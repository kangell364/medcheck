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
    const scheduledSlotLocal = `${dateStr}T${scheduledTime}:00`
    const scheduledSlotIso = new Date(scheduledSlotLocal).toISOString()
    const takenAtIso = new Date(`${dateStr}T${takenTime}:00`).toISOString()

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

    return NextResponse.json({ ok: true, scheduled_at: scheduledSlotIso, confirmed_at: takenAtIso })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
