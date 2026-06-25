-- Backfill missing service_catalog.category_id for vet services (incl. vaccinations, vendor-custom rows).
-- Idempotent: only updates rows with null/empty category_id.

UPDATE service_catalog sc
SET
  category_id = 'veterinary',
  category_name = COALESCE(NULLIF(TRIM(sc.category_name), ''), 'Veterinary')
WHERE (sc.category_id IS NULL OR TRIM(sc.category_id) = '')
  AND (
    sc.service_id LIKE 'vet\_%' ESCAPE '\'
    OR sc.service_id LIKE '%veterinary%'
    OR sc.service_id LIKE 'svc\_veterinary%' ESCAPE '\'
  );
