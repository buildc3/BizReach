CREATE TABLE products (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    description TEXT,
    price       FLOAT8,
    category    TEXT NOT NULL DEFAULT 'other'
                  CHECK (category IN ('website', 'menu', 'other')),
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO products (name, description, category) VALUES
  ('Website', 'A professional website tailored for small businesses — mobile-friendly, fast, and easy to manage.', 'website'),
  ('Restaurant Menu Card', 'A beautiful digital menu card website for restaurants to showcase their dishes and prices online.', 'menu');
