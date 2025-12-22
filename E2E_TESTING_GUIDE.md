# E2E Vendor Journey Testing Guide

## Overview
This guide covers comprehensive end-to-end testing of the complete vendor lifecycle from onboarding through payout for all 20+ vendor roles.

## Test Coverage

### ✅ Test Suites Created

1. **Vendor Onboarding** - Tests registration, application, approval for all roles
2. **Service Catalog Creation** - Tests catalog browsing, service addition, custom services
3. **Booking Flow** - Tests complete booking lifecycle from discovery to confirmation
4. **Payment & Earnings** - Tests payment processing, commission calculation, earnings tracking
5. **Coupons & Promotions** - Tests promotion creation, coupon validation, discount application
6. **Policy Enforcement** - Tests cancellation, rescheduling, refund policies
7. **Edge Cases** - Tests invalid inputs, boundary conditions, error handling
8. **Payout Flow** - Tests earnings settlement, payout calculation, Razorpay integration

## How to Run Tests

### Option 1: Using Deno Directly
```bash
deno run --allow-net --allow-read --allow-write --allow-env \
  src/tests/e2e-vendor-journey-test.ts --run
```

### Option 2: Using Test Runner Script
```bash
./src/tests/e2e-test-runner.sh
```

### Option 3: Using TypeScript Runner
```bash
deno run --allow-net --allow-read --allow-write --allow-env \
  src/tests/run-e2e-tests.ts
```

## Test Execution Flow

### Phase 1: Setup
1. Creates test vendors for each role (20+ vendors)
2. Creates test customers
3. Sets up test data

### Phase 2: Onboarding Tests
- Registers vendors
- Submits applications
- Approves vendors (simulated)
- Verifies vendor status

### Phase 3: Service Catalog Tests
- Fetches master catalog
- Gets applicable services per role
- Adds services to vendor catalogs
- Creates custom services (where allowed)

### Phase 4: Booking Tests
- Creates bookings for each vendor
- Tests different service styles
- Verifies booking creation
- Checks booking status

### Phase 5: Payment Tests
- Initiates payments
- Verifies payment processing
- Checks earnings calculation
- Validates commission calculation

### Phase 6: Coupon/Promotion Tests
- Creates promotions
- Validates coupons
- Applies discounts
- Tracks usage

### Phase 7: Policy Tests
- Tests cancellation policies
- Tests rescheduling policies
- Verifies refund calculations
- Checks wallet credits

### Phase 8: Edge Case Tests
- Tests invalid inputs
- Tests boundary conditions
- Verifies error handling
- Checks validation

### Phase 9: Payout Tests
- Checks earnings
- Triggers settlement
- Verifies payout calculation
- Checks Razorpay integration

## Expected Test Results

### Success Metrics
- **Vendor Onboarding**: 20+ vendors registered and approved
- **Service Catalog**: Services added for all vendors
- **Bookings**: Bookings created for all service styles
- **Payments**: Payments processed correctly
- **Earnings**: Earnings calculated correctly
- **Payouts**: Payouts calculated and initiated

### Test Status Indicators
- ✅ **PASS**: Test completed successfully
- ❌ **FAIL**: Test failed (needs investigation)
- ⏭️ **SKIP**: Test skipped (may require manual setup)

## Test Report

After execution, a detailed report is generated in:
- `E2E_VENDOR_JOURNEY_TEST_REPORT.txt`

The report includes:
- Test suite summaries
- Individual test results
- Pass/fail/skip counts
- Duration metrics
- Error details
- Overall statistics

## Roles Tested

The test suite covers all vendor roles:
1. veterinarian
2. pet_clinic
3. groomer
4. pet_trainer
5. pet_walker
6. pet_cafe
7. pet_resort
8. pet_boarding
9. nutritionist
10. pet_pharmacy
11. diagnostic_lab
12. ambulance_service
13. insurance_provider
14. pet_store
15. behaviorist
16. pet_photographer
17. pet_sitter
18. pet_transporter
19. pet_grooming_center
20. veterinary_clinic

## Troubleshooting

### Common Issues

1. **Network Errors**
   - Check API base URL configuration
   - Verify Supabase project ID
   - Check network connectivity

2. **Authentication Errors**
   - Verify public anon key
   - Check API endpoint permissions
   - Ensure CORS is configured

3. **Timeout Errors**
   - Increase timeout in test config
   - Check API response times
   - Verify server is running

4. **Missing Endpoints**
   - Check endpoint registration
   - Verify route paths
   - Check server logs

## Next Steps

1. **Run Tests**: Execute the test suite
2. **Review Results**: Check the generated report
3. **Fix Issues**: Address any failures
4. **Re-run Tests**: Verify fixes
5. **Document Findings**: Update test documentation

## Continuous Testing

For continuous integration:
1. Add test execution to CI/CD pipeline
2. Run tests on every deployment
3. Monitor test results
4. Alert on failures
5. Track test coverage

