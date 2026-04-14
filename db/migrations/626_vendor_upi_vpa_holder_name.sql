-- Persist Razorpay VPA validation customer_name for display after reload (optional column).
-- Uses ADD COLUMN IF NOT EXISTS so this file is safe to re-run and works with RDS Data API runners that split on ';'.

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS upi_vpa_holder_name TEXT;
COMMENT ON COLUMN vendors.upi_vpa_holder_name IS 'Beneficiary name returned by Razorpay VPA validation (if any)';
