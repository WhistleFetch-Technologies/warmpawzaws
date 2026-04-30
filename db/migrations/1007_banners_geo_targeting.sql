-- 1007_banners_geo_targeting.sql
-- Adds optional state/city targeting for banners.
-- NULL values mean "global" (all locations).

ALTER TABLE banners
  ADD COLUMN IF NOT EXISTS target_state TEXT NULL;

ALTER TABLE banners
  ADD COLUMN IF NOT EXISTS target_city TEXT NULL;

COMMENT ON COLUMN banners.target_state IS 'Target state for banner delivery. NULL means global/all states.';
COMMENT ON COLUMN banners.target_city IS 'Target city for banner delivery. NULL means global/all cities.';

CREATE INDEX IF NOT EXISTS idx_banners_target_state_lower
  ON banners (LOWER(target_state))
  WHERE target_state IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_banners_target_city_lower
  ON banners (LOWER(target_city))
  WHERE target_city IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_banners_target_state_city_lower
  ON banners (LOWER(target_state), LOWER(target_city))
  WHERE target_state IS NOT NULL OR target_city IS NOT NULL;
