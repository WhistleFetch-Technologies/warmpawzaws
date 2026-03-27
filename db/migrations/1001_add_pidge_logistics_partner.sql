-- ============================================================================
-- ADD PIDGE LOGISTICS PARTNER
-- ============================================================================
-- Extends partner_type CHECK to include 'pidge' and seeds default partner row.
-- Date: 2026-03-26
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'logistics_partners_partner_type_check'
          AND table_name = 'logistics_partners'
    ) THEN
        ALTER TABLE logistics_partners DROP CONSTRAINT logistics_partners_partner_type_check;
    END IF;
END $$;

ALTER TABLE logistics_partners
ADD CONSTRAINT logistics_partners_partner_type_check
CHECK (partner_type IN (
    'shiprocket',
    'delhivery',
    'dunzo',
    'pidge',
    'other',
    'last_mile',
    'intercity',
    'pan_india',
    'hyperlocal'
));

COMMENT ON CONSTRAINT logistics_partners_partner_type_check ON logistics_partners IS
'Provider types (shiprocket, delhivery, dunzo, pidge, other) and delivery modes (last_mile, intercity, pan_india, hyperlocal)';

INSERT INTO logistics_partners (
    partner_id,
    partner_name,
    partner_type,
    enabled,
    priority,
    supported_order_types,
    max_distance_km,
    config
)
VALUES (
    'pidge-default',
    'Pidge',
    'pidge',
    false,
    60,
    ARRAY['pharmacy', 'meal']::text[],
    20,
    '{"description": "Hyperlocal partner for pharmacy and nutritionist meals (up to 20 km)"}'::jsonb
)
ON CONFLICT (partner_id) DO UPDATE SET
    partner_name = EXCLUDED.partner_name,
    partner_type = EXCLUDED.partner_type,
    enabled = EXCLUDED.enabled,
    priority = EXCLUDED.priority,
    supported_order_types = EXCLUDED.supported_order_types,
    max_distance_km = EXCLUDED.max_distance_km,
    config = COALESCE(logistics_partners.config, '{}'::jsonb) || EXCLUDED.config,
    updated_at = NOW();
