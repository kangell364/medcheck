-- Extend alert_log with richer event tracking
ALTER TABLE alert_log ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'missed_dose' 
  CHECK (event_type IN (
    'missed_dose',
    'call_placed', 'call_answered', 'call_failed', 'call_no_answer',
    'dose_confirmed_call', 'dose_declined_call',
    'callback_scheduled', 'callback_fulfilled',
    'snooze_started', 'snooze_expired',
    'appointment_reminder', 'appointment_completed', 'appointment_missed',
    'med_added', 'med_deleted', 'med_edited',
    'patient_updated', 'contact_added',
    'system_error', 'sms_failed', 'delivery_delayed'
  ));
ALTER TABLE alert_log ADD COLUMN IF NOT EXISTS patient_name TEXT;
ALTER TABLE alert_log ADD COLUMN IF NOT EXISTS medication_name TEXT;
ALTER TABLE alert_log ADD COLUMN IF NOT EXISTS display_message TEXT;   -- customer-friendly message
ALTER TABLE alert_log ADD COLUMN IF NOT EXISTS internal_details JSONB; -- full technical details (admin only)
ALTER TABLE alert_log ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'info' 
  CHECK (severity IN ('info', 'warning', 'error', 'success'));
ALTER TABLE alert_log ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id);
