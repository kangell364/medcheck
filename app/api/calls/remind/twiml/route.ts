/**
 * GET/POST /api/calls/remind/twiml
 *
 * Twilio webhook — returns TwiML that starts a Media Stream
 * connected to the OpenAI Realtime reminder bridge.
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
  const escalationId = searchParams.get('escalationId') || ''
  const patientName = searchParams.get('patientName') || ''
  const medList = searchParams.get('medList') || '[]'

  const host = request.headers.get('host') || 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'ws' : 'wss'

  const streamUrl =
    `${protocol}://${host}/api/calls/remind/stream` +
    `?escalationId=${encodeURIComponent(escalationId)}` +
    `&patientName=${encodeURIComponent(patientName)}` +
    `&medList=${encodeURIComponent(medList)}`

  return new NextResponse(buildTwiml(streamUrl), {
    headers: { 'Content-Type': 'text/xml' },
  })
}

export const GET = handler
export const POST = handler
