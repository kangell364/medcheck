import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { createAdminClient } from '@/lib/supabase/admin'

const VoiceResponse = twilio.twiml.VoiceResponse

// Handles inbound calls — patient calls in to check their status
export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const callerNumber = formData.get('From') as string
  const digits = formData.get('Digits') as string | null

  const twiml = new VoiceResponse()
  const supabase = createAdminClient()

  // Find patient by phone number
  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('phone', callerNumber)
    .eq('active', true)
    .single()

  if (!patient) {
    twiml.say({ voice: 'Polly.Joanna' },
      'Welcome to MedCheck. We did not find your phone number in our system. Please contact your care coordinator. Goodbye.'
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
    `Hello ${firstName}, welcome to MedCheck. ${statusMessage} Thank you for calling. Goodbye!`
  )
  twiml.hangup()

  return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
}
