/**
 * lib/realtimeBridge.ts
 *
 * Twilio Media Stream ↔ OpenAI Realtime API bridge.
 * Used by both the enrollment and reminder call flows.
 *
 * Usage: call createRealtimeBridge() from a custom Node.js server that has
 * access to raw WebSocket upgrade events (e.g., server.ts using the `ws` package).
 */

import WebSocket from 'ws'
import twilio from 'twilio'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CallRole = 'enroll' | 'remind'

export interface EnrollParams {
  role: 'enroll'
  patientId: string
  patientName: string
  caregiverName: string
}

export interface RemindParams {
  role: 'remind'
  escalationId: string
  patientName: string
  medList: Array<{ name: string; nickname: string | null; dosage: string | null }>
}

export type BridgeParams = EnrollParams | RemindParams

// ─── System prompts ───────────────────────────────────────────────────────────

function buildEnrollmentPrompt(patientName: string, caregiverName: string): string {
  return `You are RxNudge, a friendly medication reminder service calling ${patientName} on behalf of ${caregiverName}.
Goal: confirm they want daily medication reminders.
Rules:
- Warm, friendly, clear speech — patient may be elderly
- Can't hear → speak slower, repeat ONCE only
- Who are you → "I'm RxNudge, ${caregiverName} set up daily med reminders for you"
- yes/sure/okay/fine → CONFIRMED → warm goodbye
- no/don't want → DECLINED → acknowledge, goodbye
- call back later → say "Of course, we'll try again!" then end
- NEVER over 90 seconds
- At 60s steer: "So shall I remind you about your medications each day?"
- At 85s end: "I'll let you go — have a wonderful day ${patientName}!"
- 1-2 sentences max per response
Start by greeting ${patientName} warmly and explaining you're calling about daily medication reminders that ${caregiverName} set up.`
}

function buildReminderPrompt(
  patientName: string,
  medList: Array<{ name: string; nickname: string | null; dosage: string | null }>
): string {
  const medNames = medList
    .map(m => m.nickname || m.name)
    .join(', ')

  return `You are RxNudge calling ${patientName}. Meds to check: ${medNames}.
Goal: confirm taken OR get snooze.
- Open: "Hi ${patientName}, RxNudge here! Did you take your ${medNames} this morning?"
- YES/taken → CONFIRMED → "Perfect! Have a wonderful day ${patientName}!"
- NO/not yet → "Would you like a reminder in an hour?" → snooze or log missed
- call back/later → SNOOZED → "No problem, talk soon!"
- rambling → redirect: "That's lovely! Quick question — did you get your medications?"
- NEVER same question twice
- NEVER over 90 seconds
- At 60s steer to close
- At 85s: "I'll let you go — talk soon ${patientName}! Bye bye!"
Start by greeting ${patientName} and asking if they took their medications.`
}

// ─── Outcome detection ────────────────────────────────────────────────────────

function detectOutcome(text: string): 'confirmed' | 'declined' | null {
  const lower = text.toLowerCase()
  if (lower.includes('wonderful day') || lower.includes('goodbye') || lower.includes('bye bye')) {
    return 'confirmed'
  }
  if (lower.includes("won't bother") || lower.includes('unenrolled')) {
    return 'declined'
  }
  return null
}

// ─── Bridge factory ───────────────────────────────────────────────────────────

/**
 * Creates and manages the Twilio↔OpenAI Realtime bridge for a single call.
 *
 * @param twilioWs - The WebSocket connection from Twilio (Media Stream)
 * @param params   - Call parameters (role + identifiers)
 * @param appUrl   - Base app URL for outcome callback
 */
export function createRealtimeBridge(
  twilioWs: WebSocket,
  params: BridgeParams,
  appUrl: string
): void {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY
  if (!OPENAI_API_KEY) {
    console.error('[bridge] OPENAI_API_KEY not set')
    twilioWs.close()
    return
  }

  const systemPrompt =
    params.role === 'enroll'
      ? buildEnrollmentPrompt(params.patientName, params.caregiverName)
      : buildReminderPrompt(params.patientName, params.medList)

  // Connect to OpenAI Realtime
  const openaiWs = new WebSocket(
    'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview',
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    }
  )

  let callSid: string | null = null
  let streamSid: string | null = null
  let callOutcome: 'confirmed' | 'declined' | null = null
  let isEnded = false

  // ── Timers ──────────────────────────────────────────────────────────────────
  const timers: ReturnType<typeof setTimeout>[] = []

  function scheduleTimer(fn: () => void, delayMs: number) {
    const t = setTimeout(fn, delayMs)
    timers.push(t)
  }

  function clearAllTimers() {
    for (const t of timers) clearTimeout(t)
  }

  function endCall() {
    if (isEnded) return
    isEnded = true
    clearAllTimers()

    // Report outcome
    if (params.role === 'remind' && params.escalationId) {
      const outcome = callOutcome === 'confirmed' ? 'confirmed' : 'timeout'
      fetch(`${appUrl}/api/calls/outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          escalationId: params.escalationId,
          outcome,
        }),
      }).catch(e => console.error('[bridge] Outcome report failed:', e))
    }

    // Hang up via Twilio REST if we have callSid
    if (callSid) {
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID!,
        process.env.TWILIO_AUTH_TOKEN!
      )
      client.calls(callSid).update({ status: 'completed' }).catch(() => {/* ignore */})
    }

    try { openaiWs.close() } catch { /* ignore */ }
    try { twilioWs.close() } catch { /* ignore */ }
  }

  function sendToOpenAI(msg: object) {
    if (openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.send(JSON.stringify(msg))
    }
  }

  function injectMessage(text: string) {
    sendToOpenAI({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'system',
        content: [{ type: 'input_text', text }],
      },
    })
    sendToOpenAI({ type: 'response.create' })
  }

  // ── OpenAI events ───────────────────────────────────────────────────────────
  openaiWs.on('open', () => {
    // Configure session
    sendToOpenAI({
      type: 'session.update',
      session: {
        voice: 'alloy',
        instructions: systemPrompt,
        turn_detection: { type: 'server_vad' },
        input_audio_format: 'g711_ulaw',
        output_audio_format: 'g711_ulaw',
        modalities: ['text', 'audio'],
      },
    })

    // Kick off the conversation
    sendToOpenAI({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'Hello' }],
      },
    })
    sendToOpenAI({ type: 'response.create' })

    // 60-second: steer to close
    scheduleTimer(() => {
      injectMessage('STEER TO CLOSE NOW')
    }, 60_000)

    // 85-second: end gracefully
    scheduleTimer(() => {
      injectMessage('END THE CALL NOW GRACEFULLY')
    }, 85_000)

    // 90-second: hard cap
    scheduleTimer(() => {
      console.log('[bridge] 90s hard cap — ending call')
      endCall()
    }, 90_000)
  })

  openaiWs.on('message', (raw: WebSocket.RawData) => {
    try {
      const event = JSON.parse(raw.toString()) as Record<string, unknown>

      if (event.type === 'response.audio.delta') {
        // Forward audio to Twilio
        const delta = event.delta as string
        if (streamSid && delta) {
          const payload = JSON.stringify({
            event: 'media',
            streamSid,
            media: { payload: delta },
          })
          if (twilioWs.readyState === WebSocket.OPEN) {
            twilioWs.send(payload)
          }
        }
      } else if (event.type === 'response.text.delta') {
        // Check assistant text for outcome signals
        const delta = ((event.delta as string) || '').toLowerCase()
        if (!callOutcome) {
          const detected = detectOutcome(delta)
          if (detected) {
            callOutcome = detected
          }
        }
      } else if (event.type === 'response.done') {
        // Check for goodbye signals after full response
        const response = event.response as Record<string, unknown> | undefined
        const output = response?.output as Array<Record<string, unknown>> | undefined
        if (output) {
          for (const item of output) {
            const content = item.content as Array<Record<string, unknown>> | undefined
            if (content) {
              for (const c of content) {
                if (c.type === 'text') {
                  const detected = detectOutcome((c.text as string) || '')
                  if (detected && !callOutcome) callOutcome = detected
                }
              }
            }
          }
        }

        // End call if outcome detected
        if (callOutcome) {
          scheduleTimer(() => endCall(), 2000)
        }
      } else if (event.type === 'error') {
        console.error('[bridge] OpenAI error:', event.error)
      }
    } catch (e) {
      console.error('[bridge] Parse error:', e)
    }
  })

  openaiWs.on('close', () => {
    if (!isEnded) endCall()
  })

  openaiWs.on('error', (err) => {
    console.error('[bridge] OpenAI WebSocket error:', err)
    endCall()
  })

  // ── Twilio events ───────────────────────────────────────────────────────────
  twilioWs.on('message', (raw: WebSocket.RawData) => {
    try {
      const event = JSON.parse(raw.toString()) as Record<string, unknown>

      switch (event.event as string) {
        case 'start': {
          const start = event.start as Record<string, unknown>
          streamSid = (start?.streamSid as string) || null
          callSid = (start?.callSid as string) || null
          break
        }

        case 'media': {
          const media = event.media as Record<string, unknown>
          const payload = media?.payload as string
          if (payload && openaiWs.readyState === WebSocket.OPEN) {
            sendToOpenAI({
              type: 'input_audio_buffer.append',
              audio: payload,
            })
          }
          break
        }

        case 'stop':
          endCall()
          break
      }
    } catch (e) {
      console.error('[bridge] Twilio parse error:', e)
    }
  })

  twilioWs.on('close', () => {
    if (!isEnded) endCall()
  })

  twilioWs.on('error', (err) => {
    console.error('[bridge] Twilio WebSocket error:', err)
    endCall()
  })
}
