-- ============================================================================
-- MIGRATION 746: delivery_tracking.metadata (Java / logistics-webhooks parity)
-- ============================================================================
-- Ensures Hibernate validate (ECS) succeeds when migration 633 was never applied.
-- Matches: db/migrations/633_delivery_tracking_and_location_history.sql
-- ============================================================================

ALTER TABLE delivery_tracking ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
