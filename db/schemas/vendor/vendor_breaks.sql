-- ============================================================================
-- VENDOR_BREAKS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_breaks (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL,
    slot_id UUID,
    day_of_week INTEGER,
    break_date DATE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_type VARCHAR(50) DEFAULT 'custom',
    reason TEXT,
    is_recurring BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id),
    CONSTRAINT valid_break_time CHECK (start_time < end_time),
    CONSTRAINT break_type_check CHECK (break_type IN ('lunch', 'tea', 'custom', 'personal')),
    CONSTRAINT day_of_week_check CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6))
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE vendor_breaks ADD CONSTRAINT vendor_breaks_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE vendor_breaks ADD CONSTRAINT vendor_breaks_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES vendor_availability_v2(id) ON UPDATE NO ACTION ON DELETE SET NULL;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX vendor_breaks_pkey ON public.vendor_breaks USING btree (id);
CREATE INDEX idx_vendor_breaks_vendor_id ON public.vendor_breaks USING btree (vendor_id);
CREATE INDEX idx_vendor_breaks_day_of_week ON public.vendor_breaks USING btree (day_of_week) WHERE is_recurring = true;
CREATE INDEX idx_vendor_breaks_date ON public.vendor_breaks USING btree (break_date) WHERE break_date IS NOT NULL;
CREATE INDEX idx_vendor_breaks_active ON public.vendor_breaks USING btree (is_active) WHERE is_active = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE vendor_breaks IS 'Vendor break times (lunch, tea, custom) for scheduling';
COMMENT ON COLUMN vendor_breaks.vendor_id IS 'Reference to vendors table';
COMMENT ON COLUMN vendor_breaks.slot_id IS 'Reference to vendor_availability_v2 (if break is tied to specific slot)';
COMMENT ON COLUMN vendor_breaks.day_of_week IS 'Day of week for recurring breaks (0=Sunday, 6=Saturday)';
COMMENT ON COLUMN vendor_breaks.break_date IS 'Specific date for one-time breaks';
COMMENT ON COLUMN vendor_breaks.start_time IS 'Break start time';
COMMENT ON COLUMN vendor_breaks.end_time IS 'Break end time';
COMMENT ON COLUMN vendor_breaks.break_type IS 'Type of break: lunch, tea, custom, personal';
COMMENT ON COLUMN vendor_breaks.reason IS 'Reason for break';
COMMENT ON COLUMN vendor_breaks.is_recurring IS 'Whether break is recurring (weekly) or one-time';
COMMENT ON COLUMN vendor_breaks.is_active IS 'Whether break is currently active';
