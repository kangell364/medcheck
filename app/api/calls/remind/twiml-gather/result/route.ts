/**
 * POST /api/calls/remind/twiml-gather/result
 *
 * Receives Twilio <Gather> result and records an outcome for the escalation.
 * For now: logs call outcome and ends the call.
 *
 * Next steps (to be implemented):
 * - Build pending slot lines (slot + earlier pending)
 * - SOME flow: iterate meds one-by-one
 * - Trigger follow-up SMS at +1h for remaining
 * - Finalize remaining at +2h
 */

import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { createAdminClient } from '@/lib/supabase/admin'
import { adminLogEvent } from '@/lib/logEvent'

const VoiceResponse = twilio.twiml.VoiceResponse

function normIntent(digits: string | null, speech: string | null): 'yes' | 'no' | 'some' | 'repeat' | null {
  const raw = (digits || speech || '').trim().toUpperCase()
  if (!raw) return null

  // DTMF
  if (raw === '1') return 'yes'
  if (raw === '2') return 'no'
  if (raw === '3') return 'some'

  // Interrupts / clarifications
  if (/(WHAT|REPEAT|SAY AGAIN|CAN\s?T HEAR|CANT HEAR|WHO IS THIS|WHY ARE YOU CALLING)/.test(raw)) return 'repeat'

  // Speech intents
  if (['YES', 'YEAH', 'YEP', 'YUP', 'TAKEN', 'TOOK', 'DONE'].includes(raw)) return 'yes'
  if (['NO', 'NOPE', 'NOT', 'NOT YET', 'HAVENT', "HAVEN'T"].includes(raw)) return 'no'
  if (['SOME', 'PARTIAL', 'A FEW'].includes(raw)) return 'some'

  return null
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const escalationId = searchParams.get('escalationId')

  const twiml = new VoiceResponse()

  const form = await request.formData()
  const digits = form.get('Digits') as string | null
  const speech = form.get('SpeechResult') as string | null

  const intent = normIntent(digits, speech)

  const VOICE = process.env.TWILIO_VOICE || 'Polly.Joanna'

  if (!escalationId) {
    twiml.say({ voice: VOICE }, 'Sorry, there was an error. Goodbye.')
    twiml.hangup()
    return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
  }

  const supabase = createAdminClient()
  const { data: escalation } = await supabase
    .from('reminder_escalations')
    .select('id, patient_id, escalation_date, time_slot, medication_ids, patients(id, name, owner_id, phone)')
    .eq('id', escalationId)
    .single()

  const patient = (escalation as any)?.patients

  // Log the gather interaction for debugging.
  // (Use system_error because logEvent types are strictly enumerated.)
  if (patient?.id && patient?.owner_id) {
    await adminLogEvent({
      patientId: patient.id,
      ownerId: patient.owner_id,
      eventType: 'system_error',
      patientName: patient.name,
      customDisplayMessage: 'Call input received (debug)',
      internalDetails: { escalationId, digits, speech, intent },
    })
  }

  if (!intent) {
    // Let the reprompt in the main TwiML handle the second try. If this is already try=2,
    // we fall back to the SMS path.
    twiml.redirect({ method: 'POST' }, `/api/calls/remind/twiml-gather?escalationId=${encodeURIComponent(escalationId)}`)
    return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
  }

  if (intent === 'repeat') {
    twiml.say(
      { voice: VOICE },
      "Of course. This is RxNudge calling to help you log your medications. " +
        'Please say yes, no, or some. Or press 1 for yes, 2 for no, or 3 for some.'
    )
    twiml.redirect({ method: 'POST' }, `/api/calls/remind/twiml-gather?escalationId=${encodeURIComponent(escalationId)}`)
    return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
  }

  if (intent === 'yes') {
    twiml.say({ voice: VOICE }, 'Great. Thank you. I have logged that as taken. Goodbye.')
    twiml.hangup()
    // Mark escalation confirmed for now. Detailed per-slot dose log updates will come next.
    await supabase
      .from('reminder_escalations')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('id', escalationId)
  } else if (intent === 'no') {
    twiml.say({ voice: VOICE }, 'Okay. Thank you. I will send you a text so you can reply later. Goodbye.')
    twiml.hangup()
    await supabase
      .from('reminder_escalations')
      .update({ status: 'pending' })
      .eq('id', escalationId)
  } else {
    // SOME
    twiml.say({ voice: VOICE }, "Okay. Let's go through them one by one. We'll continue by text for now. Goodbye.")
    twiml.hangup()
    await supabase
      .from('reminder_escalations')
      .update({ status: 'pending' })
      .eq('id', escalationId)
  }

  return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
}
