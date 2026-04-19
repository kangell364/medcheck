/**
 * POST /api/debug/test-call
 *
 * Force-trigger a reminder call immediately (bypasses reminder window).
 * Intended for troubleshooting only.
 *
 * Body: { patientId: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { adminLogEvent } from '@/lib/logEvent'

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { patientId?: string }
    const patientId = body.patientId
    if (!patientId) return NextResponse.json({ error: 'patientId required' }, { status: 400 })

    const supabase = createAdminClient()

    const { data: patient } = await supabase
      .from('patients')
      .select('id, name, phone, owner_id, active, enrollment_status, reminders_enabled, sms_opted_out')
      .eq('id', patientId)
      .single()

    if (!patient) return NextResponse.json({ error: 'patient not found' }, { status: 404 })

    // Create a minimal escalation row so call flows have an escalationId.
    const today = new Date().toISOString().slice(0, 10)
    const { data: escalation, error: escErr } = await supabase
      .from('reminder_escalations')
      .insert({
        patient_id: patient.id,
        medication_ids: [],
        escalation_date: today,
        time_slot: 'test',
        step: 3,
        status: 'pending',
      })
      .select('id')
      .single()

    if (escErr || !escalation) {
      return NextResponse.json({ error: 'failed to create escalation', details: String(escErr?.message || escErr) }, { status: 500 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.rxnudge.app'
    const resp = await fetch(`${appUrl}/api/calls/remind`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        escalationId: escalation.id,
        patientName: patient.name,
        patientPhone: patient.phone,
        medList: [],
      }),
    })

    const text = await resp.text()

    await adminLogEvent({
      patientId: patient.id,
      ownerId: patient.owner_id,
      eventType: resp.ok ? 'call_placed' : 'call_failed',
      patientName: patient.name,
      internalDetails: { testCall: true, status: resp.status, body: text, escalationId: escalation.id },
    })

    return NextResponse.json({ ok: resp.ok, status: resp.status, escalationId: escalation.id, response: text })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
