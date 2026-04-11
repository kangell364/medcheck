import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logEvent } from '@/lib/logEvent'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { name?: string; phone?: string; timezone?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { name, phone, timezone } = body

  if (!name || !phone || !timezone) {
    return NextResponse.json({ error: 'name, phone, and timezone are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('patients')
    .update({ name, phone, timezone })
    .eq('id', id)
    .eq('owner_id', user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Patient not found or access denied' }, { status: 404 })
  }

  // Log patient updated event
  await logEvent({
    patientId: id,
    ownerId: user.id,
    eventType: 'patient_updated',
    patientName: name,
    internalDetails: { updatedFields: { name, phone, timezone } },
  })

  return NextResponse.json(data)
}
