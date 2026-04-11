import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const { token } = await request.json()

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 })
  }

  const adminSupabase = createAdminClient()

  // Look up the invite
  const { data: invite, error: inviteError } = await adminSupabase
    .from('patient_invites')
    .select('*, patients(id, user_id, generated_password, name)')
    .eq('token', token)
    .single()

  if (inviteError || !invite) {
    return NextResponse.json({ error: 'Invalid link. Ask your caregiver to send a new one.' }, { status: 404 })
  }

  // Check expiry
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json(
      { error: 'This link has expired. Ask your caregiver to send a new one.' },
      { status: 410 }
    )
  }

  // Check already used
  if (invite.used_at) {
    return NextResponse.json(
      { error: 'This link has already been used. Ask your caregiver to send a new one.' },
      { status: 410 }
    )
  }

  const patient = invite.patients as { id: string; user_id: string | null; generated_password: string | null; name: string } | null
  if (!patient?.user_id || !patient?.generated_password) {
    return NextResponse.json(
      { error: 'Account not found. Please contact your caregiver.' },
      { status: 404 }
    )
  }

  // Get the user's email
  const { data: userData } = await adminSupabase.auth.admin.getUserById(patient.user_id)
  if (!userData?.user?.email) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 })
  }

  // Sign in the patient using their generated credentials
  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: session, error: signInError } = await authClient.auth.signInWithPassword({
    email: userData.user.email,
    password: patient.generated_password,
  })

  if (signInError || !session) {
    return NextResponse.json({ error: 'Sign-in failed. Please contact your caregiver.' }, { status: 500 })
  }

  // Mark token as used
  await adminSupabase
    .from('patient_invites')
    .update({ used_at: new Date().toISOString() })
    .eq('id', invite.id)

  return NextResponse.json({
    success: true,
    session: session.session,
    patientName: patient.name,
  })
}
