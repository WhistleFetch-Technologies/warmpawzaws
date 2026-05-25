-- ============================================================================
-- Prod delivery-service Hibernate validate gaps (ECS exit code 1)
-- Safe idempotent ALTERs — run after 024/420/633/746/750 on prod.
-- ============================================================================

-- Shipment.java (columns not added by 420_logistics_partners_enhancements.sql)
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS pickup_address JSONB;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS delivery_address JSONB;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS fulfillment_type TEXT DEFAULT 'warmpawz';

-- Prod shipments predates 039 (ecommerce shape: shipment_status, logistics_partner_id only).
-- Java entity expects logistics_partner, shipment_id, status column names.
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS logistics_partner TEXT;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS shipment_id TEXT;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'created';
UPDATE shipments SET logistics_partner = COALESCE(logistics_partner, 'warmpawz') WHERE logistics_partner IS NULL;
UPDATE shipments SET status = COALESCE(status, shipment_status, 'created') WHERE status IS NULL;

-- DeliveryTracking.java
ALTER TABLE delivery_tracking ADD COLUMN IF NOT EXISTS subscription_delivery_id UUID;

-- DeliveryLocationHistory.java (also in 750)
ALTER TABLE delivery_location_history ADD COLUMN IF NOT EXISTS source VARCHAR(32);

-- LogisticsPartner.java — ensure core columns exist if logistics_partners predates 420
ALTER TABLE logistics_partners ADD COLUMN IF NOT EXISTS base_url TEXT;
ALTER TABLE logistics_partners ADD COLUMN IF NOT EXISTS webhook_secret TEXT;
ALTER TABLE logistics_partners ADD COLUMN IF NOT EXISTS service_areas JSONB DEFAULT '[]'::jsonb;
ALTER TABLE logistics_partners ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 100;

-- ShipmentTrackingEvent.java — raw_data if table existed before 420
ALTER TABLE shipment_tracking_events ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE shipment_tracking_events ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
