-- Admin AI copilot audit trail (no raw prompts; prompt_hash + message_len only)
CREATE TABLE IF NOT EXISTS admin_ai_audit (
  id UUID PRIMARY KEY,
  admin_principal_id TEXT NOT NULL,
  route TEXT NOT NULL,
  tool_names TEXT,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latency_ms INTEGER,
  outcome TEXT NOT NULL,
  prompt_hash TEXT,
  message_len INTEGER
);

CREATE INDEX IF NOT EXISTS idx_admin_ai_audit_created_at ON admin_ai_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_ai_audit_principal ON admin_ai_audit (admin_principal_id);

-- Optional: grant copilot to a role via RBAC UI, or e.g.
-- INSERT INTO role_permissions (role_id, permission_name)
-- SELECT id, 'admin.ai_copilot' FROM roles WHERE name = 'super-admin' ON CONFLICT DO NOTHING;
