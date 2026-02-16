# Service Catalog DEV vs PROD Comparison

## Overview

This script safely compares service catalog data between DEV and PROD environments and generates a SQL migration script for missing records.

## Features

- ✅ Fetches data from both DEV and PROD APIs
- ✅ Normalizes and compares records
- ✅ Detects missing records in PROD
- ✅ Generates safe SQL migration script
- ✅ Uses transactions and ON CONFLICT to avoid duplicates
- ✅ Preserves IDs exactly as in DEV
- ✅ **NEVER auto-executes** - only generates script for review

## Usage

### Step 1: Get Authentication Token

You need an admin authentication token. You can get this by:
1. Logging into the admin web interface
2. Opening browser DevTools → Application → Local Storage
3. Copy the `adminAuthToken` value

### Step 2: Run the Comparison Script

```bash
# Option 1: Pass token as argument
node scripts/compare-service-catalog-dev-prod.js "your-token-here"

# Option 2: Use environment variable
export AUTH_TOKEN="your-token-here"
node scripts/compare-service-catalog-dev-prod.js

# Option 3: Windows PowerShell
$env:AUTH_TOKEN="your-token-here"
node scripts/compare-service-catalog-dev-prod.js
```

## Output

The script will:

1. **Fetch Data**: Downloads service catalog from both environments
2. **Compare**: Identifies missing records in PROD
3. **Validate**: Checks for schema compatibility
4. **Generate SQL**: Creates a migration script in `db/migrations/sync_service_catalog_<timestamp>.sql`

## SQL Script Format

The generated SQL script follows this pattern:

```sql
BEGIN;

INSERT INTO service_catalog (id, service_id, service_name, ...)
VALUES ('uuid', 'service-id', 'Service Name', ...)
ON CONFLICT (id) DO NOTHING;

COMMIT;
```

## Safety Features

- ✅ Uses `ON CONFLICT DO NOTHING` to prevent duplicates
- ✅ Wrapped in transaction for atomicity
- ✅ Only inserts missing records (no updates, no deletes)
- ✅ Preserves exact IDs from DEV
- ✅ Requires manual review before execution

## Review Before Execution

**IMPORTANT**: Before running the generated SQL script:

1. ✅ Review each INSERT statement
2. ✅ Verify foreign key dependencies exist in PROD
3. ✅ Check for any data conflicts
4. ✅ Test on staging if possible
5. ✅ Backup PROD database

## Execution

After review, execute manually:

```bash
node scripts/run-migration-rds-node.js sync_service_catalog_<timestamp>.sql
```

## What the Script Does NOT Do

- ❌ Does NOT auto-execute SQL
- ❌ Does NOT modify existing PROD records
- ❌ Does NOT delete any records
- ❌ Does NOT update mismatched records (only detects them)
- ❌ Does NOT connect to database directly

## Troubleshooting

### Authentication Error

If you get `401` or `403` errors:
- Make sure your token is valid
- Token should be a JWT token (starts with `eyJ...`)
- Token should not be expired

### No Missing Records

If the script reports "No missing records":
- PROD is up to date
- No migration script will be generated
- Check mismatched records section for differences

### Mismatched Records

If records have same ID but different data:
- These are NOT automatically updated
- Manual review required if updates are needed
- The script only handles FULLY MISSING records
