-- Add account lockout columns for brute-force protection
ALTER TABLE users
    ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN locked_until TIMESTAMP(3);

-- Index for lockout queries
CREATE INDEX users_locked_until_idx ON users(locked_until);
