# GAPAK Media Performance Audit — 2026-08-13

## Production bundle measurement
The latest available `dist/` artifact was measured with `npm run perf:audit`. The artifact is at the documented media/application budget and does not require additional media-related code splitting based on measured bundle size.

| Metric | Measured | Budget | Status |
|---|---:|---:|---|
| HLS vendor chunk | 511 KiB (523,130 bytes) | ≈511 KiB | PASS |
| Largest application JS chunk | 311 KiB (318,315 bytes) | ≈311 KiB | PASS |
| Total JS | 1,233 KiB | ≈1.23 MiB | PASS |

`npm run perf:audit` also reported the next largest chunks as `DomainPages` 125 KiB and `motion` 93 KiB.

### Verification note
The supplied repository archive already contained the measured `dist/` artifact. In this audit environment, `npm run build` could not be re-executed because `node_modules` is absent and the `vite` binary is therefore unavailable; an attempted dependency restore could not complete. These figures are therefore the measured contents of the supplied `dist/`, not a newly generated build in this environment. No claim is made that a fresh dependency install/build was independently reproduced here.

## Implemented
- Native lazy loading for media thumbnails.
- IntersectionObserver for infinite media pagination.
- Cursor-based pagination rather than page-number pagination.
- Upload progress uses actual `XMLHttpRequest.upload` progress, not timers.
- Multipart upload concurrency is bounded to 3.
- SHA-256 is calculated once per upload.
- Video playback is isolated behind an expiring grant.
- HLS uses native browser support where available and `hls.js` dynamically where required.
- Story/media viewers preload only the next story image.
- Route-level architecture keeps media services out of unrelated domains.
- IndexedDB-backed upload-session persistence is isolated to the media upload subsystem; the measured bundle is still within the documented JS budgets.

## Deliberate constraints
- Do not virtualize the media grid until measured item counts justify it; the current cursor page is bounded to 30.
- Do not decode original images on the main thread for previews; server thumbnails should be supplied.
- Do not persist raw `File` objects or cryptographic material in localStorage.
- Do not use permanent CDN URLs.

## Remaining production measurements
Run Lighthouse/WebPageTest against the deployed backend and record:
- LCP on `/media`;
- INP while filtering/searching;
- CLS while thumbnails arrive;
- HLS startup time;
- upload throughput and failed-part rate;
- memory usage during long media sessions.

The frontend bundle currently stays within the recorded production-size envelope; runtime media performance still needs real browser/backend measurement.
