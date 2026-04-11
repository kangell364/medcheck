/**
 * GET /api/enrollment/confirm?token=<permanent_token>
 *
 * Confirms enrollment for a patient by their permanent_token.
 * Sets enrollment_status = 'active' and redirects to their personal meds page.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Look up patient by permanent_token
  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('id, permanent_token, enrollment_status')
    .eq('permanent_token', token)
    .single()

  if (patientError || !patient) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 })
  }

  // Set enrollment_status to active
  const { error: updateError } = await supabase
    .from('patients')
    .update({ enrollment_status: 'active' })
    .eq('id', patient.id)

  if (updateError) {
    console.error('[enrollment/confirm] Update error:', updateError)
    return NextResponse.json({ error: 'Failed to activate enrollment' }, { status: 500 })
  }

  // Redirect to their personal meds page with a success indicator
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rxnudge.app'
  return NextResponse.redirect(`${appUrl}/p/${token}?enrolled=1`)
}
