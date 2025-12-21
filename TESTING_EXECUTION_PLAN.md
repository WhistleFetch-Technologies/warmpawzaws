# Testing Execution Plan
## Option A: Complete Testing First

**Date:** 2025  
**Status:** Ready for Execution  
**Estimated Time:** 2 hours

---

## Pre-Testing Checklist

### Environment Setup
- [ ] Application is running (dev server)
- [ ] Browser dev tools open (Console tab)
- [ ] Network tab open (to monitor API calls)
- [ ] Test customer account ready
- [ ] Test vendor accounts ready
- [ ] Test pets added to customer account

### Test Data Required
- [ ] Customer phone: `9876543210` (or your test account)
- [ ] Customer ID: Available
- [ ] At least 1 pet in customer account
- [ ] Vet clinic vendor ID
- [ ] Grooming center vendor ID
- [ ] Training center vendor ID

---

## Test 1: BookingFlowDispatcher - Vet Center Booking

### Setup
**Service Style:** `at_center`  
**Service Type:** `vet`  
**Expected Component:** `VetBookingRouter`

### Test Steps
1. Navigate to vet services in customer app
2. Select "At Clinic" option
3. Select a clinic from the list
4. **BookingFlowDispatcher should render**

### Verification Checklist
- [ ] `VetBookingRouter` component renders (check console for initialization logs)
- [ ] No errors in browser console
- [ ] Doctor selection screen appears (or service selection)
- [ ] Can navigate through booking steps
- [ ] Back button works correctly
- [ ] Navigation handlers are called (check console)
- [ ] Booking completion triggers callback

### Expected Console Output
```
🎯 [VET-BOOKING-ROUTER] Initializing with:
   - Doctor: undefined
   - Doctor ID: undefined
   - Selected Service: undefined
   - Service Type: clinic
   - Initial View: doctor_details
```

### Issues to Watch For
- Component doesn't render
- Props not passed correctly
- Navigation doesn't work
- Callbacks not triggered

---

## Test 2: BookingFlowDispatcher - Vet Home Booking

### Setup
**Service Style:** `at_home`  
**Service Type:** `vet`  
**Expected Component:** `VetBookingFlow`

### Test Steps
1. Navigate to vet services
2. Select "At Home" option
3. Select a vet service
4. **BookingFlowDispatcher should render**

### Verification Checklist
- [ ] `VetBookingFlow` component renders
- [ ] Service selection screen appears
- [ ] Address selector appears after time slot (home service specific)
- [ ] Back button works at each step
- [ ] Booking flow completes successfully
- [ ] No console errors

### Expected Behavior
- Service selection → Pet selection → Time slot → **Address selection** → Payment → Success

---

## Test 3: BookingFlowDispatcher - Vet Tele Booking

### Setup
**Service Style:** `tele`  
**Service Type:** `vet`  
**Expected Component:** `VetBookingRouter`

### Test Steps
1. Navigate to vet services
2. Select "Tele Consultation" option
3. Select a vet/doctor
4. **BookingFlowDispatcher should render**

### Verification Checklist
- [ ] `VetBookingRouter` component renders
- [ ] Tele consultation flow appears
- [ ] **No address selector** (tele service)
- [ ] Booking flow completes successfully
- [ ] Video call link/instructions provided (if implemented)

---

## Test 4: BookingFlowDispatcher - Package Booking

### Setup
**Service Style:** `package`  
**Service Type:** `training` (or any)  
**Expected Component:** `PackageBookingPage`

### Test Steps
1. Navigate to package booking
2. **BookingFlowDispatcher should render**

### Verification Checklist
- [ ] `PackageBookingPage` component renders
- [ ] **Back button visible in header** ✅ (NEW - fixed)
- [ ] Package browsing screen appears
- [ ] Can browse available packages
- [ ] Can schedule package sessions
- [ ] Can view "My Packages"
- [ ] Booking completion shows **toast notification** (not alert) ✅ (NEW - fixed)
- [ ] `onBookingComplete` callback triggered ✅ (NEW - fixed)
- [ ] No console errors

### Expected Behavior
- Browse packages → Select package → Schedule sessions → Confirm → **Toast success** → Callback triggered

---

## Test 5: BookingFlowDispatcher - Center Booking Enhanced

### Setup
**Service Style:** `at_center`  
**Service Type:** `grooming` (or training)  
**Expected Component:** `CenterBookingFlowEnhanced`  
**Required:** `petId`, `petName`, `customerName` must be provided

### Test Steps
1. Navigate to grooming/training services
2. Select "At Center" option
3. Select a center
4. Ensure pet/customer data is available
5. **BookingFlowDispatcher should render**

### Verification Checklist
- [ ] `CenterBookingFlowEnhanced` component renders (if pet/customer data available)
- [ ] Service selection with add-ons appears
- [ ] Prescription/medical records handled (if required)
- [ ] Booking flow completes successfully
- [ ] `onSuccess` callback triggered

### Fallback Behavior
- If pet/customer data missing → Falls back to `VetBookingFlow`
- Verify fallback works correctly

---

## Test 6: BookingFlowDispatcher - Delivery Placeholder

### Setup
**Service Style:** `delivery`  
**Service Type:** `pharmacy` (or any)  
**Expected Component:** Placeholder

### Test Steps
1. Navigate to delivery service
2. **BookingFlowDispatcher should render**

### Verification Checklist
- [ ] Placeholder component renders
- [ ] "Delivery booking flow coming soon" message displayed
- [ ] Back button works
- [ ] No console errors

---

## Test 7: VendorPrescriptionForm - CREATE

### Setup
**Mode:** Create new prescription  
**Booking:** Completed booking without prescription

### Test Steps
1. Open vendor booking detail modal
2. Click "Add Service Notes" (or "Add Prescription")
3. Fill form with data
4. Click "Save"

### Verification Checklist
- [ ] Form opens with empty fields
- [ ] Can fill all form fields
- [ ] Validation works (at least some content required)
- [ ] **POST endpoint called** (check Network tab)
- [ ] **Success toast appears** ✅ (NEW - fixed)
- [ ] Modal closes on success
- [ ] `onSuccess` callback triggered
- [ ] Prescription appears in booking details

### Expected API Call
```
POST /make-server-3dd53475/prescription/create
```

### Expected Response
```json
{
  "success": true,
  "prescriptionId": "prescription_..."
}
```

---

## Test 8: VendorPrescriptionForm - UPDATE

### Setup
**Mode:** Edit existing prescription  
**Booking:** Completed booking with existing prescription

### Test Steps
1. Open vendor booking detail modal
2. Click "View/Edit Service Notes"
3. **Form should load existing data** ✅ (NEW)
4. Edit some fields
5. Click "Update"

### Verification Checklist
- [ ] **Loading state appears** while fetching ✅ (NEW)
- [ ] **Form pre-populated with existing data** ✅ (NEW)
  - [ ] Diagnosis field populated
  - [ ] Observations field populated
  - [ ] Medications array populated
  - [ ] Products used populated
  - [ ] Tests recommended populated
  - [ ] Vitals populated
  - [ ] Notes and recommendations populated
- [ ] Can edit all fields
- [ ] **PUT endpoint called** (check Network tab) ✅ (NEW)
- [ ] **Success toast: "Prescription updated successfully"** ✅ (NEW)
- [ ] Modal closes on success
- [ ] `onSuccess` callback triggered
- [ ] Updated prescription saved correctly

### Expected API Call
```
PUT /make-server-3dd53475/prescription/update/:prescriptionId
```

### Expected Response
```json
{
  "success": true,
  "prescription": { ... }
}
```

---

## Test 9: VendorPrescriptionForm - Error Handling

### Test Scenarios
1. **Network Error:**
   - [ ] Disconnect network
   - [ ] Try to save/update
   - [ ] Error message displayed
   - [ ] Modal stays open (doesn't close on error)

2. **Validation Error:**
   - [ ] Try to save with no content
   - [ ] Validation error displayed
   - [ ] Modal stays open

3. **API Error:**
   - [ ] Invalid booking ID
   - [ ] Error message displayed
   - [ ] User-friendly error message

---

## Test Results Template

### Test Case: [Number] - [Name]
**Date:** [Date]  
**Tester:** [Name]  
**Result:** ✅ PASS / ❌ FAIL / ⚠️ PARTIAL

**Setup:**
[Brief description]

**Steps Executed:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Results:**
- [ ] Component rendered correctly
- [ ] Navigation worked
- [ ] Callbacks triggered
- [ ] No console errors

**Issues Found:**
- [Issue 1]
- [Issue 2]

**Screenshots:**
[If applicable]

**Notes:**
[Additional notes]

---

## Common Issues & Solutions

### Issue 1: Component Not Rendering
**Symptom:** Blank screen or error  
**Check:**
- Console for errors
- Component imports
- Props passed correctly

**Fix:**
- Verify imports in BookingFlowDispatcher
- Check prop types match
- Verify component exists

---

### Issue 2: Props Not Passed Correctly
**Symptom:** Component receives undefined props  
**Check:**
- Console logs for prop values
- Dispatcher prop mapping

**Fix:**
- Verify dispatcher passes all required props
- Check prop names match component interface

---

### Issue 3: Navigation Not Working
**Symptom:** Back button or navigation doesn't work  
**Check:**
- `onBack` and `onNavigate` handlers
- Console for handler calls

**Fix:**
- Verify handlers are passed correctly
- Check handler implementations

---

### Issue 4: Prescription Not Loading
**Symptom:** Form doesn't pre-populate  
**Check:**
- Network tab for API call
- Console for errors
- Prescription ID passed correctly

**Fix:**
- Verify prescription ID is passed
- Check API endpoint
- Verify response format

---

## Success Criteria

### All Tests Pass If:
- ✅ All components render without errors
- ✅ Navigation works correctly
- ✅ Booking completion triggers callbacks
- ✅ Prescription CREATE works
- ✅ Prescription UPDATE works
- ✅ Form pre-population works
- ✅ No console errors
- ✅ User experience is smooth

### Ready for Migration If:
- ✅ All test cases pass
- ✅ No critical issues found
- ✅ Edge cases handled
- ✅ Error handling works
- ✅ Loading states work

---

## Next Steps After Testing

### If All Tests Pass:
1. ✅ Document results
2. ✅ Proceed with migration (Task 3)
3. ✅ Start consolidating duplicates

### If Issues Found:
1. ⚠️ Document all issues
2. ⚠️ Prioritize fixes
3. ⚠️ Fix critical issues first
4. ⚠️ Re-test after fixes
5. ⚠️ Proceed once resolved

---

## Quick Reference

### BookingFlowDispatcher Test Matrix

| Service Style | Service Type | Component | Status |
|---------------|--------------|-----------|--------|
| `at_center` | `vet` | VetBookingRouter | ⚠️ Test |
| `at_home` | `vet` | VetBookingFlow | ⚠️ Test |
| `tele` | `vet` | VetBookingRouter | ⚠️ Test |
| `package` | *any* | PackageBookingPage | ⚠️ Test |
| `at_center` | `grooming` | CenterBookingFlowEnhanced | ⚠️ Test |
| `delivery` | *any* | Placeholder | ⚠️ Test |

### VendorPrescriptionForm Test Matrix

| Mode | Operation | Endpoint | Status |
|------|-----------|----------|--------|
| Create | POST | `/prescription/create` | ⚠️ Test |
| Update | PUT | `/prescription/update/:id` | ⚠️ Test |
| Load | GET | `/prescription/booking/:id` | ⚠️ Test |

---

## Testing Tools

### Browser Dev Tools
- **Console:** Check for errors and logs
- **Network:** Monitor API calls
- **React DevTools:** Inspect component state

### Test Data
- Use existing test accounts
- Create test bookings if needed
- Use test prescriptions for UPDATE test

---

## Time Estimate

| Test | Time | Priority |
|------|------|----------|
| Test 1: Vet Center | 15 min | HIGH |
| Test 2: Vet Home | 15 min | HIGH |
| Test 3: Vet Tele | 15 min | HIGH |
| Test 4: Package | 15 min | HIGH |
| Test 5: Center Enhanced | 15 min | MEDIUM |
| Test 6: Delivery | 5 min | LOW |
| Test 7: Prescription CREATE | 10 min | HIGH |
| Test 8: Prescription UPDATE | 15 min | HIGH |
| Test 9: Error Handling | 10 min | MEDIUM |
| **TOTAL** | **~2 hours** | |

---

## Ready to Start?

1. ✅ Review this plan
2. ✅ Set up test environment
3. ✅ Prepare test data
4. ✅ Start with Test 1
5. ✅ Document results as you go

**Good luck with testing!** 🚀

