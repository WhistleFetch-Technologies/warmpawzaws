-- Align customer-visible services with vendor publish state.
-- Rows that are published but disabled never appear in customer discovery; vendors expect published = visible.
-- Idempotent: only touches published/auto_published rows still marked disabled.

UPDATE vendor_services
SET is_enabled = true,
    updated_at = NOW()
WHERE publish_status IN ('published', 'auto_published')
  AND is_enabled = false;
