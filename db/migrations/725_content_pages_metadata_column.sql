-- ============================================================================
-- Migration 725: Add metadata JSONB to content_pages
-- Date: 2026-04-20
-- Purpose: Align Postgres schema with Lambda customer/admin routes that SELECT
--          content_pages.metadata and use (metadata->>'featured') for ordering
--          and filters. Without this column, GET /customer/articles can fail and
--          (previously) surfaced as an empty list.
-- ============================================================================
-- Run against DEV/UAT/PROD RDS after deploy. Idempotent: skips if column exists.
-- Default '{}' keeps NOT NULL safe for existing rows.
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'content_pages'
          AND column_name = 'metadata'
    ) THEN
        ALTER TABLE content_pages
            ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
        COMMENT ON COLUMN content_pages.metadata IS
            'JSON metadata for CMS pages (e.g. read_time, featured, seo fields). Customer /customer/articles uses featured ordering.';
    END IF;
END $$;
