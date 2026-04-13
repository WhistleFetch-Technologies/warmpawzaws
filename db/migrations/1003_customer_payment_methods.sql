-- Saved payment methods for customer checkout (card / UPI / net banking).
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS customer_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  payment_type TEXT NOT NULL,
  razorpay_token TEXT,
  card_last4 TEXT,
  card_brand TEXT,
  card_holder_name TEXT,
  card_expiry_month TEXT,
  card_expiry_year TEXT,
  upi_id TEXT,
  bank_name TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_payment_methods_customer_id
  ON customer_payment_methods (customer_id);
