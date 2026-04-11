/**
 * POST /api/calls/remind
 *
 * Initiates an outbound AI reminder call to a patient via Twilio.
 * The call connects to a Twilio Media Stream bridged to OpenAI Realtime API.
 */

import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

export interface MedListItem {
  name: string
  nickname: string | null
  dosage: string | null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { escalationId, patientName, patientPhone, medList } = body as {
      escalationId: string
      patientName: string
      patientPhone: string
      medList: MedListItem[]
    }

    if (!escalationId || !patientName || !patientPhone) {
      return NextResponse.json(
        { error: 'escalationId, patientName, patientPhone required' },
        { status: 400 }
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rxnudge.app'
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    )

    const medListEncoded = encodeURIComponent(JSON.stringify(medList || []))

    const twimlUrl =
      `${appUrl}/api/calls/remind/twiml` +
      `?escalationId=${encodeURIComponent(escalationId)}` +
      `&patientName=${encodeURIComponent(patientName)}` +
      `&medList=${medListEncoded}`

    const call = await client.calls.create({
      to: patientPhone,
      from: process.env.TWILIO_PHONE_NUMBER!,
      url: twimlUrl,
      statusCallback: `${appUrl}/api/twilio/status`,
      statusCallbackMethod: 'POST',
    })

    return NextResponse.json({ callSid: call.sid })
  } catch (error: unknown) {
    console.error('[calls/remind] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
