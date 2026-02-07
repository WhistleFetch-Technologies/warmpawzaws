# Capabilities Testing Suite

This directory contains test scripts for verifying capability-role alignment and business objective achievement.

## Files

- `test-capability-role-alignment.ts` - Tests role-capability assignments
- `test-capability-enforcement.ts` - Tests API endpoint enforcement
- `analyze-capability-alignment.ts` - Analyzes alignment and generates reports
- **`forensic-role-permissions-vendor-login.test.ts`** - Forensic test: role permissions (admin Catalog & Service / roles) must match what vendor gets at login (profile/dashboard). Ensures no capability at vendor that isn’t in role config; allows solo-added caps (platform_catalog_services, professional_profile).
- `run-capability-tests.sh` - Shell script for test execution
- `README.md` - This file

## Quick Start

### Prerequisites

- Node.js installed
- TypeScript available (via npx or installed globally)
- Database access (for automated tests)
- API endpoint accessible (for enforcement tests)

### Running Tests

```bash
# Run all tests
./run-capability-tests.sh

# Run individual test scripts
npx ts-node test-capability-role-alignment.ts
npx ts-node test-capability-enforcement.ts
npx ts-node analyze-capability-alignment.ts

# Forensic: role permissions = vendor login capabilities (requires API_BASE_URL; optional TEST_VENDOR_IDS and AUTH_HEADER)
API_BASE_URL=https://your-api.example.com npx ts-node forensic-role-permissions-vendor-login.test.ts
API_BASE_URL=https://your-api.example.com TEST_VENDOR_IDS=uuid1,uuid2 AUTH_HEADER="Bearer ..." npx ts-node forensic-role-permissions-vendor-login.test.ts
```

## Test Output

Test results are saved to `../../test-reports/` directory with timestamps.

## Documentation

See `CAPABILITIES_TESTING_NEXT_STEPS.md` in project root for detailed execution plan.
