-- Add shop main page placement for customer ecommerce banners (admin Marketing & Promotions).

ALTER TABLE banners DROP CONSTRAINT IF EXISTS banners_type_check;
ALTER TABLE banners ADD CONSTRAINT banners_type_check CHECK (
  type IN (
    'main',
    'spotlight',
    'category',
    'service',
    'home_top',
    'home_middle',
    'home_lower',
    'checkout',
    'shop'
  )
);

COMMENT ON CONSTRAINT banners_type_check ON banners IS
  'Placement / banner slot: legacy main|spotlight|category|service plus home_top|home_middle|home_lower|checkout|shop.';
