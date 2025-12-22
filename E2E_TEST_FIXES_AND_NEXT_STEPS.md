# E2E Test Fixes and Next Steps

## 🔍 Issues Identified

### 1. Endpoint Path Mismatches
The test suite is using incorrect endpoint paths. Here are the corrections needed:

#### Vendor Registration
- ❌ **Test uses**: `POST /vendor/register`
- ✅ **Actual endpoint**: `POST /make-server-3dd53475/vendor/apply`

#### Service Catalog
- ❌ **Test uses**: `GET /admin/catalog/services`
- ✅ **Actual endpoint**: `GET /make-server-3dd53475/catalog/services/master` or `/make-server-3dd53475/admin/catalog/services`

#### Customer Registration
- ❌ **Test uses**: `POST /customer/register`
- ✅ **Need to verify**: Check customer registration endpoint

#### Promotions
- ❌ **Test uses**: `GET /customer/promotions/active`
- ✅ **Actual endpoint**: `GET /make-server-3dd53475/customer/promotions/active`

## 📋 Next Steps

### Step 1: Fix Endpoint Paths in Test File
Update `src/tests/e2e-vendor-journey-test.ts` with correct endpoint paths:

1. **Vendor Registration** (Line ~147)
   ```typescript
   // Change from:
   const response = await fetch(`${API_BASE}/vendor/register`, {
   
   // To:
   const response = await fetch(`${API_BASE}/vendor/apply`, {
   ```

2. **Service Catalog** (Line ~230)
   ```typescript
   // Change from:
   const response = await fetch(`${API_BASE}/admin/catalog/services`, {
   
   // To:
   const response = await fetch(`${API_BASE}/catalog/services/master`, {
   ```

3. **Promotions** (Line ~817)
   ```typescript
   // Already correct, but verify path
   const response = await fetch(`${API_BASE}/customer/promotions/active`, {
   ```

### Step 2: Verify All Endpoint Paths
Check the following endpoints exist:
- [ ] `/make-server-3dd53475/vendor/apply` - Vendor registration
- [ ] `/make-server-3dd53475/vendor/:vendorId/application/submit` - Submit application
- [ ] `/make-server-3dd53475/admin/vendor/:vendorId/approve` - Approve vendor
- [ ] `/make-server-3dd53475/catalog/services/master` - Get catalog
- [ ] `/make-server-3dd53475/vendor/:vendorId/catalog/applicable` - Get applicable services
- [ ] `/make-server-3dd53475/vendor/:vendorId/services/add` - Add service
- [ ] `/make-server-3dd53475/bookings/create` - Create booking
- [ ] `/make-server-3dd53475/ecommerce/payments/initiate` - Initiate payment
- [ ] `/make-server-3dd53475/customer/promotions/active` - Get promotions
- [ ] `/make-server-3dd53475/bookings/:bookingId/cancel` - Cancel booking
- [ ] `/make-server-3dd53475/vendor/:vendorId/earnings` - Get earnings
- [ ] `/make-server-3dd53475/vendor/:vendorId/payouts` - Get payouts

### Step 3: Update Test Data Structure
Ensure test data matches expected API format:

**Vendor Application Data:**
```typescript
{
  roleId: string,
  phone: string,
  email: string,
  formData: {
    businessName: string,
    fullName: string,
    address: string,
    // ... other fields
  },
  documents: {},
  serviceStyle: string,
  location: { lat, lng }
}
```

### Step 4: Add Authentication Handling
Some endpoints may require authentication. Update tests to:
- Handle authentication tokens if needed
- Use public anon key for public endpoints
- Skip tests that require admin auth (mark as SKIP)

### Step 5: Re-run Tests
After fixes:
```bash
export PATH="$HOME/.deno/bin:$PATH"
deno run --allow-net --allow-read --allow-write --allow-env \
  src/tests/e2e-vendor-journey-test.ts --run
```

## 🔧 Implementation Plan

### Priority 1: Critical Endpoints (Must Fix)
1. ✅ Vendor registration endpoint path
2. ✅ Service catalog endpoint path
3. ✅ Booking creation endpoint path
4. ✅ Payment endpoints

### Priority 2: Important Endpoints (Should Fix)
1. Customer registration
2. Promotion endpoints
3. Earnings endpoints
4. Payout endpoints

### Priority 3: Nice to Have (Can Skip)
1. Admin-only endpoints (mark as SKIP)
2. Edge case tests (can be manual)

## 📊 Expected Improvements

After fixes:
- **Vendor Onboarding**: Should pass 15-18/20 tests
- **Service Catalog**: Should pass 1-2/3 tests
- **Booking Flow**: Should pass 1-2/2 tests
- **Payment & Earnings**: Should pass 2-4/5 tests
- **Overall**: Target 60-70% pass rate initially

## 🎯 Success Criteria

Tests are considered successful when:
1. ✅ All endpoint paths are correct
2. ✅ Test data format matches API expectations
3. ✅ At least 50% of tests pass
4. ✅ Failed tests have clear error messages
5. ✅ Skipped tests are properly documented

## 📝 Notes

- Some endpoints may require the backend to be deployed
- Admin endpoints will likely need authentication
- Payment endpoints may require real Razorpay credentials
- Some tests may need to be run in a specific order (dependencies)

