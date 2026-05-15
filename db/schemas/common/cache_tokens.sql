-- ============================================================================
-- CACHE_TOKENS TABLE - SCHEMA
-- ============================================================================

CREATE TABLE IF NOT EXISTS cache_tokens (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    cache_key TEXT NOT NULL,
    cache_value TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id),
    CONSTRAINT cache_tokens_cache_key_key UNIQUE (cache_key)
);

CREATE UNIQUE INDEX cache_tokens_pkey ON cache_tokens(id);
CREATE UNIQUE INDEX cache_tokens_cache_key_key ON cache_tokens(cache_key);
CREATE INDEX idx_cache_tokens_expires_at ON cache_tokens(expires_at);

COMMENT ON TABLE cache_tokens IS 'Cache tokens with expiration - replaces KV TTL logic';
