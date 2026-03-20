# Database Migrations & Scripts

This directory contains all database migration scripts and utilities for the Warmpawz platform.

**AWS RDS (production/staging):** Use **Node scripts in `scripts/`** to run migrations against RDS (Secrets Manager, SSL). See **`docs/IMPLEMENTATION_FLOW.md`**. Example:

```bash
ENVIRONMENT=dev node scripts/run-migration-rds-node.js 524_service_catalog_specialization_ids.sql
```

## Setup

Install dependencies:
```bash
npm install
```

## Available Scripts

### `npm run migrate:up`
Runs all SQL migration files in numerical order. This is idempotent and safe to run multiple times.

```bash
# Set database URL
export DATABASE_URL="postgresql://user:password@host:port/database"
# or

# Run migrations
npm run migrate:up
```

### `npm run migrate:delete-inactive-roles`
Permanently deletes inactive roles from the database (keeps only the 25 canonical active roles). Run after `250_role_cleanup_canonical_24.sql` has been applied.

**Option A – AWS RDS (recommended; uses tested script in `scripts/`):**
```bash
ENVIRONMENT=dev ./scripts/run-migration-251-delete-inactive-roles.sh
# or
ENVIRONMENT=dev node scripts/run-migration-rds-node.js 251_permanent_delete_inactive_roles.sql
```

**Option B – Direct DATABASE_URL:**
```bash
export DATABASE_URL="postgresql://user:password@host:port/database"
cd db && npm run migrate:delete-inactive-roles
```

### `npm run migrate:status`
Checks the current state of the database schema, including:
- Number of tables
- Key tables present
- Foreign keys count
- Indexes count

```bash
npm run migrate:status
```

### `npm run seed:dev`
Seeds the database with development data including:
- RBAC roles
- Service catalog
- Test data (if available)

```bash
npm run seed:dev
```

### `npm run seed:prod`
Seeds the database with production-safe base data only:
- RBAC roles (essential)
- Service catalog (essential)

⚠️ **Production Mode**: Only essential configuration data is seeded, no test data.

```bash
npm run seed:prod
```

## Environment Variables

The scripts require one of the following environment variables:

- `DATABASE_URL` - Standard PostgreSQL connection string

Example:
```bash
export DATABASE_URL="postgresql://postgres:password@localhost:5432/warmpawz"
```

## Migration Files

All migration files are located in the `migrations/` directory and are numbered sequentially:

- `001_initial_schema.sql` - Base tables
- `002_foreign_keys.sql` - Foreign key constraints
- `003_indexes.sql` - Performance indexes
- ... and so on

### Migration Ordering

Migrations are executed in numerical order based on their filename prefix (e.g., `001_`, `002_`, etc.).

### Idempotency

All migrations use idempotent SQL patterns:
- `CREATE TABLE IF NOT EXISTS`
- `CREATE INDEX IF NOT EXISTS`
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (when supported)
- DO blocks for conditional constraint creation

This makes it safe to run migrations multiple times without errors.

## CI/CD Integration

These scripts are integrated with GitHub Actions workflows:

### Development Workflow (`.github/workflows/dev.yml`)
```yaml
- name: Run migrations
  working-directory: db
  run: |
    npm ci
    npm run migrate:up
  env:
    ENVIRONMENT: dev

- name: Verify migrations
  working-directory: db
  run: npm run migrate:status
```

### Seed Data
```yaml
- name: Seed database
  working-directory: db
  run: |
    npm ci
    npm run seed:dev  # or seed:prod for production
  env:
    ENVIRONMENT: dev
```

## Manual Migration Execution

If you need to run a specific migration file manually:

```bash
node run-migration.js db/migrations/047_seed_roles.sql
```

## Troubleshooting

### "Missing script: migrate:up" Error
Make sure you're running the command from the `db` directory or specify the working directory:

```bash
cd db
npm ci
npm run migrate:up
```

### Database Connection Issues
Verify your database URL is correct and the database is accessible:

```bash
# Test connection (requires psql)
psql "$DATABASE_URL" -c "SELECT version();"
```

### Migration Already Applied
If you see "already exists" or "duplicate key" errors, this is normal for idempotent migrations. The script will skip these and continue.


## Architecture

- **run-migration-all.js** - Main migration runner, executes all migrations in order
- **check-migration-status.js** - Verifies database schema state
- **seed-dev-data.js** - Development data seeding
- **seed-prod-data.js** - Production-safe data seeding
- **run-migration.js** - Legacy single migration runner (for manual use)

## Safety Features

1. **Non-destructive**: Migrations are additive only, no DROP statements
2. **Idempotent**: Safe to run multiple times
3. **Error handling**: Continues with remaining migrations even if one fails
4. **Connection pooling**: Proper cleanup of database connections

## Database Schema

See `schema.sql` for the complete database schema documentation.

See `migrations/README.md` for detailed migration documentation.

