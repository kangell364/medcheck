import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import twilio from 'twilio'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Verify caregiver is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminSupabase = createAdminClient()

  // Verify this patient belongs to the caregiver
  const { data: patient } = await adminSupabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  // If patient doesn't have a user account yet, create one
  let userId = patient.user_id
  let generatedPassword = patient.generated_password

  if (!userId) {
    const phone = patient.phone.replace(/\D/g, '')
    const email = `patient_${phone}@rxnudge.app`
    generatedPassword = crypto.randomUUID()

    const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
      email,
      password: generatedPassword,
      email_confirm: true,
    })

    if (createError || !newUser?.user) {
      return NextResponse.json({ error: 'Failed to create patient account' }, { status: 500 })
    }

    userId = newUser.user.id

    // Create profile
    await adminSupabase.from('profiles').upsert({
      id: userId,
      full_name: patient.name,
      user_type: 'patient',
    })

    // Link patient
    await adminSupabase
      .from('patients')
      .update({ user_id: userId, generated_password: generatedPassword })
      .eq('id', id)

    // Create caregiver link if not exists
    await adminSupabase.from('patient_caregivers').upsert({
      patient_id: id,
      caregiver_id: user.id,
    })
  }

  // Invalidate old tokens
  await adminSupabase
    .from('patient_invites')
    .delete()
    .eq('patient_id', id)
    .is('used_at', null)

  // Create new invite token
  const { data: invite, error: inviteError } = await adminSupabase
    .from('patient_invites')
    .insert({ patient_id: id })
    .select('token')
    .single()

  if (inviteError || !invite) {
    return NextResponse.json({ error: 'Failed to create invite token' }, { status: 500 })
  }

  // Send SMS
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rxnudge.app'
  const loginUrl = `${appUrl}/patient-login?token=${invite.token}`
  const message = `Access your RxNudge medication tracker: ${loginUrl}`

  try {
    const twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    )
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: patient.phone,
    })
  } catch (err) {
    console.error('Failed to send SMS:', err)
    // Return success anyway — link was created even if SMS failed
    return NextResponse.json({
      success: true,
      warning: 'Link created but SMS failed to send.',
      loginUrl,
    })
  }

  return NextResponse.json({ success: true, loginUrl })
}
