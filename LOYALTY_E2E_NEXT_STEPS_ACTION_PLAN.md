# Loyalty E2E Test - Next Steps Action Plan

**Date:** 2026-01-13  
**Status:** ✅ Infrastructure Ready, ⏳ Complete E2E Testing

---

## 🎯 **Immediate Next Steps**

### Step 1: Complete E2E Test Execution

**Option A: Run Automated Test Script**
```bash
cd /Users/ketan/Documents/warmpawzecodev
API_BASE_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com" \
./scripts/test-loyalty-e2e-flow.sh
```

**What it does:**
1. Creates loyalty action rule (with unique name)
2. Creates loyalty segment
3. Links segment to rule
4. Creates vendor
5. Creates customer
6. Creates product
7. Creates order (₹500 purchase)
8. Verifies points awarded (~50 points)

**Expected Duration:** 2-5 minutes

---

### Step 2: Manual UI Testing (Recommended)

**A. Create Loyalty Action Rule via Admin UI**
1. Navigate to: `https://dfof7mguaa0a5.cloudfront.net/loyalty` (or `https://dev.admin.warmpawz.com/loyalty`)
2. Click **"Action Rules"** tab
3. Click **"Create Action Rule"**
4. Fill in:
   - Action Name: `buy_product_test_manual`
   - Category: `loyalty`
   - User Type: `customer`
   - Points Type: `per_amount`
   - Points Value: `10`
   - Base Amount: `100`
   - Frequency: `unlimited`
5. **Select Segments** (if you have segments created)
6. Click **"Create"**

**B. Create Loyalty Segment via Admin UI**
1. Click **"Segments"** tab
2. Click **"Create Segment"**
3. Fill in criteria:
   - Segment Name: `Test Customers`
   - Type: `customer`
   - Criteria: Leave empty (matches all) or set specific criteria
4. Click **"Save"**

**C. Link Segment to Rule**
1. Go back to **"Action Rules"** tab
2. Click **"Edit"** on the rule you created
3. Scroll to **"Target Segments"** section
4. Check the segment you created
5. Click **"Update"**

**D. Create Vendor via Admin UI**
1. Navigate to: `https://dfof7mguaa0a5.cloudfront.net/vendors`
2. Click **"Add Vendor"**
3. Fill in vendor details:
   - Business Name: `Test Pet Store`
   - Owner Name: `Test Owner`
   - Email: `test@warmpawz.test`
   - Phone: `+919999999999`
   - Category: Select appropriate category
   - Address, City, State, Pincode
4. Complete all steps and save

**E. Create Service/Product for Vendor**
1. Navigate to: `https://dfof7mguaa0a5.cloudfront.net/catalog`
2. Click **"Add Service"** or **"Add Product"**
3. Fill in:
   - Name: `Test Pet Food`
   - Vendor: Select the vendor you created
   - Price: `500`
   - Category: Select appropriate category
4. Save

**F. Complete Customer Transaction**
1. Navigate to Customer App: `https://d2aoyjj8ine0wk.cloudfront.net` (or `https://dev.customer.warmpawz.com`)
2. Login/Signup as test customer
3. Browse to the product/service you created
4. Add to cart / Book service
5. Complete checkout/payment
6. Verify order/booking is confirmed

**G. Verify Points Awarded**
1. In Customer App, navigate to **"Rewards"** or **"Loyalty"** section
2. Check points balance
3. Verify points were credited for the transaction
4. Check transaction history

---

### Step 3: Verify Database Records

**Check Points in Database:**
```bash
# Get customer ID from the transaction
# Then check:
DB_HOST='warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com' \
DB_NAME='warmpawz' \
DB_USER='warmpawz_admin' \
DB_PASSWORD='Warmpawz2026' \
node -e "
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: 5432
});
(async () => {
  const result = await pool.query('SELECT * FROM customer_loyalty_points ORDER BY updated_at DESC LIMIT 5');
  console.log(JSON.stringify(result.rows, null, 2));
  await pool.end();
})();
"
```

**Check Transactions:**
```bash
# Same connection, check transactions
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
  const result = await pool.query('SELECT * FROM loyalty_transactions ORDER BY created_at DESC LIMIT 10');
  console.log(JSON.stringify(result.rows, null, 2));
  await pool.end();
})();
"
```

---

## 🔍 **Troubleshooting**

### Issue: Test Script Hangs
**Solution:** 
- Check API response times
- Verify network connectivity
- Run steps individually via curl

### Issue: Points Not Awarded
**Check:**
1. Action rule exists and is active
2. Action name matches what's used in order creation
3. Customer ID is correct
4. Order status is "completed"
5. Check CloudWatch logs for errors

### Issue: Segment Not Matching
**Check:**
1. Segment criteria are correct
2. Customer meets segment criteria
3. Segment is active
4. Rule has segment_ids in conditions

---

## 📊 **Verification Checklist**

After completing the test:

- [ ] Action rule created successfully
- [ ] Segment created successfully
- [ ] Rule linked to segment
- [ ] Vendor created successfully
- [ ] Service/Product created successfully
- [ ] Customer transaction completed
- [ ] Points awarded (check customer_loyalty_points table)
- [ ] Transaction recorded (check loyalty_transactions table)
- [ ] Points visible in customer app
- [ ] Segment evaluation working (if using segments)

---

## 🎯 **Success Criteria**

✅ **Test is successful if:**
1. All API calls return success (200/201)
2. Points are awarded correctly (10 points per ₹100 = 50 points for ₹500)
3. Points visible in `customer_loyalty_points` table
4. Transaction recorded in `loyalty_transactions` table
5. Points visible in customer app UI

---

## 📝 **Documentation to Update**

After testing:
1. Update `LOYALTY_E2E_TEST_RESULTS.md` with findings
2. Document any issues found
3. Note any UI improvements needed
4. Update test evidence log

---

## 🚀 **Quick Start Commands**

```bash
# 1. Run automated test
API_BASE_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com" \
./scripts/test-loyalty-e2e-flow.sh

# 2. Verify API endpoints
curl -X GET "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/admin/loyalty-action-rules"

# 3. Create test rule
curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/admin/loyalty-action-rules" \
  -H "Content-Type: application/json" \
  -d '{"action_name":"test_manual","action_category":"loyalty","user_type":"customer","points_type":"fixed","points_value":100,"frequency_type":"unlimited","is_active":true,"priority":100}'
```

---

**Last Updated:** 2026-01-13 15:00 IST  
**Status:** Ready for execution
