# GAPAK Production Deployment

## Frontend — Vercel

Set the Vercel project root to `front` and configure:

- `VITE_API_BASE_URL=https://gapak-api-production.up.railway.app`
- `VITE_WS_BASE_URL=wss://gapak-api-production.up.railway.app/ws`
- `VITE_MEDIA_BASE_URL=https://gapak-api-production.up.railway.app`
- `VITE_ENVIRONMENT=production`
- `VITE_ENABLE_MOCK_API=false`
- `VITE_ENABLE_PLATFORM_SANDBOX=false`

The SPA fallback is already defined in `front/vercel.json`.

## Backend — Railway

Set the service root to `backend` (or deploy the backend directory as the service root). The repository contains `backend/railway.json` with:

- Dockerfile builder
- pre-deploy database migration
- `/health/ready` deployment healthcheck
- restart-on-failure
- deployment overlap/draining settings

Required production variables include:

- `APP_ENV=production`
- `APP_BASE_URL=https://gapak-api-production.up.railway.app`
- `CORS_ORIGINS=https://gapak.vercel.app`
- `AUTO_MIGRATE=false`
- `COOKIE_SECURE=true`
- `COOKIE_SAME_SITE=none`
- `COOKIE_DOMAIN=`
- real PostgreSQL, Redis, JWT, encryption, password-pepper and storage secrets

Railway's injected `PORT` is supported and takes precedence over `APP_PORT`.

## Authentication contract

GAPAK registration is anonymity-first. The production frontend no longer sends an email during account creation. Session and CSRF cookies are configured for the separate Vercel/Railway origins, while the refresh bootstrap avoids an expected unauthenticated refresh request when the server reports that no session cookie exists.

## Verification

Before switching traffic to the deployment, verify:

1. `GET /health/live` returns 200.
2. `GET /health/ready` returns 200 after PostgreSQL/Redis are available.
3. `GET /api/v1/auth/csrf` returns a CSRF token and sets the CSRF cookie.
4. Anonymous registration creates a session and refresh cookie.
5. Reloading the Vercel app restores an existing session without a spurious refresh 401.
6. Logout removes the session and subsequent page loads remain unauthenticated without an error loop.
