-- Expand banners.type CHECK to match admin/customer placement values (home_top, home_middle, checkout).
-- Keeps existing types: main, spotlight, category, service.

ALTER TABLE banners DROP CONSTRAINT IF EXISTS banners_type_check;
ALTER TABLE banners ADD CONSTRAINT banners_type_check CHECK (
  type IN (
    'main',
    'spotlight',
    'category',
    'service',
    'home_top',
    'home_middle',
    'checkout'
  )
);

COMMENT ON CONSTRAINT banners_type_check ON banners IS
  'Placement / banner slot: legacy main|spotlight|category|service plus home_top|home_middle|checkout.';
