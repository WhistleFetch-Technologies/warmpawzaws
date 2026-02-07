# Migration 300 - Quick Start Guide

## 🚀 Quick Start

Run the migration with a single command:

```bash
node scripts/run-migration-300-customer-phone.js dev ap-south-1
```

Replace `dev` with your environment (`dev`, `staging`, or `prod`) and `ap-south-1` with your AWS region.

## What It Does

This migration fixes the API error: `column b.customer_phone does not exist` by:

1. ✅ Adding `customer_phone` column to `bookings` table
2. ✅ Populating existing bookings with customer phone numbers
3. ✅ Creating performance indexes
4. ✅ Setting up auto-sync triggers

## Prerequisites

- ✅ AWS CLI configured
- ✅ Node.js installed
- ✅ Dependencies installed (already done - `pg` and `@aws-sdk/client-secrets-manager`)

## Full Command Reference

```bash
# Development
node scripts/run-migration-300-customer-phone.js dev ap-south-1

# Staging
node scripts/run-migration-300-customer-phone.js staging ap-south-1

# Production
node scripts/run-migration-300-customer-phone.js prod ap-south-1
```

## Expected Output

```
🚀 Migration 300: Add customer_phone to bookings table
============================================================
Environment: dev
Region: ap-south-1

📊 Getting RDS cluster/instance information...
✅ RDS Endpoint: warmpawz-dev-cluster.xxxxx.ap-south-1.rds.amazonaws.com
✅ Port: 5432
✅ Database: warmpawz

🔐 Getting database credentials from Secrets Manager...
✅ Username: warmpawz_admin
✅ Password: [retrieved]

📄 Migration file: db/migrations/300_add_customer_phone_to_bookings.sql

🔌 Connecting to database...
✅ Connection successful

🚀 Executing migration...
─────────────────────────
✅ Migration executed successfully

🔍 Verifying migration...
✅ Column customer_phone exists:
   - Type: character varying
   - Nullable: YES
   - Default: NULL

📊 Data Population Statistics:
   - Total bookings: 1234
   - With phone: 1234
   - Without phone: 0
   - Population rate: 100.00%

✅ Indexes created:
   - idx_bookings_customer_phone
   - idx_bookings_customer_phone_status

✅ Triggers created:
   - trigger_sync_booking_customer_phone_insert (BEFORE INSERT)
   - trigger_sync_booking_customer_phone_update (BEFORE UPDATE)
   - trigger_update_bookings_customer_phone (AFTER UPDATE)

✅ No phone mismatches detected

🎉 Migration 300 completed successfully!

📝 Next Steps:
   1. Deploy the updated backend code
   2. Run verification script: ./scripts/verify-api-fixes.sh
   3. Monitor error rates in CloudWatch
```

## Troubleshooting

### "RDS endpoint not found"
- Check cluster name: `warmpawz-{environment}-cluster`
- Verify AWS credentials: `aws sts get-caller-identity`

### "Connection timeout"
- Add your IP to RDS security group
- Check if RDS is running (not paused)

### "Secret not found"
- Verify secret exists: `aws secretsmanager list-secrets --region ap-south-1`
- Check naming pattern: `warmpawz-{environment}-rds-master*`

## After Migration

1. **Deploy backend code** (already done - code is backward compatible)
2. **Verify endpoints**:
   ```bash
   ./scripts/verify-api-fixes.sh http://localhost:3000
   ```
3. **Monitor** CloudWatch for errors

## Need Help?

See full documentation: `docs/MIGRATION_300_GUIDE.md`
