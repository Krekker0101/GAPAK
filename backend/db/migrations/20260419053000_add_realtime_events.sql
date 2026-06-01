CREATE TABLE "realtime_events" (
    "id" UUID NOT NULL,
    "sequence" BIGSERIAL NOT NULL,
    "channel" VARCHAR(190) NOT NULL,
    "aggregate_type" VARCHAR(64) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "payload_json" JSONB NOT NULL,
    "relay_status" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    "relay_attempts" INTEGER NOT NULL DEFAULT 0,
    "last_relay_error" TEXT,
    "reserved_at" TIMESTAMP(3),
    "relayed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "realtime_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "realtime_events_relay_status_check" CHECK ("relay_status" IN ('PENDING', 'RESERVED', 'RELAYED', 'FAILED'))
);

CREATE UNIQUE INDEX "realtime_events_sequence_key" ON "realtime_events"("sequence");
CREATE INDEX "realtime_events_aggregate_type_aggregate_id_sequence_idx" ON "realtime_events"("aggregate_type", "aggregate_id", "sequence");
CREATE INDEX "realtime_events_channel_sequence_idx" ON "realtime_events"("channel", "sequence");
CREATE INDEX "realtime_events_relay_status_created_at_idx" ON "realtime_events"("relay_status", "created_at");
