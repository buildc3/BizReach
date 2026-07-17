CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE searches (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name       TEXT NOT NULL,
    biz_type   TEXT NOT NULL,
    area       TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'running', 'done', 'error')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE leads (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    search_id  UUID NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    owner_name TEXT,
    address    TEXT,
    phone      TEXT,
    email      TEXT,
    website    TEXT,
    source     TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_search_id ON leads(search_id);
CREATE INDEX idx_leads_phone ON leads(phone) WHERE phone IS NOT NULL;

CREATE TABLE templates (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name       TEXT NOT NULL,
    body       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE messages (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
    body        TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'queued'
                   CHECK (status IN ('queued', 'sent', 'delivered', 'replied', 'failed')),
    sent_at     TIMESTAMPTZ,
    replied_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_lead_id ON messages(lead_id);
CREATE INDEX idx_messages_status ON messages(status);
