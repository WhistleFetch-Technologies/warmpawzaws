-- ============================================================================
-- MIGRATION 1121: Map core vendor roles onto service_categories.vendor_roles
-- ============================================================================
-- The promo engine resolves a vendor's category only through vendor_roles
-- (vcf/category-from-role.ts). Prod rows were never filled in, so Pay Bill,
-- booking and visit-profile writes resolved to no category and Category (C)
-- promos never matched. Role names are used (not role UUIDs) so the same file
-- is valid on dev and prod; the matcher accepts names.
-- Idempotent and additive: only appends names that are missing, never removes.
-- ============================================================================

WITH mapping (slug, role_name) AS (
  VALUES
    ('veterinary', 'vet_clinic'),
    ('veterinary', 'vet_solo'),
    ('grooming', 'groomer_center'),
    ('grooming', 'groomer_solo'),
    ('walking', 'walker'),
    ('training', 'trainer_solo'),
    ('training', 'trainer_center'),
    ('training', 'behaviorist_solo'),
    ('training', 'behaviorist_center'),
    ('boarding', 'boarding'),
    ('wellness', 'nutritionist_center'),
    ('wellness', 'nutritionist'),
    ('pet-sitting', 'sitter'),
    ('holiday', 'holiday')
),
wanted AS (
  SELECT slug, array_agg(role_name ORDER BY role_name) AS roles
  FROM mapping
  GROUP BY slug
)
UPDATE service_categories sc
SET vendor_roles = ARRAY(
  SELECT DISTINCT r
  FROM unnest(COALESCE(sc.vendor_roles, '{}'::text[]) || w.roles) AS r
  ORDER BY r
)
FROM wanted w
WHERE sc.category_id = w.slug
  AND NOT (w.roles <@ COALESCE(sc.vendor_roles, '{}'::text[]));
