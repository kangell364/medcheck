import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { patient_id, subscription } = await request.json()

    if (!patient_id || !subscription) {
      return NextResponse.json({ error: 'patient_id and subscription required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        { patient_id, subscription },
        { onConflict: 'patient_id' }
      )

    if (error) {
      console.error('push subscribe error:', error)
      return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('push subscribe error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
