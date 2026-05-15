-- ============================================================================
-- PERFORMANCE_METRICS TABLE - SCHEMA
-- ============================================================================

CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    metric_name TEXT NOT NULL,
    metric_value NUMERIC(10, 2) NOT NULL,
    metric_type TEXT NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE UNIQUE INDEX performance_metrics_pkey ON performance_metrics(id);
CREATE INDEX idx_performance_metrics_name ON performance_metrics(metric_name);
CREATE INDEX idx_performance_metrics_type ON performance_metrics(metric_type);
CREATE INDEX idx_performance_metrics_recorded_at ON performance_metrics(recorded_at DESC);

COMMENT ON TABLE performance_metrics IS 'Performance metrics - maps from performance_metrics KV key';
COMMENT ON COLUMN performance_metrics.metric_type IS 'Metric type: response_time, error_rate, throughput, etc.';
