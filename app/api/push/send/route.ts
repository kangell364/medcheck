import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL || 'notifications@rxnudge.app'}`,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { patient_id, title, body, data } = await request.json()

    if (!patient_id) {
      return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: row, error } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('patient_id', patient_id)
      .single()

    if (error || !row) {
      return NextResponse.json({ error: 'No subscription found for patient' }, { status: 404 })
    }

    const payload = JSON.stringify({
      title: title || 'RxNudge 💊',
      body: body || 'Time for your medications!',
      ...data,
    })

    await webpush.sendNotification(row.subscription as webpush.PushSubscription, payload)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('push send error:', err)
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 })
  }
}
