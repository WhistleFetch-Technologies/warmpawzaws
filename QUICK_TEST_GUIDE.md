# Quick Testing Guide - Event Management

## 🚀 Quick Start Testing Steps

### Step 1: Apply Database Migration

```bash
# Option A: Using the script (recommended)
export DB_HOST=your-rds-endpoint.amazonaws.com
export DB_USER=your_db_user
export DB_NAME=your_db_name
./scripts/apply-events-migration.sh

# Option B: Manual psql
psql -h <DB_HOST> -U <DB_USER> -d <DB_NAME> -f db/migrations/064_enhance_events_schema.sql
```

### Step 2: Deploy Backend

```bash
./scripts/deploy-lambda-direct.sh
```

### Step 3: Deploy Frontends

```bash
# Deploy all frontends
./scripts/deploy-admin-web.sh
./scripts/deploy-vendor-web.sh
./scripts/deploy-customer-web.sh

# Or deploy individually
cd apps/admin-web && npm run build
cd apps/vendor-web && npm run build
cd apps/customer-web && npm run build
```

### Step 4: Verify Setup

1. **Check Vendor Role**: Ensure test vendor has `events` capability
   - Login as admin
   - Go to Roles/Vendors
   - Assign `events` capability to test vendor OR assign `event_organizer` role

2. **Test Vendor Access**:
   - Login as vendor
   - Check if "Events" appears in dashboard
   - If not, vendor role needs `events` capability

---

## 🧪 Quick Test Flow (5 minutes)

### Test 1: Create Event (Vendor)
1. Login → Vendor Dashboard
2. Click "Events" (should be visible)
3. Click "Create Event"
4. Fill minimum required fields:
   - Name: "Test Event"
   - Date: Tomorrow
   - Start Time: 10:00
   - Max Bookings: 10
   - Price: ₹100
5. Click "Create Event"
6. ✅ **Expected**: Event created, status "Pending Approval"

### Test 2: Approve Event (Admin)
1. Login → Admin Dashboard
2. Go to "Events"
3. Filter by "Pending Approval"
4. Find "Test Event"
5. Click "Approve"
6. ✅ **Expected**: Status changes to "Approved"

### Test 3: Register (Customer)
1. Login → Customer Dashboard
2. Go to "Events"
3. Find "Test Event"
4. Click "Register Now"
5. ✅ **Expected**: 
   - Registration successful
   - Booking reference shown (EVT-YYYYMMDD-XXXXXX)
   - QR code displayed

### Test 4: Check-In (Vendor)
1. Login → Vendor Dashboard
2. Go to "Events"
3. Find "Test Event"
4. Click "Check-In"
5. Enter booking reference OR scan QR
6. Click "Check In Customer"
7. ✅ **Expected**: Customer marked as checked in

---

## 🔍 Verification Checklist

### Database
- [ ] Migration 064 applied
- [ ] Events table has new columns
- [ ] Can query events with new fields

### Backend
- [ ] `/vendor/events` endpoint requires capability
- [ ] `/admin/events/:id/approve` works
- [ ] `/events/:id/register` generates booking reference
- [ ] `/events/verify/:ref` returns registration

### Frontend
- [ ] Vendor: Events page loads
- [ ] Vendor: Can create event
- [ ] Admin: Can approve/reject
- [ ] Customer: Booking reference shown
- [ ] Vendor: Check-in page works

---

## 🐛 Common Issues

### "Events not showing in vendor dashboard"
**Fix**: Vendor role needs `events` capability
```sql
-- Check vendor's role
SELECT v.id, v.business_name, r.name as role_name
FROM vendors v
JOIN roles r ON v.role_id = r.id
WHERE v.id = '<vendor_id>';

-- Add events capability to role
INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, 'events', '*', '*'
FROM roles r
WHERE r.name = '<role_name>'
ON CONFLICT DO NOTHING;
```

### "Cannot create event - 403 error"
**Fix**: Check capability enforcement
- Verify vendor has `events` in role_permissions
- Check backend logs for capability check

### "Booking reference not generated"
**Fix**: Check registration endpoint
- Verify `generateBookingReference()` is called
- Check database for `booking_reference` column

### "QR code not displaying"
**Fix**: Check QR code generation
- Verify `qr_code` field populated in database
- Check frontend QR code rendering

---

## 📝 Test Data Setup

### Create Test Vendor with Events Capability
```sql
-- Option 1: Assign event_organizer role
UPDATE vendors SET role_id = (
    SELECT id FROM roles WHERE name = 'event_organizer'
) WHERE id = '<vendor_id>';

-- Option 2: Add events capability to existing role
INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT role_id, 'events', '*', '*'
FROM vendors
WHERE id = '<vendor_id>'
ON CONFLICT DO NOTHING;
```

---

## 🎯 Success Criteria

✅ **All tests pass if:**
1. Vendor can create event with all fields
2. Admin can approve/reject events
3. Customer gets booking reference & QR code
4. Vendor can check-in via QR scan or manual lookup
5. Max bookings limit enforced
6. Approval workflow works end-to-end

---

## 📞 Next Steps After Testing

1. **If all tests pass**: Deploy to production
2. **If issues found**: Check logs, verify database schema, test endpoints individually
3. **Performance**: Test with 50+ events, 100+ registrations
4. **Security**: Verify capability checks, authorization

---

## 🔗 Related Files

- Migration: `db/migrations/064_enhance_events_schema.sql`
- Backend: `backend/lambda/src/endpoints/events.ts`
- Vendor UI: `apps/vendor-web/app/events/page.tsx`
- Customer UI: `apps/customer-web/app/events/page.tsx`
- Admin UI: `apps/admin-web/app/events/page.tsx`
- Test Plan: `EVENT_MANAGEMENT_TEST_PLAN.md`
