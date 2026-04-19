/**
 * GET /api/debug/cleanup-dose-log?patientId=...&medicationId=...&scheduledTime=HH:MM&timezone=America/Chicago
 *
 * One-click cleanup: removes legacy wrong-timezone dose_logs near the intended slot.
 * Intended for troubleshooting only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { localDateTimeToUtcIso } from '@/lib/time/localToUtc'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const patientId = searchParams.get('patientId')
  const medicationId = searchParams.get('medicationId')
  const scheduledTime = searchParams.get('scheduledTime')
  const timezone = searchParams.get('timezone') || 'America/Chicago'

  if (!patientId || !medicationId || !scheduledTime) {
    return NextResponse.json({ error: 'patientId, medicationId, scheduledTime required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: timezone })
  const slotIso = localDateTimeToUtcIso({ date: dateStr, time: scheduledTime, timezone })

  const slotMs = new Date(slotIso).getTime()
  const winStart = new Date(slotMs - 8 * 60 * 60 * 1000).toISOString()
  const winEnd = new Date(slotMs + 8 * 60 * 60 * 1000).toISOString()

  const { data: nearby, error } = await supabase
    .from('dose_logs')
    .select('id, scheduled_at, confirmed, confirmed_at, method')
    .eq('patient_id', patientId)
    .eq('medication_id', medicationId)
    .gte('scheduled_at', winStart)
    .lte('scheduled_at', winEnd)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const keep = slotIso
  const toDelete = (nearby || []).filter(r => r.scheduled_at !== keep).map(r => r.id)

  if (toDelete.length) {
    const { error: delErr } = await supabase.from('dose_logs').delete().in('id', toDelete)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    timezone,
    date: dateStr,
    keepScheduledAt: keep,
    deletedIds: toDelete,
    nearbyCount: (nearby || []).length,
  })
}
