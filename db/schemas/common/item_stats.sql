-- ============================================================================
-- ITEM_STATS TABLE - SCHEMA
-- ============================================================================

CREATE TABLE IF NOT EXISTS item_stats (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL,
    item_type TEXT NOT NULL,
    stat_date DATE NOT NULL,
    views INTEGER DEFAULT 0,
    sales INTEGER DEFAULT 0,
    revenue NUMERIC(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id),
    CONSTRAINT item_stats_item_type_date_unique UNIQUE (item_id, item_type, stat_date)
);

CREATE UNIQUE INDEX item_stats_pkey ON item_stats(id);
CREATE UNIQUE INDEX item_stats_item_type_date_unique ON item_stats(item_id, item_type, stat_date);
CREATE INDEX idx_item_stats_item ON item_stats(item_id, item_type);
CREATE INDEX idx_item_stats_date ON item_stats(stat_date);

COMMENT ON TABLE item_stats IS 'Item statistics - maps from stats:item:{itemId}:{date} KV keys';
COMMENT ON COLUMN item_stats.item_type IS 'Item type: service, product, etc.';
