import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const TERMS_VERSION = '2026-04-11'

export async function POST(request: NextRequest) {
  try {
    const { patientId, token } = await request.json()

    if (!patientId || !token) {
      return NextResponse.json({ error: 'patientId and token required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verify the token matches this patient (security check)
    const { data: patient, error: fetchError } = await supabase
      .from('patients')
      .select('id, enrollment_status')
      .eq('id', patientId)
      .eq('permanent_token', token)
      .single()

    if (fetchError || !patient) {
      return NextResponse.json({ error: 'Invalid patient or token' }, { status: 403 })
    }

    // Get client IP
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'

    const now = new Date().toISOString()

    const updatePayload: Record<string, unknown> = {
      terms_accepted_at: now,
      terms_accepted_ip: ip,
      terms_version: TERMS_VERSION,
      sms_consent_at: now,
    }

    // Activate enrollment if still pending
    if (patient.enrollment_status === 'pending') {
      updatePayload.enrollment_status = 'active'
    }

    const { error: updateError } = await supabase
      .from('patients')
      .update(updatePayload)
      .eq('id', patientId)

    if (updateError) {
      console.error('patient-consent update error:', updateError)
      return NextResponse.json({ error: 'Failed to save consent' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('patient-consent error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
