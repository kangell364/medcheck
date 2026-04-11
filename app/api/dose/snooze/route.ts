import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { adminLogEvent } from '@/lib/logEvent'

// Check if a scheduled time (HH:MM) has passed in the patient's timezone
function isScheduledTimeDue(scheduledTime: string, patientTimezone: string): boolean {
  try {
    const [hour, minute] = scheduledTime.split(':').map(Number)
    const patientNow = new Date(new Date().toLocaleString('en-US', { timeZone: patientTimezone }))
    const scheduledMinutes = hour * 60 + minute
    const currentMinutes = patientNow.getHours() * 60 + patientNow.getMinutes()
    return currentMinutes >= scheduledMinutes
  } catch {
    return true
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { patientId, medicationId, scheduledAt, hours, scheduledTime } = body

    if (!patientId || !medicationId || !scheduledAt || ![1, 2].includes(hours)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Fetch medication for name + reminder_times
    const { data: medication, error: medError } = await supabase
      .from('medications')
      .select('name, reminder_times')
      .eq('id', medicationId)
      .single()

    if (medError || !medication) {
      return NextResponse.json({ error: 'Medication not found' }, { status: 404 })
    }

    // ── Server-side validation: is the medication actually due? ──────────────
    const timeToCheck: string | null = scheduledTime ?? (medication.reminder_times?.[0] ?? null)

    if (timeToCheck) {
      const { data: patient } = await supabase
        .from('patients')
        .select('timezone, owner_id, name')
        .eq('id', patientId)
        .single()

      const tz = patient?.timezone || 'America/Chicago'

      if (!isScheduledTimeDue(timeToCheck, tz)) {
        return NextResponse.json({ error: 'Medication is not yet due' }, { status: 400 })
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const snoozeUntil = new Date(Date.now() + hours * 60 * 60 * 1000)

    const { error } = await supabase.from('dose_logs').upsert(
      {
        patient_id: patientId,
        medication_id: medicationId,
        medication_name: medication.name ?? null,
        scheduled_at: scheduledAt,
        confirmed: null,
        method: 'snooze',
        snooze_until: snoozeUntil.toISOString(),
      },
      { onConflict: 'patient_id,medication_id,scheduled_at' }
    )

    if (error) {
      console.error('Snooze upsert error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // ── Schedule a callback call at snooze_until ─────────────────────────────
    const { error: callbackError } = await supabase.from('callbacks').insert({
      patient_id: patientId,
      medication_id: medicationId,
      scheduled_for: snoozeUntil.toISOString(),
      fulfilled: false,
    })

    if (callbackError) {
      console.error('Callback insert error:', callbackError)
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Fetch patient for logging
    const { data: patient } = await supabase
      .from('patients')
      .select('owner_id, name')
      .eq('id', patientId)
      .single()

    if (patient) {
      await adminLogEvent({
        patientId,
        ownerId: patient.owner_id,
        eventType: 'snooze_started',
        patientName: patient.name,
        medicationId,
        medicationName: medication.name ?? undefined,
        internalDetails: { hours, snoozeUntil: snoozeUntil.toISOString() },
      })
    }

    return NextResponse.json({ success: true, snooze_until: snoozeUntil.toISOString() })
  } catch (err) {
    console.error('Snooze route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
