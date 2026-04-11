import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { createAdminClient } from '@/lib/supabase/admin'
import { adminLogEvent } from '@/lib/logEvent'

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
        } catch (e: any) {
          console.error('SMS send error:', e)
          await adminLogEvent({
            patientId,
            ownerId: patient.owner_id,
            eventType: 'sms_failed',
            patientName: patient.name,
            medicationId: medicationId || undefined,
            medicationName: medName !== 'a medication' ? medName : undefined,
            internalDetails: { error: e.message, code: e.code, status: e.status },
          })
        }
      }
    }

    // Log the missed dose event using logEvent
    await adminLogEvent({
      patientId,
      ownerId: patient.owner_id,
      eventType: 'missed_dose',
      patientName: patient.name,
      medicationId: medicationId || undefined,
      medicationName: medName !== 'a medication' ? medName : undefined,
      sentTo: sentTo.join(', ') || 'nobody',
    })

    return NextResponse.json({ success: true, alertsSent: sentTo.length })
  } catch (error: any) {
    console.error('Alert check error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Get the start-of-day UTC timestamp for a given IANA timezone.
 */
function startOfDayInTz(timezone: string): Date {
  const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: timezone }) // YYYY-MM-DD
  const utcMidnight = new Date(`${dateStr}T00:00:00.000Z`)
  const offsetMs = utcMidnight.getTime() - new Date(utcMidnight.toLocaleString('en-US', { timeZone: timezone })).getTime()
  return new Date(utcMidnight.getTime() + offsetMs)
}

// GET endpoint to check all patients for missed doses (can be called by a cron job)
export async function GET() {
  const supabase = createAdminClient()

  const { data: patients } = await supabase
    .from('patients')
    .select('id, timezone')
    .eq('active', true)

  const broadTodayStart = new Date()
  broadTodayStart.setUTCHours(0, 0, 0, 0)

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

    const patientTodayStart = startOfDayInTz(patientTimezone)
    const scheduledAt = new Date(log.scheduled_at)

    if (scheduledAt < patientTodayStart) {
      processed.push({ logId: log.id, ok: false, reason: 'not_today_in_patient_tz' })
      continue
    }

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
