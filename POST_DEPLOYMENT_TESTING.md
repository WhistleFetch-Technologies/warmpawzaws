# 🧪 Post-Deployment Testing Plan

## ✅ Deployment Status
- **Health Check**: ✅ PASSED
- **Function Status**: HEALTHY
- **Deployment**: Complete

## 📋 Testing Checklist

### 1. Core Endpoints Testing

#### A. Customer Authentication & Profile
```bash
# Test OTP generation
curl -X POST https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/customer/otp/send \
  -H "Content-Type: application/json" \
  -d '{"phone": "9611377119"}'

# Test OTP verification
curl -X POST https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/customer/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"phone": "9611377119", "otp": "123456"}'

# Test customer profile
curl -X GET "https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/customer/profile?phone=9611377119"
```

#### B. Pet Management
```bash
# Get customer pets
curl -X GET "https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/customer/pets?customerId=CUSTOMER_ID"

# Add pet
curl -X POST https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/customer/pets \
  -H "Content-Type: application/json" \
  -d '{"customerId": "CUSTOMER_ID", "name": "Buddy", "species": "dog", "breed": "Labrador"}'
```

#### C. Service Discovery
```bash
# Problem-driven discovery
curl -X GET "https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/discovery/problem?problemId=vet_consultation&roleId=vet&latitude=28.6139&longitude=77.2090"

# Universal service discovery
curl -X GET "https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/services/discover?serviceType=grooming&city=Delhi"
```

### 2. E-commerce Endpoints

#### A. Shopping Cart
```bash
# Get cart
curl -X GET "https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/ecommerce/cart?customerId=CUSTOMER_ID"

# Add to cart
curl -X POST https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/ecommerce/cart/add \
  -H "Content-Type: application/json" \
  -d '{"customerId": "CUSTOMER_ID", "productId": "PRODUCT_ID", "quantity": 1}'
```

#### B. Addresses
```bash
# Get addresses
curl -X GET "https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/ecommerce/addresses?customerId=CUSTOMER_ID"

# Add address
curl -X POST https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/ecommerce/addresses \
  -H "Content-Type: application/json" \
  -d '{"customerId": "CUSTOMER_ID", "address_line1": "123 Main St", "city": "Delhi", "state": "Delhi", "pincode": "110001"}'
```

### 3. Loyalty & Rewards

```bash
# Get loyalty profile
curl -X GET "https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/loyalty/profile/CUSTOMER_ID"

# Process loyalty action
curl -X POST https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/loyalty/process-action \
  -H "Content-Type: application/json" \
  -d '{"userId": "CUSTOMER_ID", "userType": "customer", "actionKey": "signup", "points": 100}'
```

### 4. Referral System

```bash
# Create referral code
curl -X POST "https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/referrals/CUSTOMER_ID/create-code"

# Apply referral code
curl -X POST https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/loyalty/referral/apply \
  -H "Content-Type: application/json" \
  -d '{"newUserId": "NEW_CUSTOMER_ID", "referralCode": "REF123", "userType": "customer"}'
```

### 5. Booking System

```bash
# Get available slots
curl -X GET "https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/vendor/VENDOR_ID/slots?date=2025-01-28"

# Create booking
curl -X POST https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/customer/booking \
  -H "Content-Type: application/json" \
  -d '{
    "customerPhone": "9611377119",
    "vendorId": "VENDOR_ID",
    "petId": "PET_ID",
    "serviceId": "SERVICE_ID",
    "scheduledDate": "2025-01-28",
    "scheduledTime": "10:00",
    "amount": "500"
  }'
```

### 6. Support Tickets

```bash
# Create ticket
curl -X POST https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/support/tickets \
  -H "Content-Type: application/json" \
  -d '{"customerId": "CUSTOMER_ID", "subject": "Test", "description": "Test ticket", "category": "technical"}'

# Get tickets
curl -X GET "https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/support/tickets?customerId=CUSTOMER_ID"
```

## 🔍 Database Verification

### Check SQL Tables
```sql
-- Verify e-commerce tables exist
SELECT COUNT(*) FROM shopping_carts;
SELECT COUNT(*) FROM customer_addresses;
SELECT COUNT(*) FROM wishlists;

-- Verify bookings table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'bookings' 
AND column_name IN ('scheduled_date', 'scheduled_time', 'booking_date', 'booking_time');

-- Check for any KV store usage in recent logs
SELECT * FROM kv_store_3dd53475 
WHERE key LIKE 'booking:%' 
ORDER BY key DESC LIMIT 10;
```

## 📊 Monitoring Checklist

- [ ] Check function logs for errors
- [ ] Verify SQL query performance
- [ ] Monitor database connection pool
- [ ] Check for any timeout errors
- [ ] Verify all endpoints return expected status codes
- [ ] Test error handling (invalid inputs, missing data)
- [ ] Verify data persistence in SQL tables

## 🐛 Common Issues & Solutions

### Issue: 500 Internal Server Error
**Solution**: Check function logs in Supabase Dashboard for detailed error messages

### Issue: Table does not exist
**Solution**: Verify migration 020 was applied: `SELECT * FROM shopping_carts LIMIT 1;`

### Issue: Foreign key constraint violation
**Solution**: Ensure all referenced records exist (customers, vendors, services)

### Issue: Field mapping errors
**Solution**: Verify booking repository is using correct column names (scheduled_date/scheduled_time)

## ✅ Success Criteria

- [ ] All endpoints return 200/201 status codes
- [ ] No KV store errors in logs
- [ ] Data persists correctly in SQL tables
- [ ] OTP generation works
- [ ] Booking creation works
- [ ] Cart operations work
- [ ] Loyalty points awarded correctly
- [ ] No timeout errors
- [ ] All SQL queries execute successfully

## 📝 Next Actions

1. **Run End-to-End Tests**: Test complete user flows (signup → booking → payment)
2. **Performance Testing**: Check response times for critical endpoints
3. **Load Testing**: Verify system handles concurrent requests
4. **Error Handling**: Test edge cases and error scenarios
5. **Frontend Integration**: Update frontend to use new SQL-only endpoints

---

**Status**: Ready for comprehensive testing ✅

