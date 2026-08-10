-- Run against a production-like dataset after ANALYZE.
-- Compare the legacy OFFSET query with the keyset query at deep pages.
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT p.id, p.author_id, p.content_type, p.published_at
FROM posts p
WHERE p.deleted_at IS NULL
ORDER BY p.published_at DESC, p.id DESC
LIMIT 20 OFFSET 100000;

-- Replace the cursor values with the last row from the previous page.
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT p.id, p.author_id, p.content_type, p.published_at
FROM posts p
WHERE p.deleted_at IS NULL
  AND (p.published_at < TIMESTAMP '2026-08-01 00:00:00+00'
       OR (p.published_at = TIMESTAMP '2026-08-01 00:00:00+00' AND p.id < 'ffffffff-ffff-ffff-ffff-ffffffffffff'))
ORDER BY p.published_at DESC, p.id DESC
LIMIT 21;
