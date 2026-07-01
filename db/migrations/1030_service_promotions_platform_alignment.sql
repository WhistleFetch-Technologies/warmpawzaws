-- ============================================================================
-- SERVICE PROMOTIONS + PLATFORM PROMOTIONS ALIGNMENT
-- ============================================================================
-- Purpose: Align promotions table with marketing API and service-provider flows
-- ============================================================================

-- Platform promotions: targeting columns used by marketing API
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'promotions' AND column_name = 'service_category'
    ) THEN
        ALTER TABLE promotions ADD COLUMN service_category TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'promotions' AND column_name = 'service_style'
    ) THEN
        ALTER TABLE promotions ADD COLUMN service_style TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'promotions' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE promotions ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'promotions' AND column_name = 'published'
    ) THEN
        ALTER TABLE promotions ADD COLUMN published BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'promotions' AND column_name = 'is_spotlight'
    ) THEN
        ALTER TABLE promotions ADD COLUMN is_spotlight BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'promotions' AND column_name = 'priority'
    ) THEN
        ALTER TABLE promotions ADD COLUMN priority INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'promotions' AND column_name = 'applicable_services'
    ) THEN
        ALTER TABLE promotions ADD COLUMN applicable_services JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- Relax promotion_type CHECK to allow marketing engine types
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'promotions_promotion_type_check'
    ) THEN
        ALTER TABLE promotions DROP CONSTRAINT promotions_promotion_type_check;
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'promotions_promotion_type_check_v2'
    ) THEN
        ALTER TABLE promotions ADD CONSTRAINT promotions_promotion_type_check_v2
            CHECK (promotion_type IN (
                'discount', 'cashback', 'loyalty_points', 'free_service',
                'flash_sale', 'seasonal', 'buy_x_get_y', 'bundle', 'first_order',
                'category_discount', 'loyalty', 'service_specific', 'combo', 'first_booking'
            ));
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_promotions_customer_active
    ON promotions (is_active, published, start_date, end_date)
    WHERE is_active = true AND published = true;

COMMENT ON COLUMN promotions.service_category IS 'Service vertical targeting (vet, grooming, etc.)';
COMMENT ON COLUMN promotions.service_style IS 'Service style targeting (at_home, at_center, tele)';
COMMENT ON COLUMN promotions.metadata IS 'Additional promotion targeting and display metadata';
