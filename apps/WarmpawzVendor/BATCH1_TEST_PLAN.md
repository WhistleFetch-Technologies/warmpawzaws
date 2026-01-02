# Batch 1 Test Plan
**Date:** 2025-01-28  
**Batch:** 1 - P0 Critical Booking Operations  
**Screens:** 10

---

## 🧪 TESTING PROTOCOL

### Test Categories:
1. **Unit Tests** - Component rendering and logic
2. **Integration Tests** - API integration
3. **Navigation Tests** - Screen navigation flow
4. **Permission Tests** - Location, camera, notifications
5. **E2E Tests** - Complete user flows
6. **Error Handling Tests** - Error scenarios
7. **Build Tests** - iOS/Android compilation

---

## 📋 SCREEN-BY-SCREEN TEST CHECKLIST

### 1. BookingCompletionScreen

#### Unit Tests:
- [ ] Screen renders without errors
- [ ] OTP input field displays
- [ ] OTP validation works
- [ ] Complete button disabled when OTP missing
- [ ] Loading state displays during submission
- [ ] Success message shows on completion
- [ ] Error message shows on failure

#### Integration Tests:
- [ ] API call made with correct endpoint
- [ ] OTP sent in request body
- [ ] Response handled correctly
- [ ] Booking status updated

#### Error Scenarios:
- [ ] Invalid OTP handling
- [ ] Network error handling
- [ ] Missing booking error
- [ ] Unauthorized error

**Test Command:**
```bash
# Manual test flow
1. Navigate to BookingCompletionScreen
2. Enter valid OTP
3. Tap "Complete Booking"
4. Verify success message
5. Verify booking status updated
```

---

### 2. BookingDetailScreen

#### Unit Tests:
- [ ] Booking details display correctly
- [ ] Status badge shows correct color
- [ ] Action buttons show/hide based on status
- [ ] Navigation to other screens works
- [ ] Loading state displays
- [ ] Error state displays

#### Integration Tests:
- [ ] Booking data fetched from API
- [ ] Navigation triggers correctly
- [ ] Data refresh works

**Test Command:**
```bash
# Test with different booking statuses
1. pending - Should show Assign Staff, Accept, Reject
2. confirmed - Should show Check In, Start Service, Complete
3. in_progress - Should show Complete
4. completed - Should show minimal actions
```

---

### 3. StaffAssignmentScreen

#### Unit Tests:
- [ ] Staff list loads and displays
- [ ] Staff selection works (multi-select)
- [ ] Checkbox state updates
- [ ] Selected count displays
- [ ] Assign button disabled when no selection
- [ ] Loading state during assignment

#### Integration Tests:
- [ ] Staff list fetched from API
- [ ] Assignment API called with correct data
- [ ] Multiple staff assignment works
- [ ] Primary/secondary assignment types

#### Permission Tests:
- [ ] Handles empty staff list
- [ ] Handles API errors gracefully

**Test Command:**
```bash
1. Navigate to StaffAssignmentScreen
2. Select 1 staff member
3. Tap "Assign Staff"
4. Verify success message
5. Verify staff assigned to booking
```

---

### 4. BookingCheckInScreen

#### Unit Tests:
- [ ] Pet condition field required
- [ ] Notes field optional
- [ ] Form validation works
- [ ] Submit button disabled when condition empty
- [ ] Loading state during check-in

#### Integration Tests:
- [ ] Check-in API called correctly
- [ ] Pet condition sent in request
- [ ] Booking status updated to in_progress
- [ ] Check-in time recorded

**Test Command:**
```bash
1. Navigate to BookingCheckInScreen
2. Enter pet condition
3. Add optional notes
4. Tap "Complete Check-In"
5. Verify booking status updated
```

---

### 5. StartServiceScreen

#### Unit Tests:
- [ ] OTP input shows when required
- [ ] Direct start works when OTP not required
- [ ] OTP validation
- [ ] Loading state
- [ ] Success/error handling

#### Integration Tests:
- [ ] Start API called correctly
- [ ] OTP verified
- [ ] Booking status updated
- [ ] Session started for walker services

**Test Command:**
```bash
# Test with OTP required
1. Navigate to StartServiceScreen
2. Enter START OTP
3. Tap "Start Service"
4. Verify service started

# Test without OTP
1. Navigate to StartServiceScreen (non-OTP service)
2. Tap "Start Service"
3. Verify service started directly
```

---

### 6. GPSTrackingScreen

#### Unit Tests:
- [ ] Map renders correctly
- [ ] Current location marker displays
- [ ] Customer location marker displays
- [ ] Route polyline displays
- [ ] Start/stop tracking buttons work
- [ ] Distance calculation correct
- [ ] Stats update correctly

#### Permission Tests:
- [ ] Location permission requested
- [ ] Permission denied handling
- [ ] Permission granted flow

#### Integration Tests:
- [ ] Location updates every 5 seconds
- [ ] Route points recorded
- [ ] Distance calculated correctly
- [ ] Map updates with location

**Test Command:**
```bash
1. Navigate to GPSTrackingScreen
2. Grant location permission
3. Tap "Start Tracking"
4. Move around (or simulate)
5. Verify location updates
6. Verify route recorded
7. Tap "Stop Tracking"
8. Verify tracking stopped
```

---

### 7. RouteTrackingScreen

#### Unit Tests:
- [ ] Map renders with route
- [ ] Start/end markers display
- [ ] Route polyline displays
- [ ] Distance calculation
- [ ] Duration calculation
- [ ] Link to live tracking works

#### Integration Tests:
- [ ] Route data displayed correctly
- [ ] Navigation to GPSTrackingScreen works

**Test Command:**
```bash
1. Navigate to RouteTrackingScreen
2. Verify route displayed on map
3. Verify start/end markers
4. Verify distance/duration stats
5. Tap "Start Live Tracking"
6. Verify navigation to GPSTrackingScreen
```

---

### 8. FileUploadScreen

#### Unit Tests:
- [ ] Gallery button works
- [ ] Camera button works
- [ ] Image preview displays
- [ ] Remove button works
- [ ] Upload button disabled when no file
- [ ] Loading state during upload

#### Permission Tests:
- [ ] Camera permission requested
- [ ] Gallery permission requested
- [ ] Permission denied handling

#### Integration Tests:
- [ ] File selected from gallery
- [ ] Photo taken with camera
- [ ] File uploaded to backend
- [ ] Success message displayed

**Test Command:**
```bash
# Test gallery selection
1. Navigate to FileUploadScreen
2. Tap "Choose from Gallery"
3. Select image
4. Verify preview
5. Tap "Upload File"
6. Verify upload success

# Test camera
1. Navigate to FileUploadScreen
2. Tap "Take Photo"
3. Take photo
4. Verify preview
5. Tap "Upload File"
6. Verify upload success
```

---

### 9. PushNotificationSetup

#### Unit Tests:
- [ ] Permission request works
- [ ] Device token obtained
- [ ] Token registered with backend
- [ ] Notification listeners set up
- [ ] Notification received handling
- [ ] Notification tapped handling

#### Integration Tests:
- [ ] Token sent to backend
- [ ] Backend registration successful
- [ ] Notifications received
- [ ] Navigation on notification tap

**Test Command:**
```bash
1. Call setupPushNotifications(vendorId)
2. Grant notification permission
3. Verify token obtained
4. Verify token registered
5. Send test notification
6. Verify notification received
7. Tap notification
8. Verify navigation works
```

---

### 10. BookingActionsScreen

#### Unit Tests:
- [ ] All actions display
- [ ] Actions filtered by booking status
- [ ] Navigation to each action works
- [ ] Correct data passed to screens

#### Integration Tests:
- [ ] Context-aware action availability
- [ ] Navigation flow works
- [ ] Booking data passed correctly

**Test Command:**
```bash
1. Navigate to BookingActionsScreen
2. Verify available actions based on status
3. Tap each action
4. Verify navigation to correct screen
5. Verify data passed correctly
```

---

## 🔄 E2E TEST FLOWS

### Flow 1: Complete Booking Journey
```
1. View Booking Detail
2. Assign Staff
3. Check In (if boarding/resort)
4. Start Service
5. Upload Prescription/Report
6. Complete Booking with OTP
```

### Flow 2: Home Service with GPS
```
1. View Booking Detail
2. Start Service
3. Start GPS Tracking
4. Track route to customer
5. Complete service
6. Complete Booking
```

### Flow 3: Walker Service
```
1. View Booking Detail
2. Start Service with OTP
3. GPS Tracking active
4. Track walk route
5. End session
6. Complete Booking
```

---

## 🐛 ERROR SCENARIO TESTS

### Network Errors:
- [ ] No internet connection
- [ ] Slow network
- [ ] Request timeout
- [ ] Server error (500)
- [ ] Not found (404)
- [ ] Unauthorized (401)

### Validation Errors:
- [ ] Invalid OTP
- [ ] Missing required fields
- [ ] Invalid file format
- [ ] File too large

### Permission Errors:
- [ ] Location permission denied
- [ ] Camera permission denied
- [ ] Gallery permission denied
- [ ] Notification permission denied

---

## 📱 PLATFORM-SPECIFIC TESTS

### iOS:
- [ ] All screens render correctly
- [ ] Navigation works
- [ ] Permissions work
- [ ] Maps display correctly
- [ ] Camera works
- [ ] Notifications work
- [ ] Build succeeds

### Android:
- [ ] All screens render correctly
- [ ] Navigation works
- [ ] Permissions work
- [ ] Maps display correctly
- [ ] Camera works
- [ ] Notifications work
- [ ] Build succeeds

---

## ✅ TEST EXECUTION CHECKLIST

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All navigation tests pass
- [ ] All permission tests pass
- [ ] All E2E flows work
- [ ] Error scenarios handled
- [ ] iOS build successful
- [ ] Android build successful
- [ ] No console errors
- [ ] No crashes
- [ ] Performance acceptable

---

## 📊 TEST RESULTS TEMPLATE

```markdown
## Test Results - [Date]

### Summary:
- Total Tests: X
- Passed: Y
- Failed: Z
- Pass Rate: XX%

### Failed Tests:
1. [Screen] - [Test] - [Error]
2. ...

### Fixed Issues:
1. [Issue] - [Fix]
2. ...

### Remaining Issues:
1. [Issue] - [Priority]
2. ...
```

---

**Next:** Execute tests, document results, fix issues, then proceed to Batch 2

