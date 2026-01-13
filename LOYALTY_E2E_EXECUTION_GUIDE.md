# Loyalty E2E Test - Execution Guide

**Date:** 2026-01-13  
**Status:** Ready for Execution

---

## ✅ **Prerequisites Complete**

- ✅ Database migration: `loyalty_action_rules` table created
- ✅ API endpoints: All working and verified
- ✅ Code fixes: Deployed to Lambda
- ✅ Test scripts: Created and ready

---

## 🚀 **Execution Options**

### Option 1: Automated Test Script (Recommended)

```bash
cd /Users/ketan/Documents/warmpawzecodev
API_BASE_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com" \
./scripts/test-loyalty-e2e-flow.sh
```

**What it tests:**
- Creates action rule
- Creates segment
- Links segment to rule
- Creates vendor
- Creates customer
- Creates product
- Creates order
- Verifies points awarded

**Output:** Log file in `test-results/loyalty-e2e-*.log`

---

### Option 2: Quick API Test

```bash
./scripts/quick-test-loyalty-api.sh
```

**What it tests:**
- GET action rules
- POST create rule
- GET segments

**Duration:** ~10 seconds

---

### Option 3: Manual UI Testing

**Step-by-step in UI:**

1. **Admin → Loyalty → Action Rules**
   - Create rule: `buy_product_test`
   - Points: 10 per ₹100
   - Link to segment (if created)

2. **Admin → Loyalty → Segments**
   - Create segment: `Test Customers`
   - Criteria: Empty (matches all)

3. **Admin → Vendors**
   - Create vendor: `Test Pet Store`

4. **Admin → Catalog**
   - Create product: `Test Pet Food` (₹500)

5. **Customer App → Shop**
   - Login as test customer
   - Purchase the product
   - Complete payment

6. **Customer App → Rewards**
   - Check points balance
   - Verify ~50 points awarded

---

## 🔍 **Verification Steps**

### 1. Check API Endpoints

```bash
# Get all rules
curl -X GET "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/admin/loyalty-action-rules"

# Get all segments
curl -X GET "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/admin/loyalty-segments"
```

### 2. Check Database

```bash
# Run migration verification
DB_HOST='warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com' \
DB_NAME='warmpawz' \
DB_USER='warmpawz_admin' \
DB_PASSWORD='Warmpawz2026' \
node scripts/run-loyalty-migration.js
```

### 3. Check Points After Transaction

```bash
# Query customer points (replace CUSTOMER_ID)
node -e "
const { Pool } = require('pg');
const pool = new Pool({
  host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
  database: 'warmpawz',
  user: 'warmpawz_admin',
  password: 'Warmpawz2026',
  port: 5432
});
(async () => {
  const points = await pool.query('SELECT * FROM customer_loyalty_points ORDER BY updated_at DESC LIMIT 5');
  const transactions = await pool.query('SELECT * FROM loyalty_transactions ORDER BY created_at DESC LIMIT 10');
  console.log('Recent Points:', JSON.stringify(points.rows, null, 2));
  console.log('Recent Transactions:', JSON.stringify(transactions.rows, null, 2));
  await pool.end();
})();
"
```

---

## 📋 **Expected Results**

### After Complete Test:

1. **Action Rule:**
   - ✅ Created with unique name
   - ✅ Visible in GET /admin/loyalty-action-rules
   - ✅ Can be linked to segments

2. **Segment:**
   - ✅ Created successfully
   - ✅ Visible in GET /admin/loyalty-segments
   - ✅ Shows in rule's "Used By" column

3. **Transaction:**
   - ✅ Order/booking created
   - ✅ Payment completed
   - ✅ Points awarded: ~50 points for ₹500 purchase

4. **Database:**
   - ✅ `customer_loyalty_points` updated
   - ✅ `loyalty_transactions` has new entry
   - ✅ Points balance increased

---

## 🐛 **Common Issues & Solutions**

### Issue: "Action name already exists"
**Solution:** Test script uses unique timestamp-based names

### Issue: Points not awarded
**Check:**
- Action rule exists and is active
- Action name matches (`buy_product` or `buy_first_product`)
- Order status is "completed"
- Customer ID is correct

### Issue: Segment not matching
**Check:**
- Segment criteria are correct
- Customer meets all criteria
- Segment is active
- Rule has segment_ids in conditions

---

## 📊 **Test Evidence**

After completing test, document:

1. **Screenshots:**
   - Admin UI: Action rules list
   - Admin UI: Segments list
   - Customer App: Points balance
   - Customer App: Transaction history

2. **API Responses:**
   - Rule creation response
   - Segment creation response
   - Points balance response

3. **Database Queries:**
   - Points table snapshot
   - Transactions table snapshot

---

## ✅ **Success Criteria**

Test is successful when:
- ✅ All API calls return 200/201
- ✅ Points awarded correctly (10 per ₹100)
- ✅ Points visible in database
- ✅ Points visible in customer app
- ✅ Transaction recorded

---

**Ready to execute!** Choose your preferred method above.
