COMMENT ON TABLE analytics_events IS 'Append-only events. For monthly partitions: migrate table to PARTITION BY RANGE (occurred_at); recreate indexes below on each partition.';
