# 🧪 SOLO PROVIDER TESTING GUIDE

**Last Updated:** December 10, 2025  
**Status:** Ready for Testing

---

## 🎯 TESTING OVERVIEW

This guide provides comprehensive testing procedures for the Solo Provider system, including:
- **Automated Test Suite** - Run all tests with one click
- **Manual Testing Scenarios** - Step-by-step user flows
- **API Testing** - Direct backend endpoint testing
- **Integration Testing** - Cross-feature validation

---

## 🚀 QUICK START: AUTOMATED TESTING

### Access the Test Suite

1. **Open the test suite:**
   ```
   Navigate to: /test-solo-provider
   ```

2. **Run all tests:**
   - Click "Run All Tests" button
   - Wait for all 10 tests to complete
   - Review results

3. **Expected Results:**
   - ✅ All 10 tests should pass
   - Total time: ~10-15 seconds
   - Test data will be displayed

### Test Coverage

The automated suite tests:
1. ✅ Solo Provider Onboarding (creates vendor/center/staff)
2. ✅ Entity Creation Verification (checks flags and links)
3. ✅ Phone Index Creation (lookup by phone)
4. ✅ Solo Provider Login (session creation)
5. ✅ Dashboard Mode Detection (solo vs multi-staff)
6. ✅ Service Auto-Sync (add service)
7. ✅ Service Auto-Sync (update service)
8. ✅ Service Auto-Sync (delete service)
9. ✅ Booking Auto-Assignment (staff assignment)
10. ✅ Staff Mode Booking View (visibility check)

---

## 📋 MANUAL TESTING SCENARIOS

### SCENARIO 1: Complete Onboarding Flow

**Objective:** Test the full solo provider onboarding experience

**Steps:**
1. Navigate to vendor registration page
2. Select a role (e.g., "Pet Grooming")
3. **Verify business type selection screen appears**
   - Should show "Solo Provider" and "Business/Center" options
   - Solo Provider should have orange "Recommended" badge
4. Click "Solo Provider" card
5. **Verify simplified form loads:**
   - Owner Name (required)
   - Business Name (required)
   - Phone Number (required) - ONE field only
   - Email (required)
   - Service Area selector
   - Operating Hours
   - NO GST field
   - NO Shop License field
6. Fill in all fields:
   ```
   Owner Name: John Doe
   Business Name: John's Mobile Grooming
   Phone: +919876543210
   Email: john@grooming.com
   Service Area: Delhi NCR (10 km)
   ```
7. Submit form
8. **Verify success:**
   - Success message appears
   - Redirects to dashboard
   - Dashboard shows "Solo Provider" badge

**Expected Results:**
- ✅ Onboarding completes in under 5 minutes
- ✅ Only ONE phone number required
- ✅ No GST/license validation
- ✅ Service area displayed (not home address)

---

### SCENARIO 2: Dashboard Mode Switching

**Objective:** Test the mode switcher functionality

**Steps:**
1. Login as solo provider (use phone from Scenario 1)
2. **Verify solo provider dashboard loads:**
   - Should show mode switcher at top
   - Default mode: "Center"
   - Shows business overview
3. Click "Staff Mode" button
4. **Verify mode switches:**
   - Active mode changes to "Staff"
   - Content updates to staff operations view
   - Shows personal schedule/bookings
5. Click "Center Mode" button
6. **Verify mode switches back:**
   - Active mode changes to "Center"
   - Shows business management view

**Expected Results:**
- ✅ Mode switcher visible and functional
- ✅ Content updates based on mode
- ✅ Smooth transitions
- ✅ Mode persists on refresh

---

### SCENARIO 3: Service Auto-Sync

**Objective:** Test automatic service synchronization

**Steps:**
1. Login as solo provider
2. Ensure you're in "Center Mode"
3. Navigate to "Services" or "Service Catalog"
4. Click "Add Service"
5. Fill in service details:
   ```
   Name: Basic Grooming
   Description: Bath, brush, nail trim
   Price: ₹500
   Duration: 60 minutes
   Type: At Home
   ```
6. Click "Save" or "Add Service"
7. **Verify success message:**
   - Should say "Service added and synced to your staff profile!"
   - Should show `autoSynced: true` indicator
8. Switch to "Staff Mode"
9. Navigate to "My Services"
10. **Verify service appears:**
    - "Basic Grooming" should be listed
    - Same details (₹500, 60 mins)
11. Switch back to "Center Mode"
12. Edit the service:
    - Change price to ₹750
    - Save changes
13. **Verify update message:**
    - Should indicate sync completed
14. Switch to "Staff Mode" again
15. **Verify price updated:**
    - Should show ₹750

**Expected Results:**
- ✅ Service appears in staff mode immediately
- ✅ Updates sync automatically
- ✅ Success messages indicate sync
- ✅ No manual sync required

---

### SCENARIO 4: Service Deletion Sync

**Objective:** Test service deletion synchronization

**Steps:**
1. Login as solo provider (Center Mode)
2. Navigate to services list
3. Find "Basic Grooming" service
4. Click delete/remove
5. Confirm deletion
6. **Verify deletion:**
   - Service removed from list
   - Success message appears
7. Switch to "Staff Mode"
8. Navigate to "My Services"
9. **Verify service removed:**
   - "Basic Grooming" should NOT appear
   - Or marked as inactive

**Expected Results:**
- ✅ Service deleted from center
- ✅ Service removed from staff automatically
- ✅ No orphaned data

---

### SCENARIO 5: Booking Auto-Assignment

**Objective:** Test automatic staff assignment on booking

**Steps:**
1. **As Customer:**
   - Login/register as customer
   - Search for solo provider services
   - Find "John's Mobile Grooming"
   - Select a service
   - Choose date/time
   - Complete booking
   - Submit booking request

2. **As Solo Provider:**
   - Login with solo provider phone
   - Switch to "Staff Mode"
   - Navigate to "Bookings" or "Schedule"
   - **Verify booking appears:**
     - Should see customer's booking
     - Status: Pending
     - Assigned to you automatically
     - No manual assignment needed

3. **Backend Verification (Optional):**
   - Check booking record
   - Should have `staffId` field populated
   - Should have `autoAssigned: true` flag

**Expected Results:**
- ✅ Booking auto-assigned to solo staff
- ✅ Visible in Staff Mode immediately
- ✅ No manual assignment step
- ✅ Customer sees confirmation

---

### SCENARIO 6: Privacy Verification

**Objective:** Verify home address is protected

**Steps:**
1. **As Customer:**
   - Search for solo providers
   - View solo provider profile
   - **Verify address display:**
     - Should show service area (e.g., "Delhi NCR - 10 km radius")
     - Should NOT show exact home address
     - Should show "Comes to you" badge

2. **As Solo Provider:**
   - Login and view profile
   - Navigate to settings
   - **Verify address fields:**
     - Service area configuration available
     - Home address stored but not public
     - Privacy toggle available

**Expected Results:**
- ✅ Home address never shown to customers
- ✅ Service area displayed instead
- ✅ Privacy maintained
- ✅ Solo provider can update service area

---

## 🔬 API TESTING (Advanced)

### Test with cURL or Postman

#### 1. Solo Provider Onboarding
```bash
curl -X POST \
  https://[PROJECT_ID].supabase.co/functions/v1/make-server-3dd53475/vendor/solo-onboard \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer [ANON_KEY]' \
  -d '{
    "ownerName": "Test Provider",
    "businessName": "Test Mobile Service",
    "phone": "+919999999999",
    "email": "test@provider.com",
    "roleId": "pet_grooming",
    "roleName": "Pet Grooming",
    "serviceArea": {
      "type": "radius",
      "centerLat": 28.7041,
      "centerLng": 77.1025,
      "radiusKm": 10,
      "displayText": "Delhi NCR (10 km radius)"
    },
    "operatingHours": {
      "monday": { "open": "09:00", "close": "18:00", "isOpen": true }
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Solo provider onboarded successfully!",
  "vendorId": "vendor_xxx",
  "centerId": "center_auto_xxx",
  "staffId": "staff_auto_xxx",
  "session": { ... }
}
```

#### 2. Phone Lookup
```bash
curl -X GET \
  'https://[PROJECT_ID].supabase.co/functions/v1/make-server-3dd53475/vendor/phone/+919999999999' \
  -H 'Authorization: Bearer [ANON_KEY]'
```

**Expected Response:**
```json
{
  "success": true,
  "vendorId": "vendor_xxx",
  "centerId": "center_auto_xxx",
  "staffId": "staff_auto_xxx",
  "isSoloProvider": true
}
```

#### 3. Solo Provider Login
```bash
curl -X POST \
  https://[PROJECT_ID].supabase.co/functions/v1/make-server-3dd53475/vendor/solo-login \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer [ANON_KEY]' \
  -d '{
    "phone": "+919999999999"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "session": {
    "vendorId": "vendor_xxx",
    "centerId": "center_auto_xxx",
    "staffId": "staff_auto_xxx",
    "isSoloProvider": true,
    "defaultMode": "CENTER"
  }
}
```

#### 4. Get Solo Provider Info
```bash
curl -X GET \
  'https://[PROJECT_ID].supabase.co/functions/v1/make-server-3dd53475/vendor/[VENDOR_ID]/solo-info' \
  -H 'Authorization: Bearer [ANON_KEY]'
```

**Expected Response:**
```json
{
  "success": true,
  "vendor": { "id": "...", "isSoloProvider": true, ... },
  "center": { "id": "...", "isVirtualCenter": true, ... },
  "staff": { "id": "...", "isAutoCreated": true, ... }
}
```

#### 5. Add Service (Test Auto-Sync)
```bash
curl -X POST \
  https://[PROJECT_ID].supabase.co/functions/v1/make-server-3dd53475/vendor/services/add \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer [ANON_KEY]' \
  -d '{
    "vendorId": "vendor_xxx",
    "serviceData": {
      "name": "Test Service",
      "price": 500,
      "duration": 60,
      "type": "at_home"
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "service": { "id": "svc_xxx", ... },
  "autoSynced": true,
  "message": "Service added and synced to your staff profile!"
}
```

#### 6. Create Booking (Test Auto-Assignment)
```bash
curl -X POST \
  https://[PROJECT_ID].supabase.co/functions/v1/make-server-3dd53475/bookings/create \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer [ANON_KEY]' \
  -d '{
    "customerId": "cust_123",
    "vendorId": "vendor_xxx",
    "serviceId": "svc_xxx",
    "serviceName": "Test Service",
    "serviceType": "at_home",
    "bookingDate": "2025-12-15",
    "bookingTime": "10:00",
    "price": 500,
    "customerName": "Test Customer",
    "customerPhone": "+918888888888"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "bookingId": "booking_xxx",
  "booking": {
    "id": "booking_xxx",
    "staffId": "staff_auto_xxx",
    "autoAssigned": true,
    ...
  }
}
```

---

## ✅ TESTING CHECKLIST

### Pre-Testing Setup
- [ ] Backend endpoints deployed
- [ ] Frontend components deployed
- [ ] Test environment configured
- [ ] Test accounts created

### Automated Tests
- [ ] All 10 automated tests pass
- [ ] No console errors
- [ ] Response times acceptable (<2s per test)
- [ ] Test data cleanup works

### Manual Onboarding Tests
- [ ] Business type selection shows
- [ ] Solo provider form is simplified
- [ ] Only one phone number required
- [ ] No GST/license validation
- [ ] Service area selector works
- [ ] Onboarding completes successfully
- [ ] Vendor/center/staff created correctly

### Dashboard Tests
- [ ] Solo dashboard loads
- [ ] Mode switcher visible
- [ ] Center mode shows business view
- [ ] Staff mode shows operations view
- [ ] Mode persists on refresh
- [ ] No errors in console

### Service Sync Tests
- [ ] Add service shows sync message
- [ ] Service appears in staff mode
- [ ] Update service syncs automatically
- [ ] Delete service removes from staff
- [ ] Multiple services sync correctly
- [ ] No orphaned data

### Booking Tests
- [ ] Customer can book solo provider
- [ ] Booking auto-assigns to staff
- [ ] Solo provider sees booking in staff mode
- [ ] Booking details correct
- [ ] Status updates work
- [ ] Notifications sent

### Privacy Tests
- [ ] Home address not shown to customers
- [ ] Service area displayed correctly
- [ ] Phone number protected
- [ ] Solo provider badge visible
- [ ] "Comes to you" indicator shown

### Integration Tests
- [ ] Onboarding → Dashboard flow works
- [ ] Dashboard → Service management works
- [ ] Service management → Booking works
- [ ] Customer discovery finds solo providers
- [ ] GPS tracking available for solo providers
- [ ] Payment processing works

### Performance Tests
- [ ] Onboarding completes in <5 minutes
- [ ] Dashboard loads in <2 seconds
- [ ] Service sync happens instantly
- [ ] Booking assignment is immediate
- [ ] No memory leaks
- [ ] Mobile responsive

### Edge Cases
- [ ] Duplicate phone number handled
- [ ] Invalid phone format rejected
- [ ] Empty service area handled
- [ ] Mode switch during operation
- [ ] Concurrent service updates
- [ ] Network interruption recovery

---

## 🐛 COMMON ISSUES & SOLUTIONS

### Issue 1: Tests Fail on First Run
**Symptom:** Automated tests fail initially  
**Solution:** 
- Ensure backend is deployed
- Check API_BASE URL is correct
- Verify publicAnonKey is valid
- Run tests again (may be cold start)

### Issue 2: Business Type Selection Not Showing
**Symptom:** Goes directly to old onboarding form  
**Solution:**
- Clear browser cache
- Check VendorOnboarding.tsx routes to EnhancedVendorOnboarding
- Verify BusinessTypeSelector component exists

### Issue 3: Services Not Syncing
**Symptom:** Service added but not in staff mode  
**Solution:**
- Check vendor has `isSoloProvider: true`
- Verify auto-sync code in vendor-services-endpoints.tsx
- Check console for sync errors
- Confirm staff record exists

### Issue 4: Booking Not Auto-Assigned
**Symptom:** Booking created but no staffId  
**Solution:**
- Check vendor.isSoloProvider flag
- Verify staff record exists in vendor:{vendorId}:staff
- Check booking-endpoints.tsx auto-assignment logic
- Confirm no manual assignment override

### Issue 5: Dashboard Shows Wrong View
**Symptom:** Multi-staff dashboard shown for solo provider  
**Solution:**
- Check vendorData.isSoloProvider flag
- Verify VendorDashboard.tsx detection logic
- Clear localStorage and re-login
- Check session data

---

## 📊 TEST RESULTS TRACKING

### Test Run Template

```
Test Date: __________
Tester: __________
Environment: [ ] Development [ ] Staging [ ] Production

Automated Tests: [ ] Passed [ ] Failed
  - Test 1-10 Status: _______________
  - Errors: _______________

Manual Tests: [ ] Passed [ ] Failed
  - Onboarding: [ ] Pass [ ] Fail
  - Dashboard: [ ] Pass [ ] Fail
  - Services: [ ] Pass [ ] Fail
  - Bookings: [ ] Pass [ ] Fail
  - Privacy: [ ] Pass [ ] Fail

Issues Found:
1. _______________
2. _______________
3. _______________

Notes:
_______________________________________________
_______________________________________________
```

---

## 🚀 NEXT STEPS AFTER TESTING

### If All Tests Pass:
1. ✅ Mark system as "Production Ready"
2. ✅ Deploy to production
3. ✅ Enable for real users
4. ✅ Monitor metrics
5. ✅ Collect feedback

### If Tests Fail:
1. ❌ Document all failures
2. ❌ Prioritize by severity
3. ❌ Fix critical issues first
4. ❌ Re-test after fixes
5. ❌ Repeat until all pass

---

## 📞 SUPPORT

For testing support or to report issues:
- Check error logs in browser console
- Review backend logs in Supabase
- Verify all integration points
- Re-run automated test suite
- Document reproduction steps

---

**TESTING STATUS: READY FOR EXECUTION** ✅  
**Last Updated:** December 10, 2025  
**Version:** 1.0.0
