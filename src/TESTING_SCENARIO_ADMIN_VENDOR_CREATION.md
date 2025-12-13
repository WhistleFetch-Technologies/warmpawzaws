# 🧪 TESTING SCENARIO: Admin Vendor Creation with RoleId

**Date:** December 14, 2024  
**Feature:** Admin creates vendor with proper roleId assignment  
**Status:** Ready for testing

---

## 📋 PRE-REQUISITES

Before starting tests, ensure:

1. ✅ Roles are seeded in database
   - Navigate to: **Admin Dashboard → Role Management**
   - Click: **"Seed Initial Roles"** button
   - Verify: Roles appear in the list (pet_cafe, pet_shelter, veterinarian, etc.)

2. ✅ You have admin credentials
   - Username: admin
   - Password: [configured password]

3. ✅ Backend server is running
   - Endpoint available: `/admin/vendors/create`
   - Endpoint available: `/config/roles`

---

## 🎬 TEST SCENARIO 1: Create Pet Cafe Vendor

### Expected Flow:

```
Admin Panel → Add Vendor → Fill Form → Create → Vendor Dashboard
```

### Step-by-Step:

#### Step 1: Login as Admin
1. Navigate to: `/admin`
2. Enter admin credentials
3. Click "Login"
4. ✅ **Verify:** Admin dashboard loads

#### Step 2: Open Vendor Management
1. Click: **"Vendor Management"** in sidebar
2. ✅ **Verify:** Vendor list loads

#### Step 3: Open Add Vendor Modal
1. Click: **"+ Add Vendor"** button
2. ✅ **Verify:** Modal opens with "Step 1 of 5"

#### Step 4: Fill Basic Information (Step 1)
1. **Business Name:** "Pawfect Cafe"
2. **Owner Name:** "John Doe"
3. **Email:** "john@pawfectcafe.com"
4. **Phone:** "9876543210"
5. **Alternate Phone:** "9876543211" (optional)
6. Click: **"Continue"**
7. ✅ **Verify:** Progress to Step 2

#### Step 5: Fill Business Details (Step 2)
1. **Vendor Role:** Select "🏪 Pet Cafe" from dropdown
   - ✅ **Verify:** Dropdown shows all available roles
   - ✅ **Verify:** Category auto-populates to "grooming"
   - ✅ **Verify:** Green checkmark appears: "✓ Role selected. Features will be configured automatically."
2. **Services:** Select "Grooming", "Day Care"
3. **Experience:** Select "3-5 years"
4. **GST Number:** "29ABCDE1234F1Z5" (optional)
5. **PAN Number:** "ABCDE1234F" (optional)
6. Click: **"Continue"**
7. ✅ **Verify:** Progress to Step 3

#### Step 6: Fill Location & Address (Step 3)
1. **Address:** "123 Pet Street, MG Road"
2. **City:** "Bangalore"
3. **State:** Select "Karnataka"
4. **Pincode:** "560001"
5. **Landmark:** "Near Central Park" (optional)
6. **Service Areas:** "Koramangala, Indiranagar, HSR Layout"
7. Click: **"Continue"**
8. ✅ **Verify:** Progress to Step 4

#### Step 7: Fill Banking Details (Step 4)
1. **Bank Name:** "HDFC Bank"
2. **Account Holder Name:** "Pawfect Cafe Pvt Ltd"
3. **Account Number:** "12345678901234"
4. **IFSC Code:** "HDFC0000123"
5. Click: **"Continue"**
6. ✅ **Verify:** Progress to Step 5

#### Step 8: Fill Additional Details (Step 5)
1. **Operating Hours:** "9 AM - 8 PM"
2. **Daily Capacity:** "30 pets/day"
3. **Specialization:** "Premium grooming, cafe dining for pets"
4. **Vendor Tier:** Select "Silver"
5. **Commission Rate:** "12"
6. **Initial Status:** Select "Active"
7. ✅ **Verify:** All fields filled

#### Step 9: Create Vendor
1. Click: **"Create Vendor"** button
2. ✅ **Verify:** Loading state shows "Creating..."
3. ✅ **Verify:** Success message appears
4. ✅ **Verify:** Modal closes
5. ✅ **Verify:** Vendor list refreshes with new vendor

---

## 🔍 VERIFICATION POINTS

### Backend Verification:

Open browser console and run:

```javascript
// Check vendor was created with roleId
fetch('https://[PROJECT_ID].supabase.co/functions/v1/make-server-3dd53475/admin/vendors/vendor_9876543210', {
  headers: { 'Authorization': 'Bearer [PUBLIC_ANON_KEY]' }
})
.then(r => r.json())
.then(data => {
  console.log('✅ Vendor ID:', data.vendor.id);
  console.log('✅ Role ID:', data.vendor.roleId); // Should be: "pet_cafe"
  console.log('✅ Role Name:', data.vendor.roleName); // Should be: "Pet Cafe"
  console.log('✅ Status:', data.vendor.status); // Should be: "approved"
  console.log('✅ Active:', data.vendor.isActive); // Should be: true
  
  // CRITICAL: Verify roleId exists
  if (!data.vendor.roleId) {
    console.error('❌ FAILED: roleId is missing!');
  } else if (data.vendor.roleId !== 'pet_cafe') {
    console.error('❌ FAILED: roleId is incorrect! Expected: pet_cafe, Got:', data.vendor.roleId);
  } else {
    console.log('✅ SUCCESS: roleId is correctly set!');
  }
});
```

---

## 🎯 TEST SCENARIO 2: Vendor Login & Dashboard

### Expected Flow:

```
Vendor Login → Dashboard → Capabilities Load → Buttons Render
```

### Step-by-Step:

#### Step 1: Logout from Admin
1. Click: **"Logout"**
2. ✅ **Verify:** Redirected to home page

#### Step 2: Login as Vendor
1. Navigate to: `/vendor`
2. **Phone Number:** "9876543210"
3. **OTP:** "123456" (test OTP)
4. Click: **"Login"**
5. ✅ **Verify:** Login successful

#### Step 3: Verify Dashboard Loads
1. ✅ **Verify:** Dashboard loads (not stuck in loading state)
2. ✅ **Verify:** Vendor name displays: "Pawfect Cafe"
3. ✅ **Verify:** No error messages

#### Step 4: Verify Capability Buttons
1. Look for these buttons in the dashboard:
   - ✅ **Menu Management** button (capabilities.menu === true)
   - ✅ **Events Management** button (capabilities.events === true)
   - ✅ **Booking Management** button (capabilities.booking === true)
   - ✅ **Gallery** button (capabilities.gallery === true)

2. ✅ **Verify:** Buttons are clickable (not disabled)

#### Step 5: Test Navigation
1. Click: **"Menu Management"** button
2. ✅ **Verify:** Navigates to VendorCafeMenuManagement component
3. ✅ **Verify:** Component renders correctly

4. Go back to dashboard
5. Click: **"Events Management"** button
6. ✅ **Verify:** Navigates to VendorEventManagement component
7. ✅ **Verify:** Component renders correctly

---

## 🔍 Frontend Console Verification:

Open browser console in Vendor Dashboard and check logs:

```
Expected Console Output:
--------------------------------------------------
🔌 [CAPABILITIES] Fetching role config for: pet_cafe
🔌 [CAPABILITIES] API Response: { roles: [...] }
🔌 [CAPABILITIES] Total roles fetched: 15
🔌 [CAPABILITIES] Available role IDs: veterinarian, pet_cafe, pet_shelter, ...
✅ [CAPABILITIES] Found role config: { id: "pet_cafe", name: "Pet Cafe", capabilities: [...] }
🔑 [CAPABILITIES] Role capabilities: ["menu", "events", "booking", "chat", "gallery", ...]
   ✅ Enabled: menu
   ✅ Enabled: events
   ✅ Enabled: booking
   ✅ Enabled: chat
   ✅ Enabled: gallery
✅ [CAPABILITIES] Final capabilities: { menu: true, events: true, ... }
```

### Manual Console Check:

```javascript
// Run this in browser console
console.log('Vendor Data:', vendorData);
console.log('Role ID:', vendorData?.roleId); // Should be: "pet_cafe"
console.log('Capabilities:', capabilities);
console.log('Menu capability:', capabilities.menu); // Should be: true
console.log('Events capability:', capabilities.events); // Should be: true
console.log('Donation capability:', capabilities.donation); // Should be: false (pet cafe doesn't have this)
```

---

## 🎬 TEST SCENARIO 3: Create Pet Shelter Vendor

Same flow as Scenario 1, but with different role:

### Key Differences:

#### Step 5 (Business Details):
- **Vendor Role:** Select "🏠 Pet Shelter"
- **Expected Category:** Auto-populates to "boarding"

### Expected Capabilities:
After vendor login, verify these buttons appear:
- ✅ **Donation Management** (capabilities.donation === true)
- ✅ **Adoption Management** (capabilities.adoption === true)
- ✅ **Events Management** (capabilities.events === true)

### Expected Buttons NOT to Appear:
- ❌ Menu Management (pet shelter doesn't serve food)
- ❌ Prescription Builder (not a medical facility)

---

## 🎬 TEST SCENARIO 4: Validation Tests

### Test 4.1: Missing roleId
1. Open Add Vendor Modal
2. Fill Step 1 (Basic Info)
3. Click "Continue" to Step 2
4. **Do NOT select a role**
5. Try to click "Continue"
6. ✅ **Verify:** Button is disabled
7. ✅ **Verify:** Cannot proceed without roleId

### Test 4.2: Role Selector Loading
1. Open Add Vendor Modal
2. Navigate to Step 2
3. ✅ **Verify:** Role dropdown shows "Loading roles..." initially
4. ✅ **Verify:** Dropdown populates with roles after load
5. ✅ **Verify:** If no roles exist, shows: "No roles available - Please seed roles in Role Management"

---

## ✅ SUCCESS CRITERIA

### For Admin Vendor Creation:
- [x] Role selector loads all available roles
- [x] Category auto-populates based on role selection
- [x] Validation prevents proceeding without roleId
- [x] Vendor created with complete role data (roleId, roleName, roleDisplayName)
- [x] Success message shows after creation
- [x] Vendor appears in vendor list with correct role

### For Vendor Dashboard:
- [x] Vendor can login with created credentials
- [x] Dashboard loads without errors
- [x] Capabilities load from roleId
- [x] Correct buttons render based on role
- [x] Buttons are clickable and navigate correctly
- [x] No missing/broken capabilities

### For Different Roles:
- [x] Pet Cafe: menu, events buttons visible
- [x] Pet Shelter: donation, adoption, events buttons visible
- [x] Veterinary Clinic: prescription, medical_records buttons visible
- [x] Role-specific buttons work correctly

---

## 🐛 COMMON ISSUES & FIXES

### Issue 1: "No roles available"
**Cause:** Roles not seeded in database  
**Fix:** Go to Admin Dashboard → Role Management → "Seed Initial Roles"

### Issue 2: roleId undefined after creation
**Cause:** Backend not saving roleId  
**Fix:** Check `/admin/vendors/create` endpoint validation

### Issue 3: Capabilities empty in dashboard
**Cause:** roleId not passed to useVendorCapabilities  
**Fix:** Verify `vendorData?.roleId` is populated in VendorApp

### Issue 4: Buttons not showing
**Cause:** Capability not in role config  
**Fix:** Update role config in database to include missing capability

---

## 📊 TEST RESULTS TEMPLATE

```
Date: _____________
Tester: _____________

SCENARIO 1: Create Pet Cafe Vendor
- [ ] Admin can create vendor
- [ ] roleId properly set: ___________
- [ ] Vendor can login
- [ ] Menu button visible: ___________
- [ ] Events button visible: ___________
- [ ] Navigation works

SCENARIO 2: Create Pet Shelter Vendor
- [ ] Admin can create vendor
- [ ] roleId properly set: ___________
- [ ] Vendor can login
- [ ] Donation button visible: ___________
- [ ] Adoption button visible: ___________
- [ ] Navigation works

SCENARIO 3: Validation
- [ ] Cannot proceed without roleId
- [ ] Role selector loads
- [ ] Category auto-populates

OVERALL RESULT: ___________
ISSUES FOUND: ___________
```

---

**Document Created:** December 14, 2024  
**Status:** Ready for QA Testing  
**Priority:** HIGH (Critical path fix)
