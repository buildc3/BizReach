-- Lead grouping + pitch review lifecycle.
--
-- Groups let leads inside a search be split into batches (auto-grouped by contact
-- channel, then manually adjustable). A pitch becomes a draft `message` that is
-- reviewed/rejected before it ever enters the send pipeline.
--
-- Written idempotently so it is safe to apply manually for compile-time checks and
-- then have sqlx::migrate! re-run + record it on the next backend start.

-- ── Groups ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS groups (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    search_id  UUID NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    kind       TEXT NOT NULL DEFAULT 'manual', -- has_email | phone_only | no_contact | manual
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_groups_search_id ON groups(search_id);

-- A lead optionally belongs to one group; clearing the group keeps the lead.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_leads_group_id ON leads(group_id);

-- ── Pitch review lifecycle ──────────────────────────────────────────────────────
-- Extend the message status vocabulary: a pitch starts as 'draft', is moved to
-- 'reviewed' (or 'rejected'), and only reviewed pitches enter queued → sent → …
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_status_check;
ALTER TABLE messages ADD CONSTRAINT messages_status_check
    CHECK (status IN ('draft', 'reviewed', 'rejected', 'queued', 'sent', 'delivered', 'replied', 'failed'));

-- Track when a pitch was reviewed and when WhatsApp confirmed delivery.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reviewed_at  TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
