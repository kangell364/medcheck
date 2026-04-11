import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { createAdminClient } from '@/lib/supabase/admin'

const VoiceResponse = twilio.twiml.VoiceResponse
const MessagingResponse = twilio.twiml.MessagingResponse

// Handle inbound calls (voice) — patient calls in to check their status
export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') || ''
  const formData = await request.formData()

  const supabase = createAdminClient()

  // ----------------------------------------------------------------
  // SMS inbound — enrollment YES/NO handler
  // ----------------------------------------------------------------
  const messageBody = formData.get('Body') as string | null
  if (messageBody !== null) {
    const fromNumber = formData.get('From') as string
    const trimmed = messageBody.trim().toUpperCase()

    // Check if this number has a pending enrollment
    const { data: pendingPatient } = await supabase
      .from('patients')
      .select('*')
      .eq('phone', fromNumber)
      .eq('enrollment_status', 'pending')
      .single()

    if (pendingPatient) {
      const twiml = new MessagingResponse()

      if (trimmed === 'YES') {
        await supabase
          .from('patients')
          .update({ enrollment_status: 'active' })
          .eq('id', pendingPatient.id)

        twiml.message(
          "You're all set! RxNudge will remind you about your medications daily. Reply STOP anytime to opt out. 💊"
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

    // No pending enrollment — return empty 200 (or could handle other SMS flows)
    const twiml = new MessagingResponse()
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    })
  }

  // ----------------------------------------------------------------
  // Voice inbound — patient calls in to check their status
  // ----------------------------------------------------------------
  const callerNumber = formData.get('From') as string
  const twiml = new VoiceResponse()

  // Find patient by phone number
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

  // Get today's status
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
  const confirmed = (logs || []).filter(l => l.confirmed === true).length
  const missed = (logs || []).filter(l => l.confirmed === false).length
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
