/**
 * POST /api/reminders/start
 *
 * Starts the escalation chain for a patient for today:
 *  - Checks reminder_time window (±15 min)
 *  - Creates reminder_escalations row
 *  - Sends SMS #1 with bulleted med list grouped by time-of-day
 *
 * Called by cron every 15 minutes.
 * POST body: { patientId } for single patient, or empty for all eligible patients.
 */

import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { createAdminClient } from '@/lib/supabase/admin'
import { adminLogEvent } from '@/lib/logEvent'
import { getTimezoneForState } from '@/lib/stateTimezone'
import {
  buildEscalationSmsTexts,
  currentTimeOfDay,
  getTodayInTimezone,
  groupMedsByTimeOfDay,
  isQuietHours,
  ESCALATION_STEPS,
  type MedForSms,
} from '@/lib/escalation'

const REMINDER_WINDOW_MINUTES = 15

function parseTime(t: string): { hours: number; minutes: number } {
  const [h, m] = t.split(':').map(Number)
  return { hours: h, minutes: m }
}

function isInReminderWindow(reminderTime: string, timezone: string): boolean {
  const now = new Date()
  const localStr = now.toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const [lh, lm] = localStr.split(':').map(Number)
  const localMins = lh * 60 + lm
  const { hours, minutes } = parseTime(reminderTime)
  const targetMins = hours * 60 + minutes
  const diff = Math.abs(localMins - targetMins)
  return Math.min(diff, 1440 - diff) <= REMINDER_WINDOW_MINUTES
}

async function startEscalationForPatient(
  supabase: ReturnType<typeof createAdminClient>,
  twilioClient: ReturnType<typeof twilio>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patient: Record<string, any>
): Promise<{ skipped?: boolean; reason?: string; started?: boolean; escalationId?: string }> {
  if (!patient.active) return { skipped: true, reason: 'inactive' }
  if (patient.enrollment_status !== 'active') return { skipped: true, reason: 'not_enrolled' }
  if (patient.reminders_enabled === false) return { skipped: true, reason: 'reminders_disabled' }
  if (patient.sms_opted_out) return { skipped: true, reason: 'sms_opted_out' }

  const timezone = getTimezoneForState(patient.state ?? '') || patient.timezone || 'America/Chicago'

  if (isQuietHours(timezone)) return { skipped: true, reason: 'quiet_hours' }

  const today = getTodayInTimezone(timezone)

  // Active medications
  const { data: medications } = await supabase
    .from('medications')
    .select('id, name, nickname, dosage, reminder_times, start_date')
    .eq('patient_id', patient.id)
    .eq('active', true)
    .is('archived_at', null)

  if (!medications || medications.length === 0) return { skipped: true, reason: 'no_active_medications' }

  // Find meds that have a reminder_time slot within the current window
  // Each med can have multiple reminder_times e.g. ['08:00', '21:00']
  const medsToRemind = medications.filter((med: any) => {
    const times: string[] = med.reminder_times || []
    // Skip if med hasn't started yet
    if (med.start_date && med.start_date > today) return false
    return times.some((t: string) => isInReminderWindow(t, timezone))
  }) as MedForSms[]

  if (medsToRemind.length === 0) return { skipped: true, reason: 'outside_reminder_window' }

  // Get the matching time slot for the escalation key (use first matching slot)
  const matchingTime = (() => {
    for (const med of medsToRemind) {
      const times: string[] = (med as any).reminder_times || []
      const t = times.find((t: string) => isInReminderWindow(t, timezone))
      if (t) return t
    }
    return 'unknown'
  })()

  // No double-starts for same patient+date+time slot
  const { data: existing } = await supabase
    .from('reminder_escalations')
    .select('id, status')
    .eq('patient_id', patient.id)
    .eq('escalation_date', today)
    .ilike('status', '%')
    .limit(1)
    .maybeSingle()

  // Check if we already fired for this specific time slot today
  const escalationKey = `${today}:${matchingTime}`
  const { data: existingForSlot } = await supabase
    .from('reminder_escalations')
    .select('id')
    .eq('patient_id', patient.id)
    .eq('escalation_date', today)
    .eq('time_slot', matchingTime)
    .maybeSingle()

  if (existingForSlot) return { skipped: true, reason: 'already_started_for_slot', escalationId: existingForSlot.id }

  const medIds = medsToRemind.map((m: MedForSms) => m.id as string)

  // Caregiver name
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', patient.owner_id)
    .single()
  const caregiverName = profile?.full_name || 'your caregiver'

  const tod = currentTimeOfDay(timezone)
  const firstName = patient.name.split(' ')[0]
  const texts = buildEscalationSmsTexts(firstName, medsToRemind, tod, caregiverName)

  // Create escalation
  const { data: escalation, error: escError } = await supabase
    .from('reminder_escalations')
    .insert({
      patient_id: patient.id,
      medication_ids: medIds,
      escalation_date: today,
      time_slot: matchingTime,
      step: ESCALATION_STEPS.SMS1,
      status: 'pending',
    })
    .select('id')
    .single()

  if (escError || !escalation) {
    console.error('[reminders/start] Failed to create escalation:', escError)
    return { skipped: true, reason: 'db_error' }
  }

  // Send SMS #1
  try {
    const msg = await twilioClient.messages.create({
      to: patient.phone,
      from: process.env.TWILIO_PHONE_NUMBER!,
      body: texts.sms1,
    })
    await adminLogEvent({
      patientId: patient.id,
      ownerId: patient.owner_id,
      eventType: 'sms_sent',
      patientName: patient.name,
      internalDetails: { smsSid: msg.sid, escalationId: escalation.id, step: 1, timeSlot: matchingTime },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[reminders/start] SMS send failed:', msg)
    await adminLogEvent({
      patientId: patient.id,
      ownerId: patient.owner_id,
      eventType: 'sms_failed',
      patientName: patient.name,
      internalDetails: { error: msg, escalationId: escalation.id },
    })
  }

  return { started: true, escalationId: escalation.id }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as { patientId?: string }
    const supabase = createAdminClient()
    const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)

    if (body.patientId) {
      const { data: patient, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', body.patientId)
        .single()
      if (error || !patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
      const result = await startEscalationForPatient(supabase, twilioClient, patient as Record<string, unknown>)
      return NextResponse.json(result)
    }

    // Bulk — all eligible patients
    const { data: patients } = await supabase
      .from('patients')
      .select('*')
      .eq('active', true)
      .eq('enrollment_status', 'active')
      .eq('reminders_enabled', true)
      .eq('sms_opted_out', false)

    if (!patients?.length) return NextResponse.json({ processed: 0, started: 0 })

    let started = 0; let skipped = 0
    const errors: string[] = []

    for (const patient of patients) {
      try {
        const r = await startEscalationForPatient(supabase, twilioClient, patient as Record<string, unknown>)
        if (r.started) started++; else skipped++
      } catch (err: unknown) {
        errors.push(`${(patient as { id: string }).id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return NextResponse.json({ processed: patients.length, started, skipped, ...(errors.length ? { errors } : {}) })
  } catch (error: unknown) {
    console.error('[reminders/start] Unhandled error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
