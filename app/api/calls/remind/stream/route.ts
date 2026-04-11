/**
 * GET /api/calls/remind/stream
 *
 * WebSocket endpoint: bridges Twilio Media Stream ↔ OpenAI Realtime API
 * for daily medication reminder calls.
 *
 * NOTE: Next.js App Router does not natively support WebSocket upgrades.
 * This handler returns a 426 Upgrade Required response so the caller knows
 * to use a raw WebSocket. In production, this must be handled by a custom
 * server (server.ts) or a serverless function that supports WebSocket upgrades.
 *
 * The actual bridge logic is implemented in lib/realtimeBridge.ts and invoked
 * from the custom server entry point.
 */

import { NextRequest, NextResponse } from 'next/server'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest): Promise<NextResponse> {
  return new NextResponse('WebSocket upgrade required', {
    status: 426,
    headers: {
      Upgrade: 'websocket',
      'Content-Type': 'text/plain',
    },
  })
}
