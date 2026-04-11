import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patient_id')

    let query = supabase
      .from('doctors')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true })

    if (patientId) {
      query = query.eq('patient_id', patientId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Doctors fetch error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (err) {
    console.error('GET /api/doctors error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { patient_id, name, specialty, phone, address, notes } = body

    if (!patient_id || !name) {
      return NextResponse.json(
        { error: 'patient_id and name are required' },
        { status: 400 }
      )
    }

    // Verify patient belongs to this user
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
      .from('doctors')
      .insert({
        patient_id,
        owner_id: user.id,
        name,
        specialty: specialty || null,
        phone: phone || null,
        address: address || null,
        notes: notes || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Doctor insert error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('POST /api/doctors error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
