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
  timezone: string
  is_self: boolean
  active: boolean
  created_at: string
}

export interface Medication {
  id: string
  patient_id: string
  name: string
  dosage: string | null
  frequency: 'once' | 'twice' | 'three_times'
  reminder_times: string[]
  notes: string | null
  active: boolean
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
  method: 'call' | 'sms' | 'inbound' | 'manual' | 'app' | null
  call_sid: string | null
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
