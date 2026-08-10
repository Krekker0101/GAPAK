-- Make password_hash nullable for OAuth-only users
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "password_hash" SET DEFAULT '';
