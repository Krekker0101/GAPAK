CREATE TABLE "two_factor_setup_challenges" (
    "user_id" UUID NOT NULL,
    "setup_session_id" UUID NOT NULL,
    "secret_ciphertext" TEXT NOT NULL,
    "secret_nonce" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "two_factor_setup_challenges_pkey" PRIMARY KEY ("user_id")
);

CREATE INDEX "two_factor_setup_challenges_expires_at_idx" ON "two_factor_setup_challenges"("expires_at");
CREATE INDEX "two_factor_setup_challenges_setup_session_id_idx" ON "two_factor_setup_challenges"("setup_session_id");

ALTER TABLE "two_factor_setup_challenges"
    ADD CONSTRAINT "two_factor_setup_challenges_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "two_factor_setup_challenges"
    ADD CONSTRAINT "two_factor_setup_challenges_setup_session_id_fkey"
    FOREIGN KEY ("setup_session_id") REFERENCES "device_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
