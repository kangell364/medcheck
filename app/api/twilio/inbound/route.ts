import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { createAdminClient } from '@/lib/supabase/admin'

const VoiceResponse = twilio.twiml.VoiceResponse
const MessagingResponse = twilio.twiml.MessagingResponse

// TCPA opt-out keywords (Twilio also auto-handles these but we must handle DB side too)
const STOP_KEYWORDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'])
const START_KEYWORDS = new Set(['START', 'UNSTOP'])
const HELP_KEYWORDS = new Set(['HELP', 'INFO'])

// Handle inbound calls (voice) — patient calls in to check their status
export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const supabase = createAdminClient()

  // ----------------------------------------------------------------
  // SMS inbound
  // ----------------------------------------------------------------
  const messageBody = formData.get('Body') as string | null
  if (messageBody !== null) {
    const fromNumber = formData.get('From') as string
    const trimmed = messageBody.trim().toUpperCase()
    const twiml = new MessagingResponse()

    // ── PRIORITY 1: TCPA opt-out (STOP and variants) ──────────────
    if (STOP_KEYWORDS.has(trimmed)) {
      // Find patient by phone number (any status)
      const { data: patient } = await supabase
        .from('patients')
        .select('id, name, owner_id, phone')
        .eq('phone', fromNumber)
        .limit(1)
        .single()

      if (patient) {
        await supabase
          .from('patients')
          .update({
            reminders_enabled: false,
            sms_opted_out: true,
            sms_opted_out_at: new Date().toISOString(),
          })
          .eq('id', patient.id)

        // Notify all alert contacts except the patient
        const { data: alerts } = await supabase
          .from('patient_alerts')
          .select('phone, alert_sms')
          .eq('patient_id', patient.id)
          .eq('alert_sms', true)

        const msgBody = `⚠️ ${patient.name} opted out of RxNudge reminders (STOP). You may want to check in.`

        for (const a of alerts || []) {
          if (!a.phone) continue
          if (a.phone === patient.phone) continue
          try {
            await twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!).messages.create({
              to: a.phone,
              from: process.env.TWILIO_PHONE_NUMBER!,
              body: msgBody,
            })
          } catch (e) {
            console.error('[twilio/inbound] Failed to notify alert contact:', e)
          }
        }
      }

      // Must reply even if we don't recognize the number
      twiml.message(
        'You have been unsubscribed from RxNudge reminders. No further messages will be sent. Reply START to re-subscribe or contact your caregiver.'
      )
      return new NextResponse(twiml.toString(), {
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    // ── PRIORITY 2: Re-subscribe (START) ──────────────────────────
    if (START_KEYWORDS.has(trimmed)) {
      const { data: patient } = await supabase
        .from('patients')
        .select('id, name, owner_id')
        .eq('phone', fromNumber)
        .limit(1)
        .single()

      if (patient) {
        await supabase
          .from('patients')
          .update({
            reminders_enabled: true,
            sms_opted_out: false,
            sms_opted_out_at: null,
          })
          .eq('id', patient.id)
      }

      twiml.message(
        'You have been re-subscribed to RxNudge reminders. Reply STOP anytime to opt out.'
      )
      return new NextResponse(twiml.toString(), {
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    // ── PRIORITY 3: HELP ──────────────────────────────────────────
    if (HELP_KEYWORDS.has(trimmed)) {
      twiml.message(
        'RxNudge sends daily medication reminders. Reply STOP to unsubscribe. For support contact your caregiver or visit rxnudge.app.'
      )
      return new NextResponse(twiml.toString(), {
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    // ── Enrollment YES/NO handler ─────────────────────────────────
    const { data: pendingPatient } = await supabase
      .from('patients')
      .select('*')
      .eq('phone', fromNumber)
      .eq('enrollment_status', 'pending')
      .single()

    if (pendingPatient) {
      if (trimmed === 'YES') {
        await supabase
          .from('patients')
          .update({ enrollment_status: 'active' })
          .eq('id', pendingPatient.id)

        // Auto-create patient auth account if not yet linked
        let appLinkMsg = ''
        if (!pendingPatient.user_id) {
          try {
            const phone = fromNumber.replace(/\D/g, '')
            const email = `patient_${phone}@rxnudge.app`
            const password = crypto.randomUUID()

            // Create Supabase auth user
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
              email,
              password,
              email_confirm: true,
            })

            if (!createError && newUser?.user) {
              const userId = newUser.user.id

              // Create profile for patient
              await supabase.from('profiles').upsert({
                id: userId,
                full_name: pendingPatient.name,
                user_type: 'patient',
              })

              // Link patient record to user
              await supabase
                .from('patients')
                .update({ user_id: userId, generated_password: password })
                .eq('id', pendingPatient.id)

              // Create patient_caregivers link
              await supabase.from('patient_caregivers').insert({
                patient_id: pendingPatient.id,
                caregiver_id: pendingPatient.owner_id,
                relationship: null,
              })

              // Create invite token (invalidate old ones first)
              await supabase
                .from('patient_invites')
                .delete()
                .eq('patient_id', pendingPatient.id)
                .is('used_at', null)

              const { data: invite } = await supabase
                .from('patient_invites')
                .insert({
                  patient_id: pendingPatient.id,
                })
                .select('token')
                .single()

              if (invite?.token) {
                const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rxnudge.app'
                appLinkMsg = ` Access your medication tracker: ${appUrl}/patient-login?token=${invite.token} 💊`
              }
            }
          } catch (err) {
            console.error('Failed to auto-create patient account:', err)
          }
        }

        // Send permanent patient link via separate SMS
        const { data: updatedPatient } = await supabase
          .from('patients')
          .select('permanent_token')
          .eq('id', pendingPatient.id)
          .single()

        if (updatedPatient?.permanent_token) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rxnudge.app'
          const permanentLink = `${appUrl}/p/${updatedPatient.permanent_token}`
          // We'll append this to the enrollment confirmation or send as follow-up
          if (!appLinkMsg) {
            appLinkMsg = ` Bookmark your medication page: ${permanentLink} 💊`
          }
        }

        twiml.message(
          `You're all set! RxNudge will remind you about your medications daily. Reply STOP anytime to opt out.${appLinkMsg}`
        )
      } else if (trimmed === 'NO') {
        await supabase
          .from('patients')
          .update({ enrollment_status: 'declined' })
          .eq('id', pendingPatient.id)

        twiml.message(
          "Understood. You've been unenrolled from RxNudge. Contact your caregiver if this was a mistake."
        )
      } else {
        twiml.message(
          'Please reply YES to confirm enrollment or NO to decline.'
        )
      }

      return new NextResponse(twiml.toString(), {
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    // ── Escalation YES/NO handler (active patients) ──────────────
    const YES_KEYWORDS = new Set(['YES', 'TOOK', 'TAKEN', 'DONE', 'YEP', 'YUP'])
    const NO_KEYWORDS = new Set(['NO', 'NOPE', 'NOT YET', 'HAVEN\'T'])

    if (YES_KEYWORDS.has(trimmed) || NO_KEYWORDS.has(trimmed)) {
      const { data: activePatient } = await supabase
        .from('patients')
        .select('id, name, owner_id')
        .eq('phone', fromNumber)
        .eq('enrollment_status', 'active')
        .limit(1)
        .single()

      if (activePatient) {
        const today = new Date().toISOString().slice(0, 10)
        const { data: escalation } = await supabase
          .from('reminder_escalations')
          .select('id, status')
          .eq('patient_id', activePatient.id)
          .eq('escalation_date', today)
          .in('status', ['pending', 'snoozed'])
          .limit(1)
          .single()

        if (escalation) {
          if (YES_KEYWORDS.has(trimmed)) {
            await supabase
              .from('reminder_escalations')
              .update({
                status: 'confirmed',
                confirmed_at: new Date().toISOString(),
              })
              .eq('id', escalation.id)

            twiml.message(
              '✅ Got it! Your medications have been marked as taken. Have a wonderful day! 💊'
            )
          } else {
            // NO
            await supabase
              .from('reminder_escalations')
              .update({ status: 'declined' })
              .eq('id', escalation.id)

            twiml.message(
              "Understood. We've noted that. Your caregiver may follow up."
            )
          }

          return new NextResponse(twiml.toString(), {
            headers: { 'Content-Type': 'text/xml' },
          })
        }
      }
    }

    // No recognized command, no pending enrollment — empty 200
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    })
  }

  // ----------------------------------------------------------------
  // Voice inbound — patient calls in to check their status
  // ----------------------------------------------------------------
  const callerNumber = formData.get('From') as string
  const twiml = new VoiceResponse()

  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('phone', callerNumber)
    .eq('active', true)
    .single()

  if (!patient) {
    twiml.say({ voice: 'Polly.Joanna' },
      'Welcome to RxNudge. We did not find your phone number in our system. Please contact your care coordinator. Goodbye.'
    )
    twiml.hangup()
    return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
  }

  const firstName = patient.name.split(' ')[0]

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const { data: meds } = await supabase
    .from('medications')
    .select('*')
    .eq('patient_id', patient.id)
    .eq('active', true)

  const { data: logs } = await supabase
    .from('dose_logs')
    .select('*')
    .eq('patient_id', patient.id)
    .gte('scheduled_at', today.toISOString())
    .lt('scheduled_at', tomorrow.toISOString())

  const totalMeds = (meds || []).length
  const confirmed = (logs || []).filter((l: any) => l.confirmed === true).length
  const missed = (logs || []).filter((l: any) => l.confirmed === false).length
  const pending = totalMeds - confirmed - missed

  let statusMessage = ''
  if (totalMeds === 0) {
    statusMessage = 'You have no medications set up for today.'
  } else if (confirmed === totalMeds) {
    statusMessage = `Great news! You have taken all ${totalMeds} of your medications today.`
  } else {
    statusMessage = `Today you have taken ${confirmed} of ${totalMeds} medications.`
    if (missed > 0) statusMessage += ` ${missed} ${missed === 1 ? 'dose was' : 'doses were'} missed.`
    if (pending > 0) statusMessage += ` ${pending} ${pending === 1 ? 'dose is' : 'doses are'} still pending.`
  }

  twiml.say({ voice: 'Polly.Joanna' },
    `Hello ${firstName}, welcome to RxNudge. ${statusMessage} Thank you for calling. Goodbye!`
  )
  twiml.hangup()

  return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
}
