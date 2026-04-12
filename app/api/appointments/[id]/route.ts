import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const body = await req.json()
  const { status, permanent_token } = body

  const validStatuses = ['upcoming', 'completed', 'cancelled']
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json(
      { error: 'status must be one of: upcoming, completed, cancelled' },
      { status: 400 }
    )
  }

  // Support both authenticated users and token-based (member) access
  if (permanent_token) {
    // Member access via permanent token
    const adminSupabase = createAdminClient()

    // Look up patient by token
    const { data: patient } = await adminSupabase
      .from('patients')
      .select('id')
      .eq('permanent_token', permanent_token)
      .single()

    if (!patient) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Verify appointment belongs to this patient
    const { data: appointment } = await adminSupabase
      .from('appointments')
      .select('id, patient_id')
      .eq('id', id)
      .single()

    if (!appointment || appointment.patient_id !== patient.id) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    const { data, error } = await adminSupabase
      .from('appointments')
      .update({ status })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Appointment update error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json(data)
  }

  // Authenticated user access
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if it's a patient user (member_can_self_manage) or caregiver
  const { data: patientRecord } = await supabase
    .from('patients')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (patientRecord) {
    // Patient user — verify appointment belongs to them
    const { data: appointment } = await supabase
      .from('appointments')
      .select('id, patient_id')
      .eq('id', id)
      .single()

    if (!appointment || appointment.patient_id !== patientRecord.id) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Appointment update error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json(data)
  }

  // Caregiver user — verify they own the patient
  const { data: appointment } = await supabase
    .from('appointments')
    .select('id, patient_id')
    .eq('id', id)
    .single()

  if (!appointment) {
    return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
  }

  const { data: patient } = await supabase
    .from('patients')
    .select('id')
    .eq('id', appointment.patient_id)
    .eq('owner_id', user.id)
    .single()

  if (!patient) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Appointment update error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
