-- Admin promotion wizard persists max_uses / max_uses_per_user (usage caps).
-- Legacy promotions table used usage_limit only — align both names.

ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS max_uses INTEGER;

ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS max_uses_per_user INTEGER;

-- Backfill from legacy usage_limit where present
UPDATE promotions
SET max_uses = usage_limit
WHERE max_uses IS NULL AND usage_limit IS NOT NULL;

UPDATE promotions
SET usage_limit = max_uses
WHERE usage_limit IS NULL AND max_uses IS NOT NULL;

COMMENT ON COLUMN promotions.max_uses IS 'Maximum total redemptions for this promotion';
COMMENT ON COLUMN promotions.max_uses_per_user IS 'Maximum redemptions per customer';
