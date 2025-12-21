# Booking Flow Dispatcher - Quick Test Scenarios
## Ready-to-Use Test Cases

**Date:** 2025  
**Status:** Test Scenarios Ready

---

## Quick Test Scenarios

### Scenario 1: Vet Center Booking (Most Common)
**Path:** Customer App → Vet Services → Clinic → Select Clinic → Book Appointment

**Expected Flow:**
1. Customer selects "Vet Services"
2. Chooses "At Clinic" option
3. Selects a clinic from list
4. **BookingFlowDispatcher** renders with:
   - `serviceType: 'vet'`
   - `serviceStyle: 'at_center'`
   - `vendorId: [selected clinic ID]`
5. **VetBookingRouter** component appears
6. Customer selects doctor/service
7. Completes booking flow

**Verify:**
- ✅ VetBookingRouter renders
- ✅ Doctor selection works
- ✅ Booking completes successfully

---

### Scenario 2: Package Booking (Fixed Component)
**Path:** Customer App → Training Services → Packages → Browse Packages

**Expected Flow:**
1. Customer navigates to package booking
2. **BookingFlowDispatcher** renders with:
   - `serviceStyle: 'package'`
   - `customerPhone: [phone]`
   - `customerId: [id]`
3. **PackageBookingPage** component appears
4. **Back button visible in header** ✅ (NEW)
5. Customer browses packages
6. Selects and books package
7. **Toast notification appears** ✅ (NEW - not alert)
8. **onBookingComplete callback triggered** ✅ (NEW)

**Verify:**
- ✅ PackageBookingPage renders
- ✅ Back button in header works
- ✅ Toast notification appears (not alert)
- ✅ Callback triggered with booking ID

---

### Scenario 3: Vet Home Service
**Path:** Customer App → Vet Services → At Home → Select Service

**Expected Flow:**
1. Customer selects "Vet Services"
2. Chooses "At Home" option
3. **BookingFlowDispatcher** renders with:
   - `serviceType: 'vet'`
   - `serviceStyle: 'at_home'`
4. **VetBookingFlow** component appears
5. Customer selects service, pet, time
6. **Address selector appears** (home service specific)
7. Completes booking

**Verify:**
- ✅ VetBookingFlow renders
- ✅ Address selector appears
- ✅ Booking completes successfully

---

### Scenario 4: Tele Consultation
**Path:** Customer App → Vet Services → Tele Consultation → Book

**Expected Flow:**
1. Customer selects "Vet Services"
2. Chooses "Tele Consultation"
3. **BookingFlowDispatcher** renders with:
   - `serviceType: 'vet'`
   - `serviceStyle: 'tele'`
4. **VetBookingRouter** component appears
5. Customer selects doctor/service
6. **No address selector** (tele service)
7. Completes booking

**Verify:**
- ✅ VetBookingRouter renders
- ✅ No address selector
- ✅ Booking completes successfully

---

### Scenario 5: Grooming Center Booking
**Path:** Customer App → Grooming Services → Center → Select Center → Book

**Expected Flow:**
1. Customer selects "Grooming Services"
2. Chooses "At Center"
3. Selects a grooming center
4. **BookingFlowDispatcher** renders with:
   - `serviceType: 'grooming'`
   - `serviceStyle: 'at_center'`
   - `petId: [pet ID]` ✅ (Required)
   - `petName: [pet name]` ✅ (Required)
   - `customerName: [name]` ✅ (Required)
5. **CenterBookingFlowEnhanced** component appears (if pet/customer data available)
6. Customer selects service, add-ons
7. Completes booking

**Verify:**
- ✅ CenterBookingFlowEnhanced renders (if data available)
- ✅ Service selection with add-ons works
- ✅ Booking completes successfully

---

## Test Data Requirements

### Customer Account
- Phone: `9876543210`
- Customer ID: `customer_123`
- Name: `John Doe`
- At least 1 pet added

### Vendor Accounts
- Vet Clinic: `vendor_vet_clinic_123`
- Grooming Center: `vendor_grooming_123`
- Training Center: `vendor_training_123`
- Pharmacy: `vendor_pharmacy_123`

### Pet Data
- Pet ID: `pet_123`
- Pet Name: `Fluffy`
- Species: `Dog`

---

## Critical Test Points

### ✅ PackageBookingPage Fixes (NEW)
1. **Back Button:** Should appear in header when `onBack` prop provided
2. **Toast Notifications:** Should use `toast.success()` not `alert()`
3. **Callback:** Should call `onBookingComplete` with booking ID
4. **Navigation:** Should support `onNavigate` for external navigation

### ✅ Prop Passing
1. All props should be passed correctly to child components
2. Optional props should be handled gracefully
3. Default handlers should work if props not provided

### ✅ Navigation
1. Back button should work at all steps
2. Navigation handlers should be called correctly
3. Screen transitions should be smooth

---

## Expected Console Output

### Successful Vet Center Booking
```
🎯 [VET-BOOKING-ROUTER] Initializing with:
   - Doctor: undefined
   - Doctor ID: doctor_456
   - Selected Service: { id: 'service1', name: 'General Consultation' }
   - Service Type: clinic
   - Initial View: select_pet
```

### Successful Package Booking
```
✅ Package booking created successfully!
Booking complete: booking_package_123
```

---

## Common Errors to Watch For

### Error 1: "Cannot read property 'onBack' of undefined"
**Cause:** Component not receiving `onBack` prop
**Fix:** Verify dispatcher passes `handleBack` function

### Error 2: "Component is not a function"
**Cause:** Import error or component not exported
**Fix:** Verify component imports in dispatcher

### Error 3: "Props validation failed"
**Cause:** Missing required props
**Fix:** Verify all required props are passed

---

## Success Criteria

### All Tests Pass If:
- ✅ All components render without errors
- ✅ Navigation works correctly
- ✅ Booking completion triggers callbacks
- ✅ No console errors
- ✅ User experience is smooth

### Ready for Migration If:
- ✅ All test cases pass
- ✅ No critical issues found
- ✅ Edge cases handled
- ✅ Documentation updated

---

## Next Steps

1. **Run Test Scenarios:** Execute all test cases
2. **Document Results:** Record pass/fail for each test
3. **Fix Issues:** Address any problems found
4. **Re-test:** Verify fixes work
5. **Proceed:** Move to router migration once all tests pass

