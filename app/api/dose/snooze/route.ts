import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { patientId, medicationId, scheduledAt, hours } = body

    if (!patientId || !medicationId || !scheduledAt || ![1, 2].includes(hours)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Fetch medication name for snapshot
    const { data: medication } = await supabase
      .from('medications')
      .select('name')
      .eq('id', medicationId)
      .single()

    const snoozeUntil = new Date(Date.now() + hours * 60 * 60 * 1000)

    const { error } = await supabase.from('dose_logs').upsert(
      {
        patient_id: patientId,
        medication_id: medicationId,
        medication_name: medication?.name ?? null,
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

    return NextResponse.json({ success: true, snooze_until: snoozeUntil.toISOString() })
  } catch (err) {
    console.error('Snooze route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
