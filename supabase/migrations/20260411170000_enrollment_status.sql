-- Add enrollment_status to patients table
-- Values: pending | active | declined | inactive
-- New caregiver-enrolled patients start as 'pending'
-- Self-enrolled patients start as 'active'

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS enrollment_status TEXT NOT NULL DEFAULT 'active'
    CHECK (enrollment_status IN ('pending', 'active', 'declined', 'inactive'));

-- Backfill: existing patients are considered active
UPDATE patients SET enrollment_status = 'active' WHERE enrollment_status IS DISTINCT FROM 'active';
