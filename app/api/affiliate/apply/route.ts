import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function generateCode(firstName: string, lastName: string): string {
  const first = (firstName[0] || 'X').toUpperCase()
  const last = lastName.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8)
  return `${first}${last}`
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { full_name?: string; company_name?: string; bio?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { full_name, company_name, bio } = body

  if (!full_name || !full_name.trim()) {
    return NextResponse.json({ error: 'full_name is required' }, { status: 400 })
  }

  // Check if already an affiliate
  const { data: existing } = await supabase
    .from('affiliates')
    .select('id, status')
    .eq('user_id', user.id)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Already applied', status: existing.status }, { status: 409 })
  }

  // Generate referral code
  const nameParts = full_name.trim().split(/\s+/)
  const firstName = nameParts[0] || ''
  const lastName = nameParts.slice(1).join('') || nameParts[0] || ''
  const baseCode = generateCode(firstName, lastName)

  // Check for collision
  let referralCode = baseCode
  const { data: collision } = await supabase
    .from('affiliates')
    .select('id')
    .eq('referral_code', baseCode)
    .single()

  if (collision) {
    const suffix = Math.floor(1000 + Math.random() * 9000).toString()
    referralCode = `${baseCode}${suffix}`
  }

  // Insert affiliate record
  const { data: affiliate, error: insertError } = await supabase
    .from('affiliates')
    .insert({
      user_id: user.id,
      referral_code: referralCode,
      status: 'pending',
      company_name: company_name || null,
      bio: bio || null,
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ affiliate }, { status: 201 })
}
