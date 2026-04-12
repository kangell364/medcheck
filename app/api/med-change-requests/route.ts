import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      patient_id,
      medication_id,
      type = 'change',
      requested_name,
      requested_dosage,
      requested_frequency,
      requested_reminder_times,
      requested_nickname,
      requested_notes,
      requested_start_date,
      member_note,
    } = body

    if (!patient_id) {
      return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
    }
    if (type === 'change' && !medication_id) {
      return NextResponse.json({ error: 'medication_id required for change requests' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Verify patient exists — allow unauthenticated (member on /p/[token] has no session)
    const { data: patient } = await admin
      .from('patients')
      .select('id, name, owner_id')
      .eq('id', patient_id)
      .single()

    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

    // Get requesting user if logged in (optional)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const requestedBy = user?.id || null

    // Fetch medication name for alert message
    let medName = requested_name || 'Unknown medication'
    if (medication_id) {
      const { data: med } = await admin
        .from('medications')
        .select('name, nickname')
        .eq('id', medication_id)
        .single()
      if (med) medName = med.nickname || med.name
    }

    // Insert change request
    const { data: changeReq, error: insertErr } = await admin
      .from('med_change_requests')
      .insert({
        patient_id,
        medication_id: medication_id || null,
        requested_by: requestedBy,
        type,
        status: 'pending',
        requested_name: requested_name || null,
        requested_dosage: requested_dosage || null,
        requested_frequency: requested_frequency || null,
        requested_reminder_times: requested_reminder_times || null,
        requested_nickname: requested_nickname || null,
        requested_notes: requested_notes || null,
        requested_start_date: requested_start_date || null,
        member_note: member_note || null,
      })
      .select()
      .single()

    if (insertErr) {
      console.error('med_change_requests insert error:', insertErr)
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    // Build alert message
    const isNew = type === 'new_medication'
    const eventType = isNew ? 'new_med_request' : 'med_change_request'
    const severity = 'warning'

    let displayMessage: string
    if (isNew) {
      const namePart = requested_name || 'Unknown medication'
      const dosagePart = requested_dosage ? ` ${requested_dosage}` : ''
      const nickPart = requested_nickname ? ` ("${requested_nickname}")` : ''
      displayMessage = `${patient.name} wants to add: ${namePart}${dosagePart}${nickPart}`
      if (member_note) displayMessage += ` — "${member_note}"`
    } else {
      // Build a brief diff summary
      const changes: string[] = []
      if (requested_name) changes.push(`name → ${requested_name}`)
      if (requested_dosage) changes.push(`dosage → ${requested_dosage}`)
      if (requested_frequency) changes.push(`frequency → ${requested_frequency}`)
      if (requested_nickname) changes.push(`nickname → ${requested_nickname}`)
      const summary = changes.length > 0 ? changes.join(', ') : 'changes requested'
      displayMessage = `${patient.name} requested a change to ${medName}: ${summary}`
      if (member_note) displayMessage += ` — "${member_note}"`
    }

    // Create alert for caregiver
    await admin.from('alert_log').insert({
      patient_id,
      patient_name: patient.name,
      medication_id: medication_id || null,
      medication_name: isNew ? (requested_name || null) : medName,
      event_type: eventType,
      severity,
      display_message: displayMessage,
      message: displayMessage,
      owner_id: patient.owner_id,
      internal_details: { change_request_id: changeReq.id, type },
      sent_at: new Date().toISOString(),
    })

    // Send push notification to caregiver (they have a push sub keyed to their patient record if self)
    // Caregiver push subs are stored under their own patient record (owner). Try owner_id lookup.
    // We send to the owner's user push sub if it exists (stored by owner_id in push_subscriptions via user_id col if present)
    // For now, look for push_subscriptions where patient.owner_id matches a patient.user_id
    try {
      const { data: caregiverPatient } = await admin
        .from('patients')
        .select('id')
        .eq('user_id', patient.owner_id)
        .maybeSingle()

      if (caregiverPatient) {
        const pushTitle = isNew ? '💊 New Medication Request' : '💬 Medication Change Request'
        const pushBody = displayMessage.slice(0, 120)
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/push/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patient_id: caregiverPatient.id,
            title: pushTitle,
            body: pushBody,
            data: { url: '/alerts' },
          }),
        })
      }
    } catch (pushErr) {
      // Non-fatal
      console.warn('caregiver push failed:', pushErr)
    }

    return NextResponse.json({ ok: true, id: changeReq.id })
  } catch (err) {
    console.error('med-change-requests POST error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
