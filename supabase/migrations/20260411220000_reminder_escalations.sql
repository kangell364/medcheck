CREATE TABLE IF NOT EXISTS reminder_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  medication_ids UUID[], -- all meds being reminded
  escalation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  step INTEGER NOT NULL DEFAULT 1, -- 1=SMS1, 2=SMS2, 3=call, 4=post-snooze SMS, 5=final SMS, 6=missed
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined', 'missed', 'snoozed')),
  confirmed_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  caregiver_alerted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_id, escalation_date)
);

-- Index for efficient lookups by patient + date
CREATE INDEX IF NOT EXISTS idx_reminder_escalations_patient_date
  ON reminder_escalations(patient_id, escalation_date);

-- Index for finding active (pending/snoozed) escalations
CREATE INDEX IF NOT EXISTS idx_reminder_escalations_status
  ON reminder_escalations(status) WHERE status IN ('pending', 'snoozed');

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_reminder_escalations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reminder_escalations_updated_at ON reminder_escalations;
CREATE TRIGGER trg_reminder_escalations_updated_at
  BEFORE UPDATE ON reminder_escalations
  FOR EACH ROW EXECUTE FUNCTION update_reminder_escalations_updated_at();
