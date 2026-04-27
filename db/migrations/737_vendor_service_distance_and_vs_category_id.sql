-- Center/business: max distance (km) from business location for service area / future discovery filtering.
-- vendor_services.category_id: strict catalogue link for custom + discovery (optional FK per environment).

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS service_distance_km NUMERIC(5, 2);
COMMENT ON COLUMN vendors.service_distance_km IS
  'For center/business vendors: service coverage radius (km) from business address; used in availability UI and future discovery.';

ALTER TABLE vendor_services ADD COLUMN IF NOT EXISTS category_id UUID;
COMMENT ON COLUMN vendor_services.category_id IS
  'Link to service_categories.id for strict customer discovery by category.';
