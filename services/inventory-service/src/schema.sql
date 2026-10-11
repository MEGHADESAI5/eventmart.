CREATE TABLE IF NOT EXISTS products (
  sku TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  stock INTEGER NOT NULL CHECK (stock >= 0),
  unit_price_cents INTEGER NOT NULL
);

-- One row per handled OrderPlaced event. Makes the consumer idempotent and lets us
-- re-publish the stored outcome if the previous attempt crashed before publishing.
CREATE TABLE IF NOT EXISTS processed_events (
  event_id UUID PRIMARY KEY,
  order_id UUID NOT NULL,
  outcome TEXT NOT NULL, -- RESERVED | REJECTED
  reason TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO products (sku, name, stock, unit_price_cents) VALUES
  ('KB-001',  'Mechanical Keyboard', 50, 7999),
  ('MS-002',  'Wireless Mouse',      100, 2499),
  ('MN-003',  '27-inch Monitor',     20, 18999),
  ('HB-004',  'USB-C Hub',           75, 3499),
  ('ST-005',  'Laptop Stand',        10, 2999)
ON CONFLICT (sku) DO NOTHING;
