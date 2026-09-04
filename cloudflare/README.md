# Cloudflare R2 integration

Gapak production media is stored in the private Cloudflare R2 bucket `gapak-media-prod` in account `7aa6a9e1c9548cf14963c1d8c59edfc1`.

## Already configured

- The bucket exists in Cloudflare R2.
- Browser CORS is applied from `r2-cors.json` for `https://gapak.vercel.app` and local Vite development.
- Remote upload, download, and deletion were verified with Wrangler.
- Vercel CSP allows uploads only to this account's R2 S3 endpoint.

Reapply or inspect CORS from `front`:

```powershell
npm run cloudflare:r2:cors
npx --yes wrangler@4.129.0 r2 bucket cors list gapak-media-prod
```

## Railway secrets still required

Create an R2 API token in the Cloudflare dashboard with Object Read & Write permission scoped only to `gapak-media-prod`. Copy the S3 Access Key ID and Secret Access Key when Cloudflare displays them, then set these variables in both `gapak-api` and `gapak-worker`:

```dotenv
STORAGE_PROVIDER=s3
STORAGE_ENDPOINT=https://7aa6a9e1c9548cf14963c1d8c59edfc1.r2.cloudflarestorage.com
STORAGE_REGION=auto
STORAGE_BUCKET=gapak-media-prod
STORAGE_ACCESS_KEY_ID=<secret-in-railway>
STORAGE_SECRET_ACCESS_KEY=<secret-in-railway>
STORAGE_SIGNING_SECRET=<same-random-secret-in-api-and-worker>
```

Use `backend/.env.railway.example` for the remaining media limits and timeouts. Do not paste credentials into source files, Vercel variables, browser code, commit messages, or chat.

Redeploy `gapak-api`, `gapak-worker`, and the Vercel frontend after setting the variables. The frontend needs a new deployment because its CSP is emitted by `vercel.json`.
