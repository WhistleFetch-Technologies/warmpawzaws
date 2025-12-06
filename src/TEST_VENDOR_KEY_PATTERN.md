# TEST PLAN: Vendor Key Pattern Fix
**Issue:** Database Schema Issues - 3 different vendor key patterns causing state failures  
**Date:** November 14, 2025  
**Status:** TESTING IN PROGRESS

---

## TEST SCENARIOS

### Scenario 1: New Vendor Signup & Application Flow
**Objective:** Verify new vendors are created with correct `vendor:vendor_xxx` pattern

**Steps:**
1. Sign up as new vendor
2. Fill profile form
3. Submit application
4. Check database for correct key pattern
5. Log out and log back in
6. Verify status persists

**Expected Results:**
- ✅ Vendor created with key: `vendor:vendor_xxxxx`
- ✅ Vendor ID stored as: `vendor_xxxxx` (with prefix)
- ✅ Status: `pending_approval` after submission
- ✅ Status persists on re-login
- ✅ No duplicate keys created
- ✅ Documents attached to correct vendor record

---

### Scenario 2: Find Vendor by Phone
**Objective:** Verify phone lookup finds vendor with correct status

**Steps:**
1. Create vendor with phone: +1234567890
2. Submit application
3. Call `/vendor/find-by-phone/+1234567890`
4. Verify returned vendor has correct status

**Expected Results:**
- ✅ Vendor found by phone
- ✅ Status is `pending_approval` (not null or undefined)
- ✅ Application ID is present
- ✅ Documents array is present

---

### Scenario 3: Admin Application Review
**Objective:** Verify admin can see and approve applications

**Steps:**
1. Submit vendor application
2. Login as admin
3. Get pending applications
4. Approve application
5. Verify vendor status updates

**Expected Results:**
- ✅ Application appears in pending list
- ✅ Documents visible in admin panel
- ✅ After approval, vendor status = `approved`
- ✅ Vendor record updated at correct key

---

### Scenario 4: Vendor Service Setup
**Objective:** Verify approved vendors can setup services

**Steps:**
1. Approve vendor application
2. Vendor logs in
3. View catalog services
4. Enable/create services
5. Complete setup

**Expected Results:**
- ✅ Vendor profile found with approved status
- ✅ Catalog services load correctly
- ✅ Services saved to correct vendor key
- ✅ Setup completion updates vendor to active

---

### Scenario 5: Migration Tool
**Objective:** Verify migration consolidates old patterns

**Steps:**
1. Check migration status
2. Run consolidation migration
3. Verify all vendors use new pattern
4. Check no vendor:profile: keys remain

**Expected Results:**
- ✅ Status shows pattern distribution
- ✅ Migration consolidates old keys
- ✅ All vendors in `vendor:vendor_` pattern
- ✅ No data loss

---

## TEST EXECUTION LOG

### Test 1: Check Migration Status
```bash
curl http://localhost:54321/functions/v1/make-server-3dd53475/admin/migration/status \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**Expected Response:**
```json
{
  "needsMigration": false,
  "patterns": {
    "correct": "vendor:vendor_xxxxx (X)",
    "oldProfile": "vendor:profile:vendor_xxxxx (0)",
    "legacy": "vendor:xxxxx (0)",
    "other": "Other vendor keys (X)"
  },
  "recommendation": "All vendor keys use the correct pattern ✅"
}
```

**Status:** [ ] PASS [ ] FAIL

---

### Test 2: Create New Vendor
```bash
curl -X POST http://localhost:54321/functions/v1/make-server-3dd53475/auth/vendor/signup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "email": "testvendor@test.com",
    "password": "Test123!",
    "businessName": "Test Pet Grooming",
    "ownerName": "Test Owner",
    "phone": "+1234567890",
    "services": ["grooming"],
    "address": "123 Test St",
    "city": "Test City",
    "state": "TS",
    "pincode": "12345",
    "gstin": "TEST123",
    "pan": "TEST123",
    "aadhar": "123456789012",
    "bankAccount": "1234567890",
    "ifsc": "TEST0001234"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "user": {...},
  "status": "pending_approval"
}
```

**Verify in Database:**
- Key exists: `vendor:vendor_<uuid>` ✅
- ID field: `vendor_<uuid>` ✅
- Status: `pending` ✅

**Status:** [ ] PASS [ ] FAIL

---

### Test 3: Find Vendor by Phone
```bash
curl http://localhost:54321/functions/v1/make-server-3dd53475/vendor/find-by-phone/+1234567890 \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**Expected Response:**
```json
{
  "vendor": {
    "id": "vendor_xxxxx",
    "phone": "+1234567890",
    "status": "pending_approval",
    "businessName": "Test Pet Grooming",
    "applicationId": "APPxxxxx",
    "documents": [...]
  }
}
```

**Verify:**
- Vendor found ✅
- Has vendor_ prefix ✅
- Status is correct ✅

**Status:** [ ] PASS [ ] FAIL

---

### Test 4: Submit Application
```bash
curl -X POST http://localhost:54321/functions/v1/make-server-3dd53475/vendor/application/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "vendorId": "vendor_xxxxx",
    "fullName": "Test Owner",
    "businessName": "Test Pet Grooming",
    "vendorType": "grooming",
    "serviceStyle": "at_home",
    "email": "testvendor@test.com",
    "phone": "+1234567890",
    "address": "123 Test St",
    "city": "Test City",
    "state": "TS",
    "pincode": "12345",
    "documents": [
      {
        "category": "aadhar_front",
        "url": "https://example.com/doc1.jpg",
        "fileName": "aadhar.jpg"
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "applicationId": "APPxxxxx",
  "message": "Application submitted successfully. Awaiting admin approval."
}
```

**Verify in Database:**
- Application saved: `vendor:application:APPxxxxx` ✅
- Vendor updated at: `vendor:vendor_xxxxx` ✅
- Vendor status: `pending_approval` ✅
- Documents attached: Yes ✅

**Status:** [ ] PASS [ ] FAIL

---

### Test 5: Get Application Status
```bash
curl http://localhost:54321/functions/v1/make-server-3dd53475/vendor/application/status/vendor_xxxxx \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**Expected Response:**
```json
{
  "application": {
    "id": "APPxxxxx",
    "vendorId": "vendor_xxxxx",
    "status": "pending",
    "submittedAt": "2025-11-14T...",
    "documents": [...]
  },
  "canProceedToSetup": false
}
```

**Verify:**
- Application found ✅
- Status is pending ✅
- Documents present ✅

**Status:** [ ] PASS [ ] FAIL

---

### Test 6: Admin Gets Pending Applications
```bash
curl http://localhost:54321/functions/v1/make-server-3dd53475/admin/vendor/applications/pending \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Expected Response:**
```json
{
  "applications": [
    {
      "id": "APPxxxxx",
      "vendorId": "vendor_xxxxx",
      "fullName": "Test Owner",
      "businessName": "Test Pet Grooming",
      "status": "pending",
      "documents": [...]
    }
  ]
}
```

**Verify:**
- Application in list ✅
- Documents visible ✅
- Correct vendor ID ✅

**Status:** [ ] PASS [ ] FAIL

---

### Test 7: Admin Approves Application
```bash
curl -X POST http://localhost:54321/functions/v1/make-server-3dd53475/admin/vendor/application/APPxxxxx/approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "reviewerName": "Admin Test",
    "notes": "All documents verified"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Application approved successfully",
  "application": {
    "status": "approved",
    "reviewedBy": "Admin Test"
  }
}
```

**Verify in Database:**
- Application status: `approved` ✅
- Vendor status at `vendor:vendor_xxxxx`: `approved` ✅
- No duplicate vendor records ✅

**Status:** [ ] PASS [ ] FAIL

---

### Test 8: Vendor Can Access Service Setup
```bash
curl http://localhost:54321/functions/v1/make-server-3dd53475/vendor/services/catalog/vendor_xxxxx \
  -H "Authorization: Bearer YOUR_VENDOR_TOKEN"
```

**Expected Response:**
```json
{
  "services": [...],
  "vendorType": "grooming",
  "categoryName": "Pet Grooming"
}
```

**Verify:**
- Vendor found ✅
- Services loaded ✅
- Correct vendor type ✅

**Status:** [ ] PASS [ ] FAIL

---

### Test 9: Check for Duplicate Keys
```bash
curl http://localhost:54321/functions/v1/make-server-3dd53475/admin/migration/status \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**Verify:**
- No vendor:profile: keys for test vendor ✅
- Only one vendor:vendor_ key per vendor ✅
- All IDs have vendor_ prefix ✅

**Status:** [ ] PASS [ ] FAIL

---

## DEBUGGING ENDPOINTS

### Check Specific Vendor Key
```javascript
// In browser console or test file
const vendorId = "vendor_xxxxx";
const response = await fetch(
  `http://localhost:54321/functions/v1/make-server-3dd53475/vendor/profile/${vendorId}`,
  {
    headers: { 'Authorization': 'Bearer YOUR_ANON_KEY' }
  }
);
const data = await response.json();
console.log('Vendor data:', data);
```

### Check All Vendor Keys
```bash
# This would require creating a debug endpoint
curl http://localhost:54321/functions/v1/make-server-3dd53475/admin/debug/vendor-keys \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## PASS/FAIL CRITERIA

### MUST PASS (Critical):
- [ ] New vendors created with `vendor:vendor_xxx` pattern
- [ ] Vendor IDs stored with `vendor_` prefix
- [ ] Find by phone returns vendor with status
- [ ] Status persists across sessions (logout/login)
- [ ] Admin can see applications with documents
- [ ] Approval updates vendor status correctly
- [ ] No duplicate vendor records created

### SHOULD PASS (Important):
- [ ] Service setup finds approved vendor
- [ ] Documents attached to correct vendor record
- [ ] Migration tool consolidates old patterns
- [ ] No vendor:profile: keys created

### NICE TO HAVE (Enhancement):
- [ ] Performance: Find by phone < 500ms
- [ ] Logging: Clear console logs for debugging
- [ ] Error handling: Graceful failure messages

---

## ISSUES FOUND DURING TESTING

### Issue 1: [Title]
**Description:**
**Steps to Reproduce:**
**Expected:**
**Actual:**
**Severity:** Critical / High / Medium / Low
**Status:** Open / Fixed / Wontfix

---

## TEST RESULTS SUMMARY

**Date Tested:** _______________  
**Tester:** _______________  
**Environment:** Local / Staging / Production

**Total Tests:** 9  
**Passed:** ___  
**Failed:** ___  
**Skipped:** ___

**Overall Status:** ✅ PASS / ❌ FAIL / ⚠️ PARTIAL

---

## SIGN-OFF

### Developer
- [ ] All critical tests passing
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] Migration tested

**Signature:** _______________  
**Date:** _______________

### QA
- [ ] Test plan executed
- [ ] All scenarios verified
- [ ] Edge cases tested
- [ ] Performance acceptable

**Signature:** _______________  
**Date:** _______________

### Product Owner
- [ ] Acceptance criteria met
- [ ] User flow working end-to-end
- [ ] Ready for deployment

**Signature:** _______________  
**Date:** _______________
