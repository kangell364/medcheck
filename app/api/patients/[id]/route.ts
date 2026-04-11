import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logEvent } from '@/lib/logEvent'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

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

  let body: {
    name?: string
    phone?: string
    timezone?: string
    reminders_enabled?: boolean
    contact_method?: string
    reminder_time?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { name, phone, timezone, reminders_enabled, contact_method, reminder_time } = body

  if (!name || !phone || !timezone) {
    return NextResponse.json({ error: 'name, phone, and timezone are required' }, { status: 400 })
  }

  // Validate contact_method if provided
  if (contact_method && !['call', 'text', 'both'].includes(contact_method)) {
    return NextResponse.json({ error: 'contact_method must be call, text, or both' }, { status: 400 })
  }

  const updatePayload: Record<string, unknown> = { name, phone, timezone }
  if (reminders_enabled !== undefined) updatePayload.reminders_enabled = reminders_enabled
  if (contact_method !== undefined) updatePayload.contact_method = contact_method
  if (reminder_time !== undefined) updatePayload.reminder_time = reminder_time

  const { data, error } = await supabase
    .from('patients')
    .update(updatePayload)
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
    internalDetails: { updatedFields: updatePayload },
  })

  return NextResponse.json(data)
}
