-- ============================================================================
-- HEALTH_CHECKS TABLE - SCHEMA
-- ============================================================================

CREATE TABLE IF NOT EXISTS health_checks (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    check_type TEXT NOT NULL,
    status TEXT NOT NULL,
    details JSONB,
    checked_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

ALTER TABLE health_checks ADD CONSTRAINT health_checks_status_check CHECK (status IN ('healthy', 'degraded', 'unhealthy'));

CREATE UNIQUE INDEX health_checks_pkey ON health_checks(id);
CREATE INDEX idx_health_checks_type ON health_checks(check_type);
CREATE INDEX idx_health_checks_status ON health_checks(status);
CREATE INDEX idx_health_checks_checked_at ON health_checks(checked_at DESC);

COMMENT ON TABLE health_checks IS 'Health checks - maps from health:check, health:quick, health_check KV keys';
COMMENT ON COLUMN health_checks.check_type IS 'Check type: full, quick, database, api, etc.';
COMMENT ON COLUMN health_checks.status IS 'Status: healthy, degraded, unhealthy';
