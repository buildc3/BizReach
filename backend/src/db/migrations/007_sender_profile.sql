-- Single-row sender profile for outreach signature placeholders.
-- We pre-seed exactly one row with a fixed UUID so the upsert path is
-- always a simple UPDATE — no insert-or-update logic needed at runtime.

CREATE TABLE IF NOT EXISTS sender_profile (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    your_name   TEXT,
    company_name TEXT,
    phone       TEXT,
    website     TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO sender_profile (id, your_name, company_name, phone, website)
VALUES ('00000000-0000-0000-0000-000000000001', NULL, NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;
