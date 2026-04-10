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

// GET endpoint to check all patients for missed doses (can be called by a cron job)
export async function GET() {
  const supabase = createAdminClient()

  // Find all patients with missed doses from the last 2 hours
  const twoHoursAgo = new Date()
  twoHoursAgo.setHours(twoHoursAgo.getHours() - 2)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: missedLogs } = await supabase
    .from('dose_logs')
    .select(`
      *,
      patients(id, name, phone, owner_id),
      medications(id, name)
    `)
    .eq('confirmed', false)
    .gte('scheduled_at', today.toISOString())
    .is('call_sid', null)

  const processed = []
  for (const log of (missedLogs || [])) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://RxNudge.vercel.app'
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
