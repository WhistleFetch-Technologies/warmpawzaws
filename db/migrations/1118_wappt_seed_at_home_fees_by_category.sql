-- ============================================================================
-- Migration 1118: Seed Warmpawz Appointments at_home fees by merchant category
-- ============================================================================
-- Vet home → 999; grooming / training / walker → 499; all other hubs → 99.
-- Does NOT overwrite non-zero appointment_fee (centre). Only floors NULL/0 centre to 99.
-- ============================================================================

UPDATE warmpawz_appointments_vendor_catalog c
SET
  appointment_fee_home = CASE
    WHEN cat_token ~ '(^|[^a-z])(vet|veterinar)' THEN 999
    WHEN cat_token ~ 'groom' THEN 499
    WHEN cat_token ~ 'train' THEN 499
    WHEN cat_token ~ 'walk' THEN 499
    ELSE 99
  END,
  updated_at = NOW()
FROM (
  SELECT
    v.id AS vendor_id,
    lower(
      trim(
        coalesce(
          nullif(r.customer_service, ''),
          nullif(r.name, ''),
          nullif(r.display_name, ''),
          nullif(v.category, ''),
          nullif(v.vendor_type, ''),
          ''
        )
      )
    ) AS cat_token
  FROM vendors v
  LEFT JOIN roles r ON r.id = v.role_id
) src
WHERE c.vendor_id = src.vendor_id;

UPDATE warmpawz_appointments_vendor_catalog
SET appointment_fee = 99,
    updated_at = NOW()
WHERE appointment_fee IS NULL OR appointment_fee <= 0;
