-- Idempotent backfill for vendor availability style alias mismatch.
-- Goal: ensure rows saved with `home_visit` are also matched by `at_home` filters.

BEGIN;

UPDATE vendor_availability_v2
SET service_styles = (
  SELECT ARRAY(
    SELECT DISTINCT
      CASE
        WHEN style = 'home_visit' THEN 'at_home'
        ELSE style
      END
    FROM unnest(COALESCE(vendor_availability_v2.service_styles, ARRAY[]::text[])) AS style
    WHERE style IS NOT NULL AND btrim(style) <> ''
  )
)
WHERE COALESCE(vendor_availability_v2.service_styles, ARRAY[]::text[]) && ARRAY['home_visit']::text[];

COMMIT;

-- Verification query:
-- SELECT vendor_id::text, day_of_week, service_styles
-- FROM vendor_availability_v2
-- WHERE service_styles && ARRAY['home_visit']::text[]
-- ORDER BY vendor_id, day_of_week;
