import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  let body: { userId?: string; referralCode?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { userId, referralCode } = body

  if (!userId || !referralCode) {
    return NextResponse.json({ error: 'userId and referralCode are required' }, { status: 400 })
  }

  // Look up affiliate by code (must be active)
  const { data: affiliate, error: affiliateError } = await supabase
    .from('affiliates')
    .select('id, status')
    .eq('referral_code', referralCode.toUpperCase())
    .eq('status', 'active')
    .single()

  if (affiliateError || !affiliate) {
    return NextResponse.json({ error: 'Referral code not found or inactive' }, { status: 404 })
  }

  // Check if user already has a referral record
  const { data: existingReferral } = await supabase
    .from('referrals')
    .select('id')
    .eq('referred_user_id', userId)
    .single()

  if (existingReferral) {
    return NextResponse.json({ message: 'Already tracked' })
  }

  // Create referral record
  const { error: referralError } = await supabase
    .from('referrals')
    .insert({
      affiliate_id: affiliate.id,
      referred_user_id: userId,
      referral_code: referralCode.toUpperCase(),
      status: 'active',
    })

  if (referralError) {
    return NextResponse.json({ error: referralError.message }, { status: 500 })
  }

  // Update profile with referred_by_code
  await supabase
    .from('profiles')
    .update({ referred_by_code: referralCode.toUpperCase() })
    .eq('id', userId)

  return NextResponse.json({ success: true })
}
