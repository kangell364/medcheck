import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { patientId, medicationId } = await request.json()

    const supabase = createAdminClient()

    // Get patient info
    const { data: patient } = await supabase
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .single()

    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

    // Get medication info
    const { data: medication } = medicationId
      ? await supabase.from('medications').select('*').eq('id', medicationId).single()
      : { data: null }

    // Get alert contacts
    const { data: alertContacts } = await supabase
      .from('patient_alerts')
      .select('*')
      .eq('patient_id', patientId)

    const medName = medication?.name || 'a medication'
    const message = `⚠️ RxNudge Alert: ${patient.name} missed their ${medName} dose. Please follow up.`

    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    )

    const sentTo: string[] = []

    for (const contact of (alertContacts || [])) {
      if (contact.alert_sms && contact.phone) {
        try {
          await client.messages.create({
            to: contact.phone,
            from: process.env.TWILIO_PHONE_NUMBER!,
            body: message,
          })
          sentTo.push(`SMS:${contact.phone}`)
        } catch (e) {
          console.error('SMS send error:', e)
        }
      }
    }

    // Log the alert
    await supabase.from('alert_log').insert({
      patient_id: patientId,
      medication_id: medicationId || null,
      alert_type: 'missed_dose',
      message,
      sent_to: sentTo.join(', ') || 'nobody',
    })

    return NextResponse.json({ success: true, alertsSent: sentTo.length })
  } catch (error: any) {
    console.error('Alert check error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Get the start-of-day UTC timestamp for a given IANA timezone.
 * e.g. for America/New_York on 2026-04-10, returns the UTC equivalent of
 * midnight Eastern time on that date.
 */
function startOfDayInTz(timezone: string): Date {
  // Get the current date components in the patient's timezone
  const nowInTz = new Date().toLocaleString('en-US', { timeZone: timezone })
  const d = new Date(nowInTz)
  d.setHours(0, 0, 0, 0)
  // Re-interpret as if it's that wall-clock time in UTC for comparison purposes.
  // Actually we need the UTC instant that corresponds to midnight in the patient's timezone.
  // Use the date string approach:
  const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: timezone }) // YYYY-MM-DD
  // Construct midnight in the patient's timezone as a UTC instant
  const midnightLocal = new Date(`${dateStr}T00:00:00`)
  // Adjust: find the offset at that moment by comparing the locale string
  const utcMidnight = new Date(`${dateStr}T00:00:00.000Z`)
  // Get the actual offset for that timezone on that date
  const offsetMs = utcMidnight.getTime() - new Date(utcMidnight.toLocaleString('en-US', { timeZone: timezone })).getTime()
  return new Date(utcMidnight.getTime() + offsetMs)
}

// GET endpoint to check all patients for missed doses (can be called by a cron job)
export async function GET() {
  const supabase = createAdminClient()

  // Fetch all active patients with their timezone so we can compute
  // "start of today" per patient
  const { data: patients } = await supabase
    .from('patients')
    .select('id, timezone')
    .eq('active', true)

  // Build the earliest possible "today start" across all patients
  // (most western timezone = latest UTC midnight)
  // We query a broad window and then filter per-patient below.
  const broadTodayStart = new Date()
  broadTodayStart.setUTCHours(0, 0, 0, 0) // UTC midnight as lower bound

  const { data: missedLogs } = await supabase
    .from('dose_logs')
    .select(`
      *,
      patients(id, name, phone, owner_id, timezone),
      medications(id, name)
    `)
    .eq('confirmed', false)
    .gte('scheduled_at', broadTodayStart.toISOString())
    .is('call_sid', null)

  const processed = []
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://RxNudge.vercel.app'

  for (const log of (missedLogs || [])) {
    const patientTimezone: string = (log.patients as any)?.timezone || 'America/Chicago'

    // Determine start-of-today in the patient's timezone
    const patientTodayStart = startOfDayInTz(patientTimezone)
    const scheduledAt = new Date(log.scheduled_at)

    // Only alert if the scheduled dose is within today's window for this patient
    if (scheduledAt < patientTodayStart) {
      processed.push({ logId: log.id, ok: false, reason: 'not_today_in_patient_tz' })
      continue
    }

    // Also check: the scheduled time has actually passed in the patient's timezone
    const nowInPatientTz = new Date(new Date().toLocaleString('en-US', { timeZone: patientTimezone }))
    const scheduledInPatientTz = new Date(scheduledAt.toLocaleString('en-US', { timeZone: patientTimezone }))

    if (scheduledInPatientTz > nowInPatientTz) {
      processed.push({ logId: log.id, ok: false, reason: 'not_yet_due_in_patient_tz' })
      continue
    }

    const res = await fetch(`${appUrl}/api/alerts/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: log.patient_id,
        medicationId: log.medication_id,
      }),
    })
    processed.push({ logId: log.id, ok: res.ok })
  }

  return NextResponse.json({ processed })
}
