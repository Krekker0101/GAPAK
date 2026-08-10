# GAPAK Media Security Model

## Threats

### Malicious upload

Controls:
- strict size limits;
- allow-listed MIME types;
- signed upload requests;
- exact multipart size verification;
- complete-object SHA-256 verification;
- magic-byte MIME detection;
- owner/session binding.

### MIME/extension spoofing

The filename extension is never treated as authoritative. The completed object is sampled with content detection and must match the declared allow-listed MIME type.

### Resource exhaustion

Controls:
- bounded upload size;
- bounded multipart part size/count;
- ffprobe timeout;
- ffmpeg timeout;
- bounded ffmpeg threads;
- bounded ffmpeg concurrency;
- maximum media duration;
- maximum generated output bytes;
- cleanup of failed temporary output.

### FFmpeg abuse

User-controlled paths are never passed as shell commands. ffmpeg is invoked directly with an argument vector. Input/output paths are resolved inside the configured storage root. Unsupported or malformed media fails processing instead of falling back to fabricated metadata.

### Playback abuse

Playback grants are bound to the authenticated viewer and media object. The requested object must be the original media object or a known derived HLS object belonging to that media asset. Expired grants are rejected. HLS segment requests do not consume a separate view.

### Storage consistency

A successful upload requires both database state and verified object contents. The periodic reconciler compares storage keys with database references and removes only objects that are outside the known reference set.

## Security invariants

1. A client cannot upload outside its own upload session.
2. Declared size must equal the composed object's actual size.
3. Declared checksum, when supplied, must equal the actual SHA-256 checksum.
4. A media object cannot become `READY` before processing succeeds.
5. ffmpeg cannot run without bounded timeout/thread/output limits.
6. Failed transcoding cannot leave a media object falsely marked ready.
7. A playback grant cannot address arbitrary storage keys.
8. One HLS playback does not consume one view per segment.
9. Reconciliation never treats an unreferenced temporary part as permanent content.

## Operational configuration

Recommended production baseline:

- `STORAGE_MAX_UPLOAD_BYTES`: product-specific hard cap;
- `MEDIA_FFMPEG_TIMEOUT`: 20m or lower for normal social video;
- `MEDIA_FFMPEG_MAX_DURATION`: 2h or lower depending on product policy;
- `MEDIA_FFMPEG_MAX_OUTPUT_BYTES`: 1GiB or lower;
- `MEDIA_FFMPEG_THREADS`: 2-4;
- `MEDIA_FFMPEG_CONCURRENCY`: sized to CPU and memory;
- `WORKER_MEDIA_CLEANUP_INTERVAL`: 30m or lower.
