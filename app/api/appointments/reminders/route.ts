import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTimezoneForState } from '@/lib/stateTimezone'

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN!
const TWILIO_NUMBER = process.env.TWILIO_PHONE_NUMBER!
const SMS_APPROVED = process.env.SMS_APPROVED === 'true'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://rxnudge.app'

// Window constants (in milliseconds)
const DAY_BEFORE_MIN = (23 * 60 + 45) * 60 * 1000  // 23h45m
const DAY_BEFORE_MAX = (24 * 60 + 15) * 60 * 1000  // 24h15m
const ONE_HOUR_MIN  = (45) * 60 * 1000              // 45m
const ONE_HOUR_MAX  = (60 + 15) * 60 * 1000         // 1h15m

type ReminderWindow = 'day_before' | 'one_hour'

interface ReminderSent {
  type: string
  sent_at: string
  method?: string
}

function buildApptDateTime(appt: { appointment_date: string; appointment_time: string }): Date {
  // appointment_date = 'YYYY-MM-DD', appointment_time = 'HH:MM:SS'
  return new Date(`${appt.appointment_date}T${appt.appointment_time}`)
}

function formatTimeStr(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

function buildPushPayload(
  window: ReminderWindow,
  appt: {
    appointment_type: string
    doctor_name: string
    location?: string | null
  },
  timeStr: string
) {
  const locPart = appt.location ? ` ${appt.location}` : ''

  if (window === 'day_before') {
    return {
      title: '📅 Appointment Tomorrow',
      body: `You have a ${appt.appointment_type} with ${appt.doctor_name} tomorrow at ${timeStr}.${locPart ? ` ${appt.location}` : ''}`,
      actions: ['Got it ✅', 'Snooze 1hr ⏰'],
    }
  } else {
    return {
      title: '⏰ Appointment in 1 Hour!',
      body: `${appt.appointment_type} with ${appt.doctor_name} at ${timeStr}${locPart ? `, ${appt.location}` : ''}. Don't forget!`,
      actions: ['Got it ✅', 'Need a ride? 🚗'],
    }
  }
}

function buildSmsBody(
  window: ReminderWindow,
  appt: {
    appointment_type: string
    doctor_name: string
    location?: string | null
  },
  timeStr: string
): string {
  const locPart = appt.location ? `, at ${appt.location}` : ''

  if (window === 'day_before') {
    return (
      `📅 RxNudge Reminder: You have a ${appt.appointment_type} with ${appt.doctor_name} tomorrow at ${timeStr}${locPart}. Reply STOP to opt out.`
    )
  } else {
    return (
      `⏰ Reminder: Your ${appt.appointment_type} with ${appt.doctor_name} is in 1 hour at ${timeStr}${locPart}. Reply STOP to opt out.`
    )
  }
}

export async function GET() {
  try {
    const supabase = createAdminClient()
    const twilioClient = twilio(TWILIO_SID, TWILIO_TOKEN)

    const now = new Date()

    // Fetch all upcoming appointments — we'll filter by window ourselves
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('*, patients(id, name, phone, state, timezone, contact_method, sms_opted_out)')
      .eq('status', 'upcoming')

    if (error) {
      console.error('Appointments fetch error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    const results: { appointmentId: string; window?: string; status: string; methods?: string[] }[] = []

    for (const appt of appointments || []) {
      const patient = (appt as any).patients
      if (!patient) {
        results.push({ appointmentId: appt.id, status: 'no_patient' })
        continue
      }

      const remindersSent: ReminderSent[] = appt.reminders_sent || []

      // Determine patient timezone
      const timezone = patient.timezone || (patient.state ? getTimezoneForState(patient.state) : 'America/Chicago')

      // Build appointment datetime
      const apptDate = buildApptDateTime(appt)
      const msUntil = apptDate.getTime() - now.getTime()

      // Determine which window(s) to process
      const windows: ReminderWindow[] = []

      const dayBeforeAlreadySent = remindersSent.some(r => r.type === 'day_before')
      const oneHourAlreadySent = remindersSent.some(r => r.type === 'one_hour')

      if (!dayBeforeAlreadySent && msUntil >= DAY_BEFORE_MIN && msUntil <= DAY_BEFORE_MAX) {
        windows.push('day_before')
      }
      if (!oneHourAlreadySent && msUntil >= ONE_HOUR_MIN && msUntil <= ONE_HOUR_MAX) {
        windows.push('one_hour')
      }

      if (windows.length === 0) {
        results.push({ appointmentId: appt.id, status: 'no_window_matched' })
        continue
      }

      const timeStr = formatTimeStr(apptDate, timezone)

      for (const window of windows) {
        const methodsUsed: string[] = []

        // 1. Push notification
        const { data: pushSub } = await supabase
          .from('push_subscriptions')
          .select('id')
          .eq('patient_id', patient.id)
          .single()

        if (pushSub) {
          try {
            const push = buildPushPayload(window, appt, timeStr)
            const baseUrl = APP_URL.replace(/\/$/, '')
            await fetch(`${baseUrl}/api/push/send`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                patient_id: patient.id,
                title: push.title,
                body: push.body,
                data: {
                  type: 'appointment_reminder',
                  window,
                  appointmentId: appt.id,
                  actions: push.actions,
                },
              }),
            })
            methodsUsed.push('push')
          } catch (err) {
            console.error(`Push error for appointment ${appt.id} (${window}):`, err)
          }
        }

        // 2. SMS
        const canSms =
          SMS_APPROVED &&
          !patient.sms_opted_out &&
          patient.phone &&
          (patient.contact_method === 'text' || patient.contact_method === 'both')

        if (canSms) {
          try {
            const smsBody = buildSmsBody(window, appt, timeStr)
            await twilioClient.messages.create({
              body: smsBody,
              from: TWILIO_NUMBER,
              to: patient.phone,
            })
            methodsUsed.push('sms')
          } catch (err) {
            console.error(`SMS error for appointment ${appt.id} (${window}):`, err)
          }
        }

        // 3. Voice call
        const canCall =
          patient.phone &&
          (patient.contact_method === 'call' || patient.contact_method === 'both')

        if (canCall) {
          try {
            const baseUrl = APP_URL.replace(/\/$/, '')
            const twimlUrl = `${baseUrl}/api/appointments/reminder-call?appointmentId=${encodeURIComponent(appt.id)}&window=${window}`
            await twilioClient.calls.create({
              url: twimlUrl,
              from: TWILIO_NUMBER,
              to: patient.phone,
            })
            methodsUsed.push('call')
          } catch (err) {
            console.error(`Voice call error for appointment ${appt.id} (${window}):`, err)
          }
        }

        // Update reminders_sent
        if (methodsUsed.length > 0 || true) {
          // Always mark as sent to avoid repeated attempts even if all methods failed
          const updatedReminders: ReminderSent[] = [
            ...remindersSent,
            {
              type: window,
              sent_at: new Date().toISOString(),
              method: methodsUsed.join('+') || 'none',
            },
          ]
          await supabase
            .from('appointments')
            .update({ reminders_sent: updatedReminders })
            .eq('id', appt.id)

          // Update remindersSent for subsequent windows in same loop
          remindersSent.push({
            type: window,
            sent_at: new Date().toISOString(),
            method: methodsUsed.join('+') || 'none',
          })
        }

        results.push({
          appointmentId: appt.id,
          window,
          status: methodsUsed.length > 0 ? 'sent' : 'no_methods_available',
          methods: methodsUsed,
        })
      }
    }

    return NextResponse.json({ success: true, processed: results.length, results })
  } catch (err) {
    console.error('Reminders route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
