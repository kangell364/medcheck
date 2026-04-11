-- Add state column to patients table
-- timezone column is kept for backward compatibility but will be derived from state in the app
ALTER TABLE patients ADD COLUMN IF NOT EXISTS state TEXT;

-- Populate state from existing timezone values where we can guess
-- (best-effort; users will update via the new form)
UPDATE patients
SET state = CASE
  WHEN timezone = 'America/New_York'    THEN 'NY'
  WHEN timezone = 'America/Chicago'     THEN 'TX'
  WHEN timezone = 'America/Denver'      THEN 'CO'
  WHEN timezone = 'America/Phoenix'     THEN 'AZ'
  WHEN timezone = 'America/Los_Angeles' THEN 'CA'
  WHEN timezone = 'America/Anchorage'   THEN 'AK'
  WHEN timezone = 'Pacific/Honolulu'    THEN 'HI'
  ELSE NULL
END
WHERE state IS NULL AND timezone IS NOT NULL;
