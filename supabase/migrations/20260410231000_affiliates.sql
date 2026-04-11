-- Affiliates table: approved referral partners
CREATE TABLE IF NOT EXISTS affiliates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  referred_by UUID REFERENCES affiliates(id),  -- Level 2: who referred this affiliate
  referral_code TEXT UNIQUE NOT NULL,           -- e.g. "JSMITH" — used in referral links
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','active','suspended')),
  company_name TEXT,
  bio TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  level1_rate NUMERIC(5,4) DEFAULT 0.20,        -- 20% default
  level2_rate NUMERIC(5,4) DEFAULT 0.05,        -- 5% default
  payout_method TEXT DEFAULT 'stripe',
  stripe_account_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Affiliates can view own record" ON affiliates FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Affiliates can update own record" ON affiliates FOR UPDATE USING (user_id = auth.uid());

-- Referrals table: tracks which affiliate referred which subscriber
CREATE TABLE IF NOT EXISTS referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  signed_up_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active','churned')),
  churned_at TIMESTAMPTZ,
  monthly_revenue NUMERIC(10,2) DEFAULT 0,      -- current MRR from this subscriber
  UNIQUE(referred_user_id)                       -- one subscriber = one affiliate
);
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Affiliates can view own referrals" ON referrals FOR SELECT USING (
  affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid())
);

-- Affiliate earnings table: monthly earnings records
CREATE TABLE IF NOT EXISTS affiliate_earnings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE CASCADE,
  referral_id UUID REFERENCES referrals(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level IN (1, 2)),
  period_month DATE NOT NULL,                   -- first day of month e.g. 2026-04-01
  gross_revenue NUMERIC(10,2) NOT NULL,
  rate NUMERIC(5,4) NOT NULL,
  earnings NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  paid_at TIMESTAMPTZ,
  stripe_transfer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(affiliate_id, referral_id, period_month, level)
);
ALTER TABLE affiliate_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Affiliates can view own earnings" ON affiliate_earnings FOR SELECT USING (
  affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid())
);

-- Track referral code on profiles for signup attribution
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_affiliate BOOLEAN DEFAULT FALSE;
