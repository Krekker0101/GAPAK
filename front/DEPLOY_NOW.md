# GAPAK Front — production deployment

This archive is the complete Vite/React frontend prepared for Vercel.

## Deploy

Upload/import this project into Vercel with the project root set to this directory.
No build command changes are required:
- Build: `npm run build`
- Output: `dist`
- Install: `npm ci`

Production public endpoints are already included in `.env.production`:
- API: `https://gapak-backend.vercel.app`
- WebSocket: `wss://gapak-backend.vercel.app/ws`
- Media: `https://gapak-backend.vercel.app`

No secrets are included.

The backend must have its production CORS/cookie/CSRF configuration active for the Vercel origin. This frontend does not contain backend secrets or JWT secrets.
