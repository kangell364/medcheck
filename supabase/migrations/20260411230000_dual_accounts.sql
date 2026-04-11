-- Add role to profiles (caregiver or patient)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS user_type TEXT NOT NULL DEFAULT 'caregiver'
    CHECK (user_type IN ('caregiver', 'patient'));

-- Add user_id to patients (links patient account to their caregiver)
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Add generated_password to patients (for magic link login)
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS generated_password TEXT;

-- Link table: one patient can have multiple caregivers
CREATE TABLE IF NOT EXISTS patient_caregivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  caregiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship TEXT, -- 'son', 'daughter', 'spouse', etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_id, caregiver_id)
);

-- Magic link tokens for patient onboarding
CREATE TABLE IF NOT EXISTS patient_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for patient_caregivers
ALTER TABLE patient_caregivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Caregivers can manage their links"
  ON patient_caregivers
  FOR ALL
  USING (caregiver_id = auth.uid());

CREATE POLICY "Patients can view their caregivers"
  ON patient_caregivers
  FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE user_id = auth.uid()
    )
  );

-- RLS for patient_invites
ALTER TABLE patient_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages invites"
  ON patient_invites
  FOR ALL
  USING (true)
  WITH CHECK (true);
