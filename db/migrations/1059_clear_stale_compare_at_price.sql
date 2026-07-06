-- Migration 1059: Clear legacy compare_at_price (old MRP) on all products and SKUs.
-- Single-price model: only `price` is shown; compare_at_price is reserved for future
-- promotion-engine strikethrough (not vendor-set MRP). Idempotent.

UPDATE products
SET compare_at_price = NULL, updated_at = NOW()
WHERE compare_at_price IS NOT NULL;

UPDATE product_skus
SET compare_at_price = NULL, updated_at = NOW()
WHERE compare_at_price IS NOT NULL;
