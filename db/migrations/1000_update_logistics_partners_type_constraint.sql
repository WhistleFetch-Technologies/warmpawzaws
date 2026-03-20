-- ============================================================================
-- UPDATE LOGISTICS PARTNERS TYPE CONSTRAINT
-- ============================================================================
-- Add delivery type values to partner_type CHECK constraint
-- Date: 2026-03-20
-- ============================================================================

-- Drop the existing constraint
DO $$
BEGIN
    -- Check if the constraint exists and drop it
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'logistics_partners_partner_type_check'
        AND table_name = 'logistics_partners'
    ) THEN
        ALTER TABLE logistics_partners DROP CONSTRAINT logistics_partners_partner_type_check;
    END IF;
END $$;

-- Add the new constraint with delivery type values
ALTER TABLE logistics_partners 
ADD CONSTRAINT logistics_partners_partner_type_check 
CHECK (partner_type IN (
    'shiprocket', 
    'delhivery', 
    'dunzo', 
    'other',
    'last_mile',
    'intercity',
    'pan_india',
    'hyperlocal'
));

COMMENT ON CONSTRAINT logistics_partners_partner_type_check ON logistics_partners IS 
'Allows both provider types (shiprocket, delhivery, dunzo, other) and delivery types (last_mile, intercity, pan_india, hyperlocal)';
