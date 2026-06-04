-- MRP (compare_at_price) is the list price; price is the selling price at checkout.
-- Backfill MRP from existing selling price where MRP was never set.

UPDATE products
SET compare_at_price = price
WHERE compare_at_price IS NULL
  AND price IS NOT NULL
  AND price > 0;

COMMENT ON COLUMN products.compare_at_price IS 'MRP (list price). Required for catalog; used with price to show discounts.';
COMMENT ON COLUMN products.price IS 'Selling price charged at checkout. When equal to compare_at_price, no discount is shown.';
