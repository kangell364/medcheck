-- SMS opt-out compliance columns (TCPA)
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS sms_opted_out BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_opted_out_at TIMESTAMPTZ;

-- Backfill existing rows
UPDATE patients
SET sms_opted_out = false
WHERE sms_opted_out IS NULL;
