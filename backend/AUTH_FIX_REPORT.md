# Authentication Error Fix Report

## Problem Summary
Frontend and backend are returning `401 Unauthorized` with error code `auth.invalid_credentials` during login/registration attempts.

## Root Cause Analysis

After analyzing the logs and codebase, I identified the following issue:

### Issue: No Test Users in Database
The primary cause of login failures is **the database contains no users**. When a login attempt is made:

1. Backend's `FindUserByLogin` (line 29-40 in `internal/modules/auth/repository.go`) queries for a user
2. If no user exists, it returns `ErrNotFound`
3. The service then applies a login failure delay and returns `auth.invalid_credentials`
4. Frontend receives 401 error

This is by design for security (not revealing whether a username exists), but means you cannot login until at least one user is created.

### Code Flow
1. **Frontend** (`src/app/login/page.tsx` line 48): Calls `authService.login()`
2. **Backend Controller** (`internal/modules/auth/controller.go` line 67): Receives login request
3. **Backend Service** (`internal/modules/auth/service.go` line 86-102): Attempts to find user and validate password
4. **Result**: Returns 401 if user not found or password is invalid

## Solution

You need to create at least one test user before you can login. Here are the options:

### Option 1: Use Registration API (Recommended for testing)
The registration endpoint (`POST /api/v1/auth/register`) works without authentication and can be used to create the first user:

```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: <token-from-csrf-endpoint>" \
  -b "gapak_csrf=<token>" \
  --data '{
    "username": "testuser",
    "email": "test@example.com",
    "displayName": "Test User",
    "password": "MyTestPassword123",
    "preferAnonymous": false
  }'
```

Steps:
1. First, get a CSRF token:
```bash
curl -X GET http://localhost:8080/api/v1/auth/csrf \
  -v 2>&1 | grep "gapak_csrf"
```

2. Extract the token value and CSRF token from the response

3. Use them in the register request above

4. Once registered, use the same credentials to login

### Option 2: Seed Database with SQL
If you want to pre-populate the database with a test user, you can:

1. Generate a password hash using the argon2id algorithm with the pepper from `.env`
2. Insert the user directly into the database

Example (requires running `go run cmd/main.go` first to set up dependencies):

```bash
cd backend

# Create a Go program to generate the hash
cat > /tmp/hash_gen.go << 'EOF'
package main
import (
    "fmt"
    "strings"
    "github.com/alexedwards/argon2id"
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
    fmt.Println(hash)
}
EOF

# Generate the hash
HASH=$(go run /tmp/hash_gen.go)

# Insert into database
psql postgresql://postgres:5433@127.0.0.1:5432/gapak << EOF
INSERT INTO users (id, email, username, display_name, password_hash, role, account_status, is_anonymous, updated_at)
VALUES (gen_random_uuid(), 'test@example.com', 'testuser', 'Test User', '$HASH', 'USER', 'ACTIVE', false, NOW());

INSERT INTO user_privacy_settings (user_id, profile_visibility, last_seen_visibility, allow_friend_requests, allow_trusted_invites, searchable_by_email, searchable_by_username, post_default_privacy, show_online_status, updated_at)
SELECT id, 'CONNECTIONS', 'CONNECTIONS', true, true, false, true, 'FRIENDS', true, NOW()
FROM users WHERE username = 'testuser';
EOF
```

## Configuration Details

The authentication system uses:
- **Password Hashing**: Argon2id with pepper (from `PASSWORD_PEPPER` in `.env`)
- **CSRF Protection**: Token-based (stored in `gapak_csrf` cookie)
- **Pepper Value**: `this-is-a-pepper-secret-minimum-16-chars-long-value` (from backend `.env`)

## Testing Checklist

After creating a test user:
1. ✅ Register a new account via frontend or API
2. ✅ Login with the registered credentials
3. ✅ Verify CSRF token is sent with mutations
4. ✅ Check that tokens are set in response
5. ✅ Verify refresh token cookie is set

## Files Modified
- None required for the fix (this is a data/configuration issue, not a code issue)

## Notes for Development
- For development, consider automatically seeding a test user on first run
- The system correctly prevents information leakage by not revealing whether a username exists (returns same 401 error)
- The 200ms + random delay on failed login is intentional to prevent timing-based attacks
