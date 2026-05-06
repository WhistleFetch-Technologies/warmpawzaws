-- Idempotent backfill for vendor availability style alias mismatch.
-- Ensures rows saved with `home_visit` are matched by `at_home` filters.

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
