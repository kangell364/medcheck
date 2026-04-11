import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'

export type EventType =
  | 'missed_dose'
  | 'call_placed'
  | 'call_answered'
  | 'call_failed'
  | 'call_no_answer'
  | 'dose_confirmed_call'
  | 'dose_declined_call'
  | 'callback_scheduled'
  | 'callback_fulfilled'
  | 'snooze_started'
  | 'snooze_expired'
  | 'appointment_reminder'
  | 'appointment_completed'
  | 'appointment_missed'
  | 'med_added'
  | 'med_deleted'
  | 'med_edited'
  | 'patient_updated'
  | 'contact_added'
  | 'system_error'
  | 'sms_sent'
  | 'sms_failed'
  | 'delivery_delayed'

export type Severity = 'info' | 'warning' | 'error' | 'success'

// Customer-friendly messages for each event type
const DISPLAY_MESSAGES: Record<EventType, string> = {
  missed_dose: 'Missed dose — alert sent to contacts',
  call_placed: 'Medication reminder call placed',
  call_answered: 'Patient answered reminder call',
  call_failed: 'Unable to reach patient — will retry at next scheduled time',
  call_no_answer: 'No answer — patient will be contacted at next scheduled time',
  dose_confirmed_call: 'Patient confirmed medication taken via call',
  dose_declined_call: 'Patient indicated medication not yet taken',
  callback_scheduled: 'Callback reminder scheduled',
  callback_fulfilled: 'Callback call completed',
  snooze_started: 'Medication reminder snoozed',
  snooze_expired: 'Snooze expired — medication still unconfirmed',
  appointment_reminder: 'Appointment reminder sent',
  appointment_completed: 'Appointment marked as completed',
  appointment_missed: 'Appointment missed',
  med_added: 'Medication added',
  med_deleted: 'Medication removed',
  med_edited: 'Medication updated',
  patient_updated: 'Patient profile updated',
  contact_added: 'Alert contact added',
  system_error: 'Service temporarily unavailable — our team has been notified',
  sms_sent: 'Medication reminder SMS sent',
  sms_failed: 'Message delivery delayed — will retry shortly',
  delivery_delayed: 'Reminder delivery delayed',
}

const SEVERITY_MAP: Record<EventType, Severity> = {
  missed_dose: 'warning',
  call_placed: 'info',
  call_answered: 'success',
  call_failed: 'warning',
  call_no_answer: 'warning',
  dose_confirmed_call: 'success',
  dose_declined_call: 'warning',
  callback_scheduled: 'info',
  callback_fulfilled: 'success',
  snooze_started: 'info',
  snooze_expired: 'warning',
  appointment_reminder: 'info',
  appointment_completed: 'success',
  appointment_missed: 'warning',
  med_added: 'info',
  med_deleted: 'info',
  med_edited: 'info',
  patient_updated: 'info',
  contact_added: 'info',
  system_error: 'error',
  sms_sent: 'info',
  sms_failed: 'error',
  delivery_delayed: 'warning',
}

export interface LogEventParams {
  patientId: string
  ownerId: string
  eventType: EventType
  patientName?: string
  medicationId?: string
  medicationName?: string
  sentTo?: string
  internalDetails?: Record<string, unknown> // full technical error — admin only
  customDisplayMessage?: string // override the default display message
}

async function writeLogEvent(supabase: SupabaseClient, params: LogEventParams) {
  const displayMessage = params.customDisplayMessage || DISPLAY_MESSAGES[params.eventType]
  const severity = SEVERITY_MAP[params.eventType]

  await supabase.from('alert_log').insert({
    patient_id: params.patientId,
    owner_id: params.ownerId,
    medication_id: params.medicationId || null,
    event_type: params.eventType,
    patient_name: params.patientName || null,
    medication_name: params.medicationName || null,
    alert_type: params.eventType,
    message: displayMessage,
    display_message: displayMessage,
    internal_details: params.internalDetails || null,
    severity,
    sent_to: params.sentTo || null,
    sent_at: new Date().toISOString(),
  })
}

/**
 * Log an event using the cookie-based server client.
 * Use this from server components and API routes that have cookie context.
 */
export async function logEvent(params: LogEventParams) {
  try {
    const supabase = await createClient()
    await writeLogEvent(supabase, params)
  } catch (err) {
    // Never let logging failures break the main flow
    console.error('logEvent failed:', err)
  }
}

/**
 * Log an event using the admin (service role) client.
 * Use this from API routes that use createAdminClient (no cookie context).
 */
export async function adminLogEvent(params: LogEventParams) {
  try {
    const supabase = createAdminClient()
    await writeLogEvent(supabase, params)
  } catch (err) {
    // Never let logging failures break the main flow
    console.error('adminLogEvent failed:', err)
  }
}
