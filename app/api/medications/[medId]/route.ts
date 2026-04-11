import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logEvent } from '@/lib/logEvent'

export async function PATCH(
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

  const body = await req.json()
  const { name, nickname, dosage, reminder_times, notes, active } = body

  // Archive / restore shortcut — only update active flag
  if (typeof active === 'boolean' && Object.keys(body).length === 1) {
    const { data, error } = await supabase
      .from('medications')
      .update({ active } as any)
      .eq('id', medId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logEvent({
      patientId: medication.patient_id,
      ownerId: user.id,
      eventType: 'med_edited',
      patientName: (patient as any).name,
      medicationId: medId,
      medicationName: medication.name,
      internalDetails: { action: active ? 'restored' : 'archived' },
    })

    return NextResponse.json({ medication: data })
  }

  const { data, error } = await supabase
    .from('medications')
    .update({
      name,
      nickname: nickname || null,
      dosage: dosage || null,
      reminder_times,
      notes: notes || null,
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
    ownerId: user.id,
    eventType: 'med_edited',
    patientName: (patient as any).name,
    medicationId: medId,
    medicationName: name || medication.name,
    internalDetails: { previousName: medication.name, updatedFields: { name, nickname, dosage, reminder_times, notes } },
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
