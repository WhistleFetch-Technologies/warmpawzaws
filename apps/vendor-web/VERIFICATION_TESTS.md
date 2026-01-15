# Vendor Dashboard Verification Tests

## Build Status: ✅ PASSED

**Date:** January 15, 2026  
**Build Output:** All 51 pages compiled successfully  
**No TypeScript errors:** ✅  
**No build errors:** ✅

---

## Manual Testing Checklist

### 1. Start Development Server

```bash
cd /Users/ketan/Documents/warmpawzecodev/apps/vendor-web
npm run dev
```

Server will start on: `http://localhost:3002`

---

### 2. Test Custom Services (Fix for h.map error)

**Steps:**
1. Login as any vendor with `custom_services` capability
2. Navigate to Custom Services page
3. Open Browser DevTools → Console
4. Look for these log messages:

**Expected Console Output:**
```
📚 [CUSTOM-SERVICE] Loading catalog categories...
📚 [CUSTOM-SERVICE] Loaded catalog services: [number]
✅ [CUSTOM-SERVICE] Unique categories: [number]
```

**What to Verify:**
- ✅ No `h.map is not a function` error
- ✅ Categories dropdown populates
- ✅ Can create custom service without crash
- ✅ Empty catalog handled gracefully

**Test in Console:**
```javascript
// Test the fix
fetch('/api/admin/service-catalog')
  .then(r => r.json())
  .then(data => {
    console.log('✅ Services is array:', Array.isArray(data.services));
    console.log('✅ Services count:', data.services?.length || 0);
    console.log('✅ No crash when mapping');
  });
```

---

### 3. Test Staff Management Button Visibility

**Test Roles:**

#### ✅ Should Show Button:
1. **Veterinary Clinic**
   - Role ID: `veterinary_clinic` or `pet_clinic`
   - Expected: Button visible
   
2. **Pet Groomer**
   - Role ID: `pet_groomer`
   - Expected: Button visible
   
3. **Pet Trainer**
   - Role ID: `pet_trainer`
   - Expected: Button visible

#### ❌ Should NOT Show Button:
1. **Dog Walker**
   - Role ID: `walker`
   - Expected: No button (mobile service)

**Verification Steps:**
1. Login with each role
2. Check vendor dashboard homepage
3. Look for "Manage Staff" button with Users icon
4. Click button - should navigate to staff management

**Console Debug Command:**
```javascript
// Check capabilities
const vendorData = JSON.parse(localStorage.getItem('vendorData'));
console.log('Role ID:', vendorData.roleId);
console.log('Has staff capability:', 
  // Check all variations
  vendorData.capabilities?.includes('staff') ||
  vendorData.capabilities?.includes('staff_management') ||
  vendorData.capabilities?.includes('staffManagement')
);
```

---

### 4. Test Center Profile Button Visibility

**Test Service Styles:**

#### ✅ Should Show Button:
1. **at_center vendors**
   - Service style: `at_center`
   - Expected: Button visible
   
2. **both style vendors**
   - Service style: `both`
   - Expected: Button visible
   
3. **Pet Boarder/Resort**
   - Role ID: `pet_boarder` or `pet_resort`
   - Expected: Button visible (physical location)

#### ❌ Should NOT Show Button:
1. **at_home only vendors**
   - Service style: `at_home`
   - Expected: No button (mobile service)

**Verification Steps:**
1. Login with each service style
2. Check vendor dashboard homepage
3. Look for "Center Profile" button with Building2 icon
4. Click button - should navigate to center profile manager
5. Verify can set operating hours and facility details

**Console Debug Command:**
```javascript
// Check service style
const vendorData = JSON.parse(localStorage.getItem('vendorData'));
console.log('Service Style:', vendorData.serviceStyle);
console.log('Service Styles Array:', vendorData.serviceStyles);
console.log('Has facility capability:', 
  vendorData.capabilities?.includes('facility') ||
  vendorData.capabilities?.includes('facility_management') ||
  vendorData.capabilities?.includes('facilityManagement')
);
```

---

### 5. Test Capability Loading

**Check Different Role Types:**

```javascript
// Run in browser console after login
const vendorData = JSON.parse(localStorage.getItem('vendorData'));
const roleId = vendorData.roleId;

// Test capability hook
console.log('Looking for [useVendorCapabilities] logs...');

// Verify capabilities cache
const cachedCaps = sessionStorage.getItem(`vendor_capabilities_${roleId}`);
if (cachedCaps) {
  const parsed = JSON.parse(cachedCaps);
  console.log('✅ Cached capabilities:', parsed.capabilities);
  console.log('✅ Cache timestamp:', new Date(parsed.timestamp));
}

// Test API endpoint
fetch(`/api/config/roles/${roleId}`)
  .then(r => r.json())
  .then(data => {
    console.log('✅ Role config loaded:', data.success);
    console.log('✅ Capabilities count:', data.capabilities?.length);
    console.log('✅ Capabilities:', data.capabilities);
  });
```

**Expected Capabilities by Role:**
```
Veterinary Clinic: 
  - booking, services, staff_management, facility_management, 
    medical_records, prescriptions, tele, chat

Pet Groomer:
  - booking, services, gallery, portfolio, packages

Pet Trainer:
  - booking, services, staff_management, progress_tracking

Dog Walker:
  - booking, gps_tracking, subscriptions

Pet Store:
  - catalog, inventory, orders, delivery
```

---

### 6. Browser Network Tab Verification

**Check API Calls:**

1. Open DevTools → Network Tab
2. Filter by: XHR
3. Look for these successful calls:
   - ✅ `GET /config/roles/[roleId]` → 200 OK
   - ✅ `GET /vendor/[vendorId]/services` → 200 OK
   - ✅ `GET /admin/service-catalog` → 200 OK
   - ✅ `GET /vendor/[vendorId]/dashboard` → 200 OK

**Check Response Structure:**
```javascript
// Example: Check role endpoint
{
  "success": true,
  "roleId": "uuid-here",
  "roleName": "Veterinary Clinic",
  "capabilities": ["booking", "services", "staff_management", ...],
  "serviceStyles": ["at_center", "at_home", "tele"],
  "vendorTypes": ["Healthcare Provider"]
}
```

---

### 7. Error Scenarios Testing

**Test Error Handling:**

#### Test 1: Missing Vendor Record
```javascript
// Test with non-existent vendor
fetch('/api/vendor/00000000-0000-0000-0000-000000000000/services')
  .then(r => r.json())
  .then(data => {
    console.log('✅ Graceful empty response:', data.services?.length === 0);
  });
```

#### Test 2: Invalid Role ID
```javascript
// Test with invalid role
fetch('/api/config/roles/invalid-role-id')
  .then(r => r.json())
  .then(data => {
    console.log('✅ Error handled gracefully:', data.error || data.success === false);
  });
```

#### Test 3: Empty Custom Services
```javascript
// Verify array safety
const emptyData = { services: null };
const safeServices = Array.isArray(emptyData.services) ? emptyData.services : [];
console.log('✅ Handles null services:', safeServices.length === 0);
```

---

### 8. Visual Verification

**Check UI Elements:**

1. **Staff Management Button:**
   - Border: Orange (#FF8C42)
   - Icon: Users (👥)
   - Text: "Manage Staff"
   - Hover: Background changes to orange

2. **Center Profile Button:**
   - Border: Purple (#A855F7)
   - Icon: Building2 (🏢)
   - Text: "Center Profile"
   - Hover: Background changes to purple

3. **Custom Services Page:**
   - Category dropdown populated
   - "Create Service" button functional
   - No console errors
   - Loading states work

---

### 9. Database Verification

**Check Role Permissions (Optional):**

```sql
-- Verify staff management capability
SELECT r.display_name, rp.permission_name 
FROM roles r 
JOIN role_permissions rp ON r.id = rp.role_id 
WHERE rp.permission_name = 'staff_management';

-- Verify facility management capability
SELECT r.display_name, rp.permission_name 
FROM roles r 
JOIN role_permissions rp ON r.id = rp.role_id 
WHERE rp.permission_name IN ('facility_management', 'facility');

-- Check vendor's role and capabilities
SELECT v.id, v.business_name, r.display_name, 
       array_agg(rp.permission_name) as capabilities
FROM vendors v
JOIN roles r ON v.role_id = r.id
LEFT JOIN role_permissions rp ON r.id = rp.role_id
WHERE v.phone = '+91[your-test-number]'
GROUP BY v.id, v.business_name, r.display_name;
```

---

### 10. Mobile Responsiveness

**Test on Different Screen Sizes:**

1. **Desktop (1920x1080)**
   - All buttons visible and aligned
   - No text overflow
   
2. **Tablet (768x1024)**
   - Buttons stack properly
   - Touch-friendly spacing
   
3. **Mobile (375x667)**
   - Max width: 430px
   - Buttons full width
   - Easy to tap

---

## Success Criteria

### All Tests Must Pass:

- ✅ Build completes without errors
- ✅ No `h.map is not a function` error in console
- ✅ Staff Management button appears for eligible roles
- ✅ Center Profile button appears for at_center vendors
- ✅ Capabilities load correctly for all roles
- ✅ API endpoints return valid responses
- ✅ Error scenarios handled gracefully
- ✅ UI elements render correctly
- ✅ No TypeScript compilation errors
- ✅ No React warnings in console

---

## Test Results Log

### Test Run: [Date/Time]

| Test | Status | Notes |
|------|--------|-------|
| Build | ✅ PASS | No errors |
| Custom Services | | |
| Staff Button | | |
| Center Button | | |
| Capabilities | | |
| API Calls | | |
| Error Handling | | |
| Visual UI | | |
| Database | | |
| Mobile | | |

---

## Common Issues & Solutions

### Issue: Buttons Not Appearing
**Solution:**
```javascript
// Debug in console
const vendorData = JSON.parse(localStorage.getItem('vendorData'));
console.log('Vendor Data:', vendorData);
console.log('Role ID:', vendorData.roleId);
console.log('Service Style:', vendorData.serviceStyle);

// Check if capabilities are loading
const caps = sessionStorage.getItem(`vendor_capabilities_${vendorData.roleId}`);
console.log('Cached Capabilities:', caps ? JSON.parse(caps) : 'Not cached');
```

### Issue: Custom Services Error
**Solution:** Check network tab for 500 errors. Verify vendor has `custom_services` capability.

### Issue: Slow Loading
**Solution:** Check for capability aliasing. Console should show `[useVendorCapabilities] ✅ Loaded capabilities from DATABASE`.

---

## Next Steps After Verification

1. ✅ All tests pass → Deploy to staging
2. ⚠️ Some tests fail → Review console logs and fix
3. ❌ Critical failures → Roll back and investigate

---

*Last Updated: January 15, 2026*
