import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { createAdminClient } from '@/lib/supabase/admin'

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN!
const TWILIO_NUMBER = process.env.TWILIO_PHONE_NUMBER!

export async function GET() {
  try {
    const supabase = createAdminClient()
    const twilioClient = twilio(TWILIO_SID, TWILIO_TOKEN)

    const now = new Date()
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    // Fetch appointments within next 24 hours with status 'upcoming'
    // that haven't received a 'day_before' reminder yet.
    // We include the patient's timezone so we can format times correctly.
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('*, patients(id, name, phone, timezone)')
      .eq('status', 'upcoming')
      .gte('appointment_date', now.toISOString().split('T')[0])
      .lte('appointment_date', in24h.toISOString().split('T')[0])

    if (error) {
      console.error('Appointments fetch error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    const results: { appointmentId: string; status: string }[] = []

    for (const appt of appointments || []) {
      const remindersSent: { type: string; sent_at: string }[] = appt.reminders_sent || []
      const alreadySent = remindersSent.some(r => r.type === 'day_before')
      if (alreadySent) {
        results.push({ appointmentId: appt.id, status: 'already_sent' })
        continue
      }

      const patient = (appt as any).patients
      if (!patient?.phone) {
        results.push({ appointmentId: appt.id, status: 'no_phone' })
        continue
      }

      // Format appointment date/time using the patient's timezone
      const patientTimezone: string = patient.timezone || 'America/Chicago'

      // appointment_date is a date string (YYYY-MM-DD) and appointment_time is "HH:MM:SS"
      // The combined string is treated as a wall-clock time — we need the UTC equivalent
      // in the patient's timezone to do proper 24h window checking.
      // We build the naive date and then verify it falls within the next 24h window.
      const apptDate = new Date(`${appt.appointment_date}T${appt.appointment_time}:00`)

      // Verify the appointment is actually within the next 24 hours from now
      // (the DB query uses UTC dates which may be off by a few hours for edge TZs)
      if (apptDate.getTime() < now.getTime() || apptDate.getTime() > in24h.getTime()) {
        results.push({ appointmentId: appt.id, status: 'outside_24h_window' })
        continue
      }
      const dateStr = new Intl.DateTimeFormat('en-US', {
        timeZone: patientTimezone,
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).format(apptDate)
      const timeStr = new Intl.DateTimeFormat('en-US', {
        timeZone: patientTimezone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(apptDate)

      const rideNote = appt.needs_ride ? ' Please arrange transportation.' : ''
      const message =
        `RxNudge Reminder: ${patient.name} has a ${appt.appointment_type} appointment with ${appt.doctor_name}` +
        (appt.location ? ` at ${appt.location}` : '') +
        ` on ${dateStr} at ${timeStr}.${rideNote}`

      try {
        await twilioClient.messages.create({
          body: message,
          from: TWILIO_NUMBER,
          to: patient.phone,
        })

        // Update reminders_sent
        const updatedReminders = [
          ...remindersSent,
          { type: 'day_before', sent_at: new Date().toISOString() },
        ]
        await supabase
          .from('appointments')
          .update({ reminders_sent: updatedReminders })
          .eq('id', appt.id)

        results.push({ appointmentId: appt.id, status: 'sent' })
      } catch (err) {
        console.error(`SMS error for appointment ${appt.id}:`, err)
        results.push({ appointmentId: appt.id, status: 'sms_failed' })
      }
    }

    return NextResponse.json({ success: true, processed: results.length, results })
  } catch (err) {
    console.error('Reminders route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
