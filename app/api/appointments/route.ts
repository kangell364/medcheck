import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('appointments')
      .select('*, patients(id, name, phone)')
      .eq('owner_id', user.id)
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true })

    if (error) {
      console.error('Appointments fetch error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (err) {
    console.error('GET /api/appointments error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const {
      patient_id,
      doctor_name,
      location,
      appointment_date,
      appointment_time,
      appointment_type,
      needs_ride,
      notes,
    } = body

    if (!patient_id || !doctor_name || !appointment_date || !appointment_time) {
      return NextResponse.json(
        { error: 'patient_id, doctor_name, appointment_date, and appointment_time are required' },
        { status: 400 }
      )
    }

    // Verify the patient belongs to this user
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('id', patient_id)
      .eq('owner_id', user.id)
      .single()

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        patient_id,
        owner_id: user.id,
        doctor_name,
        location: location || null,
        appointment_date,
        appointment_time,
        appointment_type: appointment_type || 'checkup',
        needs_ride: needs_ride || false,
        notes: notes || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Appointment insert error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('POST /api/appointments error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
