/**
 * POST /api/enrollment/email
 *
 * Sends a branded RxNudge enrollment email to a patient using Resend.
 * The email contains an "Accept & Activate Reminders" button that links
 * to the confirm route using the patient's permanent_token.
 */

import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'

const resendApiKey = process.env.RESEND_API_KEY
const resend = resendApiKey ? new Resend(resendApiKey) : null

export async function POST(request: NextRequest) {
  try {
    const { patientId } = await request.json()

    if (!patientId) {
      return NextResponse.json({ error: 'patientId required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Get patient (need email, name, permanent_token)
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, name, email, permanent_token, owner_id')
      .eq('id', patientId)
      .single()

    if (patientError || !patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    if (!patient.email) {
      return NextResponse.json({ error: 'Patient has no email address' }, { status: 400 })
    }

    if (!patient.permanent_token) {
      return NextResponse.json({ error: 'Patient has no permanent token' }, { status: 400 })
    }

    // Get caregiver name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', patient.owner_id)
      .single()

    const caregiverName = profile?.full_name || 'Your caregiver'
    const memberFirstName = (patient.name as string).split(' ')[0]
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rxnudge.app'
    const confirmUrl = `${appUrl}/api/enrollment/confirm?token=${patient.permanent_token}`

    const html = `
<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #f0fdfa;">
  <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

    <div style="text-align: center; margin-bottom: 24px;">
      <div style="font-size: 48px;">💊</div>
      <h1 style="color: #0d9488; margin: 8px 0 0;">RxNudge</h1>
      <p style="color: #6b7280; font-size: 14px; margin: 4px 0 0;">Daily medication reminders</p>
    </div>

    <h2 style="color: #111827;">Hi ${memberFirstName}!</h2>
    <p style="color: #374151; line-height: 1.6;">
      <strong>${caregiverName}</strong> has set up daily medication reminders for you using RxNudge.
      RxNudge helps you track and log your medications each day — just a friendly check-in, nothing more.
    </p>

    <p style="color: #374151; line-height: 1.6;">
      Click the button below to accept and activate your reminders:
    </p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${confirmUrl}"
         style="display: inline-block; background-color: #0d9488; color: white; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-size: 18px; font-weight: bold;">
        ✅ Accept &amp; Activate Reminders
      </a>
    </div>

    <p style="color: #6b7280; font-size: 13px; line-height: 1.6;">
      By clicking Accept, you agree to receive automated medication reminder notifications from RxNudge.
      You can opt out at any time from your account settings.
    </p>

    <p style="color: #9ca3af; font-size: 13px;">
      If you didn't expect this email, you can safely ignore it.
      No reminders will be sent until you accept.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
      © 2026 RxNudge · <a href="https://rxnudge.app" style="color: #0d9488;">rxnudge.app</a>
    </p>
  </div>
</div>
`

    if (!resend) {
      return NextResponse.json({ error: 'Email provider not configured' }, { status: 503 })
    }

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'RxNudge <noreply@rxnudge.app>',
      to: patient.email as string,
      subject: `💊 ${caregiverName} has set up medication reminders for you`,
      html,
    })

    if (emailError) {
      console.error('[enrollment/email] Resend error:', emailError)
      return NextResponse.json({ error: emailError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, emailId: emailData?.id })
  } catch (error: unknown) {
    console.error('[enrollment/email] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
