-- ============================================================================
-- Migration 1091: WAPPT cancellation/refund policy scope on vendor_refund_tiers
-- ============================================================================
-- Book Appointment (warmpawz_appointments) uses dedicated policy tiers configured
-- from Admin → Warmpawz Appointments → Policies. Marketplace + tele unchanged.

ALTER TABLE vendor_refund_tiers
  ADD COLUMN IF NOT EXISTS commerce_mode TEXT DEFAULT 'marketplace',
  ADD COLUMN IF NOT EXISTS policy_scope TEXT DEFAULT 'platform';

COMMENT ON COLUMN vendor_refund_tiers.commerce_mode IS 'marketplace (default) or warmpawz_appointments for Book Appointment flat-fee bookings';
COMMENT ON COLUMN vendor_refund_tiers.policy_scope IS 'platform = global default, category = per-hub override (service_category)';

UPDATE vendor_refund_tiers
SET commerce_mode = 'marketplace'
WHERE commerce_mode IS NULL;

UPDATE vendor_refund_tiers
SET policy_scope = 'platform'
WHERE policy_scope IS NULL;

CREATE INDEX IF NOT EXISTS idx_vendor_refund_tiers_commerce_mode
  ON vendor_refund_tiers (commerce_mode)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_vendor_refund_tiers_wappt_category
  ON vendor_refund_tiers (commerce_mode, policy_scope, service_category)
  WHERE commerce_mode = 'warmpawz_appointments' AND is_active = true;

-- Optional hub slug on booking for category-scoped WAPPT policy matching
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS service_category TEXT;

COMMENT ON COLUMN bookings.service_category IS 'WAPPT hub slug at booking create: vet, grooming, training, behaviorist, walker, boarding, sitting, nutrition';

CREATE INDEX IF NOT EXISTS idx_bookings_service_category
  ON bookings (service_category)
  WHERE service_category IS NOT NULL;

-- RBAC: WAPPT policy admin permissions (no DO block — Data API splits on semicolons)
INSERT INTO role_permissions (role_id, permission_name, resource, action, created_at)
SELECT roles.rid, perms.perm, '*', '*', NOW()
FROM (
  SELECT DISTINCT rp.role_id AS rid
  FROM role_permissions rp
  WHERE rp.permission_name IN ('admin.full_access', 'admin.warmpawz_appointments')
  UNION
  SELECT r.id AS rid FROM roles r WHERE r.name = 'admin_master' AND r.is_active = true
) roles
CROSS JOIN (
  VALUES
    ('admin.warmpawz_appointments.policies.view'),
    ('admin.warmpawz_appointments.policies.edit')
) AS perms(perm)
ON CONFLICT (role_id, permission_name, resource, action) DO NOTHING;

-- Seed platform-default WAPPT tiers (idempotent)
INSERT INTO vendor_refund_tiers (
  name, description, vendor_types, service_location, hours_before_service,
  refund_percentage, cancellation_fee, is_active, tier_level, cancelled_by,
  commerce_mode, policy_scope, hours_operator, hours_threshold, cancellation_window
)
SELECT
  'WAPPT Customer 48h+ full refund', 'Book Appointment default — cancel 48h+ before slot',
  ARRAY[]::TEXT[], 'all', 48, 100, 0, true, 10, 'pet_parent',
  'warmpawz_appointments', 'platform', 'gte', 48, '48_plus'
WHERE NOT EXISTS (
  SELECT 1 FROM vendor_refund_tiers
  WHERE commerce_mode = 'warmpawz_appointments' AND policy_scope = 'platform'
    AND cancelled_by = 'pet_parent' AND name = 'WAPPT Customer 48h+ full refund'
);

INSERT INTO vendor_refund_tiers (
  name, description, vendor_types, service_location, hours_before_service,
  refund_percentage, cancellation_fee, is_active, tier_level, cancelled_by,
  commerce_mode, policy_scope, hours_operator, hours_threshold, cancellation_window
)
SELECT
  'WAPPT Customer 24h+ partial', 'Book Appointment default — cancel 24–48h before slot',
  ARRAY[]::TEXT[], 'all', 24, 75, 0, true, 20, 'pet_parent',
  'warmpawz_appointments', 'platform', 'gte', 24, '24_plus'
WHERE NOT EXISTS (
  SELECT 1 FROM vendor_refund_tiers
  WHERE commerce_mode = 'warmpawz_appointments' AND policy_scope = 'platform'
    AND cancelled_by = 'pet_parent' AND name = 'WAPPT Customer 24h+ partial'
);

INSERT INTO vendor_refund_tiers (
  name, description, vendor_types, service_location, hours_before_service,
  refund_percentage, cancellation_fee, is_active, tier_level, cancelled_by,
  commerce_mode, policy_scope, hours_operator, hours_threshold, cancellation_window
)
SELECT
  'WAPPT Customer under 24h', 'Book Appointment default — cancel under 24h',
  ARRAY[]::TEXT[], 'all', 0, 50, 0, true, 30, 'pet_parent',
  'warmpawz_appointments', 'platform', 'lt', 24, 'under_24_no_show'
WHERE NOT EXISTS (
  SELECT 1 FROM vendor_refund_tiers
  WHERE commerce_mode = 'warmpawz_appointments' AND policy_scope = 'platform'
    AND cancelled_by = 'pet_parent' AND name = 'WAPPT Customer under 24h'
);

INSERT INTO vendor_refund_tiers (
  name, description, vendor_types, service_location, hours_before_service,
  refund_percentage, cancellation_fee, is_active, tier_level, cancelled_by,
  commerce_mode, policy_scope, vendor_cancellation_reason
)
SELECT
  'WAPPT Provider cancel full refund', 'Book Appointment default — vendor cancels',
  ARRAY[]::TEXT[], 'all', 0, 100, 0, true, 10, 'provider',
  'warmpawz_appointments', 'platform', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM vendor_refund_tiers
  WHERE commerce_mode = 'warmpawz_appointments' AND policy_scope = 'platform'
    AND cancelled_by = 'provider' AND name = 'WAPPT Provider cancel full refund'
);
