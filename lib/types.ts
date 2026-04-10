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
}

// Extended types with relations
export interface PatientWithMeds extends Patient {
  medications: Medication[]
}

export interface MedicationWithStatus extends Medication {
  todayLogs: DoseLog[]
  todayStatus: 'confirmed' | 'missed' | 'pending'
}
