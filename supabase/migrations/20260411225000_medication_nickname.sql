-- Add nickname column to medications (friendly/colloquial name for SMS + AI calls)
ALTER TABLE medications
  ADD COLUMN IF NOT EXISTS nickname TEXT;

COMMENT ON COLUMN medications.nickname IS
  'Optional plain-language name used in SMS reminders and AI voice calls (e.g. "blue pill", "heart pill"). If set, used instead of the official drug name in voice calls.';
