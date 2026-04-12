import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/dose-log
 * Body: { patient_id, medication_id, reminder_time, action: 'taken' | 'skipped', timezone }
 *
 * Calculates scheduled_at from today's date + reminder_time in the patient's timezone,
 * then upserts a dose_log record.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { patient_id, medication_id, reminder_time, action, timezone } = body

    if (!patient_id || !medication_id || !reminder_time || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (action !== 'taken' && action !== 'skipped') {
      return NextResponse.json({ error: 'action must be "taken" or "skipped"' }, { status: 400 })
    }

    const tz = timezone || 'America/Chicago'
    const now = new Date()

    // Build scheduled_at: today in patient's timezone + reminder_time
    const dateStr = now.toLocaleDateString('en-CA', { timeZone: tz }) // "2026-04-11"
    const [hours, minutes] = reminder_time.split(':').map(Number)
    const scheduledAt = `${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`

    const supabase = createAdminClient()

    // Fetch medication name
    const { data: medication } = await supabase
      .from('medications')
      .select('name, nickname')
      .eq('id', medication_id)
      .single()

    const medName = medication?.nickname || medication?.name || null

    const confirmedAt = action === 'taken' ? now.toISOString() : null

    const { error } = await supabase.from('dose_logs').upsert(
      {
        patient_id,
        medication_id,
        medication_name: medName,
        scheduled_at: scheduledAt,
        confirmed: action === 'taken',
        confirmed_at: confirmedAt,
        method: action === 'skipped' ? 'manual' : 'app',
      },
      { onConflict: 'patient_id,medication_id,scheduled_at' }
    )

    if (error) {
      console.error('dose-log upsert error:', error)
      return NextResponse.json({ error: 'Database error', details: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, scheduled_at: scheduledAt, action })
  } catch (err) {
    console.error('dose-log route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
