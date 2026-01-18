# Event Management End-to-End Test Plan

## Prerequisites
1. Database migration applied
2. Backend deployed
3. Frontend apps deployed
4. Test accounts ready:
   - Vendor account with `events` capability (or `event_organizer` role)
   - Admin account
   - Customer account

---

## Test Flow 1: Vendor Creates Event → Admin Approves → Customer Books → Vendor Checks In

### Step 1: Vendor Creates Event
1. **Login as Vendor** (with events capability)
2. Navigate to **Events** section (should appear in dashboard if vendor has `events` capability)
3. Click **"Create Event"**
4. Fill in all fields:
   - **Event Name**: "Pet Adoption Drive 2025"
   - **Category**: "Adoption Drive"
   - **Description**: "Join us for a pet adoption event"
   - **Event Date**: Future date
   - **Start Time**: 10:00 AM
   - **End Time**: 4:00 PM
   - **Venue Name**: "Central Park"
   - **Venue Address**: "123 Main St"
   - **City**: "Mumbai"
   - **State**: "Maharashtra"
   - **PIN Code**: "400001"
   - **Maximum Bookings**: 50
   - **Price per Booking**: ₹500
   - **Inclusions**: 
     - "Pet adoption counseling"
     - "Health check-up"
     - "Starter kit"
   - **Exclusions**:
     - "Food and beverages"
     - "Transportation"
   - **Terms & Conditions**: "Must be 18+ to adopt"
   - **Cancellation Policy**: "Full refund if cancelled 48 hours before"
   - **Refund Policy**: "100% refund within 48 hours"
5. Click **"Create Event"**
6. **Expected**: Event created with status "Pending Approval"

### Step 2: Admin Approves Event
1. **Login as Admin**
2. Navigate to **Events** section
3. Filter by **"Pending Approval"**
4. Find the event "Pet Adoption Drive 2025"
5. Click **"Approve"**
6. **Expected**: 
   - Event status changes to "Approved"
   - Event appears in "Approved" filter
   - Event status becomes "Published"

### Step 3: Customer Discovers and Registers
1. **Login as Customer**
2. Navigate to **Events** section
3. Find "Pet Adoption Drive 2025" in Discover Events
4. Click **"View Details"** or **"Register Now"**
5. Fill registration form (if any)
6. Click **"Register"**
7. **Expected**:
   - Registration successful
   - Booking reference displayed (format: EVT-YYYYMMDD-XXXXXX)
   - QR code displayed
   - Event appears in "My Events" tab

### Step 4: Vendor Checks In Customer
1. **Login as Vendor**
2. Navigate to **Events** section
3. Find "Pet Adoption Drive 2025"
4. Click **"Check-In"** button
5. **Option A - QR Scanner**:
   - Click **"Scan QR"** button
   - Point camera at customer's QR code
   - QR code should be detected and booking reference extracted
   - Customer details should appear
6. **Option B - Manual Lookup**:
   - Enter booking reference in search box
   - Click **"Verify"**
   - Customer details should appear
7. Click **"Check In Customer"**
8. **Expected**:
   - Check-in status changes to "Checked In"
   - Check-in time recorded
   - Customer appears in checked-in list

---

## Test Flow 2: Admin Rejects Event

### Step 1: Vendor Creates Event
1. Vendor creates an event with inappropriate content

### Step 2: Admin Rejects Event
1. **Login as Admin**
2. Navigate to **Events** → Filter by **"Pending Approval"**
3. Find the event
4. Click **"Reject"**
5. Enter rejection reason: "Content does not meet platform guidelines"
6. Click **"Reject Event"**
7. **Expected**:
   - Event status changes to "Rejected"
   - Rejection reason visible to vendor
   - Vendor can see rejection reason in their events list

---

## Test Flow 3: Event Capacity Limits

### Step 1: Create Event with Limited Capacity
1. Vendor creates event with **Maximum Bookings: 2**

### Step 2: Multiple Customers Register
1. Customer 1 registers → Success
2. Customer 2 registers → Success
3. Customer 3 registers → **Expected**: Error "Event is fully booked"

---

## Test Flow 4: Booking Reference Verification

### Step 1: Customer Registers
1. Customer registers for event
2. Note the booking reference

### Step 2: Verify Booking Reference
1. **Login as Vendor** or **Admin**
2. Navigate to event check-in page
3. Enter booking reference manually
4. **Expected**: Customer details displayed correctly

---

## Test Flow 5: Event Editing (Vendor)

### Step 1: Vendor Edits Draft Event
1. Vendor creates event (status: Draft, approval: Pending)
2. Click **"Edit"**
3. Modify event details
4. Save changes
5. **Expected**: Changes saved, approval status remains "Pending"

### Step 2: Vendor Cannot Edit Approved Event
1. Admin approves event
2. Vendor tries to edit
3. **Expected**: Edit button disabled or error message shown

---

## Verification Checklist

### Database Verification
- [ ] Migration 064 applied successfully
- [ ] Events table has new columns: `max_bookings`, `price_per_booking`, `inclusions`, `exclusions`, `terms_and_conditions`
- [ ] Event registrations table has `booking_reference` and `qr_code` columns

### Backend Verification
- [ ] Vendor endpoints require `events` capability
- [ ] Booking reference generated correctly (format: EVT-YYYYMMDD-XXXXXX)
- [ ] QR code contains registration data
- [ ] Max bookings check works
- [ ] Approval workflow endpoints work

### Frontend Verification
- [ ] Vendor: Events appear in dashboard (if has capability)
- [ ] Vendor: Can create event with all fields
- [ ] Vendor: Can view event details
- [ ] Vendor: Check-in page loads
- [ ] Customer: Booking reference displayed after registration
- [ ] Customer: QR code displayed
- [ ] Admin: Approval/rejection workflow works
- [ ] Admin: Can see vendor-created events

---

## Common Issues & Solutions

### Issue: Events not appearing in vendor dashboard
**Solution**: Check if vendor role has `events` capability assigned

### Issue: Cannot create event
**Solution**: Verify vendor has `events` capability in role permissions

### Issue: QR code not displaying
**Solution**: Check if `qr_code` field is populated in database after registration

### Issue: Booking reference not generated
**Solution**: Verify `generateBookingReference()` function is called during registration

### Issue: Check-in not working
**Solution**: Verify vendor has `events` capability and is accessing correct event

---

## Performance Testing

1. **Load Test**: Create 100 events, verify list loads quickly
2. **Registration Test**: 50 customers register simultaneously
3. **Check-in Test**: Vendor checks in 50 customers quickly

---

## Security Testing

1. **Capability Check**: Vendor without `events` capability cannot access endpoints
2. **Authorization**: Vendor can only check-in their own events
3. **Data Validation**: Invalid booking references return error
4. **SQL Injection**: Test with malicious input in event fields

---

## Browser Compatibility

Test on:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

---

## Notes

- QR code scanner requires camera permissions
- Booking references are unique per registration
- Events must be approved before customers can register
- Vendor can only edit events in "draft" or "pending" status
