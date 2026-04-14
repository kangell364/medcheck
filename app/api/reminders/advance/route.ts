/**
 * POST /api/reminders/advance
 *
 * Advances pending escalations to the next step.
 * Called by cron every 15 minutes.
 *
 * Step transitions:
 *  step=1 pending >30min → SMS #2, step=2
 *  step=2 pending >30min + contact_method != 'text' → AI call, step=3
 *  step=2 pending >30min + contact_method = 'text' → SMS #3, step=4
 *  status=snoozed + snoozed_until < NOW() → SMS #3, step=4, status=pending
 *  step=4 pending >30min → SMS #4 (final), step=5
 *  step=5 pending >30min → mark missed, caregiver alert, step=6, status=missed
 */

import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { createAdminClient } from '@/lib/supabase/admin'
import { adminLogEvent } from '@/lib/logEvent'
import {
  buildEscalationSmsTexts,
  currentTimeOfDay,
  groupMedsByTimeOfDay,
  type MedForSms,
} from '@/lib/escalation'
import { getTimezoneForState } from '@/lib/stateTimezone'

const STEP_WAIT_MS = 30 * 60 * 1000 // 30 minutes

function minutesAgo(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / 60000
}

async function getEscalationContext(
  supabase: ReturnType<typeof createAdminClient>,
  escalation: Record<string, unknown>
) {
  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('id', escalation.patient_id as string)
    .single()

  if (!patient) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', patient.owner_id)
    .single()

  const timezone =
    getTimezoneForState(patient.state ?? '') || patient.timezone || 'America/Chicago'
  const caregiverName = profile?.full_name || 'your caregiver'
  const firstName = (patient.name as string).split(' ')[0]

  // Fetch meds for this escalation
  const medIds = escalation.medication_ids as string[]
  const { data: medications } = await supabase
    .from('medications')
    .select('id, name, nickname, dosage, reminder_times')
    .in('id', medIds)

  const tod = currentTimeOfDay(timezone)
  const meds: MedForSms[] = medications || []
  const medsForTod = groupMedsByTimeOfDay(meds, tod)
  const medsToUse = medsForTod.length > 0 ? medsForTod : meds

  const texts = buildEscalationSmsTexts(firstName, medsToUse, tod, caregiverName)

  return {
    patient,
    caregiverName,
    firstName,
    timezone,
    texts,
    medsToUse,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function advanceEscalation(
  supabase: ReturnType<typeof createAdminClient>,
  twilioClient: ReturnType<typeof twilio>,
  escalation: Record<string, unknown>,
  appUrl: string
): Promise<{ advanced: boolean; reason?: string }> {
  const status = escalation.status as string
  const step = escalation.step as number
  const updatedAt = escalation.updated_at as string
  const createdAt = escalation.created_at as string
  const escalationId = escalation.id as string

  const ctx = await getEscalationContext(supabase, escalation)
  if (!ctx) return { advanced: false, reason: 'patient_not_found' }

  const { patient, caregiverName, firstName, texts, medsToUse } = ctx
  const contactMethod: string = patient.contact_method ?? 'text'

  // ── SNOOZED: check if snooze expired ──────────────────────────
  if (status === 'snoozed') {
    const snoozedUntil = escalation.snoozed_until as string | null
    if (!snoozedUntil || new Date(snoozedUntil) > new Date()) {
      return { advanced: false, reason: 'snooze_not_expired' }
    }

    // Snooze expired — send SMS #3 (post-snooze)
    await supabase
      .from('reminder_escalations')
      .update({ step: 4, status: 'pending' })
      .eq('id', escalationId)

    try {
      const msg = await twilioClient.messages.create({
        to: patient.phone as string,
        from: process.env.TWILIO_PHONE_NUMBER!,
        body: texts.finalSms,
      })
      await adminLogEvent({
        patientId: patient.id as string,
        ownerId: patient.owner_id as string,
        eventType: 'sms_sent',
        patientName: patient.name as string,
        internalDetails: { smsSid: msg.sid, escalationId, step: 4, trigger: 'snooze_expired' },
      })
    } catch (e: unknown) {
      console.error('[advance] SMS failed (snooze-expired):', e)
    }
    return { advanced: true }
  }

  // CALL-ONLY mode: we skip SMS steps entirely.
  // If an old escalation exists at step 1 or 2, advance it straight to CALL.
  if (status === 'pending' && (step === 1 || step === 2)) {
    // wait the usual 30 minutes since last touch before placing a call
    const refTs = step === 1 ? createdAt : updatedAt
    if (minutesAgo(refTs) < 30) return { advanced: false, reason: 'too_soon' }

    await supabase
      .from('reminder_escalations')
      .update({ step: 3 })
      .eq('id', escalationId)

    try {
      const medList = medsToUse.map((m: MedForSms) => ({
        name: m.name,
        nickname: m.nickname ?? null,
        dosage: m.dosage ?? null,
      }))

      await fetch(`${appUrl}/api/calls/remind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          escalationId,
          patientName: patient.name as string,
          patientPhone: patient.phone as string,
          medList,
        }),
      })

      await adminLogEvent({
        patientId: patient.id as string,
        ownerId: patient.owner_id as string,
        eventType: 'call_placed',
        patientName: patient.name as string,
        internalDetails: { escalationId, step: 3, mode: 'call_only' },
      })
    } catch (e: unknown) {
      console.error('[advance] AI call trigger failed:', e)
    }

    return { advanced: true }
  }

  // ── STEP 4 → 5: final SMS ─────────────────────────────────────
  if (status === 'pending' && step === 4) {
    if (minutesAgo(updatedAt) < 30) return { advanced: false, reason: 'too_soon' }

    await supabase
      .from('reminder_escalations')
      .update({ step: 5 })
      .eq('id', escalationId)

    const sms4 = `💊 One last check-in, ${firstName}! Reply YES to log your medications as taken today.`

    try {
      const msg = await twilioClient.messages.create({
        to: patient.phone as string,
        from: process.env.TWILIO_PHONE_NUMBER!,
        body: sms4,
      })
      await adminLogEvent({
        patientId: patient.id as string,
        ownerId: patient.owner_id as string,
        eventType: 'sms_sent',
        patientName: patient.name as string,
        internalDetails: { smsSid: msg.sid, escalationId, step: 5 },
      })
    } catch (e: unknown) {
      console.error('[advance] SMS #4 failed:', e)
    }
    return { advanced: true }
  }

  // ── STEP 5 → 6: mark missed + caregiver alert ─────────────────
  if (status === 'pending' && step === 5) {
    if (minutesAgo(updatedAt) < 30) return { advanced: false, reason: 'too_soon' }

    await supabase
      .from('reminder_escalations')
      .update({ step: 6, status: 'missed', caregiver_alerted: true })
      .eq('id', escalationId)

    // Alert caregiver
    const { data: alerts } = await supabase
      .from('patient_alerts')
      .select('phone, alert_sms')
      .eq('patient_id', patient.id as string)
      .eq('alert_sms', true)

    const caregiverAlert = `⚠️ ${patient.name as string} has not confirmed taking their medications today. You may want to check in.`

    for (const alert of alerts || []) {
      if (!alert.phone) continue
      try {
        await twilioClient.messages.create({
          to: alert.phone as string,
          from: process.env.TWILIO_PHONE_NUMBER!,
          body: caregiverAlert,
        })
      } catch (e: unknown) {
        console.error('[advance] Caregiver alert failed:', e)
      }
    }

    await adminLogEvent({
      patientId: patient.id as string,
      ownerId: patient.owner_id as string,
      eventType: 'missed_dose',
      patientName: patient.name as string,
      internalDetails: { escalationId, step: 6, caregiverAlerts: (alerts || []).length },
    })
    return { advanced: true }
  }

  return { advanced: false, reason: 'no_transition' }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    )
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rxnudge.app'

    // Get all pending/snoozed escalations for today
    const today = new Date().toISOString().slice(0, 10)
    const { data: escalations } = await supabase
      .from('reminder_escalations')
      .select('*')
      .eq('escalation_date', today)
      .in('status', ['pending', 'snoozed'])

    if (!escalations?.length) {
      return NextResponse.json({ processed: 0, advanced: 0 })
    }

    let advanced = 0
    let skipped = 0
    const errors: string[] = []

    for (const escalation of escalations) {
      try {
        const result = await advanceEscalation(
          supabase,
          twilioClient,
          escalation as Record<string, unknown>,
          appUrl
        )
        if (result.advanced) advanced++
        else skipped++
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`${(escalation as { id: string }).id}: ${msg}`)
        console.error('[advance] Error processing escalation:', msg)
      }
    }

    return NextResponse.json({
      processed: escalations.length,
      advanced,
      skipped,
      ...(errors.length ? { errors } : {}),
    })
  } catch (error: unknown) {
    console.error('[reminders/advance] Unhandled error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
