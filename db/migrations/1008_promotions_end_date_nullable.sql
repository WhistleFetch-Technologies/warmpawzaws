DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'promotions'
      AND column_name = 'end_date'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.promotions ALTER COLUMN end_date DROP NOT NULL;
  END IF;
END $$;

