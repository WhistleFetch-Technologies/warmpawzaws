DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'hsn_codes' AND column_name = 'hsn_code'
  ) THEN
    EXECUTE $c$COMMENT ON COLUMN hsn_codes.hsn_code IS 'HSN/SAC code string; may repeat across rows (e.g. per tax category). Prefer hsn_code_id FK for precise tax resolution.'$c$;
  END IF;
END $$;
