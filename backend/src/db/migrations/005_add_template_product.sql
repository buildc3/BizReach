ALTER TABLE templates
    ADD COLUMN product_id UUID REFERENCES products(id) ON DELETE SET NULL;

CREATE INDEX idx_templates_product_id ON templates(product_id);
