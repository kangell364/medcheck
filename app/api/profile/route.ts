import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function isValidE164(phone: string) {
  // Optional lightweight validation; accepts empty elsewhere.
  return /^\+?[1-9]\d{6,14}$/.test(phone.replace(/[\s()-]/g, ''))
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, user_type, plan, created_at')
    .eq('id', user.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile: data })
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  const updates: Record<string, unknown> = {}

  if (typeof body.full_name === 'string') {
    updates.full_name = body.full_name.trim()
  }

  if (typeof body.phone === 'string') {
    const phone = body.phone.trim()
    if (phone.length > 0 && !isValidE164(phone)) {
      return NextResponse.json({ error: 'invalid_phone' }, { status: 400 })
    }
    updates.phone = phone.length === 0 ? null : phone
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no_valid_fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select('id, full_name, phone, user_type, plan, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile: data })
}
