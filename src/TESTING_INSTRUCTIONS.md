# 🧪 TESTING INSTRUCTIONS - Vendor Key Pattern Fix

## Quick Start (3 Steps)

### Step 1: Open the App
The app should be running. You'll see the app switcher in the top-right corner.

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│                    YOUR APP                         │
│                                                     │
│                         ┌────────────────────────┐  │
│                         │ Customer App           │  │
│                         │ Vendor App             │  │
│                         │ Admin Portal           │  │
│                         │ 🧪 Test DB    ← CLICK │  │
│                         └────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Step 2: Click "🧪 Test DB"
This opens the Database Schema Test page.

### Step 3: Click "Run Tests"
The automated test suite will run all checks.

---

## What You'll See

### Before Running Tests
```
┌──────────────────────────────────────────────────┐
│  Database Schema Test                            │
│  Issue #1: Vendor Key Pattern Consistency        │
├──────────────────────────────────────────────────┤
│                                                  │
│  This test verifies that all vendors use the     │
│  standardized vendor:vendor_xxxxx key pattern.   │
│                                                  │
│  [▶ Run Tests]                                   │
│                                                  │
└──────────────────────────────────────────────────┘
```

### While Running (30-60 seconds)
```
┌──────────────────────────────────────────────────┐
│  Test Results                                    │
├──────────────────────────────────────────────────┤
│  ⏳ Migration Status Check                       │
│     Testing...                                   │
│                                                  │
│  ⏳ Create Test Vendor                          │
│     Testing...                                   │
│                                                  │
│  • Find Vendor by Phone                         │
│  • Submit Application                            │
│  • Verify Status After Submission               │
│  • Check No Duplicate Keys                      │
│                                                  │
│  [⏳ Running...]                                 │
└──────────────────────────────────────────────────┘
```

### After Completion (All Pass ✅)
```
┌──────────────────────────────────────────────────┐
│  Test Results                                    │
├──────────────────────────────────────────────────┤
│  ✅ Migration Status Check            [PASS]    │
│     ✅ All vendors use correct pattern           │
│                                                  │
│  ✅ Create Test Vendor                [PASS]    │
│     ✅ Vendor created: vendor_xxxxx              │
│                                                  │
│  ✅ Find Vendor by Phone              [PASS]    │
│     ✅ Found vendor with ID: vendor_xxxxx,       │
│        Status: pending_approval                  │
│                                                  │
│  ✅ Submit Application                [PASS]    │
│     ✅ Application submitted: APPxxxxx           │
│                                                  │
│  ✅ Verify Status After Submission    [PASS]    │
│     ✅ Status: pending_approval, App: APPxxxxx,  │
│        Docs: 1                                   │
│                                                  │
│  ✅ Check No Duplicate Keys           [PASS]    │
│     ✅ No duplicate patterns found               │
│                                                  │
├──────────────────────────────────────────────────┤
│  ✅ All Tests Passed! ✅                         │
│                                                  │
│  The vendor key pattern fix is working           │
│  correctly. All vendors use the standardized     │
│  pattern.                                        │
└──────────────────────────────────────────────────┘
```

### If Any Test Fails ❌
```
┌──────────────────────────────────────────────────┐
│  Test Results                                    │
├──────────────────────────────────────────────────┤
│  ✅ Migration Status Check            [PASS]    │
│  ✅ Create Test Vendor                [PASS]    │
│  ❌ Find Vendor by Phone              [FAIL]    │
│     ❌ Vendor not found                          │
│     ▼ View Details                               │
│                                                  │
│  • Submit Application                  [PENDING] │
│  • Verify Status After Submission     [PENDING] │
│  • Check No Duplicate Keys            [PENDING] │
│                                                  │
├──────────────────────────────────────────────────┤
│  ❌ Some Tests Failed ❌                         │
│                                                  │
│  1 test(s) failed. Please review the results    │
│  above and check the console logs.               │
└──────────────────────────────────────────────────┘
```

---

## Manual Testing (Alternative)

If you prefer to test manually instead of using the automated suite:

### 1. Create a New Vendor
```
1. Click "Vendor App" button
2. Click "Get Started as Service Provider"
3. Enter:
   - Phone: +1234567890
   - Email: testvendor@test.com
   - Password: Test123!
   - Fill all required fields
4. Click "Sign Up"
```

### 2. Complete Profile
```
1. Choose "I'm a Service Provider"
2. Select "Pet Grooming"
3. Choose service style
4. Fill profile form
5. Upload documents
6. Click "Submit Application"
```

### 3. Verify Persistence (CRITICAL TEST!)
```
1. After submission, you should see:
   "Application Submitted Successfully"

2. Close the app completely (close browser tab)

3. Reopen the app

4. Switch to "Vendor App"

5. Login with same phone: +1234567890

6. ✅ SHOULD SEE: "Awaiting Approval" screen
   ❌ SHOULD NOT SEE: "Choose Your Role" screen

IF YOU SEE "AWAITING APPROVAL" → FIX IS WORKING! ✅
```

---

## Console Debugging

### Open Browser Console
Press **F12** or right-click → Inspect → Console

### Check Logs
You should see detailed logs like:
```
🔍 Searching for vendor with phone: 1234567890
📋 Searching through 5 vendor records...
✅ Found vendor: vendor_xxxxx for phone 1234567890
   - Status: pending_approval
   - Type: grooming
   - Application ID: APPxxxxx
```

### Check for Errors
Look for any red error messages. Common issues:
- Network errors (Supabase not running)
- 404 Not Found (endpoint missing)
- 500 Server Error (backend issue)

---

## Migration Check

### Option 1: Via Test UI
1. Click "🧪 Test DB"
2. First test shows migration status
3. Look for "All vendors use correct pattern"

### Option 2: Via Browser Console
```javascript
// Run this in browser console
const response = await fetch(
  'http://localhost:54321/functions/v1/make-server-3dd53475/admin/migration/status',
  { 
    headers: { 
      'Authorization': 'Bearer YOUR_ANON_KEY' 
    } 
  }
);
const data = await response.json();
console.log('Migration Status:', data);
```

**Expected Output:**
```javascript
{
  needsMigration: false,
  patterns: {
    correct: "vendor:vendor_xxxxx (5)",
    oldProfile: "vendor:profile:vendor_xxxxx (0)",
    legacy: "vendor:xxxxx (0)",
    other: "Other vendor keys (10)"
  },
  recommendation: "All vendor keys use the correct pattern ✅"
}
```

---

## Troubleshooting

### Test Suite Not Loading
1. Check if App.tsx imported TestDatabaseSchema correctly
2. Verify all components exist
3. Check browser console for import errors
4. Refresh the page

### Tests Timeout
1. Check if Supabase is running: `supabase status`
2. Verify edge functions deployed
3. Check network tab in browser dev tools
4. Increase timeout if needed

### All Tests Fail
1. Check Supabase connection
2. Verify API endpoints exist
3. Check server logs: `supabase functions logs`
4. Review recent code changes

### Specific Test Fails
1. Read the error message carefully
2. Click "View Details" to see full error
3. Check console logs
4. Review the specific endpoint code

---

## Success Indicators

### ✅ Everything Working
- [x] Test suite loads without errors
- [x] All 6 tests pass
- [x] Green success message displayed
- [x] Console shows detailed logs
- [x] No red errors in console
- [x] Manual vendor flow works
- [x] Status persists across sessions

### ⚠️ Needs Attention
- [ ] Some tests fail
- [ ] Migration status shows old patterns
- [ ] Vendor not found by phone
- [ ] Status doesn't persist
- [ ] Console shows errors

### ❌ Major Issues
- [ ] Test suite doesn't load
- [ ] All tests fail
- [ ] Network errors
- [ ] Supabase not running
- [ ] Endpoints returning 500 errors

---

## What Each Test Validates

### Test 1: Migration Status Check
**Purpose:** Verify no old key patterns exist  
**Checks:**
- Count of vendor:vendor_ keys (correct)
- Count of vendor:profile: keys (should be 0)
- Count of vendor:uuid keys (should be 0)

### Test 2: Create Test Vendor
**Purpose:** Verify new vendors use correct pattern  
**Checks:**
- Signup endpoint works
- Vendor ID has vendor_ prefix
- Status is pending_approval
- Vendor is created in database

### Test 3: Find Vendor by Phone
**Purpose:** Verify phone lookup works  
**Checks:**
- Phone search endpoint works
- Vendor is found
- Vendor has correct ID format
- Vendor has status field

### Test 4: Submit Application
**Purpose:** Verify application submission  
**Checks:**
- Application submission works
- Application ID is generated
- Vendor status updates
- Documents attach correctly

### Test 5: Verify Status Persistence
**Purpose:** Critical test - does status persist?  
**Checks:**
- Re-fetching vendor by phone
- Status is still pending_approval
- Application ID still exists
- Documents still attached

### Test 6: Check No Duplicates
**Purpose:** Verify no duplicate keys created  
**Checks:**
- Re-check migration status
- Confirm no vendor:profile: keys
- Confirm no duplicate vendor records

---

## Understanding Test Results

### PASS ✅
```
✅ Test Name                     [PASS]
   ✅ Success message with details
```
**Meaning:** Test completed successfully, all checks passed

### FAIL ❌
```
❌ Test Name                     [FAIL]
   ❌ Error message explaining what went wrong
   ▼ View Details
      { error details in JSON }
```
**Meaning:** Test failed, needs investigation

### RUNNING ⏳
```
⏳ Test Name                     [RUNNING]
   Testing...
```
**Meaning:** Test is in progress, wait for completion

### PENDING ⚪
```
• Test Name                      [PENDING]
```
**Meaning:** Test hasn't run yet (waiting for prerequisites)

---

## After Testing

### All Tests Pass ✅
1. ✅ Mark Issue #1 as RESOLVED
2. 📸 Take screenshot of results
3. 📝 Document completion
4. ➡️ Move to Issue #2 (Document Retrieval)

### Some Tests Fail ❌
1. 📋 Document which tests failed
2. 🔍 Review error messages
3. 🐛 Check console logs
4. 🔧 Apply fixes
5. 🔄 Re-run tests

### Need Migration 🔄
1. Run: `POST /admin/migration/consolidate-vendor-keys`
2. Wait for completion
3. Verify: `GET /admin/migration/status`
4. Re-run test suite

---

## Questions & Answers

**Q: How long do tests take?**  
A: 30-60 seconds for all 6 tests

**Q: Can I run tests multiple times?**  
A: Yes! Each test creates a new test vendor

**Q: Will tests affect real data?**  
A: Tests create test vendors but don't affect existing data

**Q: What if a test fails?**  
A: Click "View Details" to see the error, check console logs

**Q: Can I skip the automated tests?**  
A: Yes, but manual testing takes longer

**Q: Do I need to be logged in?**  
A: No, tests use API directly

---

## Ready to Test?

**👆 Click the "🧪 Test DB" button in the top-right corner!**

The entire test suite is automated and will complete in under a minute.

**Expected outcome:** All tests pass with green checkmarks ✅

**Good luck!** 🚀
