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
    // that haven't received a 'day_before' reminder yet
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('*, patients(id, name, phone)')
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

      // Format appointment date/time nicely
      const apptDate = new Date(`${appt.appointment_date}T${appt.appointment_time}`)
      const dateStr = apptDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
      const timeStr = apptDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })

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
