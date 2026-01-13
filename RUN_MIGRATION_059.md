# Run Migration 059: Customer State Management

## Quick Start

### Option 1: Using Shell Script (Recommended)
```bash
./scripts/run-migration-059-customer-state.sh
```

### Option 2: Using Node.js Script
```bash
node scripts/run-migration-059-customer-state-node.js
```

### Option 3: Manual psql
```bash
# Set environment variables
export PGHOST=your-rds-endpoint
export PGDATABASE=warmpawz
export PGUSER=your-username
export PGPASSWORD=your-password

# Run migration
psql -f db/migrations/059_customer_state_management.sql
```

## Prerequisites

1. **AWS CLI configured** (for automatic credential retrieval)
2. **psql installed** (PostgreSQL client)
3. **Database access** (RDS security group allows your IP)
4. **Migration file exists**: `db/migrations/059_customer_state_management.sql`

## What the Migration Does

1. ✅ Adds `status` column to `customers` table
2. ✅ Adds `onboarding_status` column to `customers` table
3. ✅ Adds `profile_completed` and `profile_completed_at` columns
4. ✅ Creates `customer_identity` table
5. ✅ Creates `customer_profile_completion` table
6. ✅ Migrates existing customer data
7. ✅ Creates indexes for performance

## Verification

After running the migration, verify it worked:

```sql
-- Check columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'customers'
  AND column_name IN ('status', 'onboarding_status', 'profile_completed', 'customer_identity_id');

-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('customer_identity', 'customer_profile_completion');

-- Check sample data
SELECT 
  c.phone,
  c.status,
  c.onboarding_status,
  c.profile_completed,
  ci.current_step
FROM customers c
LEFT JOIN customer_identity ci ON c.customer_identity_id = ci.id
LIMIT 5;
```

## Troubleshooting

### Error: "relation already exists"
- **OK**: Migration uses `IF NOT EXISTS`, safe to re-run
- Some elements may already exist from previous runs

### Error: "permission denied"
- Check database user has CREATE TABLE permissions
- May need to run as superuser

### Error: "connection refused"
- Check RDS security group allows your IP
- Verify endpoint is correct
- Check if RDS is running

### Error: "password authentication failed"
- Verify credentials are correct
- Check if password was retrieved from Secrets Manager

## After Migration

1. ✅ **Deploy Backend**: Backend code is ready to use new state fields
2. ✅ **Test Authentication**: Verify new customers get proper state
3. ✅ **Verify State Transitions**: Test profile completion updates state

---

**Status**: Ready to run
**Migration File**: `db/migrations/059_customer_state_management.sql`
**Scripts**: 
- `scripts/run-migration-059-customer-state.sh`
- `scripts/run-migration-059-customer-state-node.js`
