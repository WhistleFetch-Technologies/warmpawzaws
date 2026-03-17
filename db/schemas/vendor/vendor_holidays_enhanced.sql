-- ============================================================================
-- VENDOR_HOLIDAYS_ENHANCED TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_holidays_enhanced (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    holiday_type VARCHAR(50) DEFAULT 'holiday',
    reason TEXT,
    is_recurring_yearly BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id),
    CONSTRAINT valid_holiday_dates CHECK (start_date <= end_date),
    CONSTRAINT holiday_type_check CHECK (holiday_type IN ('holiday', 'vacation', 'closed', 'personal', 'sick'))
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE vendor_holidays_enhanced ADD CONSTRAINT vendor_holidays_enhanced_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON UPDATE NO ACTION ON DELETE CASCADE;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX vendor_holidays_enhanced_pkey ON public.vendor_holidays_enhanced USING btree (id);
CREATE INDEX idx_vendor_holidays_vendor_id ON public.vendor_holidays_enhanced USING btree (vendor_id);
CREATE INDEX idx_vendor_holidays_dates ON public.vendor_holidays_enhanced USING btree (start_date, end_date);
CREATE INDEX idx_vendor_holidays_recurring ON public.vendor_holidays_enhanced USING btree (is_recurring_yearly) WHERE is_recurring_yearly = true;
CREATE INDEX idx_vendor_holidays_active ON public.vendor_holidays_enhanced USING btree (is_active) WHERE is_active = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE vendor_holidays_enhanced IS 'Vendor holidays and vacation periods for scheduling';
COMMENT ON COLUMN vendor_holidays_enhanced.vendor_id IS 'Reference to vendors table';
COMMENT ON COLUMN vendor_holidays_enhanced.start_date IS 'Holiday/vacation start date';
COMMENT ON COLUMN vendor_holidays_enhanced.end_date IS 'Holiday/vacation end date';
COMMENT ON COLUMN vendor_holidays_enhanced.holiday_type IS 'Type: holiday, vacation, closed, personal, sick';
COMMENT ON COLUMN vendor_holidays_enhanced.reason IS 'Reason for holiday/vacation';
COMMENT ON COLUMN vendor_holidays_enhanced.is_recurring_yearly IS 'Whether holiday recurs yearly (e.g., Diwali, Christmas)';
COMMENT ON COLUMN vendor_holidays_enhanced.is_active IS 'Whether holiday is currently active';
