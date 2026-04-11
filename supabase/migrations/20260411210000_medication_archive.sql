-- Add archived_at to medications table
-- archived_at = NULL means active; archived_at = timestamp means archived
-- Backfill: rows where active = false get archived_at set to created_at (best guess)
ALTER TABLE medications
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Backfill existing soft-deleted (active=false) rows
UPDATE medications
  SET archived_at = COALESCE(created_at, NOW())
  WHERE active = false AND archived_at IS NULL;
