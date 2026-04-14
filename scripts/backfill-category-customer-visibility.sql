-- Safe backfill: run after 711_service_categories_customer_dashboard_visibility.sql
-- Idempotent: only normalizes empty / null visibility to platform defaults.

UPDATE service_categories
SET
  customer_visibility_type = 'GLOBAL',
  customer_dashboard_card_active = true
WHERE TRIM(COALESCE(customer_visibility_type, '')) = '';

UPDATE service_categories
SET customer_dashboard_card_active = true
WHERE customer_dashboard_card_active IS NULL;
