-- ============================================================================
-- 749: Repair ₹ mojibake in rewards_catalog (UTF-8 ₹ mis-decoded as Windows-1252)
-- ============================================================================
-- Note: Loyalty min redemption point changes were reverted; this migration
-- only fixes reward catalog text. Idempotent: REPLACE/UPDATE are safe to re-run.
-- ============================================================================

-- Mojibake: chr(226)||chr(8218)||chr(185) → chr(8377) (₹ U+20B9)
UPDATE rewards_catalog
SET
  name = REPLACE(name, CHR(226) || CHR(8218) || CHR(185), CHR(8377)),
  description = REPLACE(description, CHR(226) || CHR(8218) || CHR(185), CHR(8377));

-- Canonical copy for seeded catalog IDs (723) regardless of prior corruption
UPDATE rewards_catalog
SET name = '₹100 Off Grooming', description = 'Get ₹100 off on any grooming service'
WHERE id = 'e4b8c0d0-1111-4111-a111-000000000001'::uuid;

UPDATE rewards_catalog
SET name = '₹200 Off Vet Visit', description = 'Get ₹200 off on any vet consultation'
WHERE id = 'e4b8c0d0-2222-4222-a222-000000000002'::uuid;

UPDATE rewards_catalog
SET name = 'Free Pet Treat', description = 'Get a free premium pet treat'
WHERE id = 'e4b8c0d0-3333-4333-a333-000000000003'::uuid;
