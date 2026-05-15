-- =============================================================================
-- MANUAL / PROD-REVIEW — repair vendor_services.category + category_id
-- =============================================================================
-- Purpose: realign rows where `category` text was wrong (e.g. Pet Sitter) but
--          the intended platform row is known via `service_categories.id`.
-- Do NOT run from CI. Operator runs via RDS Data API / psql after editing
-- placeholders and reviewing the SELECT previews.
-- =============================================================================

BEGIN;

-- Preview: candidate custom services (narrow WITH clause)
-- Replace :vendor_id and optional time window / id list.
-- SELECT vs.id,
--        vs.vendor_id,
--        vs.service_name,
--        vs.category,
--        vs.category_id,
--        vs.created_at
-- FROM vendor_services vs
-- WHERE vs.is_custom_service = true
--   AND vs.vendor_id = :'vendor_id'::uuid   -- placeholder
--   AND vs.created_at >= '2026-01-01'::timestamptz
-- ORDER BY vs.created_at DESC;

-- Example repair: set FK to canonical category and display name from row.
-- Uncomment and substitute real UUIDs after preview.
-- UPDATE vendor_services vs
-- SET
--   category_id = '00000000-0000-4000-8000-000000000001'::uuid,  -- service_categories.id (Boarding, etc.)
--   category = (SELECT sc.name FROM service_categories sc WHERE sc.id = vs.category_id LIMIT 1)
-- WHERE vs.id = '00000000-0000-4000-8000-000000000002'::uuid;       -- vendor_services.id

-- Joining services table if category is duplicated there:
-- UPDATE services s
-- SET category = (SELECT name FROM service_categories WHERE id = :correct_category_id::uuid)
-- FROM vendor_services vs
-- WHERE vs.service_id = s.id
--   AND vs.id = :vendor_service_id::uuid;

ROLLBACK;
-- Change to COMMIT; only after previews are correct.
