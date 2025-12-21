# Booking Flow Dispatcher - Manual End-to-End Testing Guide
## Option A: Comprehensive Testing

**Date:** 2025  
**Status:** Testing Guide Ready  
**Component:** BookingFlowDispatcher.tsx

---

## Testing Overview

This guide provides step-by-step instructions for manually testing the `BookingFlowDispatcher` component with all service styles and types. Each test case includes setup instructions, expected behavior, and verification steps.

---

## Prerequisites

1. ✅ Application running (dev server)
2. ✅ Test customer account with phone number
3. ✅ Test vendor accounts for different service types
4. ✅ Test pets added to customer account
5. ✅ Browser dev tools open (for console logs)

---

## Test Case 1: Vet Center Booking (at_center + vet)

### Setup
```typescript
// Test Data
{
  serviceType: 'vet',
  serviceStyle: 'at_center',
  vendorId: 'vendor_vet_clinic_123',
  vendorName: 'City Vet Clinic',
  customerId: 'customer_123',
  customerPhone: '9876543210',
  staffId: 'doctor_456', // Optional: specific doctor
  selectedService: { id: 'service1', name: 'General Consultation' }, // Optional
  onBack: () => console.log('Back clicked'),
  onNavigate: (screen, data) => console.log('Navigate:', screen, data),
  onBookingComplete: (bookingId) => console.log('Booking complete:', bookingId)
}
```

### Expected Behavior
1. ✅ Renders `VetBookingRouter` component
2. ✅ Shows doctor selection or service selection screen
3. ✅ Allows navigation through booking flow
4. ✅ Back button works correctly
5. ✅ Booking completion triggers callback

### Verification Steps
- [ ] Component renders without errors
- [ ] Console shows: "VetBookingRouter initialized"
- [ ] Can navigate through booking steps
- [ ] Back button navigates correctly
- [ ] Booking completion shows success message
- [ ] `onBookingComplete` callback is called with booking ID

### Test Path
1. Navigate to vet service
2. Select clinic/center option
3. Choose vendor/clinic
4. Select doctor (if applicable)
5. Select service
6. Select pet
7. Select time slot
8. Complete payment
9. Verify booking success

---

## Test Case 2: Vet Home Booking (at_home + vet)

### Setup
```typescript
{
  serviceType: 'vet',
  serviceStyle: 'at_home',
  vendorId: 'vendor_vet_home_123',
  customerPhone: '9876543210',
  onBack: () => console.log('Back clicked'),
  onNavigate: (screen, data) => console.log('Navigate:', screen, data)
}
```

### Expected Behavior
1. ✅ Renders `VetBookingFlow` component
2. ✅ Shows service selection screen
3. ✅ Includes address selection step (for home service)
4. ✅ Navigation works correctly

### Verification Steps
- [ ] Component renders without errors
- [ ] Service selection screen appears
- [ ] Address selector appears after time slot selection
- [ ] Back button works at each step
- [ ] Booking flow completes successfully

### Test Path
1. Navigate to vet service
2. Select "At Home" option
3. Choose vendor
4. Select service
5. Select pet
6. Select time slot
7. **Select address** (home service specific)
8. Complete payment
9. Verify booking success

---

## Test Case 3: Vet Tele Consultation (tele + vet)

### Setup
```typescript
{
  serviceType: 'vet',
  serviceStyle: 'tele',
  vendorId: 'vendor_vet_tele_123',
  customerPhone: '9876543210',
  staffId: 'doctor_456', // Optional
  selectedService: { id: 'service1', name: 'Tele Consultation' }, // Optional
  onBack: () => console.log('Back clicked'),
  onNavigate: (screen, data) => console.log('Navigate:', screen, data)
}
```

### Expected Behavior
1. ✅ Renders `VetBookingRouter` component
2. ✅ Shows tele consultation specific flow
3. ✅ No address selection (tele service)
4. ✅ Video call preparation steps

### Verification Steps
- [ ] Component renders without errors
- [ ] Tele consultation flow appears
- [ ] No address selector (tele service)
- [ ] Booking flow completes successfully
- [ ] Video call link/instructions provided

### Test Path
1. Navigate to vet service
2. Select "Tele Consultation" option
3. Choose vendor/doctor
4. Select service
5. Select pet
6. Select time slot
7. Complete payment
8. Verify booking success with tele link

---

## Test Case 4: Package Booking (package)

### Setup
```typescript
{
  serviceType: 'training', // or 'grooming', etc.
  serviceStyle: 'package',
  vendorId: 'vendor_training_123',
  customerId: 'customer_123',
  customerPhone: '9876543210',
  petId: 'pet_123', // Optional
  onBack: () => console.log('Back clicked'),
  onNavigate: (screen, data) => console.log('Navigate:', screen, data),
  onBookingComplete: (bookingId) => console.log('Booking complete:', bookingId)
}
```

### Expected Behavior
1. ✅ Renders `PackageBookingPage` component
2. ✅ Shows package browsing screen
3. ✅ Back button appears in header (if onBack provided)
4. ✅ Can browse, schedule, and view packages
5. ✅ Booking completion triggers callback

### Verification Steps
- [ ] Component renders without errors
- [ ] Package browsing screen appears
- [ ] Back button visible in header
- [ ] Can browse available packages
- [ ] Can schedule package sessions
- [ ] Can view "My Packages"
- [ ] Booking completion shows toast notification
- [ ] `onBookingComplete` callback is called

### Test Path
1. Navigate to package booking
2. Browse available packages
3. Select a package
4. Schedule sessions (optional)
5. Confirm booking
6. Verify success toast
7. Check "My Packages" view
8. Verify callback triggered

---

## Test Case 5: Center Booking Enhanced (at_center + grooming/training)

### Setup
```typescript
{
  serviceType: 'grooming', // or 'training', etc.
  serviceStyle: 'at_center',
  vendorId: 'vendor_grooming_123',
  vendorName: 'Grooming Center',
  customerId: 'customer_123',
  customerPhone: '9876543210',
  customerName: 'John Doe', // Required
  petId: 'pet_123', // Required
  petName: 'Fluffy', // Required
  onBack: () => console.log('Back clicked'),
  onBookingComplete: (bookingId) => console.log('Booking complete:', bookingId)
}
```

### Expected Behavior
1. ✅ Renders `CenterBookingFlowEnhanced` component
2. ✅ Shows service selection with add-ons
3. ✅ Handles prescription/medical records if required
4. ✅ Booking completion triggers callback

### Verification Steps
- [ ] Component renders without errors
- [ ] Service selection screen appears
- [ ] Add-ons available (if configured)
- [ ] Prescription/medical records handled
- [ ] Booking flow completes successfully
- [ ] `onSuccess` callback is called

### Test Path
1. Navigate to grooming/training service
2. Select center option
3. Choose vendor
4. Select service (with add-ons if available)
5. Upload prescription/medical records (if required)
6. Select time slot
7. Complete payment
8. Verify booking success

---

## Test Case 6: Delivery Booking Placeholder (delivery)

### Setup
```typescript
{
  serviceType: 'pharmacy', // or 'nutrition', 'diagnostics'
  serviceStyle: 'delivery',
  vendorId: 'vendor_pharmacy_123',
  customerPhone: '9876543210',
  onBack: () => console.log('Back clicked')
}
```

### Expected Behavior
1. ✅ Renders placeholder component
2. ✅ Shows "Delivery booking flow coming soon" message
3. ✅ Back button works

### Verification Steps
- [ ] Placeholder renders without errors
- [ ] Message displayed correctly
- [ ] Back button works
- [ ] No errors in console

### Test Path
1. Navigate to delivery service
2. Verify placeholder appears
3. Click back button
4. Verify navigation works

---

## Test Case 7: Fallback Scenario (default)

### Setup
```typescript
{
  serviceType: 'unknown',
  serviceStyle: 'unknown', // Invalid style
  vendorId: 'vendor_123',
  customerPhone: '9876543210',
  onBack: () => console.log('Back clicked'),
  onNavigate: (screen, data) => console.log('Navigate:', screen, data)
}
```

### Expected Behavior
1. ✅ Falls back to `VetBookingFlow` (default)
2. ✅ Uses `serviceType="clinic"` as fallback
3. ✅ No errors thrown

### Verification Steps
- [ ] Component renders without errors
- [ ] Fallback flow appears
- [ ] No console errors

---

## Test Case 8: Missing Optional Props

### Setup
```typescript
// Minimal props
{
  serviceType: 'vet',
  serviceStyle: 'at_center',
  vendorId: 'vendor_123',
  customerId: 'customer_123',
  customerPhone: '9876543210'
  // No onBack, onNavigate, onBookingComplete
}
```

### Expected Behavior
1. ✅ Component renders successfully
2. ✅ Default handlers work (if implemented)
3. ✅ No errors thrown

### Verification Steps
- [ ] Component renders without errors
- [ ] Navigation works (with default handlers)
- [ ] No console errors

---

## Test Case 9: PackageBookingPage Navigation Props

### Specific Test for Fixed Component

### Setup
```typescript
{
  serviceStyle: 'package',
  customerPhone: '9876543210',
  customerId: 'customer_123',
  petId: 'pet_123',
  onBack: () => console.log('Back from package'),
  onNavigate: (screen, data) => console.log('Navigate from package:', screen, data),
  onBookingComplete: (bookingId) => console.log('Package booking complete:', bookingId)
}
```

### Expected Behavior
1. ✅ Back button appears in header
2. ✅ Back button calls `onBack` when clicked
3. ✅ Booking completion calls `onBookingComplete`
4. ✅ Toast notification appears (not alert)

### Verification Steps
- [ ] Back button visible in header
- [ ] Back button click triggers `onBack`
- [ ] Booking completion shows toast (not alert)
- [ ] `onBookingComplete` callback called with booking ID
- [ ] Navigation works correctly

---

## Common Issues to Watch For

### Issue 1: Props Not Passed Correctly
**Symptom:** Component doesn't receive expected props
**Check:** Console logs for prop values
**Fix:** Verify dispatcher prop mapping

### Issue 2: Navigation Not Working
**Symptom:** Back button or navigation doesn't work
**Check:** `onBack` and `onNavigate` handlers
**Fix:** Verify handlers are passed correctly

### Issue 3: Booking Completion Not Triggered
**Symptom:** Callback not called after booking
**Check:** `onBookingComplete` handler
**Fix:** Verify callback is passed and invoked

### Issue 4: Component Not Rendering
**Symptom:** Blank screen or error
**Check:** Console for errors, component imports
**Fix:** Verify imports and component availability

---

## Testing Checklist Summary

### Component Rendering
- [ ] VetBookingRouter renders correctly
- [ ] VetBookingFlow renders correctly
- [ ] CenterBookingFlowEnhanced renders correctly
- [ ] PackageBookingPage renders correctly
- [ ] Placeholder renders correctly

### Navigation
- [ ] Back button works for all flows
- [ ] Navigation handlers work correctly
- [ ] Screen transitions are smooth

### Booking Completion
- [ ] Callbacks triggered correctly
- [ ] Success messages appear
- [ ] Booking IDs are returned

### Error Handling
- [ ] Missing props handled gracefully
- [ ] Invalid service styles handled
- [ ] Network errors handled

---

## Test Results Template

```
Test Case: [Number] - [Name]
Date: [Date]
Tester: [Name]

Setup: [Brief description]
Result: ✅ PASS / ❌ FAIL / ⚠️ PARTIAL

Issues Found:
- [Issue 1]
- [Issue 2]

Notes:
[Additional notes]
```

---

## Next Steps After Testing

1. **Document Issues:** Record all issues found during testing
2. **Fix Issues:** Address critical issues first
3. **Re-test:** Verify fixes work correctly
4. **Update Documentation:** Update component docs with findings
5. **Proceed to Migration:** Once all tests pass, proceed with router migration

---

## Quick Test Commands

### Test Vet Center Booking
```javascript
// In browser console
window.testVetCenter = () => {
  // Trigger vet center booking flow
  // Verify VetBookingRouter renders
}
```

### Test Package Booking
```javascript
// In browser console
window.testPackage = () => {
  // Trigger package booking flow
  // Verify PackageBookingPage renders with back button
}
```

---

## Notes

- All test cases should be run in a clean browser session
- Clear cache if components don't update
- Check network tab for API calls
- Verify console for any errors or warnings
- Take screenshots of issues for documentation

