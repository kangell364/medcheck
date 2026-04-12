import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const { caregiver_note } = body

    const admin = createAdminClient()

    const { data: req, error: fetchErr } = await admin
      .from('med_change_requests')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchErr || !req) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }
    if (req.status !== 'pending') {
      return NextResponse.json({ error: 'Request already resolved' }, { status: 409 })
    }

    const { data: patient } = await admin
      .from('patients')
      .select('id, name, owner_id')
      .eq('id', req.patient_id)
      .single()

    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

    // Mark declined
    await admin
      .from('med_change_requests')
      .update({
        status: 'declined',
        caregiver_note: caregiver_note || null,
        responded_at: new Date().toISOString(),
      })
      .eq('id', id)

    const isNew = req.type === 'new_medication'
    const medLabel = req.requested_name || req.medication_id || 'medication'
    const eventType = isNew ? 'new_med_declined' : 'change_declined'
    const displayMessage = isNew
      ? `❌ New medication request declined: ${medLabel} for ${patient.name}`
      : `❌ Change declined: ${medLabel} for ${patient.name}`

    await admin.from('alert_log').insert({
      patient_id: req.patient_id,
      patient_name: patient.name,
      medication_id: req.medication_id || null,
      medication_name: req.requested_name || null,
      event_type: eventType,
      severity: 'info',
      display_message: displayMessage,
      message: displayMessage,
      owner_id: patient.owner_id,
      internal_details: { change_request_id: id, caregiver_note },
      sent_at: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('decline route error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
