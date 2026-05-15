-- ============================================================================
-- Migration 725: Add metadata JSONB to content_pages
-- ============================================================================
-- Purpose: Customer GET /customer/articles SELECTs metadata and uses
--          (metadata->>'featured') in ORDER BY. Without this column the query
--          fails and the API returns an empty list with degraded: true.
-- Date: 2026-04-20 (revised 2026-04-21: single statement for RDS Data API)
-- Idempotent: ADD COLUMN IF NOT EXISTS
-- ============================================================================

ALTER TABLE content_pages
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN content_pages.metadata IS
  'JSON metadata for CMS pages (e.g. read_time, featured, seo). Customer /customer/articles uses featured ordering.';
