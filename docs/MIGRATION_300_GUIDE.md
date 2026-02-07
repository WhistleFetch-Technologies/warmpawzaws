# Migration 300: Add customer_phone to bookings table

## Overview
This migration adds the `customer_phone` column to the `bookings` table to support faster queries and fix API errors.

## Prerequisites

1. **AWS CLI configured** with appropriate credentials
2. **Node.js** installed (v14+)
3. **Dependencies** installed in scripts folder:
   ```bash
   cd scripts
   npm install
   ```

4. **RDS Access** - Your IP must be allowed in the RDS security group

## Running the Migration

### Option 1: Using Node.js Script (Recommended for RDS Serverless)

```bash
# From project root
node scripts/run-migration-300-customer-phone.js [environment] [region]

# Examples:
node scripts/run-migration-300-customer-phone.js dev ap-south-1
node scripts/run-migration-300-customer-phone.js staging ap-south-1
node scripts/run-migration-300-customer-phone.js prod ap-south-1
```

### Option 2: Using psql (Direct Connection)

```bash
# Set environment variables
export PGPASSWORD="your-password"

# Run migration
psql -h <rds-endpoint> -p 5432 -U <username> -d warmpawz -f db/migrations/300_add_customer_phone_to_bookings.sql
```

### Option 3: Using AWS RDS Query Editor

1. Go to AWS RDS Console → Query Editor
2. Connect to your database
3. Copy and paste the contents of `db/migrations/300_add_customer_phone_to_bookings.sql`
4. Execute the query

## What the Migration Does

1. **Adds Column**: `customer_phone VARCHAR(20)` to `bookings` table
2. **Populates Data**: Updates existing bookings with customer phone numbers
3. **Creates Indexes**: 
   - `idx_bookings_customer_phone` - For phone lookups
   - `idx_bookings_customer_phone_status` - Composite index for common queries
4. **Creates Triggers**:
   - Auto-sync `customer_phone` when booking is created/updated
   - Auto-update bookings when customer phone changes
5. **Verification**: Includes queries to verify the migration

## Verification

After running the migration, the script will automatically verify:

- ✅ Column exists with correct data type
- ✅ Data population statistics
- ✅ Indexes created
- ✅ Triggers created
- ✅ No sync issues

You can also manually verify:

```sql
-- Check column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'bookings' AND column_name = 'customer_phone';

-- Check data population
SELECT 
    COUNT(*) as total,
    COUNT(customer_phone) as with_phone,
    ROUND(100.0 * COUNT(customer_phone) / COUNT(*), 2) as percentage
FROM bookings;

-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE tablename = 'bookings' AND indexname LIKE '%customer_phone%';
```

## Rollback (If Needed)

If you need to rollback the migration:

```sql
ALTER TABLE bookings DROP COLUMN IF EXISTS customer_phone;
DROP TRIGGER IF EXISTS trigger_sync_booking_customer_phone_insert ON bookings;
DROP TRIGGER IF EXISTS trigger_sync_booking_customer_phone_update ON bookings;
DROP TRIGGER IF EXISTS trigger_update_bookings_customer_phone ON customers;
DROP FUNCTION IF EXISTS sync_booking_customer_phone();
DROP FUNCTION IF EXISTS update_bookings_customer_phone();
DROP INDEX IF EXISTS idx_bookings_customer_phone;
DROP INDEX IF EXISTS idx_bookings_customer_phone_status;
```

## Troubleshooting

### Error: RDS endpoint not found
- Check if the cluster/instance name matches: `warmpawz-{environment}-cluster`
- Verify AWS credentials are configured
- Check if you're using the correct region

### Error: Secret not found
- Verify the secret exists in Secrets Manager
- Check the secret naming pattern: `warmpawz-{environment}-rds-master*`
- Ensure you have permissions to read secrets

### Error: Connection timeout
- Check if RDS security group allows your IP
- Verify the endpoint is correct
- Check if RDS is running (not paused for serverless)

### Error: Column already exists
- This is safe to ignore - the migration uses `IF NOT EXISTS`
- The migration is idempotent and can be run multiple times

## Post-Migration Steps

1. **Deploy Backend Code**: The code changes are backward compatible
2. **Run Verification**: `./scripts/verify-api-fixes.sh [API_BASE_URL]`
3. **Monitor**: Check CloudWatch for any errors
4. **Test Endpoints**:
   - `GET /reminders/upcoming?serviceStyle=tele`
   - `GET /customer/bookings/active?phone=...`
   - `GET /customer/by-phone?phone=...`

## Support

For issues or questions:
1. Check the error message in the script output
2. Review CloudWatch logs
3. Verify database connectivity
4. Contact backend team if needed
