export interface Profile {
  id: string
  full_name: string | null
  phone: string | null
  user_type: 'self' | 'caregiver'
  plan: string
  stripe_customer_id: string | null
  created_at: string
}

export interface Patient {
  id: string
  owner_id: string
  name: string
  phone: string
  /** US state abbreviation (e.g. "TX"). Timezone is derived from this via getTimezoneForState(). */
  state: string | null
  /** @deprecated Stored in DB for legacy rows. New code derives timezone from state. */
  timezone?: string | null
  is_self: boolean
  active: boolean
  enrollment_status: 'pending' | 'active' | 'declined' | 'inactive'
  reminders_enabled: boolean
  contact_method: 'call' | 'text' | 'both'
  reminder_time: string // HH:MM:SS format
  sms_opted_out: boolean
  sms_opted_out_at: string | null
  created_at: string
}

export interface Medication {
  id: string
  patient_id: string
  name: string
  /** Optional friendly name used in SMS + AI voice calls (e.g. "blue pill", "heart pill") */
  nickname: string | null
  dosage: string | null
  frequency: 'once' | 'twice' | 'three_times'
  reminder_times: string[]
  notes: string | null
  active: boolean
  start_date: string | null
  archived_at: string | null
  created_at: string
}

export interface DoseLog {
  id: string
  patient_id: string
  medication_id: string
  medication_name: string | null
  scheduled_at: string
  confirmed: boolean | null
  confirmed_at: string | null
  method: 'call' | 'sms' | 'inbound' | 'manual' | 'app' | 'snooze' | null
  call_sid: string | null
  snooze_until: string | null
  created_at: string
}

export interface PatientAlert {
  id: string
  patient_id: string
  name: string
  phone: string | null
  email: string | null
  alert_sms: boolean
  alert_email: boolean
  created_at: string
}

export interface AlertLog {
  id: string
  patient_id: string
  medication_id: string | null
  alert_type: string | null
  message: string | null
  sent_to: string | null
  sent_at: string
  // v2 fields
  event_type?: string | null
  patient_name?: string | null
  medication_name?: string | null
  display_message?: string | null
  internal_details?: Record<string, unknown> | null
  severity?: 'info' | 'warning' | 'error' | 'success' | null
  owner_id?: string | null
}

// Extended types with relations
export interface PatientWithMeds extends Patient {
  medications: Medication[]
}

export interface MedicationWithStatus extends Medication {
  todayLogs: DoseLog[]
  todayStatus: 'confirmed' | 'missed' | 'pending'
}

// Escalation engine
export type EscalationStatus = 'pending' | 'confirmed' | 'declined' | 'missed' | 'snoozed'

export interface ReminderEscalation {
  id: string
  patient_id: string
  medication_ids: string[]
  escalation_date: string // YYYY-MM-DD
  /** 1=SMS1, 2=SMS2, 3=AI call, 4=post-snooze SMS, 5=final SMS, 6=missed */
  step: number
  status: EscalationStatus
  confirmed_at: string | null
  snoozed_until: string | null
  caregiver_alerted: boolean
  created_at: string
  updated_at: string
}

// Affiliate / referral program types
export interface Affiliate {
  id: string
  user_id: string
  referred_by: string | null
  referral_code: string
  status: 'pending' | 'active' | 'suspended'
  company_name: string | null
  bio: string | null
  approved_at: string | null
  level1_rate: number
  level2_rate: number
  created_at: string
}

export interface Referral {
  id: string
  affiliate_id: string
  referred_user_id: string
  referral_code: string
  signed_up_at: string
  status: 'active' | 'churned'
  churned_at: string | null
  monthly_revenue: number
}

export interface AffiliateEarnings {
  id: string
  affiliate_id: string
  referral_id: string
  level: 1 | 2
  period_month: string
  gross_revenue: number
  rate: number
  earnings: number
  status: 'pending' | 'paid'
  paid_at: string | null
}
