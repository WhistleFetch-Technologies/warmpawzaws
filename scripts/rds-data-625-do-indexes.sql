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
