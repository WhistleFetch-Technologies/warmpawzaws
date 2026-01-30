# Migration 253: Add staff_id Column to gps_tracking_sessions

## Overview

This migration adds the `staff_id` column to the `gps_tracking_sessions` table to support tracking sessions where a staff member (rather than a vendor) is performing the service.

## Files

- **Migration SQL**: `db/migrations/253_add_staff_id_to_gps_tracking.sql`
- **Node.js Script**: `scripts/apply-migration-253-staff-id-gps-tracking.js`
- **Bash Wrapper**: `scripts/apply-migration-253-staff-id-gps-tracking.sh`

## Prerequisites

1. Database connection credentials (via environment variables or AWS Secrets Manager)
2. Node.js installed
3. Required npm packages: `pg`, `@aws-sdk/client-secrets-manager`

## Usage

### Option 1: Using the Bash Script (Recommended)

```bash
# Set environment variables
export DB_HOST=your-database-host
export DB_NAME=your-database-name
export DB_SECRET_ARN=arn:aws:secretsmanager:region:account:secret:name

# Or use RDS_* variables
export RDS_HOSTNAME=your-database-host
export RDS_DB_NAME=your-database-name

# Run the migration
./scripts/apply-migration-253-staff-id-gps-tracking.sh
```

### Option 2: Using the Node.js Script Directly

```bash
# Set environment variables
export DB_HOST=your-database-host
export DB_NAME=your-database-name
export DB_SECRET_ARN=arn:aws:secretsmanager:region:account:secret:name

# Or provide credentials directly
export DB_USER=your-username
export DB_PASSWORD=your-password

# Run the script
node scripts/apply-migration-253-staff-id-gps-tracking.js
```

### Option 3: Using .env File

Create a `.env` file in the project root:

```env
DB_HOST=your-database-host
DB_NAME=your-database-name
DB_SECRET_ARN=arn:aws:secretsmanager:region:account:secret:name
AWS_REGION=ap-south-1
```

Then run:

```bash
./scripts/apply-migration-253-staff-id-gps-tracking.sh
```

## What the Migration Does

1. **Checks** if the `staff_id` column already exists in `gps_tracking_sessions`
2. **Adds** the `staff_id` column if it doesn't exist:
   - Type: `UUID`
   - References: `staff(id)`
   - Nullable: Yes (staff_id is optional)
3. **Creates** an index on `staff_id` for performance: `idx_gps_tracking_sessions_staff_id`
4. **Verifies** the migration was successful

## Safety Features

- ✅ **Idempotent**: Safe to run multiple times - won't create duplicate columns
- ✅ **Verification**: Checks current state before and after migration
- ✅ **Error Handling**: Provides clear error messages if something goes wrong
- ✅ **Transaction**: Wrapped in a transaction for safety

## Troubleshooting

### Error: "Missing required environment variables"

Make sure you've set:
- `DB_HOST` or `RDS_HOSTNAME`
- `DB_NAME` or `RDS_DB_NAME`
- `DB_SECRET_ARN` (or `DB_USER` and `DB_PASSWORD`)

### Error: "Failed to fetch credentials from Secrets Manager"

- Verify the `DB_SECRET_ARN` is correct
- Ensure your AWS credentials are configured (via `aws configure` or environment variables)
- Check that the secret exists and you have permission to access it

### Error: "Connection refused" or "Connection timeout"

- Verify the database host and port are correct
- Check that your IP is allowed in the RDS security group
- Ensure the database is accessible from your network

### Error: "relation 'staff' does not exist"

The migration references the `staff` table. If this table doesn't exist, you may need to create it first or adjust the foreign key constraint.

## Verification

After running the migration, you can verify it was successful by checking:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'gps_tracking_sessions'
AND column_name = 'staff_id';
```

You should see:
- `column_name`: `staff_id`
- `data_type`: `uuid`
- `is_nullable`: `YES`

## Rollback

If you need to rollback this migration:

```sql
BEGIN;

-- Remove the index first
DROP INDEX IF EXISTS idx_gps_tracking_sessions_staff_id;

-- Remove the column
ALTER TABLE gps_tracking_sessions DROP COLUMN IF EXISTS staff_id;

COMMIT;
```

**Note**: Only rollback if there are no active tracking sessions using `staff_id`, or if you're sure it's safe to remove.
