-- ============================================================================
-- 1035: Round-robin support ticket auto-assignment
-- support_agents.last_assigned_at cursor + support_routing_settings singleton
-- ============================================================================

ALTER TABLE public.support_agents
  ADD COLUMN IF NOT EXISTS last_assigned_at TIMESTAMPTZ;

COMMENT ON COLUMN public.support_agents.last_assigned_at IS
  'Round-robin cursor: agents with oldest last_assigned_at receive the next ticket in their specialty pool';

CREATE TABLE IF NOT EXISTS public.support_routing_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  auto_assign_enabled BOOLEAN NOT NULL DEFAULT true,
  assign_after_ai_ack BOOLEAN NOT NULL DEFAULT true,
  sweeper_batch_size INTEGER NOT NULL DEFAULT 25,
  fallback_to_general_specialty BOOLEAN NOT NULL DEFAULT true,
  last_sweeper_run_at TIMESTAMPTZ,
  last_sweeper_assigned_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.support_routing_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.support_routing_settings IS
  'Singleton config for support ticket round-robin auto-assignment';
