# E2E Vendor Journey Test Execution Plan

## Overview
Comprehensive end-to-end testing covering the complete vendor lifecycle from onboarding to payout for all 20+ vendor roles.

## Test Suites

### Suite 1: Vendor Onboarding ✅
**Coverage**: All 20+ roles
**Tests**:
1. Vendor registration for each role
2. Application submission
3. Admin approval workflow
4. Service setup configuration
5. Availability configuration
6. Document upload and verification
7. KYC completion

**Expected Endpoints**:
- `POST /vendor/register`
- `POST /vendor/:vendorId/application/submit`
- `POST /admin/vendor/:vendorId/approve`
- `GET /vendor/:vendorId/status`

### Suite 2: Service Catalog Creation ✅
**Coverage**: All roles with service catalog access
**Tests**:
1. Fetch master service catalog
2. Get applicable services for role
3. Add services from catalog to vendor
4. Create custom services (where capability allows)
5. Configure service pricing
6. Publish services
7. Verify services appear in customer app

**Expected Endpoints**:
- `GET /admin/catalog/services`
- `GET /vendor/:vendorId/catalog/applicable`
- `POST /vendor/:vendorId/services/add`
- `POST /vendor/:vendorId/services/custom`
- `POST /vendor/:vendorId/services/publish`

### Suite 3: Booking Flow ✅
**Coverage**: All service styles (at_home, at_center, tele, delivery)
**Tests**:
1. Customer discovers vendor
2. Customer selects service
3. Customer selects pet
4. Customer selects date/time
5. Customer selects address (for home services)
6. Customer applies coupon/promotion
7. Customer makes payment
8. Booking confirmation
9. OTP generation
10. Booking status updates

**Expected Endpoints**:
- `GET /customer/vendors/search`
- `GET /vendor/:vendorId/services`
- `POST /bookings/create`
- `POST /ecommerce/payments/initiate`
- `POST /ecommerce/payments/verify`

### Suite 4: Payment & Earnings ✅
**Coverage**: All payment methods and earnings calculation
**Tests**:
1. Payment initiation
2. Payment verification
3. Commission calculation (tier-based)
4. Vendor earnings calculation
5. Platform fee calculation
6. Earnings tracking (daily/monthly)
7. Wallet integration
8. Loyalty points awarding

**Expected Endpoints**:
- `POST /ecommerce/payments/initiate`
- `POST /ecommerce/payments/verify`
- `GET /vendor/:vendorId/earnings`
- `POST /loyalty/process-action`

### Suite 5: Coupons & Promotions ✅
**Coverage**: Coupon validation, promotion application
**Tests**:
1. Create promotion (admin)
2. Get active promotions
3. Validate coupon code
4. Apply coupon to booking
5. Apply promotion to booking
6. Calculate discount correctly
7. Enforce minimum order amount
8. Enforce usage limits
9. Track coupon usage

**Expected Endpoints**:
- `POST /admin/promotions`
- `GET /customer/promotions/active`
- `POST /coupons/validate`
- `POST /coupons/apply`

### Suite 6: Policy Enforcement ✅
**Coverage**: Cancellation, rescheduling, refund policies
**Tests**:
1. Cancel booking (within policy window)
2. Cancel booking (outside policy window)
3. Reschedule booking
4. Refund calculation
5. Wallet credit on refund
6. Policy validation
7. Refund processing

**Expected Endpoints**:
- `POST /bookings/:bookingId/cancel`
- `POST /bookings/:bookingId/reschedule`
- `POST /wallet/:customerId/credit`

### Suite 7: Edge Cases ✅
**Coverage**: Invalid inputs, boundary conditions
**Tests**:
1. Booking with past date (should fail)
2. Booking with zero price (should fail)
3. Booking with invalid service (should fail)
4. Payment with invalid amount (should fail)
5. Coupon with expired date (should fail)
6. Cancellation after completion (should fail)
7. Duplicate booking (should fail)

### Suite 8: Payout Flow ✅
**Coverage**: Earnings settlement and payout
**Tests**:
1. Check vendor earnings
2. Trigger settlement calculation
3. Verify commission calculation
4. Verify vendor share calculation
5. Check payout status
6. Verify Razorpay payout initiation
7. Verify payout completion

**Expected Endpoints**:
- `GET /vendor/:vendorId/earnings`
- `POST /admin/settlement/calculate`
- `GET /vendor/:vendorId/payouts`
- `POST /razorpay/payout/create`

## Test Execution

### Automated Test Script
The test script (`src/tests/e2e-vendor-journey-test.ts`) will:
1. Create test vendors for each role
2. Create test customers
3. Execute all test suites
4. Generate comprehensive report
5. Identify gaps and failures

### Manual Verification Checklist
After automated tests, verify:
- [ ] Vendor can log in after approval
- [ ] Services appear in customer app
- [ ] Bookings can be created
- [ ] Payments process correctly
- [ ] Earnings are calculated correctly
- [ ] Payouts are initiated
- [ ] Policies are enforced
- [ ] Coupons/promotions work

## Expected Results

### Success Criteria
- ✅ All vendor roles can onboard
- ✅ All vendors can create service catalogs
- ✅ All service styles support booking
- ✅ Payments process correctly
- ✅ Earnings calculate correctly
- ✅ Payouts are automated
- ✅ Policies are enforced
- ✅ Coupons/promotions work

### Known Limitations
- Some endpoints may require admin authentication
- Payment gateway requires real credentials
- Some flows may require manual verification

## Next Steps

1. Run automated test suite
2. Review test results
3. Fix identified issues
4. Re-run tests
5. Generate final report

