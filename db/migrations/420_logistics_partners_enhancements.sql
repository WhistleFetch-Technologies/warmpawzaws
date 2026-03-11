-- ============================================================================
-- LOGISTICS PARTNERS ENHANCEMENTS
-- ============================================================================
-- Additional columns and tables for Delhivery and Dunzo integrations
-- Date: 2026-01-27
-- ============================================================================

-- Add additional columns to logistics_partners if they don't exist
DO $$
BEGIN
    -- Add webhook_secret column for partner webhook verification
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'logistics_partners' AND column_name = 'webhook_secret'
    ) THEN
        ALTER TABLE logistics_partners ADD COLUMN webhook_secret TEXT;
        COMMENT ON COLUMN logistics_partners.webhook_secret IS 'Secret key for verifying webhook signatures';
    END IF;

    -- Add base_url column for custom API endpoints
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'logistics_partners' AND column_name = 'base_url'
    ) THEN
        ALTER TABLE logistics_partners ADD COLUMN base_url TEXT;
        COMMENT ON COLUMN logistics_partners.base_url IS 'Base URL for partner API (defaults to standard if null)';
    END IF;

    -- Add service_areas column for delivery zone configuration
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'logistics_partners' AND column_name = 'service_areas'
    ) THEN
        ALTER TABLE logistics_partners ADD COLUMN service_areas JSONB DEFAULT '[]'::jsonb;
        COMMENT ON COLUMN logistics_partners.service_areas IS 'Array of serviceable areas/cities for hyperlocal partners';
    END IF;

    -- Add priority column for partner selection
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'logistics_partners' AND column_name = 'priority'
    ) THEN
        ALTER TABLE logistics_partners ADD COLUMN priority INTEGER DEFAULT 100;
        COMMENT ON COLUMN logistics_partners.priority IS 'Partner priority for auto-selection (lower = higher priority)';
    END IF;

    -- Add supported_order_types column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'logistics_partners' AND column_name = 'supported_order_types'
    ) THEN
        ALTER TABLE logistics_partners ADD COLUMN supported_order_types TEXT[] DEFAULT ARRAY['ecommerce'];
        COMMENT ON COLUMN logistics_partners.supported_order_types IS 'Order types supported by this partner (ecommerce, pharmacy, meal)';
    END IF;

    -- Add max_distance_km column for hyperlocal partners
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'logistics_partners' AND column_name = 'max_distance_km'
    ) THEN
        ALTER TABLE logistics_partners ADD COLUMN max_distance_km NUMERIC(6,2);
        COMMENT ON COLUMN logistics_partners.max_distance_km IS 'Maximum delivery distance in km (for hyperlocal partners)';
    END IF;

    -- Add credentials_source column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'logistics_partners' AND column_name = 'credentials_source'
    ) THEN
        ALTER TABLE logistics_partners ADD COLUMN credentials_source TEXT DEFAULT 'secrets_manager';
        COMMENT ON COLUMN logistics_partners.credentials_source IS 'Where to fetch credentials: secrets_manager, database, inline';
    END IF;

    -- Add last_health_check column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'logistics_partners' AND column_name = 'last_health_check'
    ) THEN
        ALTER TABLE logistics_partners ADD COLUMN last_health_check TIMESTAMPTZ;
        COMMENT ON COLUMN logistics_partners.last_health_check IS 'Timestamp of last successful API health check';
    END IF;

    -- Add is_healthy column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'logistics_partners' AND column_name = 'is_healthy'
    ) THEN
        ALTER TABLE logistics_partners ADD COLUMN is_healthy BOOLEAN DEFAULT true;
        COMMENT ON COLUMN logistics_partners.is_healthy IS 'Whether the partner API is responding correctly';
    END IF;
END $$;

-- Ensure shipment_tracking_events table exists and has required columns
DO $$
BEGIN
    -- Create table if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'shipment_tracking_events'
    ) THEN
        CREATE TABLE shipment_tracking_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
            event_type VARCHAR(100) NOT NULL,
            event_description TEXT,
            location VARCHAR(255),
            timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    ELSE
        -- Table exists, add missing columns if needed
        -- Add raw_data column if it doesn't exist (alias for metadata)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'shipment_tracking_events' AND column_name = 'raw_data'
        ) THEN
            ALTER TABLE shipment_tracking_events ADD COLUMN raw_data JSONB DEFAULT '{}'::jsonb;
        END IF;
        
        -- Ensure metadata column exists (it should from migration 004)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'shipment_tracking_events' AND column_name = 'metadata'
        ) THEN
            ALTER TABLE shipment_tracking_events ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
        END IF;
    END IF;
END $$;

-- Create indexes (using timestamp column which exists in the original table)
CREATE INDEX IF NOT EXISTS idx_shipment_tracking_events_shipment_id 
    ON shipment_tracking_events(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_tracking_events_timestamp 
    ON shipment_tracking_events(timestamp DESC);

COMMENT ON TABLE shipment_tracking_events IS 'Tracking history for shipments';

-- Add additional columns to shipments table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipments' AND column_name = 'courier_name'
    ) THEN
        ALTER TABLE shipments ADD COLUMN courier_name VARCHAR(255);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipments' AND column_name = 'current_location'
    ) THEN
        ALTER TABLE shipments ADD COLUMN current_location VARCHAR(500);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipments' AND column_name = 'estimated_delivery'
    ) THEN
        ALTER TABLE shipments ADD COLUMN estimated_delivery TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipments' AND column_name = 'shipped_at'
    ) THEN
        ALTER TABLE shipments ADD COLUMN shipped_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipments' AND column_name = 'delivered_at'
    ) THEN
        ALTER TABLE shipments ADD COLUMN delivered_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipments' AND column_name = 'picked_up_at'
    ) THEN
        ALTER TABLE shipments ADD COLUMN picked_up_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipments' AND column_name = 'logistics_partner_id'
    ) THEN
        ALTER TABLE shipments ADD COLUMN logistics_partner_id UUID REFERENCES logistics_partners(id);
    END IF;
END $$;

-- Add additional columns to delivery_tracking for Dunzo integration
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'delivery_tracking' AND column_name = 'external_task_id'
    ) THEN
        ALTER TABLE delivery_tracking ADD COLUMN external_task_id VARCHAR(255);
        COMMENT ON COLUMN delivery_tracking.external_task_id IS 'External task ID from Dunzo or other hyperlocal partner';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'delivery_tracking' AND column_name = 'logistics_partner'
    ) THEN
        ALTER TABLE delivery_tracking ADD COLUMN logistics_partner VARCHAR(50) DEFAULT 'warmpawz';
        COMMENT ON COLUMN delivery_tracking.logistics_partner IS 'Logistics partner: warmpawz, dunzo, internal, vendor';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'delivery_tracking' AND column_name = 'tracking_url'
    ) THEN
        ALTER TABLE delivery_tracking ADD COLUMN tracking_url TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'delivery_tracking' AND column_name = 'eta_to_delivery_minutes'
    ) THEN
        ALTER TABLE delivery_tracking ADD COLUMN eta_to_delivery_minutes INTEGER;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'delivery_tracking' AND column_name = 'distance_remaining_km'
    ) THEN
        ALTER TABLE delivery_tracking ADD COLUMN distance_remaining_km NUMERIC(6,2);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'delivery_tracking' AND column_name = 'delivery_person_photo'
    ) THEN
        ALTER TABLE delivery_tracking ADD COLUMN delivery_person_photo TEXT;
    END IF;
END $$;

-- Create index for external_task_id lookup
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_external_task_id 
    ON delivery_tracking(external_task_id) WHERE external_task_id IS NOT NULL;

-- Update partner_type constraint to include 'dunzo' if not already
-- Note: This is a workaround since we can't easily modify CHECK constraints in PostgreSQL
-- The application layer already handles validation

-- Insert default logistics partners if not exists
INSERT INTO logistics_partners (partner_id, partner_name, partner_type, enabled, priority, supported_order_types, config)
VALUES 
    ('shiprocket-default', 'Shiprocket', 'shiprocket', true, 100, ARRAY['ecommerce'], 
     '{"description": "Primary inter-city logistics partner"}'::jsonb),
    ('delhivery-default', 'Delhivery', 'delhivery', false, 90, ARRAY['ecommerce'], 
     '{"description": "Alternative inter-city logistics partner"}'::jsonb),
    ('dunzo-default', 'Dunzo', 'dunzo', false, 50, ARRAY['pharmacy', 'meal'], 
     '{"description": "Hyperlocal delivery partner for same-city delivery", "max_distance_km": 10}'::jsonb)
ON CONFLICT (partner_id) DO UPDATE SET
    partner_name = EXCLUDED.partner_name,
    updated_at = NOW();

-- Insert default logistics rules for partner selection
INSERT INTO logistics_rules (rule_name, rule_type, rule_config, is_active)
VALUES
    ('Hyperlocal Pharmacy Delivery', 'partner_selection', 
     '{"conditions": {"order_types": ["pharmacy", "meal"], "max_distance_km": 10, "same_city": true}, 
       "partnerPriority": ["dunzo-default", "shiprocket-default"], 
       "priority": 100}'::jsonb, true),
    ('Heavy Package Rule', 'partner_selection',
     '{"conditions": {"min_weight_kg": 5}, 
       "partnerPriority": ["delhivery-default", "shiprocket-default"], 
       "priority": 90}'::jsonb, true),
    ('Default Ecommerce Shipping', 'partner_selection',
     '{"conditions": {"order_types": ["ecommerce"]}, 
       "partnerPriority": ["shiprocket-default", "delhivery-default"], 
       "priority": 50}'::jsonb, true)
ON CONFLICT (rule_name) DO NOTHING;

COMMENT ON TABLE logistics_partners IS 'Logistics partners configuration for Shiprocket, Delhivery, Dunzo, etc.';
COMMENT ON TABLE logistics_rules IS 'Rules for automatic logistics partner selection';
