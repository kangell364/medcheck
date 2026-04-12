-- Medication change requests: members request changes/additions, caregivers approve/decline
CREATE TABLE IF NOT EXISTS med_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  medication_id UUID REFERENCES medications(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES auth.users(id),
  type TEXT NOT NULL DEFAULT 'change' CHECK (type IN ('change', 'new_medication')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  -- Requested changes (same fields as medications)
  requested_name TEXT,
  requested_dosage TEXT,
  requested_frequency TEXT,
  requested_reminder_times TEXT[],
  requested_nickname TEXT,
  requested_notes TEXT,
  member_note TEXT,       -- Member's explanation of why they want the change
  -- Response
  caregiver_note TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable realtime for live badge updates
ALTER PUBLICATION supabase_realtime ADD TABLE med_change_requests;

-- Extend alert_log event_type to include change request events
ALTER TABLE alert_log DROP CONSTRAINT IF EXISTS alert_log_event_type_check;
ALTER TABLE alert_log ADD CONSTRAINT alert_log_event_type_check CHECK (event_type IN (
  'missed_dose',
  'call_placed', 'call_answered', 'call_failed', 'call_no_answer',
  'dose_confirmed_call', 'dose_declined_call',
  'callback_scheduled', 'callback_fulfilled',
  'snooze_started', 'snooze_expired',
  'appointment_reminder', 'appointment_completed', 'appointment_missed',
  'med_added', 'med_deleted', 'med_edited',
  'patient_updated', 'contact_added',
  'system_error', 'sms_failed', 'delivery_delayed',
  'med_change_request', 'change_approved', 'change_declined',
  'new_med_request', 'new_med_approved', 'new_med_declined'
));
