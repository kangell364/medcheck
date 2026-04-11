import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { patientId, email, password, permanent_token } = await request.json()

    if (!patientId || !email || !password || !permanent_token) {
      return NextResponse.json(
        { error: 'patientId, email, password, and permanent_token are required' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verify the token matches this patient (security check)
    const { data: patient, error: fetchError } = await supabase
      .from('patients')
      .select('id, user_id, name, email')
      .eq('id', patientId)
      .eq('permanent_token', permanent_token)
      .single()

    if (fetchError || !patient) {
      return NextResponse.json({ error: 'Invalid patient or token' }, { status: 403 })
    }

    // If patient already has a user_id, they already have an account
    if (patient.user_id) {
      return NextResponse.json({ error: 'Account already exists for this patient' }, { status: 409 })
    }

    // Create the auth user
    const { data: authData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // auto-confirm so they can sign in immediately
    })

    if (createError || !authData?.user) {
      console.error('patient-account create auth error:', createError)
      // Check for duplicate email
      if (createError?.message?.toLowerCase().includes('already')) {
        return NextResponse.json(
          { error: 'An account with this email already exists. Try signing in instead.' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: 'Failed to create account. Please try again.' }, { status: 500 })
    }

    const userId = authData.user.id

    // Create profile with user_type='patient'
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        full_name: patient.name,
        user_type: 'patient',
        plan: 'free',
      })

    if (profileError) {
      console.error('patient-account create profile error:', profileError)
      // Try to clean up the auth user we just created
      await supabase.auth.admin.deleteUser(userId).catch(() => {})
      return NextResponse.json({ error: 'Failed to set up account. Please try again.' }, { status: 500 })
    }

    // Link patient.user_id to the new auth user
    const { error: linkError } = await supabase
      .from('patients')
      .update({ user_id: userId })
      .eq('id', patientId)

    if (linkError) {
      console.error('patient-account link error:', linkError)
      // Non-fatal — account still created, just not linked
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('patient-account/create error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
