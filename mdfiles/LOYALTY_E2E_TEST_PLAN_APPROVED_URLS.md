# Loyalty E2E Test Plan - Using Approved CloudFront URLs

**Date:** 2026-01-13  
**Status:** ✅ Ready for Testing  
**Infrastructure:** ✅ Complete (No changes needed)

---

## 🌐 **APPROVED CLOUDFRONT URLS**

- **Admin Dashboard:** https://dfof7mguaa0a5.cloudfront.net
- **Vendor Portal:** https://d1s6ykkj381k58.cloudfront.net
- **Customer App:** https://d2aoyjj8ine0wk.cloudfront.net

**Note:** Infrastructure is complete - no changes needed.

---

## ✅ **INFRASTRUCTURE STATUS**

### Database ✅
- ✅ `loyalty_action_rules`: 25 rules (including `buy_product`)
- ✅ `loyalty_segments`: 16 segments
- ✅ All tables ready

### API ✅
- ✅ All endpoints working
- ✅ Lambda deployed
- ✅ All fixes applied

---

## 📋 **STEP-BY-STEP E2E TEST PLAN**

### **Phase 1: Admin Dashboard Setup**

#### Step 1: Access Admin Dashboard
- **URL:** https://dfof7mguaa0a5.cloudfront.net
- **Action:** Login with admin credentials
- **Verify:** Dashboard loads successfully

#### Step 2: Configure Loyalty Action Rule
1. Navigate to **Loyalty** page
2. Click **Action Rules** tab
3. Find **`buy_product`** rule (ID: `734fe20b-df0e-46a8-ad86-a9049be11223`)
4. Click **Edit**
5. **Optional Updates:**
   - Points Value: `10`
   - Base Amount: `100` (for 10 points per ₹100)
   - Or keep default (10 per ₹1000)
6. Scroll to **Target Segments**
7. Select a segment (e.g., "All Customers" or create new)
8. Click **Update**
9. **Verify:** Rule updated successfully

#### Step 3: Create/Verify Segment
1. Click **Segments** tab
2. Verify segments exist (16 available)
3. **Optional:** Create new segment:
   - Name: "Test Customers"
   - Type: Customer
   - Criteria: Empty (matches all)
   - Save

#### Step 4: Create Vendor
1. Navigate to **Vendors** page
2. Click **Add Vendor** or **Create Vendor**
3. Fill required fields:
   - Business Name: "Test Pet Store E2E"
   - Owner Name: "Test Owner"
   - Email: `test@warmpawz.test`
   - Phone: `+919999999999`
   - Address, City, State, Pincode
   - Category: Select appropriate
4. Complete all steps
5. **Save** and verify vendor created

#### Step 5: Create Product
1. Navigate to **Catalog** or **Products** page
2. Click **Add Product**
3. Fill in:
   - Name: "Test Pet Food E2E"
   - Vendor: Select the vendor you created
   - Price: `500` (₹500)
   - Category: Select appropriate
   - Stock: 100
   - Description: "Test product for loyalty E2E testing"
4. **Save** and verify product created

---

### **Phase 2: Customer App Transaction**

#### Step 6: Access Customer App
- **URL:** https://d2aoyjj8ine0wk.cloudfront.net
- **Action:** Login or signup as test customer
- **Verify:** App loads successfully

#### Step 7: Check Initial Points Balance
1. Navigate to **Rewards** or **Loyalty** section
2. Note current points balance
3. **Screenshot:** Take screenshot for evidence
4. **Record:** Initial points value

#### Step 8: Browse and Purchase Product
1. Navigate to **Shop** or browse products
2. Find the product you created ("Test Pet Food E2E")
3. Click **Add to Cart**
4. Proceed to **Checkout**
5. Select/Add delivery address
6. Select payment method
7. **Complete payment** (use test payment if available)
8. **Confirm order**
9. **Screenshot:** Order confirmation page

#### Step 9: Verify Points Awarded
1. Navigate back to **Rewards** or **Loyalty** section
2. Check points balance
3. **Expected Points:**
   - With default rule (10/₹1000): ~5 points (10 × 0.5)
   - With updated rule (10/₹100): ~50 points (10 × 5)
4. Check **Transaction History**
5. **Screenshot:** 
   - Final points balance
   - Transaction history showing the earning
6. **Verify:** Points match expected calculation

---

### **Phase 3: Verification**

#### Step 10: Database Verification (Optional)
```sql
-- Check customer points
SELECT * FROM customer_loyalty_points 
WHERE customer_id = '<customer-id>' 
ORDER BY updated_at DESC;

-- Check transactions
SELECT * FROM loyalty_transactions 
WHERE customer_id = '<customer-id>' 
AND action_name = 'buy_product'
ORDER BY created_at DESC 
LIMIT 10;

-- Check order
SELECT id, order_number, total_amount, order_status 
FROM orders 
WHERE customer_id = '<customer-id>' 
ORDER BY created_at DESC 
LIMIT 5;
```

#### Step 11: API Verification (Optional)
```bash
# Get customer points
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/<customer-id>/rewards/points"

# Get transactions
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/<customer-id>/rewards/transactions"
```

---

## ✅ **SUCCESS CRITERIA**

Test is successful when:
- ✅ All UI steps complete without errors
- ✅ Vendor created successfully
- ✅ Product created successfully
- ✅ Order/booking created successfully
- ✅ Payment completed
- ✅ Points balance increased
- ✅ Points visible in customer app
- ✅ Points match expected calculation
- ✅ Transaction in history
- ✅ Points recorded in database (if verified)

---

## 📸 **EVIDENCE TO COLLECT**

### Screenshots:
1. **Admin:**
   - Action rules list
   - Rule details (showing segment link)
   - Segments list
   - Vendor created
   - Product created

2. **Customer:**
   - Initial points balance
   - Product in shop
   - Cart/checkout
   - Order confirmation
   - Final points balance
   - Transaction history

### Data to Record:
- Rule ID: `734fe20b-df0e-46a8-ad86-a9049be11223`
- Segment ID: (from segments list)
- Vendor ID: (from vendor creation)
- Product ID: (from product creation)
- Customer ID: (from customer app)
- Order ID: (from order confirmation)
- Initial Points: (from step 7)
- Final Points: (from step 9)
- Points Earned: (Final - Initial)

---

## 🐛 **TROUBLESHOOTING**

### Issue: Points Not Awarded
**Check:**
1. Order status is "completed"
2. Action rule exists and is active
3. Action name matches (`buy_product`)
4. Customer ID is correct
5. Check browser console for errors
6. Check CloudWatch logs for Lambda errors

### Issue: Rule Not Matching
**Check:**
1. Rule priority (higher priority rules checked first)
2. Rule conditions (segment_ids, etc.)
3. Customer meets all segment criteria
4. Rule is active

### Issue: Order Not Creating
**Check:**
1. Vendor is active
2. Product is active and in stock
3. Customer has valid address
4. Payment method is valid

---

## 📝 **TEST EXECUTION LOG**

Use this template to log your test execution:

```
Date: _______________
Time: _______________
Tester: _______________

Phase 1: Admin Setup
- [ ] Admin dashboard accessed
- [ ] Rule configured
- [ ] Segment created/verified
- [ ] Vendor created: ID _______________
- [ ] Product created: ID _______________

Phase 2: Customer Transaction
- [ ] Customer app accessed
- [ ] Initial points: _______________
- [ ] Product found in shop
- [ ] Order created: ID _______________
- [ ] Payment completed
- [ ] Final points: _______________
- [ ] Points earned: _______________

Phase 3: Verification
- [ ] Points match expected
- [ ] Transaction in history
- [ ] Database verified (if applicable)

Result: [ ] PASS [ ] FAIL
Notes: _______________
```

---

## 🚀 **READY TO START**

**All infrastructure is ready:**
- ✅ Database: 25 rules, 16 segments
- ✅ API: All endpoints working
- ✅ Code: Deployed and verified
- ✅ URLs: Approved and ready

**Start with Phase 1: Admin Dashboard Setup**

---

**Last Updated:** 2026-01-13 15:25 IST  
**Status:** ✅ **READY FOR TESTING**
