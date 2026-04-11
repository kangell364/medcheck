import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTimezoneForState } from '@/lib/stateTimezone'

/**
 * GET /api/appointments/reminder-call?appointmentId=X&window=day_before|one_hour
 *
 * Returns TwiML for a voice reminder call. Called by Twilio when placing outbound call.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const appointmentId = searchParams.get('appointmentId')
  const window = searchParams.get('window') as 'day_before' | 'one_hour' | null

  if (!appointmentId) {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, we could not find your appointment information. Goodbye.</Say></Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    )
  }

  try {
    const supabase = createAdminClient()

    const { data: appt, error } = await supabase
      .from('appointments')
      .select('*, patients(id, name, phone, state, timezone)')
      .eq('id', appointmentId)
      .single()

    if (error || !appt) {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, we could not find your appointment information. Goodbye.</Say></Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    const patient = (appt as any).patients
    const timezone = (patient?.timezone) || (patient?.state ? getTimezoneForState(patient.state) : 'America/Chicago')
    const patientFirstName = patient?.name ? patient.name.split(' ')[0] : 'there'

    // Format appointment time
    const apptDate = new Date(`${appt.appointment_date}T${appt.appointment_time}`)
    const timeStr = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(apptDate)

    const appointmentType = appt.appointment_type || 'appointment'
    const doctorName = appt.doctor_name || 'your doctor'
    const locationPart = appt.location ? ` at ${appt.location}.` : ''

    const whenPhrase =
      window === 'one_hour'
        ? `in about one hour, at ${timeStr}`
        : `tomorrow at ${timeStr}`

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    Hello ${patientFirstName}, this is R X Nudge with a reminder.
    You have a ${appointmentType} appointment with ${doctorName} ${whenPhrase}.${locationPart}
    Have a great day!
  </Say>
</Response>`

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    })
  } catch (err) {
    console.error('reminder-call route error:', err)
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, there was an error retrieving your appointment. Goodbye.</Say></Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    )
  }
}
