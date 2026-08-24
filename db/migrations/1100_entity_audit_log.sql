-- ============================================================================
-- Migration 1100: entity_audit_log (prod parity for Warmpawz Pay / Appointments)
-- ============================================================================
-- Prod never received 043. Catalogue and pricing admin mutations insert into
-- entity_audit_log and currently 500 with AUDIT_PERSISTENCE_ERROR.
-- Idempotent and additive only.
-- ============================================================================

CREATE TABLE IF NOT EXISTS entity_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    actor_id UUID,
    actor_type TEXT,
    actor_ip TEXT,
    request_id TEXT,
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE entity_audit_log
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_audit_entity ON entity_audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON entity_audit_log (event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON entity_audit_log (actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON entity_audit_log (entity_type, action);

COMMENT ON TABLE entity_audit_log IS 'Append-only audit trail for entity changes including Warmpawz Pay catalogue';
