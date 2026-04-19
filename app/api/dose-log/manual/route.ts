/**
 * POST /api/dose-log/manual
 *
 * Reliable manual dose logging endpoint (server-side) using the service role.
 * This avoids client-side RLS/auth issues when caregivers log doses.
 *
 * Body: {
 *   patientId: string,
 *   medicationId: string,
 *   medicationName?: string,
 *   scheduledTime: string, // HH:MM
 *   takenTime: string,     // HH:MM
 *   patientTimezone: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { localDateTimeToUtcIso } from '@/lib/time/localToUtc'

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      patientId: string
      medicationId: string
      medicationName?: string
      scheduledTime: string
      takenTime: string
      patientTimezone: string
    }

    const { patientId, medicationId, medicationName, scheduledTime, takenTime, patientTimezone } = body

    if (!patientId || !medicationId || !scheduledTime || !takenTime || !patientTimezone) {
      return NextResponse.json({ error: 'missing required fields' }, { status: 400 })
    }

    const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: patientTimezone })

    // Convert patient-local wall times into true UTC instants.
    const scheduledSlotIso = localDateTimeToUtcIso({
      date: dateStr,
      time: scheduledTime,
      timezone: patientTimezone,
    })

    const takenAtIso = localDateTimeToUtcIso({
      date: dateStr,
      time: takenTime,
      timezone: patientTimezone,
    })

    const supabase = createAdminClient()

    const { error: upsertError } = await supabase
      .from('dose_logs')
      .upsert(
        {
          patient_id: patientId,
          medication_id: medicationId,
          medication_name: medicationName ?? null,
          scheduled_at: scheduledSlotIso,
          confirmed: true,
          confirmed_at: takenAtIso,
          method: 'manual',
        } as any,
        { onConflict: 'patient_id,medication_id,scheduled_at' }
      )

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    // Cleanup legacy "wrong timezone" rows created before we converted local->UTC properly.
    // If there are other rows for the same patient+med near this time but with a different scheduled_at,
    // they can cause the UI to flip between entries.
    try {
      const slotMs = new Date(scheduledSlotIso).getTime()
      const winStart = new Date(slotMs - 8 * 60 * 60 * 1000).toISOString()
      const winEnd = new Date(slotMs + 8 * 60 * 60 * 1000).toISOString()

      const { data: nearby } = await supabase
        .from('dose_logs')
        .select('id, scheduled_at')
        .eq('patient_id', patientId)
        .eq('medication_id', medicationId)
        .gte('scheduled_at', winStart)
        .lte('scheduled_at', winEnd)

      const badIds = (nearby || [])
        .filter(r => r.scheduled_at !== scheduledSlotIso)
        .map(r => r.id)

      if (badIds.length) {
        await supabase.from('dose_logs').delete().in('id', badIds)
      }
    } catch {
      // best-effort cleanup only
    }

    return NextResponse.json({ ok: true, scheduled_at: scheduledSlotIso, confirmed_at: takenAtIso })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
