import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { createAdminClient } from '@/lib/supabase/admin'

const VoiceResponse = twilio.twiml.VoiceResponse

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const patientId = searchParams.get('patientId')
  const medIndex = parseInt(searchParams.get('medIndex') || '0', 10)
  const formData = await request.formData().catch(() => null)
  const digits = formData?.get('Digits') as string | null

  const twiml = new VoiceResponse()
  const supabase = createAdminClient()

  if (!patientId) {
    twiml.say({ voice: 'Polly.Joanna' }, 'Sorry, there was an error. Goodbye.')
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    })
  }

  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('id', patientId)
    .single()

  const { data: medications } = await supabase
    .from('medications')
    .select('*')
    .eq('patient_id', patientId)
    .eq('active', true)
    .order('created_at')

  const meds = medications || []

  // Process previous answer if there is one
  if (digits !== null && medIndex > 0 && meds[medIndex - 1]) {
    const prevMed = meds[medIndex - 1]
    const confirmed = digits === '1'
    const scheduledAt = new Date()
    scheduledAt.setHours(0, 0, 0, 0)

    await supabase.from('dose_logs').upsert({
      patient_id: patientId,
      medication_id: prevMed.id,
      scheduled_at: scheduledAt.toISOString(),
      confirmed,
      confirmed_at: new Date().toISOString(),
      method: 'call',
    }, { onConflict: 'patient_id,medication_id,scheduled_at' })

    if (!confirmed) {
      // Trigger alert for missed dose
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://RxNudge.vercel.app'
      await fetch(`${appUrl}/api/alerts/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, medicationId: prevMed.id }),
      }).catch(() => null) // Non-blocking
    }
  }

  const firstName = patient?.name?.split(' ')[0] || 'there'

  // Greeting for first medication
  if (medIndex === 0) {
    twiml.say({ voice: 'Polly.Joanna' }, `Hello ${firstName}, this is your RxNudge medication reminder.`)
    twiml.pause({ length: 1 })
  }

  // Ask about current medication
  if (medIndex < meds.length) {
    const med = meds[medIndex]
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://RxNudge.vercel.app'
    const nextUrl = `${appUrl}/api/twilio/voice?patientId=${patientId}&medIndex=${medIndex + 1}`

    const gather = twiml.gather({
      numDigits: 1,
      action: nextUrl,
      method: 'POST',
      timeout: 10,
    })

    // Use nickname if set — otherwise fall back to medical name
    const callName = med.nickname || med.name
    const medText = med.dosage ? `${callName}, ${med.dosage}` : callName
    gather.say({ voice: 'Polly.Joanna' }, `Did you take your ${medText}? Press 1 for yes, or press 2 for no.`)

    // If no input, re-ask once
    twiml.say({ voice: 'Polly.Joanna' }, `Sorry, I didn't catch that. Did you take your ${callName}? Press 1 for yes or 2 for no.`)
    twiml.redirect({ method: 'POST' }, nextUrl)
  } else {
    // All medications asked — wrap up
    twiml.say(
      { voice: 'Polly.Joanna' },
      `Thank you, ${firstName}! Your medication log has been updated. Have a wonderful day. Goodbye!`
    )
    twiml.hangup()
  }

  return new NextResponse(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  })
}

// Handle GET for initial call
export async function GET(request: NextRequest) {
  return POST(request)
}
