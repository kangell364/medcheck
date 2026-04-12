import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logEvent } from '@/lib/logEvent'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ medId: string }> }
) {
  const { medId } = await params

  const body = await req.json()
  const { permanent_token, name, nickname, dosage, start_date, reminder_times, notes, active, archived, frequency } = body

  // Token-based member access (member_can_self_manage)
  if (permanent_token) {
    const adminSupabase = createAdminClient()

    const { data: medication } = await adminSupabase
      .from('medications')
      .select('id, patient_id, name')
      .eq('id', medId)
      .single()

    if (!medication) {
      return NextResponse.json({ error: 'Medication not found' }, { status: 404 })
    }

    const { data: patient } = await adminSupabase
      .from('patients')
      .select('id, owner_id, name, member_can_self_manage')
      .eq('id', medication.patient_id)
      .eq('permanent_token', permanent_token)
      .single()

    if (!patient || !patient.member_can_self_manage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await adminSupabase
      .from('medications')
      .update({
        ...(name !== undefined ? { name } : {}),
        nickname: nickname || null,
        dosage: dosage || null,
        start_date: start_date || null,
        ...(reminder_times !== undefined ? { reminder_times } : {}),
        notes: notes || null,
        ...(frequency ? { frequency } : {}),
        ...(typeof active === 'boolean' ? { active } : {}),
      })
      .eq('id', medId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ medication: data })
  }

  // Authenticated user
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify ownership: medication → patient → owner_id = user.id
  const { data: medication } = await supabase
    .from('medications')
    .select('id, patient_id, name')
    .eq('id', medId)
    .single()

  if (!medication) {
    return NextResponse.json({ error: 'Medication not found' }, { status: 404 })
  }

  const { data: patient } = await supabase
    .from('patients')
    .select('owner_id, name, member_can_self_manage, user_id')
    .eq('id', medication.patient_id)
    .single()

  // Allow if: caregiver owns patient OR patient user with member_can_self_manage
  const isOwner = patient?.owner_id === user.id
  const isSelfManagePatient = patient?.user_id === user.id && patient?.member_can_self_manage

  if (!patient || (!isOwner && !isSelfManagePatient)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Archive / restore shortcut — accepts either { active: bool } or { archived: bool }
  const bodyKeys = Object.keys(body).filter(k => k !== 'permanent_token')
  const isArchiveToggle =
    (typeof active === 'boolean' && bodyKeys.length === 1) ||
    (typeof archived === 'boolean' && bodyKeys.length === 1)

  if (isArchiveToggle) {
    // Determine intent: archived=true or active=false means archive; archived=false or active=true means restore
    const archiving = typeof archived === 'boolean' ? archived : !active
    const updatePayload: Record<string, unknown> = {
      active: !archiving,
      archived_at: archiving ? new Date().toISOString() : null,
    }

    const { data, error } = await supabase
      .from('medications')
      .update(updatePayload as any)
      .eq('id', medId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logEvent({
      patientId: medication.patient_id,
      ownerId: isOwner ? user.id : patient.owner_id,
      eventType: 'med_edited',
      patientName: (patient as any).name,
      medicationId: medId,
      medicationName: medication.name,
      internalDetails: { action: archiving ? 'archived' : 'restored' },
    })

    return NextResponse.json({ medication: data })
  }

  const { data, error } = await supabase
    .from('medications')
    .update({
      name,
      nickname: nickname || null,
      dosage: dosage || null,
      start_date: start_date || null,
      reminder_times,
      notes: notes || null,
      ...(frequency ? { frequency } : {}),
      ...(typeof active === 'boolean' ? { active } : {}),
    } as any)
    .eq('id', medId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Log med edited event
  await logEvent({
    patientId: medication.patient_id,
    ownerId: isOwner ? user.id : patient.owner_id,
    eventType: 'med_edited',
    patientName: (patient as any).name,
    medicationId: medId,
    medicationName: name || medication.name,
    internalDetails: { previousName: medication.name, updatedFields: { name, nickname, dosage, start_date, reminder_times, notes, frequency } },
  })

  return NextResponse.json({ medication: data })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ medId: string }> }
) {
  const { medId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify ownership: medication → patient → owner_id = user.id
  const { data: medication } = await supabase
    .from('medications')
    .select('id, patient_id, name')
    .eq('id', medId)
    .single()

  if (!medication) {
    return NextResponse.json({ error: 'Medication not found' }, { status: 404 })
  }

  const { data: patient } = await supabase
    .from('patients')
    .select('owner_id, name')
    .eq('id', medication.patient_id)
    .single()

  if (!patient || patient.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Read keepHistory query param (default true)
  const keepHistory = req.nextUrl.searchParams.get('keepHistory') !== 'false'

  // If NOT keeping history: delete all dose_logs for this medication first
  if (!keepHistory) {
    const { error: logsError } = await supabase
      .from('dose_logs')
      .delete()
      .eq('medication_id', medId)

    if (logsError) {
      return NextResponse.json({ error: logsError.message }, { status: 500 })
    }
  }

  // Soft-delete by setting active = false
  const { error } = await supabase
    .from('medications')
    .update({ active: false })
    .eq('id', medId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Log med deleted event
  await logEvent({
    patientId: medication.patient_id,
    ownerId: user.id,
    eventType: 'med_deleted',
    patientName: (patient as any).name,
    medicationId: medId,
    medicationName: medication.name,
    internalDetails: { keepHistory, medId },
  })

  return NextResponse.json({ success: true })
}
