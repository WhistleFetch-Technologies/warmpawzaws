# Test Execution Guide - Unified Appointment Management

## Prerequisites
1. Ensure backend is running and accessible
2. Ensure frontend applications are built and running
3. Have test credentials for:
   - Vendor account
   - Staff account
   - Solo provider account
   - Customer account

## Manual Testing Checklist

### 1. Vendor Dashboard - Booking Management

**Test Steps:**
1. Login as vendor
2. Navigate to Dashboard
3. Click on "Bookings" or "Appointment Management"
4. Verify `UniversalAppointmentManagement` component loads
5. Check filters (Today/Week/Month) work
6. Verify appointment cards display correctly
7. Test Accept/Reject actions on pending bookings
8. Test Start/Complete actions on confirmed/in-progress bookings
9. Verify OTP modal appears for non-tele services
10. Check GPS tracking button appears for at_home services

**Expected Results:**
- ✅ Component loads without errors
- ✅ Appointments fetch from `/vendor/bookings/:vendorId`
- ✅ All actions work correctly
- ✅ Toast notifications appear for success/error

**Test Data:**
- Vendor ID: Use existing vendor
- Booking Status: pending, confirmed, in_progress, completed

---

### 2. Staff Dashboard - Appointments

**Test Steps:**
1. Login as staff member
2. Navigate to `/staff/appointments` or click "Appointments" in dashboard
3. Verify `UniversalAppointmentManagement` component loads
4. Check appointments are filtered by staff ID
5. Test Accept/Reject actions
6. Test Start/Complete with OTP
7. Verify GPS tracking for at_home services
8. Check chat integration works

**Expected Results:**
- ✅ Component loads with staff context
- ✅ Appointments fetch from `/staff/:staffId/appointments`
- ✅ Actions use staff-specific endpoints
- ✅ OTP verification works

**Test Data:**
- Staff ID: Use existing staff member
- Vendor ID: Staff's associated vendor

---

### 3. Solo Provider Dashboard - Bookings

**Test Steps:**
1. Login as solo provider
2. Navigate to dashboard
3. Click "Bookings" tab
4. Verify `UniversalAppointmentManagement` component loads
5. Check appointments display correctly
6. Test all actions (Accept/Reject/Start/Complete)
7. Verify OTP flow works

**Expected Results:**
- ✅ Component loads with solo provider context
- ✅ Appointments fetch from `/vendor/bookings/:soloVendorId`
- ✅ All features work same as vendor

**Test Data:**
- Solo Vendor ID: Use existing solo provider

---

### 4. Customer Booking Flow - Staff Selection

**Test Steps:**
1. Login as customer
2. Navigate to booking flow for a center service
3. Select service type: "at_center"
4. Verify `StaffSelectionStep` component appears
5. Check staff list loads from `/vendor/:vendorId/staff`
6. Select a staff member
7. Proceed to details step
8. Complete booking
9. Verify booking created with `staff_id`

**Expected Results:**
- ✅ Staff selection step appears for at_center services
- ✅ Staff list displays correctly
- ✅ Staff selection works
- ✅ Booking includes `staff_id` in payload

**Test Data:**
- Vendor ID: Clinic with staff members
- Service Type: at_center
- Staff: Active, verified staff members

---

## API Endpoint Testing

### Test Staff Appointments Endpoint
```bash
# Get staff appointments
curl -X GET "https://api.example.com/staff/staff-123/appointments?date=2025-01-30" \
  -H "Authorization: Bearer <token>"

# Expected: { success: true, appointments: [...], total: N }
```

### Test Staff Actions
```bash
# Accept booking
curl -X PUT "https://api.example.com/staff/staff-123/appointments/booking-456/accept" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{}'

# Reject booking
curl -X PUT "https://api.example.com/staff/staff-123/appointments/booking-456/reject" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Not available"}'

# Start service
curl -X PUT "https://api.example.com/staff/staff-123/appointments/booking-456/start" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"otp": "1234"}'

# Complete service
curl -X PUT "https://api.example.com/staff/staff-123/appointments/booking-456/complete" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"otp": "5678"}'
```

### Test Vendor Bookings Endpoint
```bash
# Get vendor bookings
curl -X GET "https://api.example.com/vendor/bookings/vendor-123?date=2025-01-30&filter=all" \
  -H "Authorization: Bearer <token>"
```

### Test Staff Discovery Endpoint
```bash
# Get staff for vendor
curl -X GET "https://api.example.com/vendor/vendor-123/staff" \
  -H "Authorization: Bearer <token>"
```

### Test Booking Creation with Staff ID
```bash
# Create booking with staff_id
curl -X POST "https://api.example.com/bookings/create" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_phone": "+1234567890",
    "vendor_id": "vendor-123",
    "staff_id": "staff-456",
    "service_type": "at_center",
    "scheduled_date": "2025-01-30",
    "scheduled_time": "10:00",
    "status": "pending"
  }'
```

---

## Browser Console Testing

### Check for Errors
1. Open browser DevTools (F12)
2. Navigate to Console tab
3. Test each user type flow
4. Check for:
   - API errors
   - Component errors
   - Network failures
   - Type errors

### Verify API Calls
1. Open Network tab in DevTools
2. Filter by "Fetch/XHR"
3. Verify endpoints called:
   - `/staff/:staffId/appointments` (for staff)
   - `/vendor/bookings/:vendorId` (for vendor/solo)
   - `/vendor/:vendorId/staff` (for staff selection)
   - Action endpoints (accept/reject/start/complete)

### Check Response Format
- Verify `success: true` in responses
- Check data structure matches expected format
- Verify error handling works

---

## Integration Testing Scenarios

### Scenario 1: Staff Accepts Booking
1. Customer creates booking with staff_id
2. Staff logs in and sees pending booking
3. Staff clicks "Accept"
4. Booking status changes to "confirmed"
5. Customer receives notification

### Scenario 2: Staff Starts Service
1. Staff has confirmed booking
2. Staff clicks "Start Service"
3. OTP modal appears (for non-tele)
4. Staff enters OTP
5. Service status changes to "in_progress"
6. GPS tracking starts (for at_home)

### Scenario 3: Staff Completes Service
1. Staff has in_progress booking
2. Staff clicks "Complete Service"
3. OTP modal appears
4. Staff enters OTP
5. Service status changes to "completed"
6. Payment processed

### Scenario 4: Customer Books with Staff Selection
1. Customer selects center service
2. Staff selection step appears
3. Customer selects staff member
4. Booking created with staff_id
5. Selected staff receives notification

---

## Error Scenarios to Test

1. **Network Failure**
   - Disconnect network
   - Try to load appointments
   - Verify error message appears

2. **Invalid OTP**
   - Enter wrong OTP
   - Verify error message
   - Verify service doesn't start/complete

3. **Missing Staff**
   - Try to book with unavailable staff
   - Verify appropriate message

4. **Unauthorized Access**
   - Try to access staff appointments without auth
   - Verify redirect to login

---

## Performance Testing

1. **Load Time**
   - Measure time to load appointments list
   - Should be < 2 seconds

2. **Action Response Time**
   - Measure time for accept/reject/start/complete
   - Should be < 1 second

3. **Large Dataset**
   - Test with 100+ appointments
   - Verify pagination/filtering works

---

## Accessibility Testing

1. **Keyboard Navigation**
   - Tab through all interactive elements
   - Verify focus indicators
   - Test Enter/Space on buttons

2. **Screen Reader**
   - Test with screen reader
   - Verify all text is readable
   - Check button labels

---

## Cross-Browser Testing

Test on:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

---

## Test Results Template

```
Test Case: [Name]
Date: [Date]
Tester: [Name]
Environment: [Dev/Staging/Prod]

Steps:
1. [Step]
2. [Step]
...

Expected Result: [Description]
Actual Result: [Description]
Status: ✅ Pass / ❌ Fail

Notes: [Any observations]
```

---

## Automated Test Execution

Run the test suite:
```bash
npm test -- unified-appointment-management.test.ts
```

Or run all tests:
```bash
npm test
```

---

## Reporting Issues

When reporting issues, include:
1. User type (vendor/staff/solo)
2. Action attempted
3. Expected behavior
4. Actual behavior
5. Browser/OS
6. Console errors
7. Network request/response
8. Screenshots if applicable
