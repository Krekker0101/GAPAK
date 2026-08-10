-- Performance hot-path indexes. Keyset pagination always uses a deterministic
-- time + id tie-breaker so concurrent inserts do not cause page drift.
CREATE INDEX IF NOT EXISTS posts_feed_cursor_idx
  ON posts (published_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS posts_author_feed_cursor_idx
  ON posts (author_id, published_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS posts_content_feed_cursor_idx
  ON posts (content_type, published_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS stories_feed_cursor_idx
  ON stories (published_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS comments_post_recent_cursor_idx
  ON comments (post_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL AND parent_comment_id IS NULL;

CREATE INDEX IF NOT EXISTS post_likes_post_created_cursor_idx
  ON post_likes (post_id, created_at DESC, user_id DESC);
