-- ============================================================================
-- MIGRATION 017: RBAC Policies Table
-- ============================================================================
-- Date: 2025-01-28
-- Purpose: Create table for RBAC access policies, replacing KV store usage
-- ============================================================================

CREATE TABLE IF NOT EXISTS rbac_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id TEXT NOT NULL UNIQUE, -- Human-readable policy ID
    name TEXT NOT NULL,
    description TEXT,
    rules JSONB NOT NULL, -- Array of rule objects
    effect TEXT NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow', 'deny')),
    priority INTEGER DEFAULT 0, -- Higher priority = evaluated first
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rbac_policies_policy_id ON rbac_policies(policy_id);
CREATE INDEX IF NOT EXISTS idx_rbac_policies_active ON rbac_policies(is_active);
CREATE INDEX IF NOT EXISTS idx_rbac_policies_priority ON rbac_policies(priority DESC);

COMMENT ON TABLE rbac_policies IS 'Stores RBAC access control policies, replacing KV store usage (policy:* keys)';

