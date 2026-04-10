import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { createAdminClient } from '@/lib/supabase/admin'

const VoiceResponse = twilio.twiml.VoiceResponse

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN!
const TWILIO_NUMBER = process.env.TWILIO_PHONE_NUMBER!
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://RxNudge.vercel.app'

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const patientId = searchParams.get('patientId')
  const medIndex = parseInt(searchParams.get('medIndex') || '0', 10)
  const isCallbackConfirm = searchParams.get('callbackConfirm') === 'true'

  const formData = await request.formData().catch(() => null)
  const recordingUrl = formData?.get('RecordingUrl') as string | null
  const callSid = formData?.get('CallSid') as string | null

  const twiml = new VoiceResponse()
  const supabase = createAdminClient()

  if (!patientId || !recordingUrl) {
    twiml.say({ voice: 'Polly.Joanna' }, 'Sorry, there was a processing error. Goodbye.')
    twiml.hangup()
    return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
  }

  // Fetch meds and patient
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
  const currentMed = meds[medIndex]

  // Transcribe with Whisper via OpenRouter
  let transcript = ''
  try {
    // Download recording from Twilio (add .mp3 extension)
    const mp3Url = recordingUrl.endsWith('.mp3') ? recordingUrl : `${recordingUrl}.mp3`
    const audioResponse = await fetch(mp3Url, {
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
      },
    })

    if (audioResponse.ok) {
      const audioBuffer = await audioResponse.arrayBuffer()
      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' })

      const whisperForm = new FormData()
      whisperForm.append('file', audioBlob, 'recording.mp3')
      whisperForm.append('model', 'whisper-1')

      const whisperResponse = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENROUTER_KEY}`,
        },
        body: whisperForm,
      })

      if (whisperResponse.ok) {
        const whisperData = await whisperResponse.json()
        transcript = whisperData.text || ''
      }
    }
  } catch (err) {
    console.error('Transcription error:', err)
  }

  // Interpret with GPT-4o-mini
  let intent: 'YES' | 'NO' | 'UNCERTAIN' = 'UNCERTAIN'
  if (transcript) {
    try {
      const gptResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENROUTER_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are interpreting a patient response to the question: did you take your medication? Reply with exactly one word: YES, NO, or UNCERTAIN.',
            },
            { role: 'user', content: transcript },
          ],
          max_tokens: 5,
        }),
      })

      if (gptResponse.ok) {
        const gptData = await gptResponse.json()
        const raw = (gptData.choices?.[0]?.message?.content || '').trim().toUpperCase()
        if (raw === 'YES' || raw === 'NO' || raw === 'UNCERTAIN') {
          intent = raw as 'YES' | 'NO' | 'UNCERTAIN'
        }
      }
    } catch (err) {
      console.error('GPT error:', err)
    }
  }

  // If this is callback confirmation flow
  if (isCallbackConfirm) {
    const callbackId = searchParams.get('callbackId')
    if (intent === 'YES' && callbackId) {
      // Schedule callback in 1 hour
      const scheduledFor = new Date(Date.now() + 60 * 60 * 1000)
      await supabase.from('callbacks').insert({
        patient_id: patientId,
        medication_id: currentMed?.id || null,
        scheduled_for: scheduledFor.toISOString(),
      })
      twiml.say({ voice: 'Polly.Joanna' }, 'Great! I will call you back in one hour. Goodbye!')
    } else {
      twiml.say({ voice: 'Polly.Joanna' }, 'Okay, no problem. Take care and goodbye!')
    }
    twiml.hangup()
    return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
  }

  // Handle dose logging based on intent
  const scheduledAt = new Date()
  scheduledAt.setHours(0, 0, 0, 0)

  if (intent === 'YES') {
    if (currentMed) {
      await supabase.from('dose_logs').upsert(
        {
          patient_id: patientId,
          medication_id: currentMed.id,
          scheduled_at: scheduledAt.toISOString(),
          confirmed: true,
          confirmed_at: new Date().toISOString(),
          method: 'ai_call',
          call_sid: callSid,
        },
        { onConflict: 'patient_id,medication_id,scheduled_at' }
      )
    }

    // Move to next medication or hang up
    const nextIndex = medIndex + 1
    if (nextIndex < meds.length) {
      const nextUrl = `${APP_URL}/api/twilio/voice?patientId=${patientId}&medIndex=${nextIndex}`
      twiml.redirect({ method: 'POST' }, nextUrl)
    } else {
      const firstName = patient?.name?.split(' ')[0] || 'there'
      twiml.say(
        { voice: 'Polly.Joanna' },
        `Great job, ${firstName}! Your medications have all been logged. Have a wonderful day. Goodbye!`
      )
      twiml.hangup()
    }
  } else if (intent === 'NO') {
    // Ask if they want a callback
    const confirmUrl = `${APP_URL}/api/twilio/transcribe?patientId=${patientId}&medIndex=${medIndex}&callbackConfirm=true`
    twiml.say(
      { voice: 'Polly.Joanna' },
      `No problem. Would you like me to call you back in an hour as a reminder?`
    )
    twiml.record({
      maxLength: 5,
      action: confirmUrl,
      method: 'POST',
      playBeep: true,
      timeout: 5,
    })
    twiml.say({ voice: 'Polly.Joanna' }, 'Okay, take care. Goodbye!')
    twiml.hangup()
  } else {
    // UNCERTAIN — log with null confirmed, notify family
    if (currentMed) {
      await supabase.from('dose_logs').upsert(
        {
          patient_id: patientId,
          medication_id: currentMed.id,
          scheduled_at: scheduledAt.toISOString(),
          confirmed: null,
          confirmed_at: new Date().toISOString(),
          method: 'ai_call',
          call_sid: callSid,
        },
        { onConflict: 'patient_id,medication_id,scheduled_at' }
      )
    }

    // Notify family contacts via SMS
    const { data: alertContacts } = await supabase
      .from('patient_alerts')
      .select('*')
      .eq('patient_id', patientId)

    if (alertContacts && alertContacts.length > 0) {
      const twilioClient = twilio(TWILIO_SID, TWILIO_TOKEN)
      const medName = currentMed
        ? (currentMed as any).nickname || currentMed.name
        : 'medication'
      const patientName = patient?.name || 'Your patient'

      for (const contact of alertContacts) {
        if (contact.phone && contact.alert_sms) {
          await twilioClient.messages.create({
            body: `RxNudge: ${patientName} was uncertain about taking their ${medName}. Please follow up.`,
            from: TWILIO_NUMBER,
            to: contact.phone,
          }).catch(() => null)
        }
      }
    }

    // Continue to next med
    const nextIndex = medIndex + 1
    if (nextIndex < meds.length) {
      const nextUrl = `${APP_URL}/api/twilio/voice?patientId=${patientId}&medIndex=${nextIndex}`
      twiml.redirect({ method: 'POST' }, nextUrl)
    } else {
      twiml.say({ voice: 'Polly.Joanna' }, `Thank you. We weren't sure about your response, so we've notified your family. Goodbye!`)
      twiml.hangup()
    }
  }

  return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
}
