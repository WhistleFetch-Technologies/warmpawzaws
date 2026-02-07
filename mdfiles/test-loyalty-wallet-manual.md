# Manual Testing Guide - Loyalty & Wallet Integration

## 🧪 Test Scenarios

### Prerequisites
- API server running
- Database migrations applied (especially `043_loyalty_action_rules_table.sql`)
- Test customer/vendor accounts

---

## Test 1: Customer Signup → Points Auto-Convert to Wallet

### Steps:
1. **Sign up a new customer**
   ```bash
   POST /auth/verify-otp
   {
     "phone": "+919876543210",
     "otp": "123456",
     "role": "customer"
   }
   ```

2. **Check loyalty profile**
   ```bash
   GET /loyalty/profile/{customerId}
   ```
   **Expected**: `total_points: 100` (signup bonus)

3. **Check wallet balance**
   ```bash
   GET /wallet/{customerId}
   ```
   **Expected**: `balance: 100` (auto-converted from points)

### ✅ Success Criteria:
- Customer receives 100 points on signup
- Points automatically converted to ₹100 in wallet
- Both loyalty transaction and wallet transaction created

---

## Test 2: Complete Pet Profile → Points Awarded

### Steps:
1. **Add first pet**
   ```bash
   POST /customer/{customerId}/pets
   {
     "name": "Buddy",
     "species": "dog",
     "breed": "Golden Retriever",
     "age": 2
   }
   ```

2. **Check loyalty profile**
   ```bash
   GET /loyalty/profile/{customerId}
   ```
   **Expected**: `total_points: 200` (100 signup + 100 pet profile)

3. **Check wallet balance**
   ```bash
   GET /wallet/{customerId}
   ```
   **Expected**: `balance: 200` (₹200 total)

### ✅ Success Criteria:
- 100 points awarded for first pet
- Points auto-converted to wallet
- Only first pet triggers bonus (one_time rule)

---

## Test 3: Product Purchase → Points Based on Amount

### Steps:
1. **Create order (₹5000 purchase)**
   ```bash
   POST /ecommerce/orders
   {
     "customerId": "{customerId}",
     "items": [
       {
         "productId": "product-1",
         "quantity": 1,
         "price": 5000,
         "name": "Premium Dog Food"
       }
     ]
   }
   ```

2. **Check loyalty points**
   ```bash
   GET /loyalty/profile/{customerId}
   ```
   **Expected**: 
   - First product: 50 points per ₹1000 = 250 points (₹5000)
   - Subsequent products: 10 points per ₹1000 = 50 points (₹5000)

3. **Check wallet balance**
   ```bash
   GET /wallet/{customerId}
   ```
   **Expected**: Balance increased by points earned

### ✅ Success Criteria:
- Points calculated correctly (per_amount rule)
- Points auto-converted to wallet
- Different rules for first vs. regular purchase

---

## Test 4: Service Booking → Points Based on Service Type

### Steps:
1. **Create booking (Grooming service - ₹2000)**
   ```bash
   POST /bookings
   {
     "customerId": "{customerId}",
     "vendorId": "{vendorId}",
     "serviceId": "{grooming-service-id}",
     "bookingDate": "2025-01-28",
     "bookingTime": "10:00",
     "price": 2000
   }
   ```

2. **Process payment**
   ```bash
   POST /payments/create
   {
     "bookingId": "{bookingId}",
     "amount": 2000,
     "paymentMethod": "razorpay",
     "customerId": "{customerId}"
   }
   ```

3. **Check loyalty points**
   ```bash
   GET /loyalty/profile/{customerId}
   ```
   **Expected**: 
   - Grooming: 5 points per ₹1000 = 10 points (₹2000)
   - Vet consultation: 7 points per ₹500 = 28 points (₹2000)
   - Nutrition: 5 points per ₹1000 = 10 points (₹2000)

4. **Check wallet balance**
   ```bash
   GET /wallet/{customerId}
   ```
   **Expected**: Balance increased by points earned

### ✅ Success Criteria:
- Points awarded based on service type
- Points auto-converted to wallet
- Payment completion triggers points

---

## Test 5: Wallet Payment

### Steps:
1. **Check current wallet balance**
   ```bash
   GET /wallet/{customerId}
   ```
   **Note**: Balance should be > ₹500 for this test

2. **Create booking**
   ```bash
   POST /bookings
   {
     "customerId": "{customerId}",
     "vendorId": "{vendorId}",
     "serviceId": "{service-id}",
     "price": 1000
   }
   ```

3. **Pay using wallet (partial)**
   ```bash
   POST /payments/create
   {
     "bookingId": "{bookingId}",
     "amount": 1000,
     "paymentMethod": "razorpay",
     "useWallet": true,
     "walletAmount": 500,
     "customerId": "{customerId}"
   }
   ```
   **Expected**: 
   - Wallet debited: ₹500
   - Remaining amount: ₹500
   - Payment status: pending (if remaining > 0)

4. **Pay using wallet (full)**
   ```bash
   POST /payments/create
   {
     "bookingId": "{bookingId}",
     "amount": 500,
     "paymentMethod": "razorpay",
     "useWallet": true,
     "walletAmount": 500,
     "customerId": "{customerId}"
   }
   ```
   **Expected**: 
   - Wallet debited: ₹500
   - Remaining amount: ₹0
   - Payment status: completed

5. **Check wallet balance**
   ```bash
   GET /wallet/{customerId}
   ```
   **Expected**: Balance decreased by ₹500

6. **Check wallet transactions**
   ```bash
   GET /wallet/{customerId}/transactions
   ```
   **Expected**: Debit transaction recorded

### ✅ Success Criteria:
- Wallet balance checked before payment
- Wallet debited correctly
- Partial and full wallet payments work
- Wallet transactions recorded
- Payment status updated correctly

---

## Test 6: Frequency Limits

### Steps:
1. **Post first review**
   ```bash
   POST /reviews
   {
     "customerId": "{customerId}",
     "vendorId": "{vendorId}",
     "rating": 5,
     "comment": "Great service!"
   }
   ```
   **Expected**: 500 points awarded

2. **Post second review**
   ```bash
   POST /reviews
   {
     "customerId": "{customerId}",
     "vendorId": "{vendorId-2}",
     "rating": 5,
     "comment": "Excellent!"
   }
   ```
   **Expected**: 500 points awarded

3. **Post third review**
   ```bash
   POST /reviews
   {
     "customerId": "{customerId}",
     "vendorId": "{vendorId-3}",
     "rating": 5,
     "comment": "Amazing!"
   }
   ```
   **Expected**: 500 points awarded

4. **Post fourth review (should fail)**
   ```bash
   POST /reviews
   {
     "customerId": "{customerId}",
     "vendorId": "{vendorId-4}",
     "rating": 5,
     "comment": "Good!"
   }
   ```
   **Expected**: 0 points (monthly limit reached)

5. **Check loyalty points**
   ```bash
   GET /loyalty/profile/{customerId}
   ```
   **Expected**: Only 1500 points (3 × 500), not 2000

### ✅ Success Criteria:
- First 3 reviews award points
- 4th review in same month doesn't award points
- Monthly limit enforced correctly

---

## Test 7: Admin - Manage Loyalty Action Rules

### Steps:
1. **List all rules**
   ```bash
   GET /admin/loyalty-action-rules
   ```
   **Expected**: List of all rules (19 default + any custom)

2. **Get specific rule**
   ```bash
   GET /admin/loyalty-action-rules/{ruleId}
   ```
   **Expected**: Rule details

3. **Create custom rule**
   ```bash
   POST /admin/loyalty-action-rules
   {
     "action_name": "custom_action",
     "action_category": "loyalty",
     "user_type": "customer",
     "points_type": "fixed",
     "points_value": 25,
     "frequency_type": "unlimited",
     "is_active": true,
     "priority": 100,
     "description": "Custom test action"
   }
   ```
   **Expected**: Rule created successfully

4. **Update rule**
   ```bash
   PUT /admin/loyalty-action-rules/{ruleId}
   {
     "points_value": 50,
     "is_active": false
   }
   ```
   **Expected**: Rule updated

5. **Delete rule**
   ```bash
   DELETE /admin/loyalty-action-rules/{ruleId}
   ```
   **Expected**: Rule deleted

### ✅ Success Criteria:
- CRUD operations work correctly
- Validation enforces enum values
- Action name uniqueness enforced

---

## Test 8: Loyalty Balance Check

### Steps:
1. **Get loyalty balance**
   ```bash
   GET /loyalty/profile/{customerId}
   ```
   **Note**: This should return points balance

2. **Get wallet balance**
   ```bash
   GET /wallet/{customerId}
   ```
   **Note**: This should return wallet balance

3. **Calculate total usable balance**
   - Total = Points + Wallet Balance
   - Example: 500 points + ₹1000 wallet = ₹1500 total

### ✅ Success Criteria:
- Both balances returned correctly
- Total usable balance = points + wallet

---

## Test 9: Transaction History

### Steps:
1. **Get loyalty transactions**
   ```bash
   GET /loyalty/transactions/{customerId}
   ```
   **Expected**: List of all loyalty transactions

2. **Get wallet transactions**
   ```bash
   GET /wallet/{customerId}/transactions
   ```
   **Expected**: List of all wallet transactions

### ✅ Success Criteria:
- All transactions visible
- Transactions include reference information
- Proper transaction types (earned, redeemed, credit, debit)

---

## Test 10: Error Cases

### Steps:
1. **Insufficient wallet balance**
   ```bash
   POST /payments/create
   {
     "bookingId": "{bookingId}",
     "amount": 10000,
     "useWallet": true,
     "walletAmount": 10000,
     "customerId": "{customerId}"
   }
   ```
   **Expected**: Error if wallet balance < ₹10000

2. **Invalid action name**
   ```bash
   POST /loyalty/earn
   {
     "customerId": "{customerId}",
     "actionName": "invalid_action",
     "amount": 1000
   }
   ```
   **Expected**: 0 points (no rule found)

3. **Frequency limit exceeded**
   - Try to earn points for one_time action twice
   **Expected**: 0 points on second attempt

### ✅ Success Criteria:
- Proper error handling
- Graceful degradation
- Error messages are clear

---

## 📊 Expected Results Summary

| Action | Points | Wallet Credit | Frequency |
|--------|--------|---------------|-----------|
| Sign up | 100 | ₹100 | One-time |
| Complete pet profile | 100 | ₹100 | One-time |
| Buy first product (₹5000) | 250 | ₹250 | One-time |
| Buy product (₹5000) | 50 | ₹50 | Unlimited |
| Book grooming (₹2000) | 10 | ₹10 | Unlimited |
| Book vet consultation (₹2000) | 28 | ₹28 | Unlimited |
| Post review | 500 | ₹500 | Max 3/month |
| Birthday month booking | 2x multiplier | 2x | Once/year |

---

## 🔍 Verification Checklist

- [ ] Points automatically convert to wallet (1 point = 1 rupee)
- [ ] Wallet payment works (partial and full)
- [ ] All action rules work correctly
- [ ] Frequency limits enforced
- [ ] Admin endpoints functional
- [ ] Transaction history accurate
- [ ] Error handling proper
- [ ] Database consistency maintained

---

## 🐛 Common Issues

1. **Points not converting to wallet**
   - Check: `loyalty_rules.auto_convert_to_wallet = true`
   - Check: `LoyaltyPointsService.awardPoints()` is called

2. **Wallet payment failing**
   - Check: Wallet balance sufficient
   - Check: Transaction atomicity
   - Check: Payment status updates

3. **Points not awarded**
   - Check: Rule exists and is active
   - Check: Frequency limits not exceeded
   - Check: Action name matches rule

4. **Admin endpoints not working**
   - Check: Endpoints registered in handler
   - Check: Authentication/authorization
   - Check: Database migrations applied

---

**Test Date**: 2025-01-27  
**Status**: Ready for Testing

