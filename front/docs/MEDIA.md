# GAPAK Front — Media

Date: 2026-08-09

## Production flow

1. Browser calculates SHA-256.
2. `POST /api/v1/media/upload-sessions` returns server-authorized signed upload information.
3. Browser uploads directly using server-issued signed URL(s).
4. Multipart uploads use bounded concurrency and real XHR progress.
5. ETags are captured and sent to completion.
6. Backend finalizes processing.
7. Playback requires an expiring grant from the backend.

No sample CDN URLs, fake playback grants or timer-based progress are used in production.

## Cleanup

- Upload abort controllers are removed after completion.
- Signed-upload abort listeners are removed after settlement.
- Video HLS instances are destroyed on source/unmount changes.
- Video control timers and observers are cleaned up.
- Preview Blob URLs are revoked on component cleanup.

## Backend dependency

Encrypted chat attachments still require per-recipient key wrapping, secure upload-session binding, encrypted thumbnail handling and authorized playback/decryption grants.
