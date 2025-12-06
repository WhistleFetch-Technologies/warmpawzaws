# Quick Test Guide - Pet Cafe & Sunset Services

## Step 1: Seed the Database

### 1.1 Seed Roles
1. Login to Admin Panel
2. Navigate to **Settings → Role Management**
3. Click **"Seed Initial Roles"** button
4. Wait for success message
5. **Verify:** You should see these new roles in the list:
   - ☕ Pet Cafe
   - 💜 Pet Sunset Services

### 1.2 Seed Service Catalog
1. Stay in Admin Panel
2. Navigate to **Service Catalog → Admin Controls**
3. Find the **"Catalog Seed Panel"** section
4. Click **"Preview Catalog"** (optional - to see what will be added)
5. Click **"Seed Catalog"** button
6. Wait for success message: "31 services added"

### 1.3 Verify Services in Catalog
1. Navigate to **Service Catalog → Services Tab**
2. Filter by Role: **"Pet Cafe"**
   - Should show 15 services
   - Services like "Cafe Table Reservation", "Puppuccino", "Birthday Party Package"
3. Filter by Role: **"Pet Sunset Services"**
   - Should show 16 services
   - Services like "Individual Cremation", "Memorial Service", "Grief Counseling"

---

## Step 2: Test Pet Cafe Vendor Flow

### 2.1 Vendor Registration
1. Open Vendor App in a new incognito window
2. Click **"Register as Vendor"**
3. Enter phone number: `+919999000001`
4. Verify with OTP
5. **Select Role:** Pet Cafe ☕
6. Click Continue

### 2.2 Onboarding Form
You should see these **Pet Cafe specific fields:**
- ✅ FSSAI License Number (text field)
- ✅ Seating Capacity (Pax) (number field)
- ✅ Max Pets at Once (number field)

Required Documents:
- ✅ Aadhar Card (Front & Back)
- ✅ PAN Card
- ✅ FSSAI License
- ✅ Fire Safety Certificate
- ✅ Cafe Interior Photos (optional)

Fill out and submit the application.

### 2.3 Admin Approval
1. Switch back to Admin Panel
2. Navigate to **Vendor Management → Pending Applications**
3. Find the Pet Cafe application
4. **Review documents:**
   - Verify FSSAI License is uploaded
   - Verify Fire Safety Certificate is uploaded
5. Click **"Approve"**
6. Wait for confirmation

### 2.4 Service Setup (Vendor Side)
1. Switch back to Vendor App (refresh if needed)
2. You should see **"Congratulations! Application Approved"**
3. Click **"Setup Services"**
4. **Verify:** You should see 15 Pet Cafe services:
   - Table reservations
   - Playtime sessions
   - Birthday party packages
   - Daycare services
5. Enable at least 3-5 services
6. Set your prices (optional - uses base prices if not changed)
7. Click **"Save & Continue"**

### 2.5 Availability Setup
1. Set your working hours (e.g., 9 AM - 9 PM)
2. Select working days
3. Click **"Complete Setup"**

### 2.6 Dashboard Access
You should now see the **Pet Cafe Dashboard:**
- ✅ Coffee icon in header
- ✅ "Pet Cafe Dashboard" title
- ✅ Stats cards:
  - Today's Bookings
  - Today's Guests (pax count)
  - Upcoming
  - Total Revenue
- ✅ "Today's Reservations" section
- ✅ "Upcoming Reservations" section

---

## Step 3: Test Sunset Services Vendor Flow

### 3.1 Vendor Registration
1. Open Vendor App in a new incognito window
2. Click **"Register as Vendor"**
3. Enter phone number: `+919999000002`
4. Verify with OTP
5. **Select Role:** Pet Sunset Services 💜
6. Click Continue

### 3.2 Onboarding Form
You should see these **Sunset Services specific fields:**
- ✅ Crematorium License Number (text field)
- ✅ Cemetery Location (optional text field)
- ✅ Certified Grief Counselor on Staff (checkbox)

Required Documents:
- ✅ Aadhar Card (Front & Back)
- ✅ PAN Card
- ✅ Crematorium License
- ✅ Pollution Control Certificate
- ✅ Facility Photos (optional)

Fill out and submit the application.

### 3.3 Admin Approval
1. Switch back to Admin Panel
2. Navigate to **Vendor Management → Pending Applications**
3. Find the Sunset Services application
4. **Review documents:**
   - Verify Crematorium License is uploaded
   - Verify Pollution Control Certificate is uploaded
5. Click **"Approve"**
6. Wait for confirmation

### 3.4 Service Setup (Vendor Side)
1. Switch back to Vendor App (refresh if needed)
2. You should see **"Congratulations! Application Approved"**
3. Click **"Setup Services"**
4. **Verify:** You should see 16 Sunset Services:
   - Cremation services
   - Burial arrangements
   - Memorial ceremonies
   - Grief support
   - Transport services
5. Enable at least 3-5 services
6. Set your prices (optional)
7. Click **"Save & Continue"**

### 3.5 Availability Setup
1. Set your working hours
2. Select working days (24/7 for emergency services recommended)
3. Click **"Complete Setup"**

### 3.6 Dashboard Access
You should now see the **Sunset Services Dashboard:**
- ✅ Purple gradient header
- ✅ Heart icon
- ✅ "Pet Sunset Services" title
- ✅ Stats cards:
  - Pending Requests
  - Scheduled Services
  - Completed
  - Total Revenue
- ✅ "Pending Requests - Urgent Attention Needed" section (yellow banner)
- ✅ "Scheduled Services" section
- ✅ Call customer button (phone icon)

---

## Step 4: Test Booking Flow (Mock)

### 4.1 Create Test Booking for Pet Cafe
Since customer app isn't built yet, create a test booking via API:

```bash
# Open browser console on admin panel
# Run this code:

const createCafeBooking = async () => {
  const response = await fetch(
    'https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475/bookings/create',
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer YOUR_ANON_KEY',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customerId: 'customer_test_001',
        vendorId: 'CAFE_VENDOR_ID_HERE',
        petId: 'pet_test_001',
        serviceId: 'service_cafe_table_2pax',
        serviceName: 'Cafe Table Reservation - 2 Pax',
        serviceType: 'at_center',
        bookingDate: '2024-11-20',
        bookingTime: '14:00',
        duration: 120,
        price: 500,
        customerName: 'Test Customer',
        customerPhone: '+919999999999',
        customerAddress: 'Test Address',
        petName: 'Bruno',
        numberOfPax: 2,
        specialInstructions: 'Please arrange window table'
      })
    }
  );
  const data = await response.json();
  console.log('Booking created:', data);
};

createCafeBooking();
```

### 4.2 Verify Booking in Cafe Dashboard
1. Go to Pet Cafe vendor dashboard
2. Refresh the page
3. **Verify:**
   - Booking appears in "Today's Reservations"
   - Shows "2 pax"
   - Shows booking time "14:00"
   - Shows pet name "Bruno"
   - Shows special instructions
   - Shows "Confirm" and "Decline" buttons

### 4.3 Test Booking Actions
1. Click **"Confirm"** button
2. Verify:
   - Booking status changes to "confirmed"
   - Button changes to "Check In"
3. Click **"Check In"**
4. Verify:
   - Status changes to "in_progress"
   - Button changes to "Complete"
5. Click **"Complete"**
6. Verify:
   - Status changes to "completed"
   - Moves out of "Today's Reservations"
   - Revenue stat increases

### 4.4 Create Test Booking for Sunset Services
```bash
const createSunsetBooking = async () => {
  const response = await fetch(
    'https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475/bookings/create',
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer YOUR_ANON_KEY',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customerId: 'customer_test_002',
        vendorId: 'SUNSET_VENDOR_ID_HERE',
        petId: 'pet_test_002',
        serviceId: 'service_cremation_individual',
        serviceName: 'Individual Pet Cremation',
        serviceType: 'at_center',
        bookingDate: '2024-11-20',
        bookingTime: '10:00',
        duration: 240,
        price: 8000,
        customerName: 'Test Customer 2',
        customerPhone: '+919999999998',
        customerAddress: '123 Main St, City',
        petName: 'Max',
        specialInstructions: 'Please handle with care. This is a very difficult time for the family.'
      })
    }
  );
  const data = await response.json();
  console.log('Booking created:', data);
};

createSunsetBooking();
```

### 4.5 Verify Booking in Sunset Dashboard
1. Go to Sunset Services vendor dashboard
2. Refresh the page
3. **Verify:**
   - Booking appears in "Pending Requests - Urgent Attention Needed"
   - Shows customer phone
   - Shows customer address
   - Shows pet name "Max"
   - Shows special instructions prominently
   - Shows "Accept & Schedule" and "Unable to Service" buttons
   - Shows "Call" button with phone icon

### 4.6 Test Sunset Booking Actions
1. Click **"Accept & Schedule"** button
2. Verify:
   - Moves to "Scheduled Services" section
   - Button changes to "Start Service"
3. Click **"Start Service"**
4. Verify:
   - Status changes to "in_progress"
5. Update status to completed via API or admin panel

---

## Expected Results Summary

### ✅ Admin Panel:
- [x] Pet Cafe role visible in Role Management
- [x] Sunset Services role visible in Role Management
- [x] 15 Pet Cafe services in catalog
- [x] 16 Sunset Services in catalog
- [x] Can approve Pet Cafe vendors
- [x] Can approve Sunset Services vendors

### ✅ Vendor Onboarding:
- [x] Pet Cafe shows FSSAI license field
- [x] Sunset Services shows Crematorium license field
- [x] Document uploads work
- [x] Service setup shows correct services
- [x] Availability setup works

### ✅ Pet Cafe Dashboard:
- [x] Coffee icon and amber color theme
- [x] Stats show today's bookings and guests (pax)
- [x] Bookings show numberOfPax field
- [x] Can confirm/decline/check-in/complete bookings
- [x] Special instructions visible

### ✅ Sunset Services Dashboard:
- [x] Heart icon and purple color theme
- [x] Urgent pending requests section
- [x] Customer phone and address visible
- [x] Call customer button works
- [x] Can accept & schedule services
- [x] Special instructions prominently displayed

---

## Troubleshooting

### Issue: Roles don't appear after seeding
**Solution:** Check browser console for errors. Verify the seed endpoint was called successfully.

### Issue: Services don't appear in catalog
**Solution:** 
1. Check if catalog was seeded successfully
2. Verify role filter is not hiding services
3. Clear browser cache and refresh

### Issue: Dashboard doesn't load
**Solution:**
1. Verify vendor has completed full onboarding (services + availability)
2. Check if vendor status is 'active' in admin panel
3. Check browser console for errors
4. Verify roleId matches exactly: `pet_cafe` or `sunset_services`

### Issue: Bookings don't appear
**Solution:**
1. Verify vendorId in booking matches vendor's ID
2. Check booking date is today or future
3. Refresh dashboard
4. Check browser console for API errors

### Issue: numberOfPax not showing
**Solution:**
1. Verify booking was created with numberOfPax field
2. Check if booking object has the field (inspect in console)
3. Refresh dashboard

---

## Quick Verification Commands

### Check if roles exist:
```javascript
// Run in browser console on admin panel
const checkRoles = async () => {
  const response = await fetch(
    'https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475/config/roles',
    {
      headers: { 'Authorization': 'Bearer YOUR_ANON_KEY' }
    }
  );
  const data = await response.json();
  const cafeRole = data.roles.find(r => r.id === 'pet_cafe');
  const sunsetRole = data.roles.find(r => r.id === 'sunset_services');
  console.log('Pet Cafe Role:', cafeRole ? '✅ Found' : '❌ Missing');
  console.log('Sunset Services Role:', sunsetRole ? '✅ Found' : '❌ Missing');
};

checkRoles();
```

### Check if services exist:
```javascript
// Run in browser console on admin panel
const checkServices = async () => {
  const response = await fetch(
    'https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475/admin/catalog/services',
    {
      headers: { 'Authorization': 'Bearer YOUR_ANON_KEY' }
    }
  );
  const data = await response.json();
  const cafeServices = data.services.filter(s => 
    s.applicableRoles?.includes('pet_cafe')
  );
  const sunsetServices = data.services.filter(s => 
    s.applicableRoles?.includes('sunset_services')
  );
  console.log(`Pet Cafe Services: ${cafeServices.length} (expected: 15)`);
  console.log(`Sunset Services: ${sunsetServices.length} (expected: 16)`);
};

checkServices();
```

---

## Success Criteria

### All Tests Pass When:
1. ✅ Both roles appear in admin role management
2. ✅ All 31 services appear in service catalog
3. ✅ Vendors can complete onboarding for both roles
4. ✅ Role-specific fields appear in onboarding forms
5. ✅ Both dashboards load correctly after approval
6. ✅ Bookings can be created and managed
7. ✅ numberOfPax field works for cafe bookings
8. ✅ Special instructions display correctly
9. ✅ Status transitions work (pending → confirmed → in_progress → completed)
10. ✅ Stats update in real-time

---

**Testing Duration:** ~30 minutes  
**Required Access:** Admin Panel + Vendor App + Browser Console  
**Prerequisites:** Database seeded with roles and services
