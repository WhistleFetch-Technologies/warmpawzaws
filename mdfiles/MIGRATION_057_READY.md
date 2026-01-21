# Migration 057: Vendor Capabilities Tables - Ready to Run

## Date: 2026-01-12

## ✅ Migration Created

**File**: `db/migrations/057_vendor_capabilities_tables.sql`

## 📋 What This Migration Does

Creates **13 missing database tables** and adds **4 missing columns** needed for 38 failing vendor capability endpoints.

### Tables Created:
1. ✅ `prescriptions` - For prescriptions endpoint
2. ✅ `medical_records` - For medical records endpoint  
3. ✅ `diagnostic_tests` - For diagnostics endpoint
4. ✅ `service_packages` - For packages endpoint
5. ✅ `package_sessions` - For training progress endpoint
6. ✅ `gps_tracking_sessions` - For GPS tracking endpoints
7. ✅ `vendor_availability_v2` - For schedule endpoint
8. ✅ `vendor_settlements` - For settlements endpoint
9. ✅ `ambulance_vehicles` - For ambulance endpoints
10. ✅ `meal_plans` - For nutrition endpoints
11. ✅ `holiday_packages` - For holiday endpoints
12. ✅ `video_call_sessions` - For video call endpoint
13. ✅ `reviews` - For reviews endpoint

### Schema Updates:
- ✅ Add `commission_amount` to `payments` table
- ✅ Add `total_amount` to `payments` table
- ✅ Add `category` to `products` table
- ✅ Add `available_date` to `staff_availability` table

## 🔍 Conflict Check

The migration uses:
- ✅ `CREATE TABLE IF NOT EXISTS` - Safe to run multiple times
- ✅ `DO $$ BEGIN ... END $$` blocks for column additions - Checks existence before adding
- ✅ All operations are idempotent

**Note**: Some tables may already exist from previous migrations (034, 032, 012, etc.). The migration will skip creating existing tables.

## 🚀 How to Run

### Option 1: Using Node.js Script (Recommended)

```bash
cd /Users/ketan/Documents/warmpawzecodev
node scripts/check-and-run-migration-057.js
```

This script will:
1. ✅ Retrieve RDS credentials from AWS Secrets Manager
2. ✅ Check existing tables
3. ✅ Show warnings for existing tables
4. ✅ Ask for confirmation
5. ✅ Run the migration
6. ✅ Verify tables created

### Option 2: Using Bash Script

```bash
cd /Users/ketan/Documents/warmpawzecodev
./scripts/run-migration-057.sh
```

**Note**: Requires `psql` to be installed.

### Option 3: Manual (Using psql)

```bash
# Get credentials
RDS_SECRET_ARN="warmpawz-dev-rds-master-20260106164510791100000002"
DB_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "$RDS_SECRET_ARN" \
  --region ap-south-1 \
  --query SecretString \
  --output text)

DB_USER=$(echo "$DB_SECRET" | jq -r '.username')
DB_PASS=$(echo "$DB_SECRET" | jq -r '.password')

# Run migration
export PGPASSWORD="$DB_PASS"
psql -h warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com \
     -U "$DB_USER" \
     -d warmpawz \
     -f db/migrations/057_vendor_capabilities_tables.sql
```

## ✅ Verification

After running the migration, verify tables:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'prescriptions', 'medical_records', 'diagnostic_tests',
  'service_packages', 'package_sessions', 'gps_tracking_sessions',
  'vendor_availability_v2', 'vendor_settlements', 'ambulance_vehicles',
  'meal_plans', 'holiday_packages', 'video_call_sessions', 'reviews'
)
ORDER BY table_name;
```

## 📊 Expected Results

**Before Migration**:
- 38 endpoints failing (HTTP 500 - table/column missing)

**After Migration**:
- All 13 tables created
- All 4 columns added
- 38 endpoints should return HTTP 200 or 404 (not 500)

## 🧪 Next Steps

After migration:
1. ✅ Re-run endpoint tests: `./test-vendor-capabilities-curl-verified.sh`
2. ✅ Verify all 73 endpoints working
3. ✅ Check for any remaining schema issues

## 📝 Files Created

1. ✅ `db/migrations/057_vendor_capabilities_tables.sql` - Migration SQL
2. ✅ `scripts/check-and-run-migration-057.js` - Node.js migration runner
3. ✅ `scripts/run-migration-057.sh` - Bash migration runner

---

**Status**: ✅ **READY TO RUN**
