-- Add start_date to medications table
ALTER TABLE medications
  ADD COLUMN IF NOT EXISTS start_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Backfill existing rows with CURRENT_DATE as default
UPDATE medications
  SET start_date = CURRENT_DATE
  WHERE start_date IS NULL;
