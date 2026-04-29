-- Expand banners.type CHECK to include home_lower placement.
-- Keeps existing types: main, spotlight, category, service, home_top, home_middle, checkout.

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
    'checkout'
  )
);

COMMENT ON CONSTRAINT banners_type_check ON banners IS
  'Placement / banner slot: legacy main|spotlight|category|service plus home_top|home_middle|home_lower|checkout.';
