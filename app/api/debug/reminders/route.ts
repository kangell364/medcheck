/**
 * GET /api/debug/reminders?patientId=...&date=YYYY-MM-DD
 *
 * Debug helper to diagnose why reminders/calls did or did not occur.
 * Returns escalation rows and recent admin log events.
 *
 * NOTE: This is intended for temporary troubleshooting. Consider protecting
 * with auth or removing once stable.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const patientId = searchParams.get('patientId')
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10)

  if (!patientId) {
    return NextResponse.json({ error: 'patientId required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: patient, error: patientErr } = await supabase
    .from('patients')
    .select('id, name, phone, active, enrollment_status, reminders_enabled, sms_opted_out, timezone, state, contact_method')
    .eq('id', patientId)
    .single()

  if (patientErr || !patient) {
    return NextResponse.json({ error: 'patient not found' }, { status: 404 })
  }

  const { data: escalations } = await supabase
    .from('reminder_escalations')
    .select('*')
    .eq('patient_id', patientId)
    .eq('escalation_date', date)
    .order('created_at', { ascending: true })

  // Pull recent alert_log/admin events if available
  const { data: events } = await supabase
    .from('alert_log')
    .select('id, created_at, event_type, internal_details')
    .eq('patient_id', patientId)
    .gte('created_at', `${date}T00:00:00.000Z`)
    .lte('created_at', `${date}T23:59:59.999Z`)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({
    date,
    patient,
    escalations: escalations || [],
    events: events || [],
  })
}
