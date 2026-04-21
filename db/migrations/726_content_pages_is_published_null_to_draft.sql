-- ============================================================================
-- MIGRATION 726: content_pages — NULL is_published → draft (false)
-- ============================================================================
-- Purpose: Align legacy rows with customer API `WHERE is_published = true`.
-- Admin list uses the same semantics after backend fix (rowIsPublished).
-- Idempotent: rows already false/true are unchanged; only NULL becomes false.
-- Date: 2026-04-21
-- ============================================================================

UPDATE content_pages SET is_published = false WHERE is_published IS NULL;
