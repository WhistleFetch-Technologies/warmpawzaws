# Database Migrations

## Overview

This directory contains idempotent SQL migration scripts for migrating from KV-store to normalized SQL architecture.

## Migration Files

### 001_initial_schema.sql
- Creates all base tables
- Uses `CREATE TABLE IF NOT EXISTS` for idempotency
- No foreign keys (added in migration 002)
- No indexes (added in migration 003)

### 002_foreign_keys.sql
- Adds all foreign key constraints
- Uses DO blocks to check constraint existence before adding
- Ensures referential integrity

### 003_indexes.sql
- Creates all performance indexes
- Uses `CREATE INDEX IF NOT EXISTS`
- Includes composite and partial indexes

## Running Migrations

### Option 1: Using Supabase CLI

```bash
# Run all migrations
supabase db reset

# Or run individually
psql $DATABASE_URL -f db/migrations/001_initial_schema.sql
psql $DATABASE_URL -f db/migrations/002_foreign_keys.sql
psql $DATABASE_URL -f db/migrations/003_indexes.sql
```

### Option 2: Using psql directly

```bash
# Connect to database
psql -h <host> -U <user> -d <database>

# Run migrations in order
\i db/migrations/001_initial_schema.sql
\i db/migrations/002_foreign_keys.sql
\i db/migrations/003_indexes.sql
```

### Option 3: Using Supabase Dashboard

1. Go to SQL Editor in Supabase Dashboard
2. Copy and paste each migration file content
3. Run in order: 001, 002, 003

## Migration Safety

All migrations are:
- ✅ **Idempotent** - Safe to run multiple times
- ✅ **Non-destructive** - No DROP statements
- ✅ **Preserves KV data** - Original `kv_store_3dd53475` table remains untouched

## Verification

After running migrations, verify:

```sql
-- Check table count
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name NOT LIKE 'kv_%';

-- Check foreign keys
SELECT COUNT(*) FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY';

-- Check indexes
SELECT COUNT(*) FROM pg_indexes 
WHERE schemaname = 'public';
```

## Next Steps

After migrations:
1. Run data migration script (to be created in Phase 4)
2. Update application code to use SQL repositories
3. Verify data integrity
4. Monitor performance

## Rollback

These migrations are additive only. To rollback:
1. Drop foreign keys: `ALTER TABLE <table> DROP CONSTRAINT <constraint>;`
2. Drop indexes: `DROP INDEX IF EXISTS <index>;`
3. Drop tables: `DROP TABLE IF EXISTS <table>;`

**Note:** Rollback will lose all migrated data. Ensure backups before rolling back.

