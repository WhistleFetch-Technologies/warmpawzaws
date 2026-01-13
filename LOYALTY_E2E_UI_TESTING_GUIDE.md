# Loyalty E2E Test - UI Testing Guide

**Date:** 2026-01-13  
**Status:** ✅ Ready for Manual UI Testing

---

## 🎯 **SYSTEM STATUS**

✅ **All Infrastructure Ready:**
- Database: `loyalty_action_rules` (19 rules), `loyalty_segments` (14 segments)
- API: All endpoints working and verified
- Code: All fixes deployed
- Rules: `buy_product` rule exists (10 points per ₹1000, can be updated to ₹100)

---

## 📋 **STEP-BY-STEP UI TEST**

### **Part 1: Admin Dashboard Setup**

#### Step 1: Access Admin Dashboard
- URL: `https://dfof7mguaa0a5.cloudfront.net` or `https://dev.admin.warmpawz.com`
- Login with admin credentials

#### Step 2: Configure Loyalty Rule
1. Navigate to **Loyalty** page
2. Click **Action Rules** tab
3. Find **`buy_product`** rule (or create new)
4. Click **Edit**
5. Update:
   - Points Value: `10`
   - Base Amount: `100` (for 10 points per ₹100)
   - Or keep default (10 per ₹1000)
6. Scroll to **Target Segments**
7. Select a segment (e.g., "All Customers" or create new)
8. Click **Update**

#### Step 3: Create/Verify Segment
1. Click **Segments** tab
2. Verify segments exist or create new:
   - Name: "Test Customers"
   - Type: Customer
   - Criteria: Empty (matches all)
   - Save

#### Step 4: Create Vendor
1. Navigate to **Vendors** page
2. Click **Add Vendor**
3. Fill required fields:
   - Business Name: "Test Pet Store"
   - Owner Name: "Test Owner"
   - Email: `test@warmpawz.test`
   - Phone: `+919999999999`
   - Address, City, State, Pincode
   - Category: Select appropriate
4. Complete all steps and **Save**

#### Step 5: Create Product
1. Navigate to **Catalog** page
2. Click **Add Product**
3. Fill in:
   - Name: "Test Pet Food"
   - Vendor: Select the vendor you created
   - Price: `500` (₹500)
   - Category: Select appropriate
   - Stock: 100
4. **Save**

---

### **Part 2: Customer App Transaction**

#### Step 6: Access Customer App
- URL: `https://d2aoyjj8ine0wk.cloudfront.net` or `https://dev.customer.warmpawz.com`
- Login or signup as test customer

#### Step 7: Check Initial Points
1. Navigate to **Rewards** or **Loyalty** section
2. Note current points balance
3. Take screenshot for evidence

#### Step 8: Complete Purchase
1. Navigate to **Shop** or browse products
2. Find the product you created ("Test Pet Food")
3. Click **Add to Cart**
4. Proceed to **Checkout**
5. Select address
6. Complete payment (use test payment if available)
7. Confirm order

#### Step 9: Verify Points Awarded
1. Navigate back to **Rewards** or **Loyalty** section
2. Check points balance
3. **Expected:** Should increase by ~50 points (10 points per ₹100 × 5)
   - Or ~5 points if using default rule (10 per ₹1000)
4. Check transaction history
5. Take screenshots for evidence

---

## 🔍 **VERIFICATION CHECKLIST**

After completing the test:

- [ ] Action rule exists and is active
- [ ] Rule is linked to segment (if using segments)
- [ ] Vendor created successfully
- [ ] Product created successfully
- [ ] Customer can see product in shop
- [ ] Order/booking created successfully
- [ ] Payment completed
- [ ] Points balance increased
- [ ] Points visible in transaction history
- [ ] Points match expected calculation

---

## 📊 **EXPECTED RESULTS**

### Points Calculation:
- **Rule:** 10 points per ₹100
- **Purchase:** ₹500
- **Expected Points:** 50 points (10 × 5)

### Or with Default Rule:
- **Rule:** 10 points per ₹1000
- **Purchase:** ₹500
- **Expected Points:** 5 points (10 × 0.5, rounded)

---

## 🐛 **TROUBLESHOOTING**

### Issue: Points Not Awarded
**Check:**
1. Order status is "completed"
2. Action rule exists and is active
3. Action name matches (`buy_product` or `buy_first_product`)
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

## 📸 **EVIDENCE TO COLLECT**

1. **Screenshots:**
   - Admin: Action rules list
   - Admin: Segments list
   - Admin: Rule linked to segment
   - Customer: Initial points balance
   - Customer: Order confirmation
   - Customer: Final points balance
   - Customer: Transaction history

2. **API Responses:**
   - Rule creation/update response
   - Segment creation response
   - Order creation response
   - Points balance response

3. **Database Queries:**
   - Points before/after
   - Transaction records
   - Order records

---

## ✅ **SUCCESS INDICATORS**

Test is successful when:
- ✅ All UI steps complete without errors
- ✅ Order created successfully
- ✅ Points awarded correctly
- ✅ Points visible in customer app
- ✅ Points recorded in database
- ✅ Transaction history shows the earning

---

**System is ready! Follow the steps above to complete the E2E test via UI.** 🚀
