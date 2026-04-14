-- ============================================================================
-- 625: Allow multiple hsn_codes rows with the same HSN string (per category / row)
-- ============================================================================
-- Previously hsn_code was UNIQUE globally. Product need: same code (e.g. 9983)
-- on multiple rows tied to different tax categories.
-- ============================================================================

-- Drop table UNIQUE constraint (name from CREATE TABLE ... hsn_code UNIQUE / ALTER)
ALTER TABLE IF EXISTS hsn_codes DROP CONSTRAINT IF EXISTS hsn_codes_hsn_code_key;

-- Drop standalone unique indexes (names vary by migration / env)
DROP INDEX IF EXISTS hsn_codes_hsn_code_key;
DROP INDEX IF EXISTS idx_hsn_codes_hsn_code_unique;

-- Legacy schema (e.g. 213) may use column `code` with a unique constraint
ALTER TABLE IF EXISTS hsn_codes DROP CONSTRAINT IF EXISTS hsn_codes_code_key;
DROP INDEX IF EXISTS hsn_codes_code_key;

-- Non-unique index for lookups on hsn_code (if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'hsn_codes' AND column_name = 'hsn_code'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_hsn_codes_hsn_code_nonunique ON hsn_codes (hsn_code);
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'hsn_codes' AND column_name = 'code'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_hsn_codes_code_nonunique ON hsn_codes (code);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'hsn_codes' AND column_name = 'hsn_code'
  ) THEN
    EXECUTE $c$COMMENT ON COLUMN hsn_codes.hsn_code IS 'HSN/SAC code string; may repeat across rows (e.g. per tax category). Prefer hsn_code_id FK for precise tax resolution.'$c$;
  END IF;
END $$;
