-- MedCheck Initial Schema
-- Run this in the Supabase SQL editor

-- User profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name TEXT,
  phone TEXT,
  user_type TEXT CHECK (user_type IN ('self', 'caregiver')) DEFAULT 'caregiver',
  plan TEXT DEFAULT 'free',
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patients (person taking meds — could be the user themselves or their parent)
CREATE TABLE IF NOT EXISTS patients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  timezone TEXT DEFAULT 'America/Chicago',
  is_self BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Medications
CREATE TABLE IF NOT EXISTS medications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT,
  frequency TEXT CHECK (frequency IN ('once', 'twice', 'three_times')) DEFAULT 'once',
  reminder_times TEXT[] DEFAULT ARRAY['08:00'],
  notes TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dose logs (core data — every confirmation or miss)
CREATE TABLE IF NOT EXISTS dose_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  medication_id UUID REFERENCES medications(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  confirmed BOOLEAN,
  confirmed_at TIMESTAMPTZ,
  method TEXT CHECK (method IN ('call', 'sms', 'inbound', 'manual', 'app')),
  call_sid TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_id, medication_id, scheduled_at)
);

-- Family alerts (who gets notified)
CREATE TABLE IF NOT EXISTS patient_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  alert_sms BOOLEAN DEFAULT TRUE,
  alert_email BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alert log
CREATE TABLE IF NOT EXISTS alert_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  medication_id UUID REFERENCES medications(id),
  alert_type TEXT,
  message TEXT,
  sent_to TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE dose_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles: users can only see/edit their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Patients: users can only see/edit their own patients
CREATE POLICY "Users can view own patients" ON patients
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert own patients" ON patients
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own patients" ON patients
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own patients" ON patients
  FOR DELETE USING (auth.uid() = owner_id);

-- Medications: scoped through patients
CREATE POLICY "Users can view own medications" ON medications
  FOR SELECT USING (
    patient_id IN (SELECT id FROM patients WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can insert own medications" ON medications
  FOR INSERT WITH CHECK (
    patient_id IN (SELECT id FROM patients WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can update own medications" ON medications
  FOR UPDATE USING (
    patient_id IN (SELECT id FROM patients WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can delete own medications" ON medications
  FOR DELETE USING (
    patient_id IN (SELECT id FROM patients WHERE owner_id = auth.uid())
  );

-- Dose logs: scoped through patients
CREATE POLICY "Users can view own dose logs" ON dose_logs
  FOR SELECT USING (
    patient_id IN (SELECT id FROM patients WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can insert own dose logs" ON dose_logs
  FOR INSERT WITH CHECK (
    patient_id IN (SELECT id FROM patients WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can update own dose logs" ON dose_logs
  FOR UPDATE USING (
    patient_id IN (SELECT id FROM patients WHERE owner_id = auth.uid())
  );

-- Patient alerts: scoped through patients
CREATE POLICY "Users can view own patient alerts" ON patient_alerts
  FOR SELECT USING (
    patient_id IN (SELECT id FROM patients WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can insert own patient alerts" ON patient_alerts
  FOR INSERT WITH CHECK (
    patient_id IN (SELECT id FROM patients WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can update own patient alerts" ON patient_alerts
  FOR UPDATE USING (
    patient_id IN (SELECT id FROM patients WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can delete own patient alerts" ON patient_alerts
  FOR DELETE USING (
    patient_id IN (SELECT id FROM patients WHERE owner_id = auth.uid())
  );

-- Alert log: scoped through patients
CREATE POLICY "Users can view own alert log" ON alert_log
  FOR SELECT USING (
    patient_id IN (SELECT id FROM patients WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can insert own alert log" ON alert_log
  FOR INSERT WITH CHECK (
    patient_id IN (SELECT id FROM patients WHERE owner_id = auth.uid())
  );

-- Create profile on signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
