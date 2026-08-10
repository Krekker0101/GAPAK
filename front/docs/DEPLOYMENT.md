# GAPAK Front — Deployment

## Required environment

```env
VITE_API_BASE_URL="https://api.example.com"
VITE_WS_BASE_URL="wss://api.example.com"
VITE_MEDIA_BASE_URL="https://media.example.com"
VITE_ENVIRONMENT="production"
VITE_ENABLE_MOCK_API="false"
VITE_ENABLE_PLATFORM_SANDBOX="false"
```

`VITE_ENABLE_MOCK_API` and `VITE_ENABLE_PLATFORM_SANDBOX` are forcibly constrained by `import.meta.env.DEV`; a production build cannot enable them.

## Build

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
npm run preview
```

The current uploaded project could not complete `npm ci` in the audit environment because the configured package registry returned 404 for `@tailwindcss/vite`. Public-registry installation timed out. Consequently a real Vite build/preview result is not claimed.

## Backend prerequisites

Before release, verify:

- auth/session cookies and CSRF contract;
- all production API contracts used by routes;
- realtime WebSocket endpoint and event ordering/ack semantics;
- media signed URLs and CORS/ETag exposure;
- E2EE device-key verification/revocation/replay protection;
- backend authorization for every permission boundary;
- production telemetry privacy policy;
- HTTPS/WSS only.

## Release gate

Do not ship if typecheck, lint, tests or production build fail. Do not enable routes whose backend dependency is not implemented; they must remain explicit contract/permission states.
