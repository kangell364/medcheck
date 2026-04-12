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

    const admin = createAdminClient()

    // Fetch the change request
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

    // Fetch patient info for alert
    const { data: patient } = await admin
      .from('patients')
      .select('id, name, owner_id')
      .eq('id', req.patient_id)
      .single()

    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

    const isNew = req.type === 'new_medication'

    if (!isNew && req.medication_id) {
      // Apply changes to the existing medication
      const updates: Record<string, unknown> = {}
      if (req.requested_name) updates.name = req.requested_name
      if (req.requested_dosage !== null) updates.dosage = req.requested_dosage
      if (req.requested_frequency) updates.frequency = req.requested_frequency
      if (req.requested_reminder_times) updates.reminder_times = req.requested_reminder_times
      if (req.requested_nickname !== null) updates.nickname = req.requested_nickname
      if (req.requested_notes !== null) updates.notes = req.requested_notes

      if (Object.keys(updates).length > 0) {
        const { error: medErr } = await admin
          .from('medications')
          .update(updates)
          .eq('id', req.medication_id)

        if (medErr) {
          console.error('medication update error:', medErr)
          return NextResponse.json({ error: medErr.message }, { status: 500 })
        }
      }
    }
    // For new_medication type, caregiver adds via the /patients/[id]/medications/new page
    // Approval just marks the request as approved (the Add It button redirects them there)

    // Mark request approved
    await admin
      .from('med_change_requests')
      .update({ status: 'approved', responded_at: new Date().toISOString() })
      .eq('id', id)

    const medLabel = req.requested_name || req.medication_id || 'medication'
    const eventType = isNew ? 'new_med_approved' : 'change_approved'
    const displayMessage = isNew
      ? `✅ New medication approved: ${medLabel} — will be added for ${patient.name}`
      : `✅ Change approved: ${medLabel} updated for ${patient.name}`

    // Create approval alert
    await admin.from('alert_log').insert({
      patient_id: req.patient_id,
      patient_name: patient.name,
      medication_id: req.medication_id || null,
      medication_name: req.requested_name || null,
      event_type: eventType,
      severity: 'success',
      display_message: displayMessage,
      message: displayMessage,
      owner_id: patient.owner_id,
      internal_details: { change_request_id: id },
      sent_at: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('approve route error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
