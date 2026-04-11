-- Push subscriptions for Web Push notifications
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_id)
);

-- Persistent token for public patient link (no login required)
ALTER TABLE patients ADD COLUMN IF NOT EXISTS permanent_token TEXT UNIQUE DEFAULT gen_random_uuid()::text;

-- Patient consent / TCPA / terms tracking
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_accepted_ip TEXT,
  ADD COLUMN IF NOT EXISTS terms_version TEXT,
  ADD COLUMN IF NOT EXISTS sms_consent_at TIMESTAMPTZ;
