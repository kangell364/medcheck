/**
 * POST /api/enrollment/sms
 *
 * Sends an enrollment invitation to a patient.
 *
 * Enrollment flow decision:
 * - If SMS_APPROVED=false OR contact_method='call' OR contact_method='both':
 *     → Initiate AI voice enrollment call (POST /api/calls/enroll)
 *     → Also send vCard MMS as fallback/introduction
 * - If SMS_APPROVED=true AND contact_method='text':
 *     → Send SMS invitation with YES/NO reply
 */

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
      .select('*')
      .eq('id', patientId)
      .single()

    if (patientError || !patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Get caregiver name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', patient.owner_id)
      .single()

    const caregiverName = profile?.full_name || 'Your caregiver'
    const patientFirstName = (patient.name as string).split(' ')[0]
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rxnudge.app'

    const smsApproved = process.env.SMS_APPROVED === 'true'
    const contactMethod: string = patient.contact_method ?? 'text'

    // ── Decide: voice call vs SMS ─────────────────────────────────
    const useCall = !smsApproved || contactMethod === 'call' || contactMethod === 'both'

    if (useCall) {
      // Initiate AI enrollment call
      try {
        const callRes = await fetch(`${appUrl}/api/calls/enroll`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId: patient.id,
            patientName: patient.name,
            caregiverName,
            patientPhone: patient.phone,
          }),
        })

        const callData = await callRes.json() as { callSid?: string; error?: string }

        if (!callRes.ok) {
          console.error('[enrollment/sms] Call initiation failed:', callData.error)
          // Fall through to SMS as fallback
        } else {
          // Send vCard MMS alongside the call (introduction)
          if (contactMethod !== 'call') {
            // Only send intro SMS if they accept texts too
            try {
              const client = twilio(
                process.env.TWILIO_ACCOUNT_SID!,
                process.env.TWILIO_AUTH_TOKEN!
              )
              await client.messages.create({
                to: patient.phone as string,
                from: process.env.TWILIO_PHONE_NUMBER!,
                body: `Hi ${patientFirstName}, ${caregiverName} has set up RxNudge medication reminders for you. Save our contact below! 💊`,
                mediaUrl: [`${appUrl}/api/vcard`],
              })
            } catch (smsErr) {
              console.error('[enrollment/sms] vCard MMS failed:', smsErr)
            }
          }

          return NextResponse.json({ success: true, method: 'call', callSid: callData.callSid })
        }
      } catch (callErr) {
        console.error('[enrollment/sms] Call error:', callErr)
        // Fall through to SMS
      }
    }

    // ── SMS enrollment (SMS_APPROVED=true + text contact) ─────────
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    )

    await client.messages.create({
      to: patient.phone as string,
      from: process.env.TWILIO_PHONE_NUMBER!,
      body: `Hi ${patientFirstName}, ${caregiverName} has enrolled you in RxNudge for daily medication reminders. Reply YES to confirm or NO to decline. Tap the attachment to save our contact! 💊\n\nReply STOP to opt out at any time.`,
      mediaUrl: [`${appUrl}/api/vcard`],
    })

    return NextResponse.json({ success: true, method: 'sms' })
  } catch (error: unknown) {
    console.error('Enrollment SMS error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
