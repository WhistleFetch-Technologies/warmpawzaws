-- Sprint A promotion targeting: scope token for admin/wizard persistence (all | bookings | services | products).
ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS applicable_to TEXT;

UPDATE promotions
SET applicable_to = 'all'
WHERE applicable_to IS NULL OR TRIM(applicable_to) = '';

CREATE INDEX IF NOT EXISTS idx_promotions_applicable_to ON promotions (applicable_to);
