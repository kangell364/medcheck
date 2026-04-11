/**
 * GET/POST /api/calls/enroll/twiml
 *
 * Twilio webhook — returns TwiML that starts a Media Stream
 * connected to the OpenAI Realtime enrollment bridge.
 */

import { NextRequest, NextResponse } from 'next/server'

function buildTwiml(streamUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}" />
  </Connect>
</Response>`
}

function handler(request: NextRequest): NextResponse {
  const { searchParams } = new URL(request.url)
  const patientId = searchParams.get('patientId') || ''
  const patientName = searchParams.get('patientName') || ''
  const caregiverName = searchParams.get('caregiverName') || ''

  const host = request.headers.get('host') || 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'ws' : 'wss'

  const streamUrl =
    `${protocol}://${host}/api/calls/enroll/stream` +
    `?patientId=${encodeURIComponent(patientId)}` +
    `&patientName=${encodeURIComponent(patientName)}` +
    `&caregiverName=${encodeURIComponent(caregiverName)}`

  return new NextResponse(buildTwiml(streamUrl), {
    headers: { 'Content-Type': 'text/xml' },
  })
}

export const GET = handler
export const POST = handler
