/**
 * POST /api/calls/enroll
 *
 * Initiates an outbound AI enrollment call to a patient via Twilio.
 * The call connects to a Twilio Media Stream bridged to OpenAI Realtime API.
 */

import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

export async function POST(request: NextRequest) {
  try {
    const { patientId, patientName, caregiverName, patientPhone } = await request.json()

    if (!patientId || !patientName || !caregiverName || !patientPhone) {
      return NextResponse.json(
        { error: 'patientId, patientName, caregiverName, patientPhone required' },
        { status: 400 }
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rxnudge.app'
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    )

    const twimlUrl =
      `${appUrl}/api/calls/enroll/twiml` +
      `?patientId=${encodeURIComponent(patientId)}` +
      `&patientName=${encodeURIComponent(patientName)}` +
      `&caregiverName=${encodeURIComponent(caregiverName)}`

    const call = await client.calls.create({
      to: patientPhone,
      from: process.env.TWILIO_PHONE_NUMBER!,
      url: twimlUrl,
      statusCallback: `${appUrl}/api/twilio/status`,
      statusCallbackMethod: 'POST',
    })

    return NextResponse.json({ callSid: call.sid })
  } catch (error: unknown) {
    console.error('[calls/enroll] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
