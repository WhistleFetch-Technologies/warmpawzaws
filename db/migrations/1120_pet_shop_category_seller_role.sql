-- ============================================================================
-- MIGRATION 1120: Pet Shop / Pet Products category — allow the `seller` role
-- ============================================================================
-- Shop vendors carry the canonical `seller` role (migration 522), but the
-- Pet Shop catalogue row only lists legacy keys ('shop', 'pet_shop'). The
-- promo engine resolves a vendor's category through vendor_roles, so shop
-- orders resolved to no category and Category-published / Pet Shop visit
-- source promotions never matched ecommerce.
-- Idempotent and additive: appends 'seller' only where it is missing.
-- ============================================================================

UPDATE service_categories
SET vendor_roles = array_append(COALESCE(vendor_roles, '{}'::text[]), 'seller')
WHERE (
    COALESCE(vendor_roles, '{}'::text[]) && ARRAY['shop', 'pet_shop']::text[]
    OR lower(btrim(name)) IN ('pet shop', 'pet products')
  )
  AND NOT ('seller' = ANY (COALESCE(vendor_roles, '{}'::text[])));
