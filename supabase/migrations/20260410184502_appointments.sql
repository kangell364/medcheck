CREATE TABLE IF NOT EXISTS appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  doctor_name TEXT NOT NULL,
  location TEXT,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  appointment_type TEXT DEFAULT 'checkup',
  needs_ride BOOLEAN DEFAULT FALSE,
  notes TEXT,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming','completed','missed','cancelled')),
  reminders_sent JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own appointments" ON appointments FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own appointments" ON appointments FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own appointments" ON appointments FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can delete own appointments" ON appointments FOR DELETE USING (owner_id = auth.uid());
