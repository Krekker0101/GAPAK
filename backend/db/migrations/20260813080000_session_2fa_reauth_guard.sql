ALTER TABLE device_sessions ADD COLUMN IF NOT EXISTS two_factor_verified_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS device_sessions_2fa_verified_idx ON device_sessions (user_id, two_factor_verified_at DESC) WHERE revoked_at IS NULL;
