# GAPAK Backend — Railway production deployment

This repository is prepared for the current Railway layout:

- `gapak-api` — public HTTP API
- `gapak-worker` — background jobs / realtime relay / media cleanup
- `gapak-migrate` — one-shot migration service
- `Postgres` — Railway PostgreSQL
- `Redis` — Railway Redis

## Service commands

### gapak-api
Use the Docker image's default start command. Do **not** put the worker binary into the Railway **Build Command**.

If an explicit start command is required:

`/usr/local/bin/gapak-api`

### gapak-worker
Build command: leave empty / use Railway's normal Docker build.

Start command:

`/usr/local/bin/gapak-worker`

### gapak-migrate
Build command: leave empty / use Railway's normal Docker build.

Start command:

`/usr/local/bin/gapak-migrate`

Run the migration service before the API and worker release when the schema changes.

## Required production variables

Set these explicitly in `gapak-api`, `gapak-worker`, and `gapak-migrate` where applicable:

- `APP_ENV=production`
- `APP_BASE_URL=https://<your-public-api-domain>`
- `APP_HOST=0.0.0.0`
- `APP_PORT=${{PORT}}` or leave `APP_PORT` unset and let the application use Railway's `PORT`
- `CORS_ORIGINS=https://<your-vercel-frontend-domain>`
- `DATABASE_URL=${{Postgres.DATABASE_PRIVATE_URL}}`
- `REDIS_ENABLED=true`
- `REDIS_URL=${{Redis.REDIS_PRIVATE_URL}}`
- `AUTO_MIGRATE=false`
- `METRICS_ENABLED=true`
- `METRICS_TOKEN=<random-secret>`
- unique `JWT_ACCESS_SECRET`
- unique `JWT_REFRESH_SECRET`
- `PASSWORD_PEPPER`
- `ENCRYPTION_KEY_BASE64` (32 decoded bytes)
- `STORAGE_SIGNING_SECRET`
- `ANONYMITY_HASH_SECRET`
- `COOKIE_SECURE=true`
- `COOKIE_SAME_SITE=none`
- `COOKIE_DOMAIN=`
- `JWT_ACCESS_TTL=15m`
- `JWT_REFRESH_TTL=720h`
- `SESSION_IDLE_TTL=168h` (automatic logout after 7 days without using this device)

Do not copy localhost values into production.

## Health probes

- `/health` — cheap liveness-compatible endpoint
- `/health/live` — liveness
- `/health/ready` — PostgreSQL/Redis readiness
- `/` — service identity + status

Railway's public domain can be tested with:

`curl -i https://<your-public-api-domain>/health`

A healthy liveness response is HTTP 200. Readiness may return HTTP 503 when a critical dependency is unavailable.

## Frontend variables

Vercel Production uses the tracked `/api/v1/*` external rewrite so browser auth cookies remain first-party. Keep the API base empty; the public Railway domain remains the direct WebSocket/media target.

Typical values:

- `VITE_API_BASE_URL=`
- `VITE_WS_BASE_URL=wss://<your-public-api-domain>`
- `VITE_MEDIA_BASE_URL=https://<your-public-api-domain>`
- `VITE_ENVIRONMENT=production`

After changing any `VITE_*` variable, trigger a new Vercel deployment because Vite embeds these values at build time.

## Media note

`STORAGE_PROVIDER=local` is acceptable for development only. A Railway API service and a separately deployed worker do not share arbitrary container filesystems. For production media processing, use a shared object store and configure both services with the same bucket/credentials. Do not treat a local container filesystem as durable media storage.
