# 🧪 TESTING PROCESS & USER ROLES

**Date:** 2025-01-13  
**Framework:** WARMPAWZ UI E2E Testing

---

## 👥 USER ROLES USED IN TESTING

### 1. **Admin Role** (`role: 'admin'`)
- **Purpose:** Test admin panel functionality
- **Authentication:** UAT Mode with `uat-token-admin-test`
- **Tests:** 180 admin tests
- **Scenarios:**
  - Vendor management (approve, reject, view)
  - Finance management (refund policies, cancellation, GST, commissions)
  - Marketing (promotions, coupons, spotlights)
  - Analytics and reporting
  - Settings and configuration

### 2. **Customer Role** (`role: 'customer'`)
- **Purpose:** Test customer-facing features
- **Authentication:** UAT Mode with customer token
- **Tests:** 125 customer tests
- **Scenarios:**
  - Search and discovery
  - Booking services
  - Payments and orders
  - Tracking and notifications
  - Profile management

### 3. **Vendor Role** (`role: 'vendor'`)
- **Purpose:** Test vendor dashboard and operations
- **Authentication:** UAT Mode with vendor token
- **Tests:** 586 vendor tests
- **Scenarios:**
  - Vendor onboarding
  - Service management
  - Booking management
  - GPS tracking
  - Settlements and payments
  - All vendor types (vet, grooming, walking, boarding, training)

---

## 🔐 AUTHENTICATION PROCESS

### UAT Mode (User Acceptance Testing)
```bash
UAT_MODE=true
AUTH_TOKEN=uat-token-admin-test
```

**How it works:**
1. Tests use UAT mode headers: `X-UAT-Mode: true`
2. UAT token: `uat-token-admin-test` (for admin)
3. Backend recognizes UAT mode and bypasses real authentication
4. Allows testing without real user credentials

**Headers sent:**
```javascript
{
  'X-UAT-Mode': 'true',
  'X-UAT-Token': 'uat-token-admin-test',
  'Authorization': 'Bearer uat-token-admin-test'
}
```

---

## 📋 TESTING PROCESS FOLLOWED

### Phase 1: Test Execution Flow

```
1. Load Test Scenarios
   ↓
2. Check Preconditions
   ↓
3. Execute UI Steps (with role context)
   ↓
4. Validate API Calls
   ↓
5. Validate Database State
   ↓
6. Validate Events
   ↓
7. Validate UI State
   ↓
8. Determine Pass/Fail
```

### Phase 2: Execution Strategy

**Mode:** Serial Execution with Fix-Before-Proceed

1. **Execute Tests Serially**
   - One test at a time
   - Respects preconditions (test dependencies)
   - Uses role-specific browser context

2. **Stop on Failures**
   - When test fails, execution stops
   - Error details are logged
   - Waits for fix before continuing

3. **Fix and Continue**
   - Fix the failing test
   - Re-run to verify fix
   - Continue to next test

4. **Track Progress**
   - Count passed/failed tests
   - Show currently executing test
   - Monitor in real-time

---

## 🎯 ROLE-BASED TEST EXECUTION

### How Roles Are Used

Each test specifies a role:
```typescript
{
  id: 'admin-001',
  role: 'admin',  // ← Role determines:
  // - Which browser context to use
  // - Which authentication token
  // - Which UI base URL
  // - Which API endpoints
}
```

### Browser Context Management

- **Separate browser pages per role:**
  - `admin` → Admin UI page
  - `customer` → Customer UI page  
  - `vendor` → Vendor UI page

- **Role-specific navigation:**
  - Admin: `/admin/*` routes
  - Customer: `/customer/*` or `/` routes
  - Vendor: `/vendor/*` routes

---

## 🔄 CURRENT EXECUTION PROCESS

### Step-by-Step What Happens:

1. **Test Loads**
   ```
   🧪 Executing Test: View Vendor List (admin-001)
      Role: admin | Screen: vendor-admin | Element: vendorList
   ```

2. **Preconditions Check**
   - Checks if dependent tests passed
   - If not, test is blocked until preconditions met

3. **UI Steps Execute**
   ```
   → Step: navigate on /vendor-admin
   → Step: wait on vendorList
   → Step: verify on vendorList
   ```

4. **Browser Automation**
   - Attempts real browser interaction
   - Falls back to simulation if UI unavailable
   - Uses role-specific page context

5. **API Validation**
   ```
   [API] Calling: GET /admin/vendors/all
   [API] Headers: X-UAT-Mode: true, Authorization: Bearer uat-token-admin-test
   [API] Status: 200 ✅
   ```

6. **Result Determination**
   - If API validation passes → Test PASSED
   - If API validation fails → Test FAILED (stops execution)

---

## 📊 TEST DISTRIBUTION BY ROLE

### Admin Tests (180)
- Vendor Administration: 50+
- Finance Management: 40+
- Marketing & Promotions: 30+
- Analytics: 20+
- Settings: 20+
- E-commerce: 20+

### Customer Tests (125)
- Search & Discovery: 25+
- Booking: 30+
- Payments: 20+
- Tracking: 15+
- Profile: 15+
- Orders: 20+

### Vendor Tests (586)
- Onboarding: 50+
- Service Management: 100+
- Booking Management: 150+
- GPS Tracking: 50+
- Settlements: 50+
- Specialized Features: 186+

**Total: 891 tests**

---

## 🔧 CONFIGURATION USED

### Environment Variables
```bash
# API Configuration
API_BASE_URL=https://dev.api.warmpawz.com
AUTH_TOKEN=uat-token-admin-test
UAT_MODE=true

# UI Configuration
UI_BASE_URL=http://localhost:3000
HEADLESS=true

# Feature Flags
USE_BROWSER_AUTOMATION=true
USE_REAL_API=true
USE_REAL_DB=false  # Disabled (not configured)
USE_REAL_EVENTS=false  # Disabled (not configured)
```

### Current Behavior
- ✅ **Browser Automation:** Attempts real UI, falls back to simulation
- ✅ **API Calls:** Real HTTP requests with UAT authentication
- ⏸️ **Database:** Skipped (USE_REAL_DB=false)
- ⏸️ **Events:** Skipped (USE_REAL_EVENTS=false)

---

## 🎯 TESTING METHODOLOGY

### Principles Followed

1. **Real Actions Only**
   - No mocks or stubs
   - Real API calls
   - Real browser interactions (when available)

2. **Role-Based Context**
   - Each test uses correct role
   - Role-specific authentication
   - Role-specific UI navigation

3. **Fix Before Proceed**
   - Stop on failures
   - Fix immediately
   - Verify fix before continuing

4. **Comprehensive Validation**
   - UI state validation
   - API response validation
   - Database state validation (when enabled)
   - Event validation (when enabled)

---

## 📝 EXAMPLE TEST EXECUTION

### Test: admin-001 (View Vendor List)

**Role:** `admin`

**Process:**
1. Navigate to `/vendor-admin` (admin UI)
2. Wait for vendor list to load
3. Verify vendor list element exists
4. Validate API: `GET /admin/vendors/all`
   - Headers: `X-UAT-Mode: true`, `Authorization: Bearer uat-token-admin-test`
   - Expected: Status 200
5. Result: ✅ PASSED (API validation succeeded)

**What User Context:**
- **User Type:** Admin
- **Authentication:** UAT Mode (test admin user)
- **UI Context:** Admin panel
- **API Context:** Admin endpoints

---

## 🔍 CURRENT STATUS

**Tests Executed:** 12+ tests  
**Passed:** 12  
**Failed:** 0  
**Currently:** Executing admin tests serially

**Process:** 
- ✅ Using UAT mode for authentication
- ✅ Role-based test execution
- ✅ Serial execution with fix-before-proceed
- ✅ Real API validation
- ✅ Graceful UI fallback

---

**Last Updated:** 2025-01-13
