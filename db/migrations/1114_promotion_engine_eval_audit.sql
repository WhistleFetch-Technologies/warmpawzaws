-- ============================================================================
-- 1114_promotion_engine_eval_audit.sql
-- Evaluate snapshots + audit (HLD §26/§41 / master plan §4.4)
-- Evaluate must not write wallet; commit uses evaluation_id + idempotency.
-- ============================================================================

CREATE TABLE IF NOT EXISTS promo_engine_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  request_json JSONB NOT NULL,
  result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  explain_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_promo_engine_evaluations_user
  ON promo_engine_evaluations (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_promo_engine_evaluations_expires
  ON promo_engine_evaluations (expires_at)
  WHERE expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS promo_engine_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID,
  evaluation_id UUID,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_engine_audit_promo
  ON promo_engine_audit_log (promotion_id, created_at DESC)
  WHERE promotion_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_promo_engine_audit_eval
  ON promo_engine_audit_log (evaluation_id, created_at DESC)
  WHERE evaluation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_promo_engine_audit_event
  ON promo_engine_audit_log (event_type, created_at DESC);

COMMENT ON TABLE promo_engine_evaluations IS
  'Short-lived evaluate snapshots (commit window). Never implies wallet credit.';
COMMENT ON TABLE promo_engine_audit_log IS
  'EVALUATED|ELIGIBLE|REJECTED|COMMITTED|REVERSED and related engine events';
COMMENT ON COLUMN promo_engine_audit_log.event_type IS
  'EVALUATED|ELIGIBLE|REJECTED|COMMITTED|REVERSED|STATUS_CHANGED|…';
