-- Migration 1058: Add return_policy_text to vendors
-- Allows vendors to set a free-text return policy description
-- (return_window_days already exists from Phase 8 migrations)

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS return_policy_text TEXT;
