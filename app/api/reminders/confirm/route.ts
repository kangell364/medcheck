import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { escalationId } = await request.json()

    if (!escalationId) {
      return NextResponse.json({ error: 'escalationId required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('reminder_escalations')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', escalationId)
      .in('status', ['pending', 'snoozed'])

    if (error) {
      console.error('confirm escalation error:', error)
      return NextResponse.json({ error: 'Failed to confirm' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('confirm escalation error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
