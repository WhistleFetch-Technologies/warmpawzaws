# Capabilities Testing - Next Steps
## Action Plan for Testing All 76 Capabilities

**Date:** 2025-01-28  
**Status:** Ready for Execution

---

## Quick Start Guide

### Step 1: Verify Test Environment Setup

```bash
# Navigate to project root
cd /Users/ketan/Documents/warmpawzecodev

# Verify test scripts exist
ls -la tests/capabilities/

# Check database connection (if needed)
# Verify API endpoint is accessible
curl -I https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/health
```

### Step 2: Install Dependencies (if needed)

```bash
# Install TypeScript if not already installed
npm install -g typescript ts-node

# Or use npx (recommended)
# No installation needed - npx will use local or download
```

### Step 3: Execute Tests

#### Option A: Run Individual Test Scripts

```bash
# 1. Test Role-Capability Alignment
cd tests/capabilities
npx ts-node test-capability-role-alignment.ts > ../../test-reports/role-alignment-$(date +%Y%m%d_%H%M%S).txt

# 2. Test Capability Enforcement
npx ts-node test-capability-enforcement.ts > ../../test-reports/enforcement-$(date +%Y%m%d_%H%M%S).txt

# 3. Analyze Capability Alignment
npx ts-node analyze-capability-alignment.ts > ../../test-reports/analysis-$(date +%Y%m%d_%H%M%S).txt
```

#### Option B: Run Shell Script

```bash
cd tests/capabilities
./run-capability-tests.sh
```

---

## Detailed Execution Plan

### Phase 1: Automated Testing (30 minutes)

#### 1.1 Test Role-Capability Alignment

**Purpose:** Verify that each role has the correct capabilities assigned

**Command:**
```bash
cd tests/capabilities
npx ts-node test-capability-role-alignment.ts
```

**Expected Output:**
- List of roles tested
- Capabilities for each role
- Pass/fail status for each capability
- Alignment score

**What to Check:**
- ✅ All roles have expected capabilities
- ✅ No roles have unexpected capabilities
- ✅ Alignment scores are > 90%

**If Issues Found:**
- Review role definitions in `backend/lambda/src/endpoints/role-seeding.ts`
- Check `role_permissions` table in database
- Update role-capability mappings

#### 1.2 Test Capability Enforcement

**Purpose:** Verify that API endpoints enforce capability requirements

**Command:**
```bash
cd tests/capabilities
npx ts-node test-capability-enforcement.ts
```

**Expected Output:**
- List of endpoints tested
- Capability requirements for each endpoint
- Vendors with/without capabilities
- Enforcement status

**What to Check:**
- ✅ Endpoints correctly check capabilities
- ✅ Vendors without capabilities get 403 errors
- ✅ Vendors with capabilities can access endpoints

**If Issues Found:**
- Review middleware in `backend/lambda/src/middleware/capability-enforcement.ts`
- Check endpoint implementations
- Verify capability checks are in place

#### 1.3 Analyze Capability Alignment

**Purpose:** Generate comprehensive alignment analysis

**Command:**
```bash
cd tests/capabilities
npx ts-node analyze-capability-alignment.ts
```

**Expected Output:**
- Capability analysis with scores
- Role analysis with scores
- Overall alignment score
- Issues identified

**What to Check:**
- ✅ Overall alignment score > 85%
- ✅ No critical issues identified
- ✅ Capabilities properly assigned

**If Issues Found:**
- Review analysis report
- Address identified issues
- Update capability assignments

---

### Phase 2: Manual Testing (2-3 hours)

#### 2.1 Test Core Capabilities

**Test Dashboard Capability:**
1. Login as vendor (any role)
2. Verify dashboard loads
3. Check metrics display
4. Verify navigation works

**Test Bookings Capability:**
1. Login as service provider vendor
2. Access bookings page
3. Create a booking
4. Update booking status
5. Verify booking appears in system

**Test Services Capability:**
1. Access services page
2. Create new service
3. Update service details
4. Verify service appears in catalog

**Test Staff Capability:**
1. Login as business vendor
2. Access staff page
3. Add staff member
4. Verify staff appears
5. Login as solo vendor - should NOT see staff page

#### 2.2 Test Healthcare Capabilities

**Test Prescriptions Capability:**
1. Login as veterinarian
2. Access prescriptions page
3. Create prescription for booking
4. Add medications
5. Download PDF
6. Verify prescription linked to booking

**Test Medical Records Capability:**
1. Login as veterinarian
2. Access medical records page
3. Create medical record
4. Attach file
5. Update record
6. Verify audit trail

**Test Diagnostics Capability:**
1. Login as veterinary clinic with diagnostic_lab
2. Access diagnostics page
3. Add test to catalog
4. Create test booking
5. Upload results
6. Generate report

**Test Pharmacy Capability:**
1. Login as pharmacy vendor
2. Access pharmacy page
3. Add medicine to inventory
4. Process prescription order
5. Verify prescription
6. Check expiry alerts

#### 2.3 Test Specialized Service Capabilities

**Test Events Capability:**
1. Login as event organizer or cafe vendor
2. Access events page
3. Create event
4. Manage registrations
5. Check-in attendees
6. Verify QR codes work

**Test Cafe Tables Capability:**
1. Login as cafe vendor
2. Access cafe tables page
3. Configure table layout
4. Check availability
5. Create reservation
6. Verify table booking

**Test Rooms Capability:**
1. Login as boarding/resort vendor
2. Access rooms page
3. Add room
4. Set room type and pricing
5. Create booking
6. Verify room availability

**Test Ambulance Capability:**
1. Login as ambulance vendor
2. Access ambulance page
3. Add vehicle to fleet
4. Track vehicle location
5. Dispatch emergency
6. View trip history

#### 2.4 Test Operations Capabilities

**Test Inventory Capability:**
1. Login as products store or pharmacy vendor
2. Access inventory page
3. Add product
4. Set stock level
5. Process stock movement
6. Verify low stock alert

**Test Orders Capability:**
1. Access orders page
2. View pending orders
3. Process order
4. Update status
5. Track shipping
6. Verify order completed

**Test GPS Tracking Capability:**
1. Login as walker, taxi, or ambulance vendor
2. Access GPS tracking page
3. Start tracking
4. View live location
5. Check route history
6. Verify alerts work

---

### Phase 3: Integration Testing (1-2 hours)

#### 3.1 Test Capability Interactions

**Test Prescription-Booking Integration:**
1. Create booking
2. Create prescription linked to booking
3. Verify prescription appears in booking details
4. Download prescription
5. Verify prescription history

**Test Medical Records-Pet Integration:**
1. Create medical record for pet
2. Verify record appears in pet's medical history
3. Link record to booking
4. Verify record accessible from booking

**Test Events-Registration Integration:**
1. Create event
2. Register customer for event
3. Generate QR code
4. Check-in customer
5. Verify registration status

#### 3.2 Test Role Transitions

**Test Solo to Business Transition:**
1. Login as solo vendor
2. Verify staff page NOT accessible
3. Update vendor type to business
4. Verify staff page becomes accessible
5. Test staff management features

#### 3.3 Test Capability Inheritance

**Test Multi-Doctor Management:**
1. Login as veterinary clinic
2. Verify multi_doctor_management capability
3. Add multiple doctors
4. Assign patients to doctors
5. Verify doctor schedules

---

### Phase 4: Generate Final Report (30 minutes)

#### 4.1 Compile Test Results

```bash
# Create reports directory
mkdir -p test-reports

# Compile all test results
cat test-reports/*.txt > test-reports/combined-results-$(date +%Y%m%d).txt

# Generate summary
echo "=== CAPABILITY TESTING SUMMARY ===" > test-reports/summary-$(date +%Y%m%d).txt
echo "Date: $(date)" >> test-reports/summary-$(date +%Y%m%d).txt
echo "" >> test-reports/summary-$(date +%Y%m%d).txt
echo "Total Tests: $(grep -c "Test" test-reports/combined-results-*.txt)" >> test-reports/summary-$(date +%Y%m%d).txt
echo "Passed: $(grep -c "PASS" test-reports/combined-results-*.txt)" >> test-reports/summary-$(date +%Y%m%d).txt
echo "Failed: $(grep -c "FAIL" test-reports/combined-results-*.txt)" >> test-reports/summary-$(date +%Y%m%d).txt
```

#### 4.2 Document Findings

Create a findings document with:
- Test execution summary
- Issues identified
- Fixes applied
- Recommendations
- Next steps

---

## Troubleshooting

### Issue: TypeScript compilation errors

**Solution:**
```bash
# Check TypeScript version
npx tsc --version

# Compile manually to see errors
npx tsc tests/capabilities/*.ts --noEmit

# Fix import paths if needed
```

### Issue: Database connection errors

**Solution:**
```bash
# Check database connection string
echo $DATABASE_URL

# Verify database is accessible
# Check RDS connection settings in backend/lambda/src/database/rds-connection.ts
```

### Issue: API endpoint not accessible

**Solution:**
```bash
# Test API endpoint
curl -I https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/health

# Check API base URL in test scripts
# Update if needed
```

### Issue: Test scripts not executable

**Solution:**
```bash
# Make scripts executable
chmod +x tests/capabilities/*.sh

# Or run with bash
bash tests/capabilities/run-capability-tests.sh
```

---

## Success Criteria

### ✅ Test Execution Complete When:

1. **Automated Tests:**
   - ✅ All test scripts run without errors
   - ✅ Test reports generated
   - ✅ Alignment scores > 85%

2. **Manual Tests:**
   - ✅ All core capabilities tested
   - ✅ All healthcare capabilities tested
   - ✅ All specialized service capabilities tested
   - ✅ All operations capabilities tested

3. **Integration Tests:**
   - ✅ Capability interactions verified
   - ✅ Role transitions tested
   - ✅ Capability inheritance verified

4. **Documentation:**
   - ✅ Test results documented
   - ✅ Issues identified and logged
   - ✅ Recommendations provided
   - ✅ Next steps defined

---

## Quick Reference Commands

```bash
# Run all tests
cd tests/capabilities && ./run-capability-tests.sh

# Test specific capability
cd tests/capabilities && npx ts-node test-capability-role-alignment.ts | grep "prescriptions"

# Generate analysis report
cd tests/capabilities && npx ts-node analyze-capability-alignment.ts > ../../test-reports/analysis.txt

# View test results
cat test-reports/*.txt | less

# Check test coverage
grep -r "capability" tests/capabilities/ | wc -l
```

---

## Timeline Estimate

- **Phase 1 (Automated Testing):** 30 minutes
- **Phase 2 (Manual Testing):** 2-3 hours
- **Phase 3 (Integration Testing):** 1-2 hours
- **Phase 4 (Report Generation):** 30 minutes

**Total Estimated Time:** 4-6 hours

---

## Next Actions

1. ✅ **Immediate:** Execute Phase 1 (Automated Testing)
2. ⏳ **Today:** Complete Phase 2 (Manual Testing) for critical capabilities
3. ⏳ **This Week:** Complete all testing phases
4. ⏳ **Next Week:** Review findings and implement fixes

---

**Ready to Start?** Run the commands in Phase 1 to begin testing!
