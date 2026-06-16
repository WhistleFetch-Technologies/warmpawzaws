-- ============================================================================
-- Migration 1037: Remove legacy admin.dashboard permission from roles
-- ============================================================================
-- admin.dashboard had no dedicated page (sidebar item redirected to /).
-- Module access is gated by specific permissions (admin.analytics, admin.customers, etc.).
-- Idempotent: safe to run multiple times.
-- ============================================================================

DELETE FROM role_permissions
WHERE permission_name = 'admin.dashboard';
