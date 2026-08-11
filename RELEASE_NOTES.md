# GAPAK production release v3

This release fixes the Vercel -> Railway CSRF failure observed during registration.

Key production fixes:
- CSRF mutation validation supports the strict double-submit cookie when available.
- Cross-site browser cookie blocking is handled safely through an explicit-Origin + custom-header fallback; unknown origins remain rejected.
- The frontend automatically refreshes its CSRF bootstrap once when the API reports an invalid CSRF token.
- Vercel SPA routing is configured both for a `front` Root Directory and for repository-root Vercel projects.
- Production API CORS remains explicitly restricted to the configured Vercel origin.
- Existing Secure/SameSite=None production cookie configuration is preserved.

Deployment:
1. Deploy `backend/` to Railway.
2. Set `CORS_ORIGINS=https://gapak.vercel.app` on Railway.
3. Set `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none`, and leave `COOKIE_DOMAIN` empty.
4. Deploy `front/` to Vercel. If the Vercel Root Directory is `front`, keep it. If the Root Directory is the repository root, the root `vercel.json` builds `front` automatically.
5. Redeploy both services after replacing the previous release.

The local environment used for this packaging did not have the project's external Go/Node dependencies installed, so full dependency-backed test suites could not be completed here. Source formatting and targeted static inspection were performed; deployment runtime verification must still be performed by Railway/Vercel after deployment.
