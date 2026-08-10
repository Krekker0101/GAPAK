# Media Security Hardening Report

## Implemented

- Exact multipart size equality instead of only an upper-bound check.
- Complete-object SHA-256 verification after composition.
- Declared checksum verification when supplied by the client.
- Canonical checksum persistence when the client omitted it.
- Media remains `PENDING` until worker processing succeeds.
- Failed video processing marks media `FAILED`.
- ffprobe is mandatory for secure adaptive video processing.
- ffprobe has a dedicated timeout.
- Maximum media duration enforced.
- ffmpeg has wall-clock timeout, CPU thread bounds and a global concurrency semaphore.
- Generated HLS output is monitored and cancelled when it exceeds the configured output budget.
- Failed variant directories are removed.
- Periodic storage/database reconciliation added.
- Stale processing jobs are reconciled.
- Storage indexes added for media/object reconciliation.
- HLS playback grants are treated as short-lived playback sessions: the first derived HLS request consumes the view, subsequent segments do not.

## Verification limitation

The repository requires Go 1.24.13. The available execution environment has Go 1.23.2 and cannot download the required toolchain because outbound network access is unavailable. Therefore the full Go test/build suite could not be truthfully reported as passing in this environment.
