# Warmpawz Contract & Integration Tests Report

**Date:** 2026-01-20 22:15:18
**Test Type:** all
**Duration:** 3 seconds

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | 94 |
| Passed | 92 |
| Failed | 0 |
| Skipped | 2 |
| Pass Rate | 90.0% |

## Test Categories

### 1. Database Schema Validation
- Table existence and structure
- Column definitions and types
- Foreign key relationships
- Constraint validations

### 2. API Contract Validation
- Request/Response schema verification
- Required field validation
- Data type enforcement
- Error response structure

### 3. Parameter Tracing
- DB column → API field mapping
- API request → DB insertion
- Frontend form → API request
- Consistent field naming (snake_case ↔ camelCase)

### 4. Business Flow Integration
- Vendor onboarding (Center & Solo)
- Service configuration
- Customer booking (Center, Home, Tele)
- Order/Delivery flows
- Problem grid navigation

### 5. Payment Rules Validation
- GST/Tax calculations
- Platform fees and convenience charges
- Logistics and delivery charges
- Discounts and promotions
- Wallet balance usage
- Refund and cancellation policies
- Subscription and package tracking
- Tier commission system

## Test Results Details


Running 94 tests using 4 workers

(node:80121) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:80122) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:80123) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:80124) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:80123) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:80124) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:80121) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:80122) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
Warning: No roles found in database. Run role seeding endpoint to populate.
  -   3 [contract-tests] › specs/contract-tests/business-flow-integration.spec.ts:154:9 › Vendor Onboarding Complete Flow › Center Vendor Onboarding (Vet) › Step 3: Select role persists to database
  ✓   2 [contract-tests] › specs/contract-tests/business-flow-integration.spec.ts:106:9 › Vendor Onboarding Complete Flow › Center Vendor Onboarding (Vet) › Step 2: Load available roles dynamically (163ms)
  ✓   4 [contract-tests] › specs/contract-tests/business-flow-integration.spec.ts:56:9 › Vendor Onboarding Complete Flow › Center Vendor Onboarding (Vet) › Step 1: Initialize vendor identity with phone (158ms)
  ✓   1 [contract-tests] › specs/contract-tests/business-flow-integration.spec.ts:215:9 › Vendor Onboarding Complete Flow › Center Vendor Onboarding (Vet) › Step 4: Select vendor type (center) persists correctly (241ms)
  ✓   5 [contract-tests] › specs/contract-tests/business-flow-integration.spec.ts:314:9 › Vendor Onboarding Complete Flow › Center Vendor Onboarding (Vet) › Step 6: Submit application persists all data (57ms)
  ✓   6 [contract-tests] › specs/contract-tests/business-flow-integration.spec.ts:367:9 › Vendor Onboarding Complete Flow › Solo Vendor Onboarding (Walker) › Solo vendor flow initializes correctly (57ms)
  -   8 [contract-tests] › specs/contract-tests/business-flow-integration.spec.ts:378:9 › Vendor Onboarding Complete Flow › Solo Vendor Onboarding (Walker) › Walker role has GPS tracking field in form
  ✓   7 [contract-tests] › specs/contract-tests/business-flow-integration.spec.ts:254:9 › Vendor Onboarding Complete Flow › Center Vendor Onboarding (Vet) › Step 5: Dynamic form schema loads for role (108ms)
  ✓   9 [contract-tests] › specs/contract-tests/business-flow-integration.spec.ts:430:9 › Service Configuration Flow › Vendor Service Management › Get service catalog for role (51ms)
  ✓  10 [contract-tests] › specs/contract-tests/business-flow-integration.spec.ts:444:9 › Service Configuration Flow › Vendor Service Management › Vendor services include role and capabilities (51ms)
  ✓  11 [contract-tests] › specs/contract-tests/business-flow-integration.spec.ts:473:9 › Service Configuration Flow › Vendor Service Management › Service styles are validated against role config (51ms)
  ✓  12 [contract-tests] › specs/contract-tests/business-flow-integration.spec.ts:491:9 › Service Configuration Flow › Vendor Service Management › Custom service creation requires approval (48ms)
  ✓  13 [contract-tests] › specs/contract-tests/business-flow-integration.spec.ts:530:9 › Customer Booking Complete Flow › Center Service Booking (Vet) › Service discovery returns providers with profile data (48ms)
  ✓  14 [contract-tests] › specs/contract-tests/business-flow-integration.spec.ts:552:9 › Customer Booking Complete Flow › Center Service Booking (Vet) › Booking creation validates all required fields (52ms)
  ✓  15 [contract-tests] › specs/contract-tests/business-flow-integration.spec.ts:581:9 › Customer Booking Complete Flow › Center Service Booking (Vet) › Slot availability check prevents double booking (54ms)
  ✓  16 [contract-tests] › specs/contract-tests/business-flow-integration.spec.ts:631:9 › Customer Booking Complete Flow › Home Service Booking › Home service booking includes address validation (52ms)
  ✓  17 [contract-tests] › specs/contract-tests/business-flow-integration.spec.ts:666:9 › Customer Booking Complete Flow › Home Service Booking › GPS tracking is enabled for home services (44ms)
  ✓  18 [contract-tests] › specs/contract-tests/business-flow-integration.spec.ts:682:9 › Customer Booking Complete Flow › Tele Consultation Booking › Tele booking returns video call details (54ms)
  ✓  19 [contract-tests] › specs/contract-tests/business-flow-integration.spec.ts:712:9 › Customer Booking Complete Flow › Tele Consultation Booking › Instant tele queue is functional (46ms)
  ✓  20 [contract-tests] › specs/contract-tests/business-flow-integration.spec.ts:738:9 › Order/Delivery Complete Flow › Pharmacy Order Flow › Pharmacy order broadcast to nearby pharmacies (45ms)
  ✓  21 [contract-tests] › specs/contract-tests/business-flow-integration.spec.ts:766:9 › Order/Delivery Complete Flow › Pharmacy Order Flow › Order tracking updates flow correctly (46ms)
  ✓  22 [contract-tests] › specs/contract-tests/business-flow-integration.spec.ts:781:9 › Order/Delivery Complete Flow › Meal Plan Order Flow › Meal plans list with delivery info (44ms)
  ✓  23 [contract-tests] › specs/contract-tests/business-flow-integration.spec.ts:804:7 › Prescription and Medical Records Flow › Prescription creation includes all required fields (50ms)
  ✓  25 [contract-tests] › specs/contract-tests/business-flow-integration.spec.ts:864:7 › Problem Grid Flow › Problem grid loads for all service types (42ms)
  ✓  24 [contract-tests] › specs/contract-tests/business-flow-integration.spec.ts:850:7 › Prescription and Medical Records Flow › Medical records are accessible for pet (48ms)
  ✓  26 [contract-tests] › specs/contract-tests/business-flow-integration.spec.ts:884:7 › Problem Grid Flow › Problem grid filters to correct service providers (47ms)
  ✓  27 [contract-tests] › specs/contract-tests/parameter-tracing.spec.ts:208:7 › Parameter Tracing: Vendor Onboarding Flow › Role selection parameters flow correctly through system (48ms)
  ✓  28 [contract-tests] › specs/contract-tests/parameter-tracing.spec.ts:235:7 › Parameter Tracing: Vendor Onboarding Flow › Onboarding status response maps DB fields correctly (52ms)
  ✓  30 [contract-tests] › specs/contract-tests/parameter-tracing.spec.ts:315:7 › Parameter Tracing: Service Management Flow › Vendor services API response maps DB fields correctly (49ms)
  ✓  29 [contract-tests] › specs/contract-tests/parameter-tracing.spec.ts:271:7 › Parameter Tracing: Vendor Onboarding Flow › Form schema response maps role config correctly (67ms)
  ✓  31 [contract-tests] › specs/contract-tests/parameter-tracing.spec.ts:372:7 › Parameter Tracing: Service Management Flow › Service catalog maps role-based services correctly (46ms)
  ✓  34 [contract-tests] › specs/contract-tests/parameter-tracing.spec.ts:469:7 › Parameter Tracing: Booking Flow › Booking status update preserves parameter integrity (49ms)
  ✓  33 [contract-tests] › specs/contract-tests/parameter-tracing.spec.ts:431:7 › Parameter Tracing: Booking Flow › Booking creation validates all parameter types (58ms)
  ✓  35 [contract-tests] › specs/contract-tests/parameter-tracing.spec.ts:500:7 › Parameter Tracing: Booking Flow › Booking details endpoint returns complete mapped data (67ms)
  ✓  32 [contract-tests] › specs/contract-tests/parameter-tracing.spec.ts:394:7 › Parameter Tracing: Service Management Flow › Add service from catalog preserves all parameters (109ms)
  ✓  37 [contract-tests] › specs/contract-tests/parameter-tracing.spec.ts:558:7 › Parameter Tracing: Payment Flow › Tax calculation parameters are correctly applied (47ms)
  ✓  36 [contract-tests] › specs/contract-tests/parameter-tracing.spec.ts:529:7 › Parameter Tracing: Payment Flow › Payment creation maps all required fields (57ms)
  ✓  38 [contract-tests] › specs/contract-tests/parameter-tracing.spec.ts:582:7 › Parameter Tracing: Order/Delivery Flow › Pharmacy order parameters map correctly (48ms)
  ✓  39 [contract-tests] › specs/contract-tests/parameter-tracing.spec.ts:609:7 › Parameter Tracing: Order/Delivery Flow › Meal plan order parameters map correctly (48ms)
  ✓  40 [contract-tests] › specs/contract-tests/parameter-tracing.spec.ts:636:7 › Parameter Tracing: Order/Delivery Flow › Logistics delivery parameters flow correctly (48ms)
  ✓  42 [contract-tests] › specs/contract-tests/parameter-tracing.spec.ts:696:7 › Field Name Consistency Validation › Error responses have consistent structure (47ms)
  ✓  43 [contract-tests] › specs/contract-tests/payment-rules-validation.spec.ts:64:7 › GST and Tax Calculation Rules › GST is calculated correctly on service bookings (57ms)
  ✓  41 [contract-tests] › specs/contract-tests/parameter-tracing.spec.ts:658:7 › Field Name Consistency Validation › API responses use consistent casing convention (93ms)
  ✓  44 [contract-tests] › specs/contract-tests/payment-rules-validation.spec.ts:97:7 › GST and Tax Calculation Rules › GST breakdown is included in payment response (48ms)
  ✓  45 [contract-tests] › specs/contract-tests/payment-rules-validation.spec.ts:123:7 › GST and Tax Calculation Rules › Medicine orders have 0% GST applied (53ms)
  ✓  47 [contract-tests] › specs/contract-tests/payment-rules-validation.spec.ts:178:7 › Platform Fee and Convenience Charges › Convenience fee is applied for COD payments (52ms)
  ✓  48 [contract-tests] › specs/contract-tests/payment-rules-validation.spec.ts:202:7 › Platform Fee and Convenience Charges › Online payments have no convenience fee (48ms)
  ✓  51 [contract-tests] › specs/contract-tests/payment-rules-validation.spec.ts:281:7 › Logistics and Delivery Rules › Pharmacy broadcast follows radius expansion rules (47ms)
  ✓  50 [contract-tests] › specs/contract-tests/payment-rules-validation.spec.ts:259:7 › Logistics and Delivery Rules › Free delivery for orders above threshold (49ms)
  ✓  52 [contract-tests] › specs/contract-tests/payment-rules-validation.spec.ts:299:7 › Logistics and Delivery Rules › Hyperlocal delivery radius is enforced (46ms)
  ✓  53 [contract-tests] › specs/contract-tests/payment-rules-validation.spec.ts:325:7 › Discounts and Promotions › Vendor discount is applied directly to service price (47ms)
  ✓  46 [contract-tests] › specs/contract-tests/payment-rules-validation.spec.ts:150:7 › Platform Fee and Convenience Charges › Platform fee is calculated within bounds (224ms)
  ✓  54 [contract-tests] › specs/contract-tests/payment-rules-validation.spec.ts:352:7 › Discounts and Promotions › Platform discount is applied at payment page (47ms)
  ✓  55 [contract-tests] › specs/contract-tests/payment-rules-validation.spec.ts:376:7 › Discounts and Promotions › Coupon validation returns clear error for invalid codes (47ms)
  ✓  49 [contract-tests] › specs/contract-tests/payment-rules-validation.spec.ts:229:7 › Logistics and Delivery Rules › Delivery charges are calculated based on distance (180ms)
  ✓  56 [contract-tests] › specs/contract-tests/payment-rules-validation.spec.ts:396:7 › Discounts and Promotions › Buy X Get Y promotions work correctly (45ms)
  ✓  57 [contract-tests] › specs/contract-tests/payment-rules-validation.spec.ts:421:7 › Wallet Balance Usage › Wallet balance can be used for payment (43ms)
  ✓  58 [contract-tests] › specs/contract-tests/payment-rules-validation.spec.ts:448:7 › Wallet Balance Usage › Wallet balance is capped at order total (50ms)
  ✓  59 [contract-tests] › specs/contract-tests/payment-rules-validation.spec.ts:468:7 › Refund and Cancellation Policies › Cancellation policy returns time-based rules (53ms)
  ✓  60 [contract-tests] › specs/contract-tests/payment-rules-validation.spec.ts:494:7 › Refund and Cancellation Policies › Refund calculation follows policy rules (46ms)
  ✓  61 [contract-tests] › specs/contract-tests/payment-rules-validation.spec.ts:518:7 › Refund and Cancellation Policies › Rescheduling policy is distinct from cancellation (48ms)
  ✓  63 [contract-tests] › specs/contract-tests/payment-rules-validation.spec.ts:563:7 › Subscription and Package Tracking › Package sessions are tracked correctly (44ms)
  ✓  62 [contract-tests] › specs/contract-tests/payment-rules-validation.spec.ts:539:7 › Subscription and Package Tracking › Active subscription bypasses payment for booking (50ms)
  ✓  64 [contract-tests] › specs/contract-tests/payment-rules-validation.spec.ts:585:7 › Subscription and Package Tracking › Package expiry is enforced (50ms)
  ✓  65 [contract-tests] › specs/contract-tests/payment-rules-validation.spec.ts:606:7 › Tier Commission System › Vendor tier determines commission rate (49ms)
  ✓  66 [contract-tests] › specs/contract-tests/payment-rules-validation.spec.ts:630:7 › Tier Commission System › Settlement calculation applies tier commission (45ms)
  ✓  67 [contract-tests] › specs/contract-tests/payment-rules-validation.spec.ts:658:7 › Universal Payment Page Validation › Payment page calculates all components correctly (44ms)
  ✓  69 [contract-tests] › specs/contract-tests/schema-validation.spec.ts:189:9 › Database Schema Validation › Core Vendor Tables › vendor_onboarding_applications table supports all required statuses (49ms)
  ✓  70 [contract-tests] › specs/contract-tests/schema-validation.spec.ts:208:9 › Database Schema Validation › Core Vendor Tables › vendors table foreign key to roles exists (69ms)
  ✓  71 [contract-tests] › specs/contract-tests/schema-validation.spec.ts:232:9 › Database Schema Validation › Service Management Tables › service_catalog returns properly structured data (67ms)
  ✓  68 [contract-tests] › specs/contract-tests/schema-validation.spec.ts:162:9 › Database Schema Validation › Core Vendor Tables › vendor_identity table has correct structure (92ms)
  ✓  72 [contract-tests] › specs/contract-tests/schema-validation.spec.ts:251:9 › Database Schema Validation › Service Management Tables › vendor_services table supports all service styles (55ms)
  ✓  74 [contract-tests] › specs/contract-tests/schema-validation.spec.ts:287:9 › Database Schema Validation › Booking and Payment Tables › payments table supports all payment methods (55ms)
  ✓  73 [contract-tests] › specs/contract-tests/schema-validation.spec.ts:270:9 › Database Schema Validation › Booking and Payment Tables › bookings table supports all required status values (70ms)
  ✓  75 [contract-tests] › specs/contract-tests/schema-validation.spec.ts:301:9 › Database Schema Validation › Booking and Payment Tables › payments table supports all payment statuses (63ms)
  ✓  76 [contract-tests] › specs/contract-tests/schema-validation.spec.ts:317:9 › Database Schema Validation › Role-Specific Capability Tables › meal_plans table exists for nutritionist role (50ms)
  ✓  77 [contract-tests] › specs/contract-tests/schema-validation.spec.ts:326:9 › Database Schema Validation › Role-Specific Capability Tables › diagnostic_tests table exists for diagnostics role (51ms)
  ✓  78 [contract-tests] › specs/contract-tests/schema-validation.spec.ts:334:9 › Database Schema Validation › Role-Specific Capability Tables › training_programs table exists for trainer role (55ms)
  ✓  79 [contract-tests] › specs/contract-tests/schema-validation.spec.ts:347:9 › API Schema Contract Validation › Vendor Onboarding API Contracts › GET /vendor/onboarding/status returns expected schema (58ms)
  ✓  80 [contract-tests] › specs/contract-tests/schema-validation.spec.ts:369:9 › API Schema Contract Validation › Vendor Onboarding API Contracts › GET /vendor/onboarding/roles returns expected schema (60ms)
  ✓  81 [contract-tests] › specs/contract-tests/schema-validation.spec.ts:395:9 › API Schema Contract Validation › Vendor Onboarding API Contracts › POST /vendor/onboarding/select-role validates required fields (48ms)
  ✓  82 [contract-tests] › specs/contract-tests/schema-validation.spec.ts:414:9 › API Schema Contract Validation › Vendor Onboarding API Contracts › POST /vendor/onboarding/submit-application validates phone format (52ms)
  ✓  83 [contract-tests] › specs/contract-tests/schema-validation.spec.ts:433:9 › API Schema Contract Validation › Vendor Services API Contracts › GET /vendor/:vendorId/services returns expected schema (63ms)
  ✓  84 [contract-tests] › specs/contract-tests/schema-validation.spec.ts:452:9 › API Schema Contract Validation › Vendor Services API Contracts › POST /vendor/:vendorId/services validates required fields (55ms)
  ✓  85 [contract-tests] › specs/contract-tests/schema-validation.spec.ts:469:9 › API Schema Contract Validation › Vendor Services API Contracts › PUT /vendor/:vendorId/services/:serviceId validates update fields (58ms)
  ✓  86 [contract-tests] › specs/contract-tests/schema-validation.spec.ts:490:9 › API Schema Contract Validation › Booking API Contracts › POST /bookings/create validates required fields (61ms)
  ✓  87 [contract-tests] › specs/contract-tests/schema-validation.spec.ts:508:9 › API Schema Contract Validation › Booking API Contracts › POST /bookings/create validates booking date/time format (57ms)
  ✓  88 [contract-tests] › specs/contract-tests/schema-validation.spec.ts:528:9 › API Schema Contract Validation › Booking API Contracts › PUT /bookings/:bookingId/status validates status transitions (53ms)
  ✓  89 [contract-tests] › specs/contract-tests/schema-validation.spec.ts:548:9 › API Schema Contract Validation › Payment API Contracts › POST /payments/create-order validates required fields (99ms)
  ✓  90 [contract-tests] › specs/contract-tests/schema-validation.spec.ts:564:9 › API Schema Contract Validation › Payment API Contracts › POST /payments/verify validates signature format (57ms)
  ✓  94 [contract-tests] › specs/contract-tests/schema-validation.spec.ts:632:7 › Data Type Validation › Date/Time format validation (21ms)
  ✓  92 [contract-tests] › specs/contract-tests/schema-validation.spec.ts:586:7 › Data Type Validation › UUID format validation across endpoints (82ms)
  ✓  93 [contract-tests] › specs/contract-tests/schema-validation.spec.ts:618:7 › Data Type Validation › Price format validation (decimal handling) (58ms)
  ✓  91 [contract-tests] › specs/contract-tests/schema-validation.spec.ts:601:7 › Data Type Validation › Phone number format validation (166ms)

  2 skipped
  92 passed (2.6s)

---

*Generated by Warmpawz Contract Tests Runner*
