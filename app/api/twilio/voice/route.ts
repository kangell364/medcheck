import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { createAdminClient } from '@/lib/supabase/admin'
import { requiresRecordingDisclosure, RECORDING_DISCLOSURE_TEXT } from '@/lib/recordingConsent'

const VoiceResponse = twilio.twiml.VoiceResponse

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const patientId = searchParams.get('patientId')
  const medIndex = parseInt(searchParams.get('medIndex') || '0', 10)

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
  const firstName = patient?.name?.split(' ')[0] || 'there'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://RxNudge.vercel.app'

  // Greeting for first medication
  if (medIndex === 0) {
    // Play recording disclosure ONLY in all-party consent states
    if (requiresRecordingDisclosure((patient as any)?.state)) {
      twiml.say({ voice: 'Polly.Joanna' }, RECORDING_DISCLOSURE_TEXT)
      twiml.pause({ length: 1 })
    }
    twiml.say({ voice: 'Polly.Joanna' }, `Hello ${firstName}, this is your RxNudge medication reminder.`)
    twiml.pause({ length: 1 })
  }

  // Ask about current medication using Record (spoken response)
  if (medIndex < meds.length) {
    const med = meds[medIndex]
    const callName = (med as any).nickname || med.name
    const medText = med.dosage ? `${callName}, ${med.dosage}` : callName
    const transcribeUrl = `${appUrl}/api/twilio/transcribe?patientId=${patientId}&medIndex=${medIndex}`

    twiml.say({ voice: 'Polly.Joanna' }, `Did you take your ${medText}?`)
    twiml.record({
      maxLength: 5,
      action: transcribeUrl,
      method: 'POST',
      playBeep: true,
      timeout: 5,
    })

    // Fallback if no recording
    twiml.say({ voice: 'Polly.Joanna' }, `Sorry, I didn't catch that. Moving on.`)
    const nextUrl = `${appUrl}/api/twilio/voice?patientId=${patientId}&medIndex=${medIndex + 1}`
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
