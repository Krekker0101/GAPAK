# GAPAK Media Architecture

## Lifecycle

`UPLOAD -> VALIDATE -> STORE -> VERIFY -> PROCESS -> TRANSCODE -> READY -> AUTHORIZE -> PLAY -> EXPIRE -> RECONCILE/CLEANUP`

### Upload

- Upload sessions are owner-scoped.
- Declared size is bounded by `STORAGE_MAX_UPLOAD_BYTES`.
- Multipart completion requires every part and an exact aggregate size match.
- Signed part requests bind bucket, object key, session, part number, content type and expiry.

### Verify

After multipart composition the backend re-reads the complete object and verifies:

1. exact byte size;
2. SHA-256 checksum;
3. detected MIME type;
4. configured MIME allow-list.

The stored checksum becomes the canonical object checksum when the client did not supply one.

### Processing

Completed uploads remain `PENDING` until a durable processing job succeeds. A media record is not exposed as `READY` merely because storage composition succeeded.

Video processing uses ffprobe before ffmpeg. Adaptive HLS transcoding is bounded by:

- wall-clock timeout;
- ffmpeg CPU/thread limits;
- global ffmpeg worker concurrency;
- maximum output bytes;
- maximum media duration.

Failed video processing marks both the video asset and media record failed and removes failed variant output.

### Playback

A playback grant is the short-lived authorization boundary. For HLS, the grant behaves as a playback session: the first HLS-derived request consumes one view, while playlist/segment requests within the same unexpired grant do not consume additional views.

Every requested HLS object is checked against the media's known master playlist, variant playlist, init segment or segment prefix. A grant cannot be used to address an arbitrary object key.

### Cleanup and reconciliation

The worker periodically reconciles object storage with PostgreSQL. It detects and removes:

- expired upload-session part objects;
- `.assembling` temporary objects;
- unreferenced objects;
- stale processing jobs;
- expired upload sessions.

PostgreSQL remains the source of truth. Reconciliation is deliberately conservative around HLS segment prefixes.
