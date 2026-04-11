import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { patientId } = await request.json()

    if (!patientId) {
      return NextResponse.json({ error: 'patientId required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Get patient
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .single()

    if (patientError || !patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Get active medications
    const { data: medications } = await supabase
      .from('medications')
      .select('*')
      .eq('patient_id', patientId)
      .eq('active', true)

    if (!medications || medications.length === 0) {
      return NextResponse.json({ error: 'No active medications' }, { status: 400 })
    }

    // Create dose log entries for today.
    // Use midnight in the patient's timezone as the canonical "scheduled_at" for today.
    const patientTimezone: string = patient.timezone || 'America/Chicago'
    const todayDateInPatientTz = new Date().toLocaleDateString('en-CA', { timeZone: patientTimezone }) // YYYY-MM-DD
    // Compute the UTC timestamp for midnight in the patient's timezone
    const utcMidnight = new Date(`${todayDateInPatientTz}T00:00:00.000Z`)
    const offsetMs = utcMidnight.getTime() - new Date(utcMidnight.toLocaleString('en-US', { timeZone: patientTimezone })).getTime()
    const scheduledAt = new Date(utcMidnight.getTime() + offsetMs)

    // Create pending dose logs
    for (const med of medications) {
      await supabase.from('dose_logs').upsert({
        patient_id: patientId,
        medication_id: med.id,
        medication_name: med.name,
        scheduled_at: scheduledAt.toISOString(),
        confirmed: null,
        method: 'call',
      }, { onConflict: 'patient_id,medication_id,scheduled_at' })
    }

    // Initiate Twilio call
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    )

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://RxNudge.vercel.app'
    const voiceUrl = `${appUrl}/api/twilio/voice?patientId=${patientId}`
    const statusUrl = `${appUrl}/api/twilio/status`

    const call = await client.calls.create({
      to: patient.phone,
      from: process.env.TWILIO_PHONE_NUMBER!,
      url: voiceUrl,
      statusCallback: statusUrl,
      statusCallbackMethod: 'POST',
    })

    return NextResponse.json({ success: true, callSid: call.sid })
  } catch (error: any) {
    console.error('Outbound call error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
