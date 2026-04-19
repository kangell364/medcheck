/**
 * GET/POST /api/calls/remind/twiml-gather
 *
 * Twilio webhook — returns TwiML for a low-cost "lifelike" call:
 * - Natural TTS voice (Polly.Joanna)
 * - <Gather> speech + DTMF (press 1/2/3 or say yes/no/some)
 *
 * This replaces the previous WebSocket Media Stream realtime bridge which does not
 * work on Vercel/Next.js App Router without a custom WS-capable server.
 */

import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { createAdminClient } from '@/lib/supabase/admin'
import { requiresRecordingDisclosure, RECORDING_DISCLOSURE_TEXT } from '@/lib/recordingConsent'

const VoiceResponse = twilio.twiml.VoiceResponse

function normIntent(raw: string): 'yes' | 'no' | 'some' | null {
  const s = (raw || '').trim().toUpperCase()
  if (!s) return null

  // DTMF
  if (s === '1') return 'yes'
  if (s === '2') return 'no'
  if (s === '3') return 'some'

  // Speech
  if (['YES', 'YEAH', 'YEP', 'YUP', 'TAKEN', 'TOOK', 'DONE'].includes(s)) return 'yes'
  if (['NO', 'NOPE', 'NOT', 'NOT YET', 'HAVENT', "HAVEN'T"].includes(s)) return 'no'
  if (['SOME', 'PARTIAL', 'A FEW'].includes(s)) return 'some'

  return null
}

function handler(request: NextRequest): NextResponse {
  const { searchParams } = new URL(request.url)
  const escalationId = searchParams.get('escalationId') || ''

  const twiml = new VoiceResponse()

  // We defer loading patient/med info until the gather result callback.
  // If we wanted to greet by name here, we can fetch escalation→patient.

  const gather = twiml.gather({
    input: ['speech', 'dtmf'],
    numDigits: 1,
    speechTimeout: 'auto',
    action: `/api/calls/remind/twiml-gather/result?escalationId=${encodeURIComponent(escalationId)}`,
    method: 'POST',
    timeout: 8,
  })

  // Speech-first, keypad secondary.
  // Twilio's type definitions restrict voice to a narrow union; runtime accepts more.
  const VOICE = (process.env.TWILIO_VOICE || 'Polly.Joanna') as any

  gather.say(
    { voice: VOICE },
    "Hi. This is RxNudge. I'm calling to help you log your medications." 
  )
  gather.pause({ length: 1 })
  gather.say(
    { voice: VOICE },
    'Did you take your medications? You can say: yes, no, or some.'
  )
  gather.pause({ length: 1 })
  gather.say(
    { voice: VOICE },
    'If it is easier, you can press 1 for yes, 2 for no, or 3 for some.'
  )

  // No input fallback: reprompt once instead of hanging up immediately.
  const reprompt = twiml.gather({
    input: ['speech', 'dtmf'],
    numDigits: 1,
    speechTimeout: 'auto',
    action: `/api/calls/remind/twiml-gather/result?escalationId=${encodeURIComponent(escalationId)}&try=2`,
    method: 'POST',
    timeout: 8,
  })

  reprompt.say(
    { voice: VOICE },
    "Sorry — I didn't catch that. Please say yes, no, or some. " +
      'Or press 1 for yes, 2 for no, or 3 for some.'
  )

  twiml.say({ voice: VOICE }, "No worries. We'll send you a text message instead. Goodbye.")
  twiml.hangup()

  return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
}

export const GET = handler
export const POST = handler
