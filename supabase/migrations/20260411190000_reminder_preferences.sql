-- Add reminder preference columns to patients table
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS contact_method TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS reminder_time TIME NOT NULL DEFAULT '08:00:00';

-- Add check constraint for contact_method
ALTER TABLE patients
  DROP CONSTRAINT IF EXISTS patients_contact_method_check;

ALTER TABLE patients
  ADD CONSTRAINT patients_contact_method_check
  CHECK (contact_method IN ('call', 'text', 'both'));

-- Backfill existing rows with defaults (already handled by DEFAULT, but explicit for safety)
UPDATE patients
SET
  reminders_enabled = true,
  contact_method = 'text',
  reminder_time = '08:00:00'
WHERE reminders_enabled IS NULL
   OR contact_method IS NULL
   OR reminder_time IS NULL;
