-- Migration 1004: Customer username + password auth columns
--
-- is_phone_verified:
--   Default FALSE for new rows. This migration sets TRUE where we can infer the customer
--   already passed phone verification or used the app: onboarding_status IS DISTINCT FROM 'INIT',
--   OR profile_completed, OR last_login_at IS NOT NULL. Pure INIT rows with no activity stay FALSE
--   until the next successful OTP verify (application sets TRUE on OTP).
--
-- username:
--   Default login name; backfilled from canonical last-10 digits of phone for Indian numbers.
--   Duplicate phones (multiple customer rows) get username = last10 || '_' || left(uuid) to satisfy UNIQUE.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Backfill username from canonical 10-digit key (same ordering idea as OTP customer collapse)
WITH ranked AS (
  SELECT
    id,
    RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) AS last10,
    ROW_NUMBER() OVER (
      PARTITION BY RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10)
      ORDER BY (profile_completed IS TRUE) DESC, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    ) AS rn
  FROM customers
  WHERE phone IS NOT NULL
    AND LENGTH(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g')) >= 10
)
UPDATE customers c
SET username = CASE
  WHEN r.rn = 1 THEN r.last10
  ELSE r.last10 || '_' || REPLACE(SUBSTRING(c.id::text, 1, 8), '-', '')
END
FROM ranked r
WHERE c.id = r.id
  AND (c.username IS NULL OR TRIM(c.username) = '');

-- Rows without a usable 10-digit phone: deterministic unique placeholder
UPDATE customers
SET username = 'u' || REPLACE(id::text, '-', '')
WHERE username IS NULL OR TRIM(username) = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_username_unique ON customers (username);

UPDATE customers
SET is_phone_verified = true
WHERE is_phone_verified = false
  AND (
    onboarding_status IS DISTINCT FROM 'INIT'
    OR profile_completed IS TRUE
    OR last_login_at IS NOT NULL
  );

COMMENT ON COLUMN customers.username IS 'Unique login username; default canonical 10-digit mobile';
COMMENT ON COLUMN customers.password_hash IS 'bcrypt ($2*) or legacy PBKDF2 salt:hex';
COMMENT ON COLUMN customers.password_set_at IS 'When customer password was set; NULL for OTP-only';
COMMENT ON COLUMN customers.is_phone_verified IS 'True after OTP success; legacy inferred in 1004 where activity existed';
