-- Boarding-specific disclaimer at vendor row (customer discovery + intake; varies per vendor).
-- Synced from vendor profile facility save for boarding roles; falls back to metadata if empty.

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS boarding_disclaimer TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS boarding_disclaimer_points JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN vendors.boarding_disclaimer IS 'Denormalized newline-joined boarding disclaimer (boarding vendors only).';
COMMENT ON COLUMN vendors.boarding_disclaimer_points IS 'JSON array of disclaimer bullet strings for customer boarding intake.';
