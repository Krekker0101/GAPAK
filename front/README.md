# GAPAK Front

Production-oriented React/Vite frontend for GAPAK. The final audit deliberately keeps unsupported backend functionality visible as contract/permission states instead of simulating success.

## Architecture

- `src/app/` — application shell, providers and URL router.
- `src/pages/` — route-level server-state composition.
- `src/domains/*/api/` — backend API boundaries.
- `src/shared/` — HTTP, auth, realtime, security, design system and UX infrastructure.
- `src/devtools/` — development-only sandbox and fixture code. Legacy prototype domains live under `src/devtools/legacy-domains/` and are not production routes.

## Development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Development-only fixtures can be enabled with:

```env
VITE_ENABLE_MOCK_API=true
VITE_ENABLE_PLATFORM_SANDBOX=true
```

These flags are constrained by `import.meta.env.DEV`; a production build cannot enable them.

## Production

```env
VITE_API_BASE_URL="https://api.example.com"
VITE_WS_BASE_URL="wss://api.example.com"
VITE_MEDIA_BASE_URL="https://media.example.com"
VITE_ENVIRONMENT="production"
VITE_ENABLE_MOCK_API="false"
VITE_ENABLE_PLATFORM_SANDBOX="false"
```

Production does not use mock API, mock WebSocket, fake media, fake live data, fake OAuth, fake 2FA or fake cryptography.

## Verification

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run preview
```

`npm run test:e2e` runs the Playwright critical path only when a real backend-authenticated test environment is supplied.

## Current release truth

The project is **not yet fully production-ready** because the uploaded frontend cannot prove a complete real backend integration in this environment. In particular, the production login/register UI is absent, CSRF bootstrap is backend-dependent, and full E2EE/realtime guarantees require backend contracts.

See:

- `docs/PRODUCTION_READINESS.md`
- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/AUTH.md`
- `docs/REALTIME.md`
- `docs/SECURITY.md`
- `docs/E2EE.md`
- `docs/MEDIA.md`
- `docs/TESTING.md`
- `docs/DEPLOYMENT.md`


## Production deployment note

The production API is deployed on Railway while the SPA is deployed on Vercel. The browser client always uses credentialed requests. The API uses a strict double-submit CSRF cookie when available and a CORS-origin-bound header fallback when browsers block cross-site cookies. Keep the production CORS origin restricted to the exact Vercel application origin.

If the Vercel project is configured with the repository root as its Root Directory, the repository-level `vercel.json` builds `front` and rewrites all SPA routes to `front/dist/index.html`. If the Vercel Root Directory is already `front`, the existing `front/vercel.json` provides the SPA rewrite.
