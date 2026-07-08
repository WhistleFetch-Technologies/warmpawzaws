-- Lean Asset Pipeline: content-hash dedup index and legacy migration log.
-- Apply: ENVIRONMENT=dev node scripts/run-migration-rds-node.js 1061_image_content_index.sql

CREATE TABLE IF NOT EXISTS image_content_index (
  content_sha256 CHAR(64) PRIMARY KEY,
  webp_key       TEXT NOT NULL,
  thumb_key      TEXT,
  byte_size      INT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_image_content_index_webp_key
  ON image_content_index (webp_key);

CREATE TABLE IF NOT EXISTS image_migration_log (
  legacy_key  TEXT PRIMARY KEY,
  webp_key    TEXT NOT NULL,
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_image_migration_log_webp_key
  ON image_migration_log (webp_key);
