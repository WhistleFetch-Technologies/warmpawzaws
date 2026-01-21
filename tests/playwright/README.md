# Warmpawz Playwright E2E Tests

Comprehensive end-to-end tests for all Warmpawz applications using Playwright.

## Test Coverage

| App | Tests | Description |
|-----|-------|-------------|
| **Admin Portal** | 20 tests | Authentication, Analytics, Vendors, Finance, Problem Grid, Reports, Subscriptions |
| **Customer App** | 23 tests | Authentication, Home, Services, Search, Bookings, Pets, Wallet, Shop, Orders |
| **Vendor Portal** | 26 tests | Authentication, Onboarding, Dashboard, Services, Bookings, Staff, Analytics |
| **API** | 24 tests | Health, Roles, Services, Customer, Admin, Vendor, Error Handling, Performance |

**Total: 93 tests**

## Quick Start

```bash
# Navigate to test directory
cd tests/playwright

# Install dependencies
npm install

# Run all tests
npm test

# Run specific project
npm run test:admin
npm run test:customer
npm run test:vendor
npm run test:api
```

## Available Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests |
| `npm run test:admin` | Run Admin Portal tests |
| `npm run test:customer` | Run Customer App tests |
| `npm run test:vendor` | Run Vendor Portal tests |
| `npm run test:api` | Run API tests |
| `npm run test:headed` | Run tests in headed mode (visible browser) |
| `npm run test:debug` | Run tests in debug mode |
| `npm run test:ui` | Open Playwright UI |
| `npm run report` | View HTML report |

## Test Environment

Tests run against deployed CloudFront URLs by default:

| App | URL |
|-----|-----|
| Admin | https://dfof7mguaa0a5.cloudfront.net |
| Customer | https://d2aoyjj8ine0wk.cloudfront.net |
| Vendor | https://d1s6ykkj381k58.cloudfront.net |
| API | https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com |

### Custom URLs

Override URLs with environment variables:

```bash
ADMIN_URL=http://localhost:3003 npm run test:admin
CUSTOMER_URL=http://localhost:3001 npm run test:customer
VENDOR_URL=http://localhost:3002 npm run test:vendor
API_URL=http://localhost:3000 npm run test:api
```

## Test Structure

```
tests/playwright/
├── playwright.config.ts   # Playwright configuration
├── package.json           # Dependencies and scripts
├── specs/
│   ├── admin.spec.ts      # Admin Portal tests
│   ├── customer.spec.ts   # Customer App tests
│   ├── vendor.spec.ts     # Vendor Portal tests
│   └── api.spec.ts        # API tests
├── test-results/          # Test artifacts
│   ├── html-report/       # HTML report
│   ├── results.json       # JSON results
│   └── artifacts/         # Screenshots, videos
└── README.md              # This file
```

## Test Categories

### Admin Portal Tests
- **Authentication**: Login page, UAT credentials
- **Analytics Dashboard**: GMV, commission stats, tabs
- **Vendor Management**: Vendor list, empty states
- **Finance & Policies**: Policy tabs, GST configuration
- **Problem Grid**: Categories, add/edit items
- **Reports**: Report types, filters, export options
- **Subscriptions**: Plan management
- **Navigation**: Sidebar, page navigation

### Customer App Tests
- **Authentication**: Phone input, OTP flow
- **Home Page**: Content, service categories
- **Services**: Service list, categories
- **Search**: Search functionality
- **Bookings**: Booking list, status
- **Pets**: Pet management
- **Wallet**: Balance display
- **Shop**: Products, categories
- **Orders**: Order history
- **Navigation**: Page navigation
- **Responsive**: Mobile, tablet views

### Vendor Portal Tests
- **Authentication**: Phone input, OTP flow
- **Onboarding**: Role selection
- **Dashboard**: Metrics display
- **Services**: Service management
- **Bookings**: Appointment list
- **Staff**: Staff management
- **Schedule**: Availability
- **Analytics**: Earnings, metrics
- **Profile**: Profile information
- **Settings**: Configuration options
- **Navigation**: Page navigation
- **Responsive**: Mobile, tablet views

### API Tests
- **Health Check**: Database connectivity
- **Roles & Config**: Roles, regions, capabilities
- **Vendor Onboarding**: Roles, status
- **Services**: Service list, catalog
- **Customer Endpoints**: Vendor search, problem grid
- **Admin Endpoints**: Vendors, customers, bookings, analytics
- **Vendor Endpoints**: Dashboard, services
- **Error Handling**: 404, malformed requests
- **Performance**: Response times

## Running from Project Root

Use the provided script:

```bash
./scripts/run-playwright-tests.sh all     # Run all tests
./scripts/run-playwright-tests.sh admin   # Run admin tests
./scripts/run-playwright-tests.sh customer # Run customer tests
./scripts/run-playwright-tests.sh vendor  # Run vendor tests
./scripts/run-playwright-tests.sh api     # Run API tests
```

## CI/CD Integration

Add to your GitHub Actions workflow:

```yaml
- name: Install Playwright
  run: cd tests/playwright && npm install && npx playwright install chromium

- name: Run Playwright Tests
  run: cd tests/playwright && npm test
```

## Viewing Reports

After running tests:

```bash
# View HTML report
npm run report

# Or open directly
open test-results/html-report/index.html
```

## Troubleshooting

### Browser not installed
```bash
npx playwright install chromium
```

### Tests timing out
Increase timeout in `playwright.config.ts`:
```typescript
use: {
  actionTimeout: 30000,
  navigationTimeout: 60000,
}
```

### CORS issues
Tests run in a browser context, so CORS headers must be configured on the API.

## Last Test Run

**Date:** January 20, 2026  
**Result:** 92 passed, 1 skipped  
**Duration:** 1.5 minutes
