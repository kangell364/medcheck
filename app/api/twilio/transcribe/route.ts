import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { createAdminClient } from '@/lib/supabase/admin'
import { adminLogEvent } from '@/lib/logEvent'

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
  // We support: YES / NO / CALL_LATER / REPEAT / WHY_CALLING / UNCERTAIN
  type Intent = 'YES' | 'NO' | 'CALL_LATER' | 'REPEAT' | 'WHY_CALLING' | 'UNCERTAIN'
  let intent: Intent = 'UNCERTAIN'

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
                "You are classifying a patient's spoken reply during an RxNudge medication reminder call. Reply with exactly ONE token from: YES, NO, CALL_LATER, REPEAT, WHY_CALLING, UNCERTAIN.\n\nGuidance:\n- YES: they took it (yep, yes, already did, I took it, done).\n- NO: they did not take it.\n- CALL_LATER: ask to call back later / not now / busy / call me in an hour.\n- REPEAT: what did you say / say again / repeat.\n- WHY_CALLING: why are you calling / who is this.\n- UNCERTAIN: anything else.",
            },
            { role: 'user', content: transcript },
          ],
          max_tokens: 8,
        }),
      })

      if (gptResponse.ok) {
        const gptData = await gptResponse.json()
        const raw = (gptData.choices?.[0]?.message?.content || '').trim().toUpperCase()
        if (['YES', 'NO', 'CALL_LATER', 'REPEAT', 'WHY_CALLING', 'UNCERTAIN'].includes(raw)) {
          intent = raw as Intent
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

      // Log callback scheduled
      if (patient) {
        await adminLogEvent({
          patientId,
          ownerId: patient.owner_id,
          eventType: 'callback_scheduled',
          patientName: patient.name,
          medicationId: currentMed?.id,
          medicationName: currentMed?.name,
          internalDetails: { callbackId, scheduledFor: scheduledFor.toISOString() },
        })
      }

      twiml.say({ voice: 'Polly.Joanna' }, 'Great! I will call you back in one hour. Goodbye!')
    } else {
      twiml.say({ voice: 'Polly.Joanna' }, 'Okay, no problem. Take care and goodbye!')
    }
    twiml.hangup()
    return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
  }

  // Handle dose logging based on intent.
  const patientTimezone: string = patient?.timezone || 'America/Chicago'
  const todayDateInPatientTz = new Date().toLocaleDateString('en-CA', { timeZone: patientTimezone })
  const utcMidnight = new Date(`${todayDateInPatientTz}T00:00:00.000Z`)
  const tzOffsetMs = utcMidnight.getTime() - new Date(utcMidnight.toLocaleString('en-US', { timeZone: patientTimezone })).getTime()
  const scheduledAt = new Date(utcMidnight.getTime() + tzOffsetMs)

  if (intent === 'CALL_LATER') {
    // Always schedule callback in 1 hour, do NOT mark missed.
    const scheduledFor = new Date(Date.now() + 60 * 60 * 1000)
    await supabase.from('callbacks').insert({
      patient_id: patientId,
      medication_id: currentMed?.id || null,
      scheduled_for: scheduledFor.toISOString(),
    })

    if (patient) {
      await adminLogEvent({
        patientId,
        ownerId: patient.owner_id,
        eventType: 'callback_scheduled',
        patientName: patient.name,
        medicationId: currentMed?.id,
        medicationName: currentMed?.name,
        internalDetails: { callSid, transcript, scheduledFor: scheduledFor.toISOString(), reason: 'call_later' },
      })
    }

    const firstName = patient?.name?.split(' ')[0] || 'there'
    twiml.say({ voice: 'Polly.Joanna' }, `No problem, ${firstName}. I'll call you back in one hour. Goodbye!`)
    twiml.hangup()
  } else if (intent === 'REPEAT') {
    const medText = currentMed ? ((currentMed as any).nickname || currentMed.name) : 'your medication'
    twiml.say({ voice: 'Polly.Joanna' }, `Sure. Did you take your ${medText}?`)
    const transcribeUrl = `${APP_URL}/api/twilio/transcribe?patientId=${patientId}&medIndex=${medIndex}`
    twiml.record({
      maxLength: 5,
      action: transcribeUrl,
      method: 'POST',
      playBeep: true,
      timeout: 5,
    })
    twiml.say({ voice: 'Polly.Joanna' }, `Sorry, I didn't catch that. Moving on.`)
    const nextUrl = `${APP_URL}/api/twilio/voice?patientId=${patientId}&medIndex=${medIndex + 1}`
    twiml.redirect({ method: 'POST' }, nextUrl)
  } else if (intent === 'WHY_CALLING') {
    const firstName = patient?.name?.split(' ')[0] || 'there'
    const medText = currentMed ? ((currentMed as any).nickname || currentMed.name) : 'your medication'
    twiml.say({ voice: 'Polly.Joanna' }, `Hi ${firstName}. I'm Polly, your AI assistant from RxNudge. I'm calling to check on your medication reminder.`)
    twiml.pause({ length: 1 })
    twiml.say({ voice: 'Polly.Joanna' }, `Did you take your ${medText}?`)
    const transcribeUrl = `${APP_URL}/api/twilio/transcribe?patientId=${patientId}&medIndex=${medIndex}`
    twiml.record({
      maxLength: 5,
      action: transcribeUrl,
      method: 'POST',
      playBeep: true,
      timeout: 5,
    })
    twiml.say({ voice: 'Polly.Joanna' }, `Sorry, I didn't catch that. Moving on.`)
    const nextUrl = `${APP_URL}/api/twilio/voice?patientId=${patientId}&medIndex=${medIndex + 1}`
    twiml.redirect({ method: 'POST' }, nextUrl)
  } else if (intent === 'YES') {
    if (currentMed) {
      await supabase.from('dose_logs').upsert(
        {
          patient_id: patientId,
          medication_id: currentMed.id,
          medication_name: currentMed.name,
          scheduled_at: scheduledAt.toISOString(),
          confirmed: true,
          confirmed_at: new Date().toISOString(),
          method: 'ai_call',
          call_sid: callSid,
        },
        { onConflict: 'patient_id,medication_id,scheduled_at' }
      )

      // Log dose confirmed via call
      if (patient) {
        await adminLogEvent({
          patientId,
          ownerId: patient.owner_id,
          eventType: 'dose_confirmed_call',
          patientName: patient.name,
          medicationId: currentMed.id,
          medicationName: currentMed.name,
          internalDetails: { callSid, transcript },
        })
      }
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
    // Log dose declined via call
    if (patient && currentMed) {
      await adminLogEvent({
        patientId,
        ownerId: patient.owner_id,
        eventType: 'dose_declined_call',
        patientName: patient.name,
        medicationId: currentMed.id,
        medicationName: currentMed.name,
        internalDetails: { callSid, transcript },
      })
    }

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
    // UNCERTAIN — brief conversational response + steer back.
    // Do NOT mark missed immediately. If still not confirmed, schedule a 1-hour callback.

    const firstName = patient?.name?.split(' ')[0] || 'there'
    const medText = currentMed ? ((currentMed as any).nickname || currentMed.name) : 'your medication'

    let reply = ''
    try {
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
                "You are Polly, an AI assistant on a medication reminder phone call. Be brief (1-2 sentences). Answer the patient's question if possible, but do not give medical advice. Always end by returning to: asking if they took the medication.",
            },
            {
              role: 'user',
              content: `Patient (${firstName}) said: ${transcript}\n\nContext: You are calling about: ${medText}.`,
            },
          ],
          max_tokens: 120,
        }),
      })

      if (resp.ok) {
        const j = await resp.json()
        reply = (j.choices?.[0]?.message?.content || '').trim()
      }
    } catch {
      // ignore
    }

    if (!reply) {
      reply = `No problem, ${firstName}. Just to confirm—did you take your ${medText}?`
    }

    twiml.say({ voice: 'Polly.Joanna' }, reply)

    // One more try to capture a clear YES/NO
    const transcribeUrl = `${APP_URL}/api/twilio/transcribe?patientId=${patientId}&medIndex=${medIndex}`
    twiml.record({
      maxLength: 6,
      action: transcribeUrl,
      method: 'POST',
      playBeep: true,
      timeout: 6,
    })

    // If still no clear answer (no recording / unclear), schedule callback in 1 hour.
    const scheduledFor = new Date(Date.now() + 60 * 60 * 1000)
    await supabase.from('callbacks').insert({
      patient_id: patientId,
      medication_id: currentMed?.id || null,
      scheduled_for: scheduledFor.toISOString(),
    })

    if (patient) {
      await adminLogEvent({
        patientId,
        ownerId: patient.owner_id,
        eventType: 'callback_scheduled',
        patientName: patient.name,
        medicationId: currentMed?.id,
        medicationName: currentMed?.name,
        internalDetails: { callSid, transcript, scheduledFor: scheduledFor.toISOString(), reason: 'uncertain_then_callback' },
      })
    }

    twiml.say({ voice: 'Polly.Joanna' }, `Okay ${firstName}. I'll call you back in one hour. Goodbye!`)
    twiml.hangup()
  }

  return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
}
