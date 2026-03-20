-- ============================================================================
-- VENDOR_STATS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_stats (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL,
    stat_date DATE NOT NULL,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    bookings INTEGER DEFAULT 0,
    revenue NUMERIC(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id),
    CONSTRAINT unique_vendor_stat_date UNIQUE (vendor_id, stat_date)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE vendor_stats ADD CONSTRAINT vendor_stats_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON UPDATE NO ACTION ON DELETE CASCADE;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX vendor_stats_pkey ON public.vendor_stats USING btree (id);
CREATE UNIQUE INDEX unique_vendor_stat_date ON public.vendor_stats USING btree (vendor_id, stat_date);
CREATE INDEX idx_vendor_stats_vendor ON public.vendor_stats USING btree (vendor_id);
CREATE INDEX idx_vendor_stats_date ON public.vendor_stats USING btree (stat_date);
CREATE INDEX idx_vendor_stats_vendor_date ON public.vendor_stats USING btree (vendor_id, stat_date DESC);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE vendor_stats IS 'Vendor statistics - maps from stats:vendor:{vendorId}:{date} KV keys';
COMMENT ON COLUMN vendor_stats.vendor_id IS 'Reference to vendors table';
COMMENT ON COLUMN vendor_stats.stat_date IS 'Date for which stats are recorded';
COMMENT ON COLUMN vendor_stats.impressions IS 'Number of times vendor appeared in search results';
COMMENT ON COLUMN vendor_stats.clicks IS 'Number of times vendor profile was clicked';
COMMENT ON COLUMN vendor_stats.bookings IS 'Number of bookings made';
COMMENT ON COLUMN vendor_stats.revenue IS 'Revenue generated on this date';
