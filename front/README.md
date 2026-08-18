# GAPAK Front

Production React/Vite client for the GAPAK Go API. Routed business domains use typed HTTP services and server-owned state; the application contains no mock backend or production fixture data.

## Development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Public frontend configuration:

```env
VITE_API_BASE_URL=https://api.example.com
VITE_WS_BASE_URL=wss://api.example.com/ws
VITE_MEDIA_BASE_URL=https://media.example.com
VITE_WEB_PUSH_PUBLIC_KEY=<public VAPID key from the backend deployment>
VITE_ENVIRONMENT=production
```

The Web Push value is the public VAPID key and must match the backend sender configuration. Never put JWT secrets, refresh tokens, database credentials, OAuth secrets, the private VAPID key or private encryption keys in `VITE_*` variables.

## Authentication persistence

The access token and CSRF token are memory-only. On reload, the client calls `/auth/csrf`, detects the server session through the HttpOnly refresh cookie, rotates it with `/auth/refresh`, then loads `/users/me`. The backend refresh-cookie TTL determines how long the login survives; explicit logout revokes the session.

For cross-site Vercel-to-Railway deployments, the backend must use `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none`, an empty `COOKIE_DOMAIN`, and the exact frontend origin in `CORS_ORIGINS`.

## Quality gates

```bash
npm run typecheck
npm run lint
npm run test:all
npm run build
```

`npm run test:e2e` requires a real backend-authenticated test environment. Direct browser-to-database access is intentionally absent; the frontend communicates only with the backend API.

See `docs/ARCHITECTURE.md`, `docs/AUTH.md`, `docs/REALTIME.md`, `docs/SECURITY.md`, `docs/E2EE.md`, `docs/MEDIA.md`, `docs/TESTING.md`, and `docs/DEPLOYMENT.md`.
