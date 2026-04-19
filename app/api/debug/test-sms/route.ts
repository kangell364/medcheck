/**
 * POST /api/debug/test-sms
 *
 * Sends a single A2P-style reminder SMS to the given number.
 * Intended for low-volume testing only.
 *
 * Body: { to: string, patientId?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { createAdminClient } from '@/lib/supabase/admin'
import { adminLogEvent } from '@/lib/logEvent'

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { to?: string; patientId?: string }
    const to = body.to

    if (!to) return NextResponse.json({ error: 'to required (E.164 like +1979...)' }, { status: 400 })

    const from = process.env.TWILIO_PHONE_NUMBER
    if (!from) return NextResponse.json({ error: 'TWILIO_PHONE_NUMBER not configured' }, { status: 500 })

    const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)

    const msg =
      `💊 RxNudge test reminder: Reply YES if you took your medications.\n\n` +
      `Reply STOP to opt out. Reply HELP for help.`

    const res = await client.messages.create({ to, from, body: msg })

    // If they provided a patientId, log it for visibility.
    if (body.patientId) {
      const supabase = createAdminClient()
      const { data: patient } = await supabase
        .from('patients')
        .select('id, name, owner_id')
        .eq('id', body.patientId)
        .single()

      if (patient) {
        await adminLogEvent({
          patientId: patient.id,
          ownerId: patient.owner_id,
          eventType: 'sms_sent',
          patientName: patient.name,
          sentTo: to,
          internalDetails: { testSms: true, sid: res.sid },
        })
      }
    }

    return NextResponse.json({ ok: true, sid: res.sid })
  } catch (err: unknown) {
    console.error('[debug/test-sms] error', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
