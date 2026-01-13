# WARMPAWZ UI END-TO-END TESTING FRAMEWORK

## Overview

This framework provides comprehensive end-to-end testing for the Warmpawz platform with:

- ✅ **Real UI-driven actions** (no mocks)
- ✅ **Real API calls** to actual endpoints
- ✅ **Real DB state validation**
- ✅ **Real event verification** (SNS, EventBridge)
- ✅ **Real timing delays** (human-like behavior)
- ✅ **Real error simulation**

## Test Coverage

- **200+ Admin Tests** - Vendor management, finance, marketing, e-commerce
- **200+ Customer Tests** - Search, booking, payments, tracking
- **300+ Vendor Tests** - All vendor types, onboarding, services, bookings

## Structure

```
tests/ui-e2e/
├── test-execution-engine.ts    # Core test execution engine
├── test-runner.ts               # Main test runner
├── test-scenarios/
│   ├── admin-tests.ts          # Admin test scenarios
│   ├── customer-tests.ts       # Customer test scenarios
│   └── vendor-tests.ts         # Vendor test scenarios
└── README.md                    # This file
```

## Running Tests

### Prerequisites

1. Set environment variables:
```bash
export API_BASE_URL=https://api.warmpawz.com
export DB_CONNECTION_STRING=postgresql://...
export EVENT_BRIDGE_BUS=warmpawz-events
export SNS_TOPIC_ARN=arn:aws:sns:...
```

2. Install dependencies:
```bash
npm install
```

### Execute All Tests

```bash
npm run test:ui-e2e
```

Or directly:
```bash
ts-node tests/ui-e2e/test-runner.ts
```

### Execute Specific Test Suite

```typescript
import { TestExecutionEngine } from './test-execution-engine';
import { adminTests } from './test-scenarios/admin-tests';

const engine = new TestExecutionEngine();
await engine.executeTest(adminTests[0]);
```

## Test Results

Results are saved to:
- `./test-results/ui-e2e/` - Individual test results
- `./test-results/reports/` - Certification reports

## Certification Report

After execution, a comprehensive certification report is generated including:

- Executive summary
- Coverage metrics (screens, handlers, validations)
- Test category breakdown
- Failed tests & blockers
- Issue ledger
- Certification declaration

## Adding New Tests

1. Create test scenario in appropriate file (`admin-tests.ts`, `customer-tests.ts`, or `vendor-tests.ts`)
2. Follow the `UITest` interface structure
3. Include all validations (API, DB, Events, UI)
4. Add preconditions if test depends on others
5. Run tests to verify

Example:

```typescript
{
  id: 'test-001',
  name: 'Test Name',
  description: 'Test description',
  role: 'admin',
  screen: 'screen-name',
  component: 'ComponentName',
  element: 'elementName',
  action: 'click',
  category: 'functional',
  priority: 'high',
  preconditions: [],
  steps: [
    { id: 's1', action: 'navigate', target: '/path' },
    { id: 's2', action: 'click', target: 'button' },
  ],
  apiValidations: [
    {
      endpoint: '/api/endpoint',
      method: 'POST',
      expectedStatus: 200,
    },
  ],
  dbValidations: [],
  eventValidations: [],
  expectedResults: [
    { uiState: 'expected.state' },
  ],
  tags: ['tag1', 'tag2'],
}
```

## Notes

- Tests execute in parallel when possible (respecting dependencies)
- Failed tests are automatically retried (configurable)
- All API calls are real (no mocks)
- All DB validations query actual database
- All events are verified from real event sources
