-- ============================================================================
-- SETTLEMENT_SCHEDULES TABLE - SCHEMA
-- ============================================================================

CREATE TABLE IF NOT EXISTS settlement_schedules (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    vendor_id UUID,
    schedule_type TEXT NOT NULL,
    day_of_week INTEGER,
    day_of_month INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

ALTER TABLE settlement_schedules ADD CONSTRAINT settlement_schedules_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;
ALTER TABLE settlement_schedules ADD CONSTRAINT settlement_schedules_schedule_type_check CHECK (schedule_type IN ('daily', 'weekly', 'biweekly', 'monthly'));
ALTER TABLE settlement_schedules ADD CONSTRAINT settlement_schedules_day_of_week_check CHECK (day_of_week IS NULL OR (day_of_week BETWEEN 0 AND 6));
ALTER TABLE settlement_schedules ADD CONSTRAINT settlement_schedules_day_of_month_check CHECK (day_of_month IS NULL OR (day_of_month BETWEEN 1 AND 31));

CREATE UNIQUE INDEX settlement_schedules_pkey ON settlement_schedules(id);
CREATE INDEX idx_settlement_schedules_vendor_id ON settlement_schedules(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX idx_settlement_schedules_type ON settlement_schedules(schedule_type);

COMMENT ON TABLE settlement_schedules IS 'Settlement schedule - maps from platform:settlement_schedule KV key';
COMMENT ON COLUMN settlement_schedules.vendor_id IS 'Reference to vendors table (NULL for global schedule)';
COMMENT ON COLUMN settlement_schedules.day_of_week IS 'Day of week (0=Sunday, 6=Saturday)';
COMMENT ON COLUMN settlement_schedules.day_of_month IS 'Day of month (1-31)';
