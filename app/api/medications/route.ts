import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      patient_id,
      name,
      nickname,
      dosage,
      frequency,
      reminder_times,
      start_date,
      notes,
      permanent_token,
    } = body

    if (!patient_id || !name || !frequency) {
      return NextResponse.json(
        { error: 'patient_id, name, and frequency are required' },
        { status: 400 }
      )
    }

    const validFrequencies = ['once', 'twice', 'three_times']
    if (!validFrequencies.includes(frequency)) {
      return NextResponse.json(
        { error: 'frequency must be once, twice, or three_times' },
        { status: 400 }
      )
    }

    const medData = {
      patient_id,
      name,
      nickname: nickname || null,
      dosage: dosage || null,
      frequency,
      reminder_times: reminder_times || ['08:00:00'],
      start_date: start_date || new Date().toISOString().slice(0, 10),
      notes: notes || null,
      active: true,
    }

    // Token-based member access (member_can_self_manage)
    if (permanent_token) {
      const adminSupabase = createAdminClient()

      const { data: patient } = await adminSupabase
        .from('patients')
        .select('id, member_can_self_manage')
        .eq('permanent_token', permanent_token)
        .eq('id', patient_id)
        .single()

      if (!patient) {
        return NextResponse.json({ error: 'Invalid token or patient' }, { status: 401 })
      }

      if (!patient.member_can_self_manage) {
        return NextResponse.json(
          { error: 'Self-manage is not enabled for this patient' },
          { status: 403 }
        )
      }

      const { data, error } = await adminSupabase
        .from('medications')
        .insert(medData)
        .select()
        .single()

      if (error) {
        console.error('Medication insert error:', error)
        return NextResponse.json({ error: 'Database error' }, { status: 500 })
      }

      return NextResponse.json(data, { status: 201 })
    }

    // Authenticated user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check if patient user with member_can_self_manage
    const { data: patientRecord } = await supabase
      .from('patients')
      .select('id, member_can_self_manage, owner_id')
      .eq('user_id', user.id)
      .eq('id', patient_id)
      .single()

    if (patientRecord) {
      if (!patientRecord.member_can_self_manage) {
        return NextResponse.json(
          { error: 'Self-manage is not enabled for this patient' },
          { status: 403 }
        )
      }

      const { data, error } = await supabase
        .from('medications')
        .insert(medData)
        .select()
        .single()

      if (error) {
        console.error('Medication insert error:', error)
        return NextResponse.json({ error: 'Database error' }, { status: 500 })
      }

      return NextResponse.json(data, { status: 201 })
    }

    // Caregiver user — verify patient belongs to them
    const { data: caregiverPatient } = await supabase
      .from('patients')
      .select('id')
      .eq('id', patient_id)
      .eq('owner_id', user.id)
      .single()

    if (!caregiverPatient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('medications')
      .insert(medData)
      .select()
      .single()

    if (error) {
      console.error('Medication insert error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('POST /api/medications error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
