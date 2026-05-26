-- Vendor/customer-visible reason when an e-commerce order is cancelled
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

COMMENT ON COLUMN orders.cancellation_reason IS 'Reason shown to customer when order is cancelled (vendor or customer initiated)';
