CREATE TABLE IF NOT EXISTS doctors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  specialty TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own doctors" ON doctors
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own doctors" ON doctors
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own doctors" ON doctors
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own doctors" ON doctors
  FOR DELETE USING (owner_id = auth.uid());
