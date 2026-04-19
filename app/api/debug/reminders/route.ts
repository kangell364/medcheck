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

  // Pull dose logs for that date (using the patient's local day boundaries)
  const tz = (patient as any).timezone || 'America/Chicago'

  // Convert local midnight→UTC bounds using Intl so debug results match what the UI considers "today".
  const utcForLocal = (d: string, hhmmss: string) => {
    // Create a Date for the local wall time by formatting parts in tz and then constructing UTC.
    const approx = new Date(`${d}T${hhmmss}Z`) // seed
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(approx)

    const get = (t: string) => parts.find(p => p.type === t)?.value
    const y = get('year')
    const mo = get('month')
    const da = get('day')
    const h = get('hour')
    const mi = get('minute')
    const s = get('second')

    // Construct an ISO string and let Date parse it as UTC.
    return new Date(`${y}-${mo}-${da}T${h}:${mi}:${s}.000Z`).toISOString()
  }

  // These bounds are approximate but consistent for the patient's timezone.
  const startUtc = utcForLocal(date, '00:00:00')
  const endUtc = utcForLocal(date, '23:59:59')

  const { data: doseLogs } = await supabase
    .from('dose_logs')
    .select('id, medication_id, scheduled_at, confirmed, confirmed_at, method, created_at, updated_at')
    .eq('patient_id', patientId)
    .gte('scheduled_at', startUtc)
    .lte('scheduled_at', endUtc)
    .order('scheduled_at', { ascending: true })

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
    timezone: tz,
    patient,
    escalations: escalations || [],
    doseLogs: doseLogs || [],
    events: events || [],
  })
}
