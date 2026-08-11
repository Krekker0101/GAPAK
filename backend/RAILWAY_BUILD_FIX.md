# Railway build fix

The backend build failure reported by Railway was caused by two compile-time issues in the auth controller:

1. The controller referenced the application error package without importing it.
2. The controller referenced an unexported SameSite parser from the auth platform package.

Both issues have been corrected in the source tree. The auth cookie SameSite configuration remains driven by the configured production value.

Recommended Railway production values for a Vercel frontend on a different site:
- COOKIE_SECURE=true
- COOKIE_SAME_SITE=none
- COOKIE_DOMAIN= (empty)

The full project archive contains the corrected backend and frontend.
