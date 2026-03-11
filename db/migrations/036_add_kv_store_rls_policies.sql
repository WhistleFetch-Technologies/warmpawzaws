-- ============================================================================
-- Migration: Add RLS Policies for kv_store_3dd53475 Table
-- ============================================================================
-- Purpose: Address Supabase security advisor warning by creating RLS policies
--          for the kv_store_3dd53475 table which has RLS enabled but no policies
--
-- Note: This table is a key-value store used by Edge Functions via service_role.
--       Policies are created to allow service_role full access and restricted
--       access for authenticated users.
-- ============================================================================

BEGIN;

-- ============================================================================
-- Create RLS Policies for kv_store_3dd53475
-- ============================================================================

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS service_role_all_access ON public.kv_store_3dd53475;
DROP POLICY IF EXISTS authenticated_read_public_data ON public.kv_store_3dd53475;

-- Policy for service_role (used by Edge Functions)
-- This allows full access to all operations (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY service_role_all_access ON public.kv_store_3dd53475
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy for authenticated users
-- This allows read-only access to public/admin settings only
-- Customer-specific data should be accessed through proper normalized tables, not the KV store
-- The KV store is primarily for backend/Edge Function use via service_role
CREATE POLICY authenticated_read_public_data ON public.kv_store_3dd53475
    FOR SELECT
    TO authenticated
    USING (
        -- Allow read access to public/admin/platform settings only
        key LIKE 'admin:%'
        OR
        key LIKE 'platform:%'
        OR
        key LIKE 'role:%'
        OR
        key LIKE 'service:%'
    );

-- Note: If you need authenticated users to write to this table, you would need to add
-- additional policies for INSERT, UPDATE, and DELETE operations with appropriate
-- restrictions. Currently, only service_role can write to this table.

COMMIT;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- RLS policies have been created for kv_store_3dd53475:
--   - service_role: Full access (SELECT, INSERT, UPDATE, DELETE)
--   - authenticated: Read-only access to public/admin/platform settings
--   Note: Customer-specific data should be accessed through normalized tables
-- ============================================================================

