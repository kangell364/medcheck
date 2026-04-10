CREATE TABLE IF NOT EXISTS callbacks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  medication_id UUID REFERENCES medications(id),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  scheduled_for TIMESTAMPTZ NOT NULL,
  fulfilled BOOLEAN DEFAULT FALSE,
  fulfilled_at TIMESTAMPTZ,
  call_sid TEXT
);
ALTER TABLE callbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own callbacks" ON callbacks FOR SELECT USING (patient_id IN (SELECT id FROM patients WHERE owner_id = auth.uid()));
CREATE POLICY "Users can insert own callbacks" ON callbacks FOR INSERT WITH CHECK (patient_id IN (SELECT id FROM patients WHERE owner_id = auth.uid()));
