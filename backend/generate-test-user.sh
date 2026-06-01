#!/usr/bin/env bash

# Generate test user hash and seed to database

# Install go-task if needed
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Generate the password hash using Go
go run test-hash.go > hash_output.txt

if [ $? -ne 0 ]; then
    echo "Failed to generate hash"
    exit 1
fi

# Extract the hash from output
HASH=$(grep "^Hash:" hash_output.txt | cut -d' ' -f2-)

if [ -z "$HASH" ]; then
    echo "Failed to extract hash from output"
    cat hash_output.txt
    exit 1
fi

echo "Generated hash: $HASH"
echo "Remember - test credentials:"
echo "  Username: testuser"
echo "  Email: test@example.com"
echo "  Password: TestPassword123"

# Create SQL file with actual hash
cat > db/migrations/20260516000000_seed_test_user.sql << EOF
-- Seed test user for debugging login issues
-- Username: testuser
-- Email: test@example.com
-- Password: TestPassword123

INSERT INTO users (id, email, username, display_name, password_hash, role, account_status, is_anonymous, updated_at)
VALUES (
    'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid,
    'test@example.com',
    'testuser',
    'Test User',
    '$HASH',
    'USER',
    'ACTIVE',
    false,
    NOW()
) ON CONFLICT (username) DO NOTHING;

-- Insert privacy settings
INSERT INTO user_privacy_settings (user_id, profile_visibility, last_seen_visibility, allow_friend_requests, allow_trusted_invites, searchable_by_email, searchable_by_username, post_default_privacy, show_online_status, updated_at)
VALUES (
    'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid,
    'CONNECTIONS',
    'CONNECTIONS',
    true,
    true,
    false,
    true,
    'FRIENDS',
    true,
    NOW()
) ON CONFLICT DO NOTHING;
EOF

echo "Migration file created: db/migrations/20260516000000_seed_test_user.sql"
echo "Run migrations to seed the test user"

rm hash_output.txt
