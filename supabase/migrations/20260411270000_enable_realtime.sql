-- Enable realtime for patients table
-- Required for the caregiver's Members page to auto-update when a member
-- accepts their enrollment (enrollment_status changes to 'active').
--
-- To apply via Supabase dashboard:
--   Database → Replication → supabase_realtime publication → Add table → patients
--
-- Or run this migration against your Supabase project:
ALTER PUBLICATION supabase_realtime ADD TABLE patients;
