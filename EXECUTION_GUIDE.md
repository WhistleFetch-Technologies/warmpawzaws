# Vendor Capabilities Testing - Execution Guide

**Date:** 2026-01-28  
**Status:** Ready for Execution  
**Scope:** All 56 Vendor Capabilities

---

## 🎯 QUICK START

### Prerequisites Checklist

- [ ] API server running (local or deployed)
- [ ] Database access configured
- [ ] Test vendor account created
- [ ] Authentication tokens available
- [ ] Test data prepared

---

## 📋 EXECUTION STEPS

### Step 1: Environment Setup (15 minutes)

#### 1.1 Configure API Base URL

```bash
# Set API base URL
export API_BASE="http://localhost:3000/api"  # Local
# OR
export API_BASE="https://api.warmpawz.com/api"  # Production/Staging
```

#### 1.2 Set Test Vendor ID

```bash
# Get a test vendor ID from database or create one
export VENDOR_ID="your-test-vendor-id"

# Or use the test script to find/create one
./test-capabilities-systematic.sh --setup
```

#### 1.3 Configure Authentication

```bash
# Set authentication token (if required)
export AUTH_TOKEN="your-auth-token"

# Or use UAT mode
export UAT_MODE="true"
export UAT_TOKEN="uat-token-admin"
```

---

### Step 2: Verify Infrastructure (10 minutes)

#### 2.1 Check API Health

```bash
curl -X GET "$API_BASE/health" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-28T..."
}
```

#### 2.2 Verify Vendor Profile Endpoint

```bash
curl -X GET "$API_BASE/vendor/$VENDOR_ID/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "vendor": {
    "id": "...",
    "role_id": "...",
    "capabilities": [...]
  }
}
```

---

### Step 3: Execute Systematic Tests (30-60 minutes)

#### 3.1 Run Quick Verification

```bash
# Quick check of critical capabilities
./test-capabilities-systematic.sh dev
```

#### 3.2 Run Full Test Suite

```bash
# Test all 56 capabilities
./test-capabilities-systematic.sh dev --full
```

#### 3.3 Test Specific Capability

```bash
# Test a specific capability
./test-capabilities-systematic.sh dev --capability services
```

---

### Step 4: Manual Verification (Critical Capabilities)

#### 4.1 Test Dashboard Data Handoff

```bash
# 1. Call API
curl -X GET "$API_BASE/vendor/$VENDOR_ID/dashboard" \
  -H "Content-Type: application/json"

# 2. Verify response structure
# Expected: { vendor, stats, bookings, timeframe }

# 3. Check database directly
psql -d warmpawz -c "SELECT * FROM vendors WHERE id = '$VENDOR_ID';"
psql -d warmpawz -c "SELECT * FROM role_permissions WHERE role_id = (SELECT role_id FROM vendors WHERE id = '$VENDOR_ID');"
```

#### 4.2 Test Services CRUD

```bash
# CREATE
curl -X POST "$API_BASE/vendor/$VENDOR_ID/services" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "test-service-id",
    "serviceStyle": "at_home",
    "customPrice": 500,
    "customDuration": 30,
    "isEnabled": true
  }'

# READ
curl -X GET "$API_BASE/vendor/$VENDOR_ID/services"

# UPDATE
curl -X PUT "$API_BASE/vendor/$VENDOR_ID/services/SERVICE_ID" \
  -H "Content-Type: application/json" \
  -d '{"price": 600}'

# DELETE
curl -X DELETE "$API_BASE/vendor/$VENDOR_ID/services/SERVICE_ID"
```

#### 4.3 Test Staff CRUD

```bash
# CREATE
curl -X POST "$API_BASE/vendor/$VENDOR_ID/staff" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Staff",
    "phone": "+919876543210",
    "role": "vet",
    "is_active": true
  }'

# READ
curl -X GET "$API_BASE/vendor/$VENDOR_ID/staff"

# UPDATE
curl -X PUT "$API_BASE/vendor/$VENDOR_ID/staff/STAFF_ID" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name"}'

# DELETE
curl -X DELETE "$API_BASE/vendor/$VENDOR_ID/staff/STAFF_ID"
```

---

### Step 5: Document Results (15 minutes)

#### 5.1 Generate Test Report

```bash
# Run tests and save results
./test-capabilities-systematic.sh dev --full > test-results-$(date +%Y%m%d).log 2>&1
```

#### 5.2 Update Test Report

Update `CAPABILITIES_COMPREHENSIVE_TEST_REPORT.md` with:
- ✅ Passed tests
- ❌ Failed tests
- ⚠️ Warnings/Issues
- 📝 Notes/Observations

---

## 🔍 DETAILED TESTING PROCEDURES

### Test 1: Data Handoff Verification

**Objective:** Verify UI → API → DB → API → UI flow

**Procedure:**
1. **UI Request:** Simulate frontend request
   ```typescript
   const response = await apiClient.get(`/vendor/${vendorId}/profile`);
   ```

2. **API Processing:** Verify backend query
   ```sql
   SELECT v.*, r.*, rp.permission_name
   FROM vendors v
   LEFT JOIN roles r ON v.role_id = r.id
   LEFT JOIN role_permissions rp ON r.id = rp.role_id
   WHERE v.id = $1
   ```

3. **DB Response:** Verify database returns correct data
4. **API Response:** Verify API returns structured data
5. **UI Rendering:** Verify frontend receives and displays data

**Success Criteria:**
- ✅ API returns vendor data
- ✅ API includes role information
- ✅ API includes capabilities array
- ✅ Frontend can filter capabilities
- ✅ Frontend renders correct UI components

---

### Test 2: API Contract Verification

**Objective:** Verify request/response formats

**Procedure:**
1. **Request Format:** Test with valid data
2. **Request Validation:** Test with invalid data
3. **Response Format:** Verify response structure
4. **Error Handling:** Test error scenarios

**Success Criteria:**
- ✅ Valid requests return 200/201
- ✅ Invalid requests return 400/404
- ✅ Response matches documented format
- ✅ Errors return proper error messages

---

### Test 3: Full Lifecycle Testing

**Objective:** Verify CRUD operations

**Procedure:**
1. **CREATE:** Create new resource
2. **READ:** Retrieve created resource
3. **UPDATE:** Modify resource
4. **DELETE:** Remove resource (if applicable)

**Success Criteria:**
- ✅ CREATE returns 201 with resource data
- ✅ READ returns 200 with resource data
- ✅ UPDATE returns 200 with updated data
- ✅ DELETE returns 200/204
- ✅ Resource persists in database
- ✅ Resource changes reflect in subsequent reads

---

## 📊 TEST EXECUTION CHECKLIST

### Core Capabilities (3)
- [ ] dashboard - Data handoff
- [ ] bookings - CRUD operations
- [ ] profile - CRUD operations

### Services Capabilities (10)
- [ ] services - Full CRUD ✅
- [ ] packages - Endpoint discovery + CRUD
- [ ] pricing - Endpoint discovery + CRUD
- [ ] test_catalog - Endpoint discovery + CRUD
- [ ] menu - Endpoint discovery + CRUD
- [ ] products - Endpoint discovery + CRUD
- [ ] subscriptions - Endpoint discovery + CRUD
- [ ] centre_booking - Data handoff
- [ ] home_services - Data handoff
- [ ] tele_consultation - Data handoff

### Operations Capabilities (8)
- [ ] staff - Full CRUD ✅
- [ ] schedule - CRUD operations
- [ ] service_radius - Endpoint discovery + CRUD
- [ ] gps_tracking - Endpoint discovery + CRUD
- [ ] reviews - Data handoff
- [ ] analytics - Data handoff
- [ ] reports - CRUD operations
- [ ] settings - CRUD operations

### Finance Capabilities (3)
- [ ] earnings - Data handoff
- [ ] settlements - Data handoff
- [ ] bank_account - CRUD operations

### Medical Capabilities (4)
- [ ] prescriptions - CREATE/READ ✅
- [ ] medical_records - Endpoint discovery + CRUD
- [ ] vaccination - Endpoint discovery + CRUD
- [ ] diagnostics - Endpoint discovery + CRUD

### Specialized Capabilities (23)
- [ ] All 23 specialized capabilities - Endpoint discovery + testing

### Communication Capabilities (3)
- [ ] chat - Endpoint discovery + testing
- [ ] video_call - Endpoint discovery + testing
- [ ] notifications - Data handoff

---

## 🚨 TROUBLESHOOTING

### Issue: API Not Responding

**Solution:**
```bash
# Check if server is running
curl -X GET "$API_BASE/health"

# Check server logs
tail -f /path/to/server/logs

# Verify environment variables
echo $API_BASE
echo $VENDOR_ID
```

### Issue: Authentication Failed

**Solution:**
```bash
# Use UAT mode
export UAT_MODE="true"
export UAT_TOKEN="uat-token-admin"

# Or get valid token
curl -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phone": "...", "otp": "..."}'
```

### Issue: Database Connection Error

**Solution:**
```bash
# Verify database connection
psql -d warmpawz -c "SELECT 1;"

# Check environment variables
echo $DATABASE_URL
echo $DB_HOST
echo $DB_PORT
```

### Issue: Test Data Missing

**Solution:**
```bash
# Create test vendor
./scripts/create-test-vendor.sh

# Or use existing test data
export VENDOR_ID="existing-test-vendor-id"
```

---

## 📈 PROGRESS TRACKING

### Current Status

- **Structure Verified:** ✅ 56/56 (100%)
- **Data Handoff Tested:** ⏳ 6/56 (11%)
- **CRUD Tested:** ⏳ 6/56 (11%)
- **API Contracts Documented:** ⏳ 28/56 (50%)

### Target Status

- **Structure Verified:** ✅ 56/56 (100%)
- **Data Handoff Tested:** 🎯 56/56 (100%)
- **CRUD Tested:** 🎯 56/56 (100%)
- **API Contracts Documented:** 🎯 56/56 (100%)

---

## 🎯 PRIORITY ORDER

### Phase 1: Critical Capabilities (Immediate)
1. dashboard ✅
2. profile ✅
3. bookings ✅
4. services ✅
5. staff ✅
6. schedule ⚠️
7. earnings ⚠️
8. prescriptions ✅

### Phase 2: High-Value Capabilities (Next)
1. packages
2. products
3. orders
4. settlements
5. analytics
6. reports

### Phase 3: Specialized Capabilities (Later)
1. All remaining 40 capabilities

---

## 📝 TEST RESULTS TEMPLATE

```markdown
## Test Results - [Date]

### Capability: [name]

**Status:** ✅ PASS / ❌ FAIL / ⚠️ WARNING

**Data Handoff:**
- UI → API: ✅ / ❌
- API → DB: ✅ / ❌
- DB → API: ✅ / ❌
- API → UI: ✅ / ❌

**CRUD Operations:**
- CREATE: ✅ / ❌
- READ: ✅ / ❌
- UPDATE: ✅ / ❌
- DELETE: ✅ / ❌ / N/A

**API Contract:**
- Request Format: ✅ / ❌
- Response Format: ✅ / ❌
- Error Handling: ✅ / ❌

**Notes:**
- [Any observations or issues]
```

---

## 🎉 SUCCESS CRITERIA

### Test Execution Complete When:

1. ✅ All 56 capabilities tested
2. ✅ All data handoff flows verified
3. ✅ All CRUD operations tested (where applicable)
4. ✅ All API contracts documented
5. ✅ All test results documented
6. ✅ All issues identified and logged
7. ✅ Test report generated

---

**Ready to Execute:** ✅  
**Estimated Time:** 2-4 hours (full suite)  
**Next Action:** Run Step 1 (Environment Setup)
