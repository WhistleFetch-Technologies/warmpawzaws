-- ============================================================================
-- CACHE_STATS TABLE - SCHEMA
-- ============================================================================

CREATE TABLE IF NOT EXISTS cache_stats (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    stat_date DATE NOT NULL,
    hits INTEGER DEFAULT 0,
    misses INTEGER DEFAULT 0,
    evictions INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id),
    CONSTRAINT cache_stats_stat_date_key UNIQUE (stat_date)
);

CREATE UNIQUE INDEX cache_stats_pkey ON cache_stats(id);
CREATE UNIQUE INDEX cache_stats_stat_date_key ON cache_stats(stat_date);

COMMENT ON TABLE cache_stats IS 'Cache statistics - maps from cache_stats KV key';
