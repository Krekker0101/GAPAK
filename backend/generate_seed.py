#!/usr/bin/env python3
"""
Generate test user seed SQL with proper Argon2id hash.
"""

import subprocess
import json
import sys

# Create a Go program to generate the hash
go_code = '''package main

import (
	"fmt"
	"strings"

	"github.com/alexedwards/argon2id"
	"github.com/google/uuid"
)

func main() {
	password := "TestPassword123"
	pepper := "this-is-a-pepper-secret-minimum-16-chars-long-value"

	params := &argon2id.Params{
		Memory:      256 * 1024,
		Iterations:  3,
		Parallelism: 2,
		SaltLength:  16,
		KeyLength:   32,
	}

	hash, _ := argon2id.CreateHash(strings.TrimSpace(password)+pepper, params)
	userID := uuid.NewString()

	fmt.Println(hash)
}
'''

try:
    # Run the Go code to generate hash
    result = subprocess.run(['go', 'run', '-'], input=go_code.encode(), 
                          cwd='d:\\GO-Lessons\\pro-go\\Gapak\\backend',
                          capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"Error: {result.stderr}", file=sys.stderr)
        sys.exit(1)
        
    hash_value = result.stdout.strip()
    
    # Generate SQL
    sql = f"""-- Seed test user for debugging login issues
-- Username: testuser
-- Email: test@example.com
-- Password: TestPassword123

INSERT INTO users (id, email, username, display_name, password_hash, role, account_status, is_anonymous, updated_at)
VALUES (
    'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid,
    'test@example.com',
    'testuser',
    'Test User',
    '{hash_value}',
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
"""
    
    print(sql)
    
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
