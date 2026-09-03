-- Hand-authored (not `prisma migrate dev`) because the shadow database
-- Prisma spins up to diff schema changes lacks the `uuid-ossp` extension
-- that `0_init` (introspected from the pre-existing sqlx-managed DB) relies
-- on for `uuid_generate_v4()` defaults — 0_init itself fails to replay on a
-- fresh shadow DB. Generated the raw ALTER/CREATE statements via
-- `prisma migrate diff --from-config-datasource --to-schema --script`
-- against the real DB (which bypasses the shadow DB), then reordered by
-- hand to insert the backfill step required because `user_id` is NOT NULL
-- on tables that already hold rows. Applied via `prisma migrate deploy`,
-- which also doesn't use a shadow DB. strategy.md §9.3 / §8.6 phase 2.
--
-- Intentionally excludes `DROP TABLE "_sqlx_migrations"` that the raw diff
-- proposed — that's the old Rust backend's leftover migration-tracking
-- table, unrelated to this change; out of scope here.

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- Bootstrap admin user: every row in the tables below predates auth and
-- needs an owner. Backfilled to this account so existing data isn't
-- orphaned. Default password documented in progress.md / .ai/project.md —
-- there is no password-reset flow yet (strategy.md §9.1, out of scope for
-- v1), so change it by hand in the DB if this account's credentials need
-- to stop being the shared default.
INSERT INTO "users" ("id", "email", "password_hash", "name") VALUES (
    '00000000-0000-0000-0000-000000000099',
    'admin@lead-gen.local',
    '$2b$10$p9jVUOszAD4X9oSCrXylzupWHYlx.y9zd1Z4zehLos.JdcogVCZBi', -- bcrypt("changeme123", 10)
    'Admin'
);

-- AlterTable: add nullable first, backfill, then tighten to NOT NULL below.
ALTER TABLE "leads" ADD COLUMN "user_id" UUID;
ALTER TABLE "products" ADD COLUMN "user_id" UUID;
ALTER TABLE "searches" ADD COLUMN "user_id" UUID;
ALTER TABLE "sender_profile" ADD COLUMN "user_id" UUID;
ALTER TABLE "templates" ADD COLUMN "user_id" UUID;

-- Backfill existing rows to the bootstrap admin.
UPDATE "leads" SET "user_id" = '00000000-0000-0000-0000-000000000099' WHERE "user_id" IS NULL;
UPDATE "products" SET "user_id" = '00000000-0000-0000-0000-000000000099' WHERE "user_id" IS NULL;
UPDATE "searches" SET "user_id" = '00000000-0000-0000-0000-000000000099' WHERE "user_id" IS NULL;
UPDATE "sender_profile" SET "user_id" = '00000000-0000-0000-0000-000000000099' WHERE "user_id" IS NULL;
UPDATE "templates" SET "user_id" = '00000000-0000-0000-0000-000000000099' WHERE "user_id" IS NULL;

-- Now safe to require it on every future row.
ALTER TABLE "leads" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "searches" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "sender_profile" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "templates" ALTER COLUMN "user_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "idx_leads_user_id" ON "leads"("user_id");
CREATE INDEX "idx_products_user_id" ON "products"("user_id");
CREATE INDEX "idx_searches_user_id" ON "searches"("user_id");
CREATE UNIQUE INDEX "sender_profile_user_id_key" ON "sender_profile"("user_id");
CREATE INDEX "idx_templates_user_id" ON "templates"("user_id");

-- AddForeignKey
ALTER TABLE "searches" ADD CONSTRAINT "searches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "leads" ADD CONSTRAINT "leads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "products" ADD CONSTRAINT "products_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "templates" ADD CONSTRAINT "templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "sender_profile" ADD CONSTRAINT "sender_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
