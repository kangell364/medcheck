import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { affiliateId?: string; approved?: boolean; level1_rate?: number; level2_rate?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { affiliateId, approved, level1_rate, level2_rate } = body

  if (!affiliateId || approved === undefined) {
    return NextResponse.json({ error: 'affiliateId and approved are required' }, { status: 400 })
  }

  const updatePayload: Record<string, unknown> = {
    status: approved ? 'active' : 'suspended',
    approved_by: user.id,
  }
  if (approved) {
    updatePayload.approved_at = new Date().toISOString()
  }
  if (level1_rate !== undefined) {
    updatePayload.level1_rate = level1_rate
  }
  if (level2_rate !== undefined) {
    updatePayload.level2_rate = level2_rate
  }

  const { data: affiliate, error: updateError } = await supabase
    .from('affiliates')
    .update(updatePayload)
    .eq('id', affiliateId)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // If approved, also update is_affiliate on their profile
  if (approved && affiliate?.user_id) {
    await supabase
      .from('profiles')
      .update({ is_affiliate: true })
      .eq('id', affiliate.user_id)
  }

  return NextResponse.json({ affiliate })
}
