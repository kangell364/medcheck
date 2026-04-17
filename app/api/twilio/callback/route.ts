import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { createAdminClient } from '@/lib/supabase/admin'
import { adminLogEvent } from '@/lib/logEvent'

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN!
const TWILIO_NUMBER = process.env.TWILIO_PHONE_NUMBER!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://RxNudge.vercel.app'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { callbackId } = body

    if (!callbackId) {
      return NextResponse.json({ error: 'callbackId required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Look up callback record
    const { data: callback, error } = await supabase
      .from('callbacks')
      .select('*, patients(*)')
      .eq('id', callbackId)
      .eq('fulfilled', false)
      .single()

    if (error || !callback) {
      return NextResponse.json({ error: 'Callback not found or already fulfilled' }, { status: 404 })
    }

    const patient = (callback as any).patients
    if (!patient?.phone) {
      return NextResponse.json({ error: 'Patient phone not available' }, { status: 400 })
    }

    // Make outbound call
    const twilioClient = twilio(TWILIO_SID, TWILIO_TOKEN)
    const callUrl = `${APP_URL}/api/twilio/voice?patientId=${callback.patient_id}&medIndex=0`

    const call = await twilioClient.calls.create({
      to: patient.phone,
      from: TWILIO_NUMBER,
      url: callUrl,
      method: 'POST',
    })

    // Mark callback as fulfilled
    await supabase
      .from('callbacks')
      .update({
        fulfilled: true,
        fulfilled_at: new Date().toISOString(),
        call_sid: call.sid,
      })
      .eq('id', callbackId)

    // Log callback fulfilled
    await adminLogEvent({
      patientId: callback.patient_id,
      ownerId: patient.owner_id,
      eventType: 'callback_fulfilled',
      patientName: patient.name,
      medicationId: callback.medication_id ?? undefined,
      medicationName: undefined,
      internalDetails: { callbackId, callSid: call.sid },
    })

    return NextResponse.json({ success: true, callSid: call.sid })
  } catch (err) {
    console.error('Callback error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
