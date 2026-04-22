-- Vendor phone + password login: password_hash + auth_version (parity with customer auth)
-- Idempotent: safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE public.vendors ADD COLUMN password_hash TEXT;
    COMMENT ON COLUMN public.vendors.password_hash IS 'bcrypt ($2*) or legacy PBKDF2 salt:hex — mirrors customers.password_hash';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'auth_version'
  ) THEN
    ALTER TABLE public.vendors ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0;
    UPDATE public.vendors SET auth_version = 0 WHERE auth_version IS NULL;
    COMMENT ON COLUMN public.vendors.auth_version IS 'Bump on vendor password set/change; reserved for JWT invalidation parity with customers.';
  END IF;
END $$;
