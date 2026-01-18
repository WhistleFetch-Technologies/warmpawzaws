# Event Management Architecture - Implementation Guide

## Overview
Complete vendor self-service event management system with admin approval workflow and booking verification, integrated seamlessly with existing platform architecture.

## Architecture Decision: Vendor Self-Service with Admin Approval

**Why this approach:**
- ✅ Scalable: Supports multiple vendors advertising events independently
- ✅ Consistent: Follows same pattern as vendor service creation
- ✅ Business-aligned: Vendors can market their events directly
- ✅ Quality-controlled: Admin approval ensures platform standards
- ✅ Verification-ready: Vendors verify their own events (they know attendees)

---

## Database Schema Changes

### Migration: `063_event_approval_and_verification.sql`

**Events Table Additions:**
- `approval_status` (pending, approved, rejected)
- `created_by` (admin, vendor)
- `reviewed_by` (admin UUID)
- `reviewed_at` (timestamp)
- `rejection_reason` (text)

**Event Registrations Table Additions:**
- `booking_reference` (unique, human-readable: EVT-YYYYMMDD-XXXXXX)
- `qr_code` (JSON stringified data)
- `checked_in_by` (vendor/admin UUID)

**Indexes Created:**
- `idx_events_approval_status` - Fast pending approvals lookup
- `idx_event_registrations_booking_reference` - Fast verification lookup
- `idx_event_registrations_check_in_status` - Check-in status queries

**Function Created:**
- `generate_booking_reference()` - PostgreSQL function for unique reference generation

---

## API Endpoints Architecture

### Vendor Endpoints (Following vendor-services pattern)

```
POST   /vendor/events                    - Create event (status: draft, approval: pending)
GET    /vendor/events                    - List vendor's events (with filters)
PUT    /vendor/events/:eventId           - Update event (only if pending/draft)
POST   /vendor/events/:eventId/submit    - Submit for approval
GET    /vendor/events/:eventId/registrations - View registrations
POST   /events/registrations/:id/check-in - Check in customer
GET    /events/verify/:bookingReference  - Verify booking by reference
```

### Admin Endpoints (Following vendor-onboarding approval pattern)

```
GET    /admin/events/pending             - List pending approvals
POST   /admin/events/:eventId/approve    - Approve event (auto-publishes)
POST   /admin/events/:eventId/reject     - Reject with reason
GET    /admin/events                     - List all events (existing)
POST   /admin/events                     - Create event (auto-approved)
PUT    /admin/events/:eventId            - Update any event
DELETE /admin/events/:eventId            - Delete event
```

### Customer Endpoints

```
GET    /events/discover                  - Discover approved events only
POST   /events/:eventId/register         - Register (generates booking reference + QR)
GET    /events/registrations/:id         - Get registration with QR code
GET    /events/my-registrations          - List customer's registrations
```

### Verification Endpoints (Vendor/Admin)

```
GET    /events/verify/:bookingReference  - Verify booking details
POST   /events/registrations/:id/check-in - Check in customer
```

---

## Event Lifecycle Flow

### Vendor Creates Event
```
1. Vendor creates event via /vendor/events
   → status: 'draft'
   → approval_status: 'pending'
   → created_by: 'vendor'

2. Vendor submits for approval via /vendor/events/:id/submit
   → approval_status: 'pending'
   → Admin notified (via existing notification system)

3. Admin reviews in admin panel
   → Views pending events
   → Reviews event details

4a. Admin approves via /admin/events/:id/approve
    → approval_status: 'approved'
    → status: 'published'
    → Event visible to customers

4b. Admin rejects via /admin/events/:id/reject
    → approval_status: 'rejected'
    → status: 'draft'
    → Vendor can see rejection reason and resubmit
```

### Customer Registration Flow
```
1. Customer browses approved events via /events/discover
2. Customer registers via /events/:eventId/register
3. System generates:
   - booking_reference: EVT-20250113-847293
   - qr_code: JSON with registration details
4. Customer receives confirmation with booking reference
5. Customer can view QR code in "My Events"
```

### Check-In Verification Flow
```
1. Customer arrives at event with QR code/booking reference
2. Vendor scans QR code OR enters booking reference
3. System shows:
   - Customer name
   - Number of attendees
   - Payment status
   - Registration details
4. Vendor clicks "Check In"
5. System updates:
   - check_in_status: 'checked_in'
   - check_in_time: current timestamp
   - checked_in_by: vendor ID
6. Customer receives check-in confirmation
```

---

## Integration Points

### 1. Follows Vendor Services Pattern
- Same endpoint structure (`/vendor/...`)
- Same status management approach
- Same permission checks

### 2. Follows Admin Approval Pattern
- Same approval workflow as vendor onboarding
- Same status transitions (pending → approved/rejected)
- Same review tracking (reviewed_by, reviewed_at)

### 3. Follows Booking Pattern
- Similar to service bookings
- Uses same customer registration flow
- Integrates with existing payment system

### 4. Security & Permissions
- Vendors can only manage their own events
- Admins can manage all events
- Customers can only view their own registrations
- Check-in requires vendor/admin authentication

---

## Booking Reference Format

**Format:** `EVT-YYYYMMDD-XXXXXX`
- `EVT` - Event prefix
- `YYYYMMDD` - Date (e.g., 20250113)
- `XXXXXX` - 6-digit random number

**Example:** `EVT-20250113-847293`

**Benefits:**
- Human-readable
- Easy to communicate verbally
- Unique per day
- Searchable in database

---

## QR Code Data Structure

```json
{
  "type": "event_registration",
  "registrationId": "uuid",
  "bookingReference": "EVT-20250113-847293",
  "eventId": "uuid",
  "customerName": "John Doe",
  "timestamp": "2025-01-13T10:30:00Z"
}
```

**Usage:**
- Stored as JSON string in database
- Can be converted to QR code image on frontend
- Contains all info needed for verification
- Can be signed/encrypted in future if needed

---

## Frontend Implementation Plan

### Vendor App (New)
1. **Event Management Page**
   - List vendor's events
   - Create new event
   - Edit draft/pending events
   - Submit for approval
   - View approval status

2. **Check-In Page**
   - QR code scanner
   - Manual booking reference lookup
   - Registration list for event
   - Check-in action
   - Check-in history

### Admin App (Update)
1. **Event Approval Queue**
   - List pending events
   - Review event details
   - Approve/Reject actions
   - View rejection reasons

2. **Event Management** (Existing - Enhanced)
   - Filter by approval status
   - View created_by field
   - See review history

### Customer App (Update)
1. **My Events Tab** (Existing - Enhanced)
   - Display booking reference
   - Show QR code
   - Display check-in status
   - Link to registration details

2. **Event Discovery** (Existing - Already filters approved)

---

## Security Considerations

1. **Vendor Isolation**
   - Vendors can only access their own events
   - Vendor ID verified from auth token
   - Database queries filtered by vendor_id

2. **Admin Authorization**
   - Admin ID tracked for approvals
   - Admin actions logged
   - Rejection reasons stored

3. **Customer Privacy**
   - Customers can only view their own registrations
   - QR codes contain minimal necessary data
   - Check-in requires vendor/admin authentication

4. **Data Integrity**
   - Booking references are unique
   - Check-in can only happen once
   - Timestamps recorded for audit

---

## Testing Checklist

### Backend
- [ ] Vendor can create event
- [ ] Vendor can update draft event
- [ ] Vendor cannot update approved event
- [ ] Admin can approve event
- [ ] Admin can reject with reason
- [ ] Approved events appear in discover
- [ ] Booking reference generated on registration
- [ ] QR code generated on registration
- [ ] Verification endpoint works
- [ ] Check-in endpoint works
- [ ] Check-in can only happen once

### Frontend
- [ ] Vendor can create event
- [ ] Vendor can see approval status
- [ ] Admin can approve/reject
- [ ] Customer sees booking reference
- [ ] Customer sees QR code
- [ ] Vendor can scan QR code
- [ ] Vendor can check in customer
- [ ] Check-in status updates

---

## Migration Steps

1. **Run Database Migration**
   ```bash
   psql -d warmpawz_db -f db/migrations/063_event_approval_and_verification.sql
   ```

2. **Deploy Backend**
   - Lambda function already updated
   - Endpoints registered in handler

3. **Update Frontend**
   - Vendor app: Add event management UI
   - Admin app: Add approval workflow
   - Customer app: Show booking reference/QR

4. **Test End-to-End**
   - Vendor creates event
   - Admin approves
   - Customer registers
   - Vendor checks in

---

## Future Enhancements

1. **QR Code Image Generation**
   - Generate actual QR code images server-side
   - Store in S3
   - Return image URL

2. **Notifications**
   - Email/SMS on registration
   - Push notification on approval
   - Check-in confirmation

3. **Analytics**
   - Event performance metrics
   - Check-in rates
   - Popular events

4. **Advanced Features**
   - Waitlist management
   - Event reminders
   - Post-event feedback

---

## Summary

This implementation provides a complete, scalable event management system that:
- ✅ Follows existing platform patterns
- ✅ Supports vendor self-service
- ✅ Maintains quality through admin approval
- ✅ Enables easy verification with QR codes
- ✅ Integrates seamlessly with current architecture
- ✅ Scales to support multiple vendors

All backend endpoints are implemented and ready. Frontend implementation follows next.
