import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

type Params = { id: string }

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('patients')
    .select('notification_style, notification_volume, notification_sound')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  return NextResponse.json({
    notification_style: data.notification_style ?? 'normal',
    notification_volume: data.notification_volume ?? 80,
    notification_sound: data.notification_sound ?? 'default',
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { id } = await params
  const body = await req.json()

  const allowed = ['notification_style', 'notification_volume', 'notification_sound']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
  }

  // Validate style
  if (updates.notification_style !== undefined) {
    const validStyles = ['silent', 'normal', 'alarm']
    if (!validStyles.includes(updates.notification_style as string)) {
      return NextResponse.json({ error: 'Invalid notification_style' }, { status: 400 })
    }
  }

  // Validate volume
  if (updates.notification_volume !== undefined) {
    const vol = Number(updates.notification_volume)
    if (isNaN(vol) || vol < 0 || vol > 100) {
      return NextResponse.json({ error: 'notification_volume must be 0–100' }, { status: 400 })
    }
    updates.notification_volume = vol
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('patients')
    .update(updates)
    .eq('id', id)
    .select('notification_style, notification_volume, notification_sound')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({
    notification_style: data.notification_style,
    notification_volume: data.notification_volume,
    notification_sound: data.notification_sound,
  })
}
