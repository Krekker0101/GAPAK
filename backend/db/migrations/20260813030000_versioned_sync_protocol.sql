-- Versioned global revision for the sync ledger.
-- This is intentionally separate from domain_events.sequence, which remains
-- domain-specific (for example chat message sequence numbers).
CREATE SEQUENCE IF NOT EXISTS domain_events_revision_seq;

ALTER TABLE domain_events
    ADD COLUMN IF NOT EXISTS revision BIGINT;

-- Backfill deterministic revisions for events created before this migration.
WITH ordered AS (
    SELECT id, row_number() OVER (ORDER BY created_at ASC, id ASC)::BIGINT AS rev
    FROM domain_events
    WHERE revision IS NULL
)
UPDATE domain_events d
SET revision = ordered.rev
FROM ordered
WHERE d.id = ordered.id;

SELECT setval(
    'domain_events_revision_seq',
    COALESCE((SELECT MAX(revision) FROM domain_events), 1),
    (SELECT COUNT(*) > 0 FROM domain_events)
);

ALTER TABLE domain_events
    ALTER COLUMN revision SET DEFAULT nextval('domain_events_revision_seq'),
    ALTER COLUMN revision SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS domain_events_revision_key
    ON domain_events(revision);

CREATE INDEX IF NOT EXISTS domain_events_revision_recipient_idx
    ON domain_events(revision, actor_id);

-- The sync protocol needs deterministic tombstone state for current entities.
-- Existing domain models already contain updated_at/deleted_at for the synced
-- resources. No legacy REST route is changed by this migration.


ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE notifications SET updated_at = COALESCE(updated_at, created_at);
ALTER TABLE notifications ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE notifications ALTER COLUMN updated_at SET NOT NULL;
CREATE INDEX IF NOT EXISTS notifications_user_updated_idx ON notifications(user_id, updated_at DESC, id DESC);
