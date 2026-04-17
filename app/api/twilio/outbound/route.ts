import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { createAdminClient } from '@/lib/supabase/admin'
import { adminLogEvent } from '@/lib/logEvent'
import { getTimezoneForState } from '@/lib/stateTimezone'

// Window (in minutes) around reminder_time within which we fire reminders
const REMINDER_WINDOW_MINUTES = 15

/**
 * Parse a TIME string from Postgres (HH:MM:SS) into { hours, minutes }.
 */
function parseTime(t: string): { hours: number; minutes: number } {
  const [h, m] = t.split(':').map(Number)
  return { hours: h, minutes: m }
}

/**
 * Return true if the patient's reminder_time falls within REMINDER_WINDOW_MINUTES
 * of the current UTC time, accounting for the patient's timezone.
 */
function isInReminderWindow(reminderTime: string, timezone: string): boolean {
  const now = new Date()
  // Current clock time in the patient's timezone
  const localTimeStr = now.toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  // localTimeStr is like "08:05"
  const [localH, localM] = localTimeStr.split(':').map(Number)
  const localMinutes = localH * 60 + localM

  const { hours, minutes } = parseTime(reminderTime)
  const targetMinutes = hours * 60 + minutes

  const diff = Math.abs(localMinutes - targetMinutes)
  // Handle midnight wrap-around (e.g., 23:55 vs 00:05)
  const wrappedDiff = Math.min(diff, 1440 - diff)
  return wrappedDiff <= REMINDER_WINDOW_MINUTES
}

/**
 * Determine whether this is the patient's first-ever outbound SMS.
 * We check dose_logs with method = 'sms' for any prior record.
 */
async function isFirstSms(supabase: ReturnType<typeof createAdminClient>, patientId: string): Promise<boolean> {
  const { count } = await supabase
    .from('dose_logs')
    .select('id', { count: 'exact', head: true })
    .eq('patient_id', patientId)
    .eq('method', 'sms')

  return (count ?? 0) === 0
}

/**
 * Build a medication list string for an SMS body.
 */
function buildMedList(medications: any[]): string {
  return medications
    .map((m: any) => {
      const name = m.nickname || m.name
      return m.dosage ? `${name} (${m.dosage})` : name
    })
    .join(', ')
}

/**
 * Send an SMS reminder to a patient. Handles opt-out footer logic.
 */
async function sendSmsReminder(
  client: ReturnType<typeof twilio>,
  supabase: ReturnType<typeof createAdminClient>,
  patient: any,
  medications: any[],
  appUrl: string
): Promise<{ sid: string } | null> {
  // Hard block on SMS opt-out — never send if patient has STOPped
  if (patient.sms_opted_out) {
    console.log(`[outbound] Skipping SMS for patient ${patient.id} — sms_opted_out`)
    return null
  }

  const firstName = patient.name.split(' ')[0]
  const medList = buildMedList(medications)
  // Keep SMS copy aligned with A2P campaign samples (clear separation + STOP/HELP language)
  // Two line breaks before compliance footer so it doesn't visually blend with the reminder.
  const footer = '\n\nReply HELP for help. Reply STOP to opt out.'

  const body = `RxNudge: Hi ${firstName} — reminder to take ${medList}. Reply YES when taken.${footer}`

  const msg = await client.messages.create({
    to: patient.phone,
    from: process.env.TWILIO_PHONE_NUMBER!,
    body,
  })

  return { sid: msg.sid }
}

/**
 * Initiate a voice call reminder to a patient.
 */
async function sendCallReminder(
  client: ReturnType<typeof twilio>,
  patient: any,
  appUrl: string
): Promise<{ sid: string }> {
  const voiceUrl = `${appUrl}/api/twilio/voice?patientId=${patient.id}`
  const statusUrl = `${appUrl}/api/twilio/status`

  const call = await client.calls.create({
    to: patient.phone,
    from: process.env.TWILIO_PHONE_NUMBER!,
    url: voiceUrl,
    statusCallback: statusUrl,
    statusCallbackMethod: 'POST',
  })

  return { sid: call.sid }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { patientId } = body as { patientId?: string }

    if (!patientId) {
      return NextResponse.json({ error: 'patientId required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Get patient with all reminder preference fields
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .single()

    if (patientError || !patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // ── Compliance / preference gates ────────────────────────────

    // 1. Reminders globally disabled for this patient
    if (patient.reminders_enabled === false) {
      return NextResponse.json({ skipped: true, reason: 'reminders_disabled' })
    }

    // 2. Patient has SMS opted out (STOP keyword received)
    //    For call-only patients this doesn't block calls, but block any SMS path.
    //    If contact_method is 'text' or 'both' AND they've opted out → skip entirely
    //    because we can't reach them via their preferred channel.
    const contactMethod: string = patient.contact_method ?? 'text'
    if (patient.sms_opted_out && contactMethod !== 'call') {
      return NextResponse.json({ skipped: true, reason: 'sms_opted_out' })
    }

    // Derive timezone from state; fall back to stored timezone for legacy rows, then default
    const timezone: string = getTimezoneForState(patient.state ?? '') || patient.timezone || 'America/Chicago'

    // ── Get active medications ────────────────────────────────────
    const { data: allMedications } = await supabase
      .from('medications')
      .select('*')
      .eq('patient_id', patientId)
      .eq('active', true)
      .is('archived_at', null)

    if (!allMedications || allMedications.length === 0) {
      return NextResponse.json({ error: 'No active medications' }, { status: 400 })
    }

    // Filter to only meds due in the current window (per reminder_times)
    // If called from TriggerCallButton (manual), include all meds
    const isManualTrigger = (body as any).manual === true
    const today = new Date().toLocaleDateString('en-CA', { timeZone: timezone })
    const medications = isManualTrigger
      ? allMedications
      : allMedications.filter((med: any) => {
          const times: string[] = med.reminder_times || []
          if (med.start_date && med.start_date > today) return false
          return times.some((t: string) => isInReminderWindow(t, timezone))
        })

    if (!isManualTrigger && medications.length === 0) {
      return NextResponse.json({ skipped: true, reason: 'no_meds_due_in_window' })
    }

    // ── Create dose log entries for today ────────────────────────
    const todayDateInPatientTz = new Date().toLocaleDateString('en-CA', { timeZone: timezone })
    const utcMidnight = new Date(`${todayDateInPatientTz}T00:00:00.000Z`)
    const offsetMs = utcMidnight.getTime() - new Date(utcMidnight.toLocaleString('en-US', { timeZone: timezone })).getTime()
    const scheduledAt = new Date(utcMidnight.getTime() + offsetMs)

    const logMethod = contactMethod === 'call' ? 'call' : 'sms'

    for (const med of medications) {
      await supabase.from('dose_logs').upsert({
        patient_id: patientId,
        medication_id: med.id,
        medication_name: med.name,
        scheduled_at: scheduledAt.toISOString(),
        confirmed: null,
        method: logMethod,
      }, { onConflict: 'patient_id,medication_id,scheduled_at' })
    }

    // ── Send via the patient's chosen contact method ──────────────
    const twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    )
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://RxNudge.vercel.app'

    const results: Record<string, string | null> = {}

    try {
      if (contactMethod === 'call') {
        // Voice call only
        const { sid } = await sendCallReminder(twilioClient, patient, appUrl)
        results.callSid = sid

        await adminLogEvent({
          patientId,
          ownerId: patient.owner_id,
          eventType: 'call_placed',
          patientName: patient.name,
          internalDetails: { callSid: sid },
        })

      } else if (contactMethod === 'text') {
        // SMS only
        const smsResult = await sendSmsReminder(twilioClient, supabase, patient, medications, appUrl)
        results.smsSid = smsResult?.sid ?? null

        if (smsResult) {
          await adminLogEvent({
            patientId,
            ownerId: patient.owner_id,
            eventType: 'sms_sent',
            patientName: patient.name,
            internalDetails: { smsSid: smsResult.sid },
          })
        }

      } else if (contactMethod === 'both') {
        // Call first, then SMS (fire-and-forget — no waiting for answer)
        const [callResult, smsResult] = await Promise.allSettled([
          sendCallReminder(twilioClient, patient, appUrl),
          sendSmsReminder(twilioClient, supabase, patient, medications, appUrl),
        ])

        if (callResult.status === 'fulfilled') {
          results.callSid = callResult.value.sid
          await adminLogEvent({
            patientId,
            ownerId: patient.owner_id,
            eventType: 'call_placed',
            patientName: patient.name,
            internalDetails: { callSid: callResult.value.sid },
          })
        } else {
          console.error('[outbound] Call failed in both-mode:', callResult.reason)
          results.callError = callResult.reason?.message ?? 'unknown'
        }

        if (smsResult.status === 'fulfilled' && smsResult.value) {
          results.smsSid = smsResult.value.sid
          await adminLogEvent({
            patientId,
            ownerId: patient.owner_id,
            eventType: 'sms_sent',
            patientName: patient.name,
            internalDetails: { smsSid: smsResult.value.sid },
          })
        } else if (smsResult.status === 'rejected') {
          console.error('[outbound] SMS failed in both-mode:', smsResult.reason)
          results.smsError = smsResult.reason?.message ?? 'unknown'
        }
      }
    } catch (err: any) {
      console.error('[outbound] Reminder error:', err)
      await adminLogEvent({
        patientId,
        ownerId: patient.owner_id,
        eventType: 'call_failed',
        patientName: patient.name,
        internalDetails: { error: err.message, code: err.code },
      })
      return NextResponse.json({ error: err.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, contactMethod, ...results })
  } catch (error: any) {
    console.error('[outbound] Unhandled error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
