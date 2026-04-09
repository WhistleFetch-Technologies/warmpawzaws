-- ============================================================================
-- SUPPORT TICKETS: attachments column (customer live chat / CRM)
-- ============================================================================
-- SCOPE (minimal / safe):
--   - Touches ONLY table public.support_tickets (adds one column).
--   - Does NOT alter other tables, indexes, triggers, or RLS.
--   - Idempotent: ADD COLUMN IF NOT EXISTS; existing rows get default '[]'::jsonb.
--
-- If this migration is NOT applied, POST /support/tickets can fail with:
--   column "attachments" of relation "support_tickets" does not exist
-- when any code path INSERTs a top-level `attachments` column.
--
-- Apply on RDS (Data API enabled), pick one:
--   PowerShell (AWS CLI only):  cd scripts; .\run-migration-617-aws-cli.ps1 -Environment dev
--   Node:  cd scripts; npm install; $env:ENVIRONMENT="dev"; npm run migrate:617
-- Or run this file with psql / RDS Query Editor against the cluster.
--
-- Note: Lambda insert() also merges top-level attachments into metadata.attachments
-- so tickets work without this column; the column is still recommended for clarity/indexing.
-- Date: 2026-03-20
-- ============================================================================

ALTER TABLE support_tickets
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN support_tickets.attachments IS 'Optional attachment URLs or metadata (JSON array)';
