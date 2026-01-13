# WARMPAWZ SYSTEM RELIABILITY TEST SUITE

## Overview

This is a comprehensive 100-test suite designed to validate the Warmpawz Ecosystem across all service types, vendors, financial rules, and edge conditions. The suite is **NON-NEGOTIABLE** and **BLOCKS UAT** until all 100 tests pass.

## Test Categories

### Category A: Tax & Financial Complexity (20 Tests)
- Multiple tax slabs (central + state)
- Tax-exempt services
- Mixed taxable & non-taxable add-ons
- Wallet + Razorpay + partial refund
- Package cancellation mid-way
- Tax recalculation after reschedule
- Vendor-specific tax overrides
- Cross-border tax edge cases

### Category B: Refund, Cancellation & Policy Engine (15 Tests)
- Time-based refund thresholds
- Vendor override vs platform policy
- Partial service delivery
- No-show penalties
- Multi-session package refund
- Subscription pause vs cancel
- Admin override scenarios

### Category C: Video Calling & Tele Services (10 Tests)
- Instant tele-consult assignment
- Delayed staff join
- Call drop & reconnection
- Vendor joins late
- Customer joins from two devices
- Recording permission mismatch
- Tele + prescription flow
- Tele session cancellation after start

### Category D: Home Services & Map Tracking (15 Tests)
- Distance threshold breach
- Staff running late
- GPS spoof / signal loss
- Buffer time violation
- Overlapping bookings
- Staff multi-service capability conflict
- Commute time recalculation
- Live tracking permission revoke

### Category E: Pet Cafe Booking (10 Tests)
- Concurrent table booking
- Pet policy violation
- Overbooking prevention
- Time slot overlap
- Group booking cancellation
- Menu pre-order + cancellation
- Peak-hour pricing rules
- Multi-pet restriction enforcement

### Category F: Insurance Lifecycle (10 Tests)
- Policy purchase with missing docs
- Doc upload after payment
- Claim filing before waiting period
- Partial claim approval
- Claim rejection & appeal
- Multi-pet insurance
- Policy cancellation & refund
- Policy renewal with price change

### Category G: Dynamic Vendor Dashboard & Capabilities (10 Tests)
- Role change post-approval
- Tier upgrade mid-cycle
- Capability enable/disable
- Feature visibility mismatch
- Solo → Business conversion
- Staff permission escalation attempt
- Capability conflict across services

### Category H: Cross-Journey Conflicts (10 Tests)
- Vendor running home + tele simultaneously
- Same staff assigned to two services
- Package + one-time overlap
- Wallet negative balance attempt
- Booking during maintenance window
- Admin config change mid-booking

## File Structure

```
tests/system-reliability/
├── test-registry.ts              # Test registry and issue tracking
├── test-framework.ts             # Test execution framework
├── test-executor.ts              # Main test orchestrator
├── report-generator.ts           # Comprehensive report generator
├── run-tests.ts                  # CLI entry point
├── index.ts                      # Module exports
├── test-definitions-category-a.ts # Category A tests (T-001 to T-020)
├── test-definitions-category-b.ts # Category B tests (T-021 to T-035)
├── test-definitions-category-c.ts # Category C tests (T-036 to T-045)
├── test-definitions-category-d.ts # Category D tests (T-046 to T-060)
├── test-definitions-category-e.ts # Category E tests (T-061 to T-070)
├── test-definitions-category-f.ts # Category F tests (T-071 to T-080)
├── test-definitions-category-g.ts # Category G tests (T-081 to T-090)
├── test-definitions-category-h.ts # Category H tests (T-091 to T-100)
└── README.md                     # This file
```

## Prerequisites

1. **Running API Server**: The Warmpawz API must be running and accessible
2. **Database Access**: RDS PostgreSQL database must be accessible
3. **Environment Variables**:
   - `API_ENDPOINT`: Base URL of the API (default: http://localhost:3000)
   - `DB_HOST`: Database host
   - `DB_NAME`: Database name
   - `DB_USER`: Database user (or `DB_SECRET_ARN` for AWS Secrets Manager)
   - `DB_PASSWORD`: Database password (or `DB_SECRET_ARN` for AWS Secrets Manager)

## Execution

### Run All Tests

```bash
cd tests/system-reliability
npm run test:reliability
# or
ts-node run-tests.ts
```

### Run by Category

```typescript
import { TestExecutor } from './test-executor';

const executor = new TestExecutor();
executor.registerAllTests();
await executor.executeCategory('A'); // Tax & Financial
await executor.executeCategory('B'); // Refund & Policy
// ... etc
```

### Execute Until All Pass

The test executor will automatically:
1. Execute all 100 tests
2. Identify failures
3. Log issues
4. Re-run failed tests after fixes
5. Continue until all pass (max 10 iterations)

```typescript
const executor = new TestExecutor();
executor.registerAllTests();
await executor.executeUntilAllPass(10);
```

## Test Execution Flow

1. **Precondition Setup**: Creates test data (customers, vendors, services, etc.)
2. **Step Execution**: Executes API calls in sequence
3. **Validation**: Validates outcomes against expected results
4. **Issue Tracking**: Logs failures with issue IDs
5. **Fix Application**: Records fixes applied
6. **Re-run**: Re-executes failed tests after fixes
7. **Report Generation**: Creates comprehensive report

## Issue Tracking

Each failed test generates an issue with:
- **Issue ID**: Unique identifier (ISSUE-001, ISSUE-002, etc.)
- **Severity**: CRITICAL, HIGH, MEDIUM, or LOW
- **Description**: Detailed failure description
- **Root Cause**: Identified root cause (after analysis)
- **Fix Applied**: Description of fix applied
- **Fix Verified**: Boolean indicating if fix resolved the issue

## Report Generation

The report generator creates a comprehensive markdown report including:

1. **Executive Summary**: Overall test statistics
2. **Test Registry**: Complete list of all 100 tests with status
3. **Issue Summary**: All identified issues
4. **Detailed Issue Information**: Root causes and fixes
5. **Fix References**: Links between tests and fixes
6. **Re-run Confirmations**: Verification of fixes
7. **Final Verdict**: UAT readiness assessment

Report is saved to: `WARMPAWZ_ADVANCED_SYSTEM_RELIABILITY_REPORT.md`

## Test Philosophy

These tests are designed to:
- ✅ Execute **real APIs** (no mocks)
- ✅ Apply **real tax & policy rules**
- ✅ Trigger **real failures**
- ✅ Log **all issues**
- ✅ Fix **root causes**
- ✅ Re-run **until all pass**

## Enforcement Rules

- ❌ Do NOT simplify rules
- ❌ Do NOT mock scenarios
- ❌ Do NOT skip failed tests
- ❌ Do NOT disable validations
- ✅ ONLY fix root causes
- ✅ ONLY mark PASS when clean
- ✅ ONLY complete when 100/100 PASS

## Completion Criteria

The task is **COMPLETE ONLY WHEN**:
- ✅ 100/100 tests PASS
- ✅ No open issues
- ✅ No inconsistent states
- ✅ No financial mismatch
- ✅ No UI/API drift
- ✅ All complex rules enforced correctly

## Final Output

The final report will show:
- **Final Score**: 100 / 100 PASS
- **Verdict**: SYSTEM IS ENTERPRISE-GRADE & UAT-READY

---

**Status**: Test suite designed and ready for execution
**Next Step**: Execute tests against running system and fix all issues until 100/100 PASS
