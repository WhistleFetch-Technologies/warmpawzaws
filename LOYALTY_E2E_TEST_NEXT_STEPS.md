# Loyalty E2E Test - Next Steps to Complete Testing

**Date:** 2026-01-13  
**Status:** 🔄 Ready for Database Migration

---

## ✅ Completed

### 1. Code Fixes
- ✅ Fixed query parameter parsing in loyalty action rules endpoint
- ✅ Fixed headers parsing in createApiGatewayEvent
- ✅ Fixed same issues in loyalty segments endpoint
- ✅ All fixes compiled and verified

### 2. Lambda Deployment
- ✅ Lambda function `warmpawz-dev-api-handler` updated
- ✅ Deployment confirmed successful
- ✅ Function is live with fixes

### 3. Test Infrastructure
- ✅ E2E test script created: `scripts/test-loyalty-e2e-flow.sh`
- ✅ Table verification script: `scripts/verify-loyalty-tables.sh`
- ✅ Migration runner script: `scripts/run-loyalty-migration-via-api.sh`
- ✅ Comprehensive logging and error reporting

---

## 🔍 Current Issue

**Symptom:** API returns `{"error":"Failed to fetch loyalty action rules"}`

**Root Cause:** The `loyalty_action_rules` table likely doesn't exist in the database.

**Evidence:**
- API endpoint is working (no more "Cannot read properties" error)
- Lambda function is deployed and responding
- Error suggests database query failure (table missing or connection issue)

---

## 📋 Next Steps to Complete Testing

### Step 1: Get Database Credentials

```bash
# Get database connection details from AWS SSM
aws ssm get-parameters \
  --names \
    /warmpawz/dev/db/host \
    /warmpawz/dev/db/name \
    /warmpawz/dev/db/user \
    /warmpawz/dev/db/password \
  --with-decryption \
  --region ap-south-1 \
  --query 'Parameters[*].[Name,Value]' \
  --output table
```

**Expected Output:**
```
Name                              Value
--------------------------------  -------------------------
/warmpawz/dev/db/host             <rds-endpoint>
/warmpawz/dev/db/name             <database-name>
/warmpawz/dev/db/user             <username>
/warmpawz/dev/db/password         <password>
```

---

### Step 2: Verify Database Connection

```bash
# Test connection (replace with actual values from Step 1)
psql -h <DB_HOST> -U <DB_USER> -d <DB_NAME> -c "SELECT version();"
```

**Expected:** PostgreSQL version information

---

### Step 3: Check if Table Exists

```bash
# Connect to database and check
psql -h <DB_HOST> -U <DB_USER> -d <DB_NAME> -c "
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'loyalty_action_rules'
);
"
```

**Expected Output:**
- `t` (true) = Table exists ✅
- `f` (false) = Table doesn't exist ❌

---

### Step 4: Run Migration (If Table Doesn't Exist)

```bash
# Run the migration SQL file
psql -h <DB_HOST> -U <DB_USER> -d <DB_NAME> \
  -f db/migrations/043_loyalty_action_rules_table.sql
```

**Migration File:** `db/migrations/043_loyalty_action_rules_table.sql`

**What it does:**
- Creates `loyalty_action_rules` table
- Creates indexes for performance
- Inserts default action rules (signup, buy_product, etc.)
- Updates `loyalty_rules` table with auto-conversion fields

**Expected Output:**
```
CREATE TABLE
CREATE INDEX
CREATE INDEX
...
INSERT 0 15  (or similar)
ALTER TABLE
ALTER TABLE
```

---

### Step 5: Verify Migration Success

```bash
# Check table exists and has data
psql -h <DB_HOST> -U <DB_USER> -d <DB_NAME> -c "
SELECT COUNT(*) as rule_count 
FROM loyalty_action_rules;
"
```

**Expected:** Should return a count > 0 (default rules inserted)

---

### Step 6: Verify API Endpoint

```bash
# Test the API endpoint
curl -X GET "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/admin/loyalty-action-rules" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "rules": [
    {
      "id": "...",
      "action_name": "signup",
      "action_category": "loyalty",
      ...
    },
    ...
  ]
}
```

---

### Step 7: Run Complete E2E Test

```bash
# Run the full E2E test
API_BASE_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com" \
./scripts/test-loyalty-e2e-flow.sh
```

**What it tests:**
1. ✅ Create loyalty action rule
2. ✅ Create loyalty segment
3. ✅ Link segment to rule
4. ✅ Create vendor
5. ✅ Create customer
6. ✅ Create product
7. ✅ Create order (₹500 purchase)
8. ✅ Verify points awarded (~50 points expected)

**Expected Output:**
```
✓ SUCCESS: Points were awarded correctly!
  Expected: ~50 points, Got: 50 points
```

---

## 🔧 Alternative: Create Table via API (If Migration Endpoint Exists)

If there's a migration endpoint available:

```bash
# Try migration via API
curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/admin/migrations/run" \
  -H "Content-Type: application/json" \
  -d '{"migration": "043_loyalty_action_rules_table"}'
```

**Note:** This endpoint may not exist. Use direct database migration (Step 4) if this fails.

---

## 📊 Test Scripts Available

### 1. Table Verification
```bash
./scripts/verify-loyalty-tables.sh
```
Checks if table exists via API

### 2. Migration Runner
```bash
./scripts/run-loyalty-migration-via-api.sh
```
Attempts to run migration via API (may not work)

### 3. Complete E2E Test
```bash
API_BASE_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com" \
./scripts/test-loyalty-e2e-flow.sh
```
Runs complete user journey test

---

## 🐛 Troubleshooting

### Issue: "Failed to fetch loyalty action rules"
**Solution:** Run migration (Step 4)

### Issue: "Connection refused" or "timeout"
**Solution:** 
- Check RDS security group allows Lambda access
- Verify DB_HOST is correct
- Check VPC configuration

### Issue: "Permission denied"
**Solution:**
- Verify DB_USER has CREATE TABLE permission
- Check database user role

### Issue: "Table already exists"
**Solution:** 
- Migration uses `CREATE TABLE IF NOT EXISTS`, so this is safe
- Check if table has data: `SELECT COUNT(*) FROM loyalty_action_rules;`

---

## ✅ Success Criteria

After completing the steps above, you should see:

1. ✅ `loyalty_action_rules` table exists in database
2. ✅ API endpoint returns list of rules (not error)
3. ✅ E2E test completes successfully
4. ✅ Points are awarded correctly for test transaction
5. ✅ Points visible in `customer_loyalty_points` table
6. ✅ Transaction recorded in `loyalty_transactions` table

---

## 📝 Quick Reference

**Migration File:** `db/migrations/043_loyalty_action_rules_table.sql`  
**API Endpoint:** `GET /admin/loyalty-action-rules`  
**Test Script:** `scripts/test-loyalty-e2e-flow.sh`  
**Lambda Function:** `warmpawz-dev-api-handler`  
**Region:** `ap-south-1`

---

**Last Updated:** 2026-01-13 14:00 IST  
**Status:** Ready for database migration to complete testing
