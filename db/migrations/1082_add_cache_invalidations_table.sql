-- ============================================================================
-- MIGRATION 1082: ADD CACHE_INVALIDATIONS TABLE
-- ============================================================================
-- Purpose: Support admin governance cache invalidation tracking
-- Used by: POST /admin/governance/propagate, POST /admin/governance/invalidate-cache,
--          GET /admin/governance/status
-- ============================================================================

CREATE TABLE IF NOT EXISTS cache_invalidations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key TEXT NOT NULL,
    invalidated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cache_invalidations_invalidated_at
    ON cache_invalidations (invalidated_at DESC);

CREATE INDEX IF NOT EXISTS idx_cache_invalidations_cache_key
    ON cache_invalidations (cache_key);

COMMENT ON TABLE cache_invalidations IS 'Audit log of cache key invalidations triggered by admin governance propagation';
COMMENT ON COLUMN cache_invalidations.cache_key IS 'Cache key or pattern invalidated (e.g. platform:settings, pattern:*)';
COMMENT ON COLUMN cache_invalidations.invalidated_at IS 'Timestamp when the invalidation was recorded';
