-- ============================================================================
-- 720: support_agents — drop invalid staff_id FK + clean non-staff references
-- ============================================================================
-- Problem: POST /support/settings/agents stores admin UUID in user_id AND
-- staff_id (VALUES ($1,$1,...)). If staff_id REFERENCES staff(id), insert fails:
--   support_agents_staff_id_fkey
-- Fix: staff_id must be NULL for admin-backed agents; only real staff rows use staff_id.
-- Idempotent: safe on dev and prod.
-- ============================================================================

ALTER TABLE public.support_agents
    DROP CONSTRAINT IF EXISTS support_agents_staff_id_fkey;

-- Remove staff_id values that are not real staff rows (e.g. duplicate of admin user_id)
UPDATE public.support_agents sa
SET
    staff_id = NULL,
    updated_at = COALESCE(sa.updated_at, NOW())
WHERE sa.staff_id IS NOT NULL
  AND NOT EXISTS (
        SELECT 1
        FROM public.staff st
        WHERE st.id = sa.staff_id
    );

COMMENT ON COLUMN public.support_agents.staff_id IS
    'References staff(id) when the agent is a staff member and user_id is NULL; NULL when the agent is an admin (user_id = admins.id).';
