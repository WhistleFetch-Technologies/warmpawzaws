# Batch 1 Test Execution Guide
**Date:** 2025-01-28  
**Status:** Ready for Testing

---

## 🚀 QUICK START TESTING

### Prerequisites:
1. ✅ All 10 screens created
2. ✅ Navigation wired in App.tsx
3. ✅ API endpoints configured
4. ✅ Dependencies installed

### Test Environment Setup:
```bash
# Install dependencies
cd Warmpawzecodev/apps/WarmpawzVendor
npm install

# iOS
cd ios && pod install && cd ..
npm run ios

# Android
npm run android
```

---

## 📱 MANUAL TESTING CHECKLIST

### Test 1: Booking Detail Navigation
- [ ] Navigate to Bookings list
- [ ] Tap on a booking
- [ ] Verify BookingDetailScreen opens
- [ ] Verify booking information displays
- [ ] Verify action buttons show based on status
- [ ] Tap "Back" - verify navigation works

### Test 2: Booking Completion Flow
- [ ] From BookingDetailScreen, tap "Complete Booking"
- [ ] Verify BookingCompletionScreen opens
- [ ] Enter OTP (or verify no OTP required)
- [ ] Tap "Complete Booking"
- [ ] Verify success message
- [ ] Verify navigation back
- [ ] Verify booking status updated

### Test 3: Staff Assignment Flow
- [ ] From BookingDetailScreen, tap "Assign Staff"
- [ ] Verify StaffAssignmentScreen opens
- [ ] Verify staff list loads
- [ ] Select one or more staff members
- [ ] Tap "Assign Staff"
- [ ] Verify success message
- [ ] Verify navigation back
- [ ] Verify staff assigned to booking

### Test 4: Check-In Flow
- [ ] From BookingDetailScreen (boarding/resort booking), tap "Check In"
- [ ] Verify BookingCheckInScreen opens
- [ ] Enter pet condition (required)
- [ ] Add optional notes
- [ ] Tap "Complete Check-In"
- [ ] Verify success message
- [ ] Verify booking status updated to in_progress

### Test 5: Start Service Flow
- [ ] From BookingDetailScreen, tap "Start Service"
- [ ] Verify StartServiceScreen opens
- [ ] If OTP required, enter START OTP
- [ ] Tap "Start Service"
- [ ] Verify success message
- [ ] Verify booking status updated

### Test 6: GPS Tracking Flow
- [ ] From BookingDetailScreen (home service), tap "GPS Tracking"
- [ ] Verify GPSTrackingScreen opens
- [ ] Grant location permission
- [ ] Tap "Start Tracking"
- [ ] Verify map displays
- [ ] Verify current location marker
- [ ] Verify location updates (move device or simulate)
- [ ] Verify route recorded
- [ ] Verify distance calculated
- [ ] Tap "Stop Tracking"
- [ ] Verify tracking stopped

### Test 7: Route Tracking Flow
- [ ] Navigate to RouteTrackingScreen
- [ ] Verify route displayed on map
- [ ] Verify start/end markers
- [ ] Verify distance/duration stats
- [ ] Tap "Start Live Tracking"
- [ ] Verify navigation to GPSTrackingScreen

### Test 8: File Upload Flow
- [ ] From BookingDetailScreen, navigate to FileUpload
- [ ] Verify FileUploadScreen opens
- [ ] Tap "Choose from Gallery"
- [ ] Select image
- [ ] Verify preview displays
- [ ] Tap "Upload File"
- [ ] Verify upload success
- [ ] Test camera capture
- [ ] Verify photo preview
- [ ] Upload photo

### Test 9: Push Notifications
- [ ] On app start, verify permission requested
- [ ] Grant notification permission
- [ ] Verify device token obtained
- [ ] Verify token registered with backend
- [ ] Send test notification from backend
- [ ] Verify notification received
- [ ] Tap notification
- [ ] Verify navigation to booking

### Test 10: Booking Actions Hub
- [ ] Navigate to BookingActionsScreen
- [ ] Verify all available actions display
- [ ] Verify actions filtered by booking status
- [ ] Tap each action
- [ ] Verify navigation to correct screen
- [ ] Verify data passed correctly

---

## 🔄 E2E TEST FLOWS

### Flow A: Complete Booking Journey (Boarding)
```
1. Login → Dashboard
2. Navigate to Bookings
3. Select pending booking
4. Assign Staff
5. Accept Booking
6. Check In (enter pet condition)
7. Complete Booking (with OTP)
8. Verify booking completed
```

### Flow B: Home Service with GPS
```
1. Login → Dashboard
2. Navigate to Bookings
3. Select confirmed home service booking
4. Start Service
5. Start GPS Tracking
6. Track route (simulate movement)
7. Complete Service
8. Complete Booking
9. Verify all steps completed
```

### Flow C: Walker Service
```
1. Login → Dashboard
2. Navigate to Bookings
3. Select walker booking
4. Start Service (with START OTP)
5. GPS Tracking active
6. Track walk route
7. End session
8. Complete Booking
```

---

## 🐛 ERROR SCENARIO TESTS

### Network Errors:
- [ ] Turn off WiFi/data
- [ ] Try to complete booking
- [ ] Verify error message displays
- [ ] Turn on network
- [ ] Retry - verify success

### Invalid OTP:
- [ ] Enter wrong OTP
- [ ] Tap Complete
- [ ] Verify error message
- [ ] Enter correct OTP
- [ ] Verify success

### Permission Denied:
- [ ] Deny location permission
- [ ] Try GPS tracking
- [ ] Verify error message
- [ ] Grant permission in settings
- [ ] Retry - verify works

### Missing Data:
- [ ] Navigate to screen without bookingId
- [ ] Verify error handling
- [ ] Verify graceful degradation

---

## 📊 TEST RESULTS TEMPLATE

```markdown
## Batch 1 Test Results - [Date/Time]

### Test Summary:
- Total Tests: 50+
- Passed: X
- Failed: Y
- Pass Rate: XX%

### Screen Test Results:

#### 1. BookingCompletionScreen
- ✅ Renders correctly
- ✅ OTP validation works
- ✅ API integration works
- ✅ Error handling works
- Issues: None

#### 2. BookingDetailScreen
- ✅ Renders correctly
- ✅ Navigation works
- ✅ Status badges correct
- Issues: None

[... continue for all screens ...]

### Failed Tests:
1. [Screen] - [Test] - [Error] - [Fix Applied]

### Fixed Issues:
1. [Issue] - [Fix] - [Status]

### Remaining Issues:
1. [Issue] - [Priority] - [Notes]
```

---

## 🔧 QUICK FIX GUIDE

### Common Issues:

#### Issue: Screen not navigating
**Fix:** Check navigationTarget state and screen name match

#### Issue: API call failing
**Fix:** Verify endpoint path includes `/make-server-3dd53475` prefix

#### Issue: Permission not requested
**Fix:** Check permission request code in screen

#### Issue: Map not displaying
**Fix:** Verify `react-native-maps` installed and configured

#### Issue: Image picker not working
**Fix:** Verify `expo-image-picker` permissions granted

---

## ✅ TEST COMPLETION CRITERIA

Before moving to Batch 2:
- [ ] All 10 screens tested individually
- [ ] All E2E flows tested
- [ ] All error scenarios tested
- [ ] iOS build successful
- [ ] Android build successful
- [ ] No critical bugs
- [ ] All navigation works
- [ ] All API calls work
- [ ] All permissions work
- [ ] Performance acceptable

---

## 📝 TEST EXECUTION LOG

**Date:** _____________  
**Tester:** _____________  
**Environment:** iOS / Android / Both

### Results:
- [ ] All tests passed
- [ ] Some tests failed (see below)
- [ ] Critical issues found

### Issues Found:
1. _________________________________
2. _________________________________
3. _________________________________

### Fixes Applied:
1. _________________________________
2. _________________________________
3. _________________________________

### Status: ✅ READY FOR BATCH 2 / ⚠️ FIXES NEEDED

---

**Next:** Execute tests, document results, fix any issues, then proceed to Batch 2

