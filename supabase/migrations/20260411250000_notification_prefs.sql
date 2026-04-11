ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS notification_style TEXT NOT NULL DEFAULT 'normal'
    CHECK (notification_style IN ('silent', 'normal', 'alarm')),
  ADD COLUMN IF NOT EXISTS notification_volume INTEGER NOT NULL DEFAULT 80
    CHECK (notification_volume >= 0 AND notification_volume <= 100),
  ADD COLUMN IF NOT EXISTS notification_sound TEXT NOT NULL DEFAULT 'default';
