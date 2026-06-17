-- Rolling 24h password reset cap: track last successful reset per account.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_password_reset_at TIMESTAMPTZ;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS last_password_reset_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_customers_last_password_reset_at
  ON customers (last_password_reset_at)
  WHERE last_password_reset_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vendors_last_password_reset_at
  ON vendors (last_password_reset_at)
  WHERE last_password_reset_at IS NOT NULL;
