import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { patientId } = await request.json()

    if (!patientId) {
      return NextResponse.json({ error: 'patientId required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Get patient
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('*, profiles:owner_id(full_name, phone)')
      .eq('id', patientId)
      .single()

    if (patientError || !patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Get caregiver name from profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', patient.owner_id)
      .single()

    const caregiverName = profile?.full_name || 'Your caregiver'
    const patientFirstName = patient.name.split(' ')[0]
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rxnudge.app'

    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    )

    await client.messages.create({
      to: patient.phone,
      from: process.env.TWILIO_PHONE_NUMBER!,
      body: `Hi ${patientFirstName}, ${caregiverName} has enrolled you in RxNudge for daily medication reminders. Reply YES to confirm or NO to decline. Tap the attachment to save our contact! 💊`,
      mediaUrl: [`${appUrl}/api/vcard`],
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Enrollment SMS error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
