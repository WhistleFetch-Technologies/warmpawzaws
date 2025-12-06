# Admin Panel Verification Checklist
## Pet Cafe & Sunset Services Implementation

Use this checklist to verify that Pet Cafe and Sunset Services are properly configured and visible in the Admin Panel.

---

## ✅ Step 1: Verify Roles are Seeded

### Navigate to: Settings → Role Management

**Check for these roles:**

| Order | Role Name | Icon | Status |
|-------|-----------|------|--------|
| 10 | Pet Cafe | ☕ | Active |
| 11 | Pet Sunset Services | 💜 | Active |

### Expand Pet Cafe Role - Verify:
- **Description:** "Pet-friendly cafe with dining, playtime, and social experiences"
- **Vendor Type:** service_provider
- **Service Styles:** at_center
- **Features:**
  - Table reservations
  - Pet dining services
  - Playtime sessions
  - Birthday parties
  - Social events
- **Pricing Control:** ✅ Enabled (₹200-₹3,000)
- **Document Requirements:**
  - Aadhar Card ✅
  - PAN Card ✅
  - FSSAI License ✅
  - Fire Safety Certificate ✅
  - Cafe Interior Photos
- **Capabilities:** booking, reservation_management, menu, events, gallery

### Expand Sunset Services Role - Verify:
- **Description:** "Compassionate end-of-life care, cremation, burial, and memorial services"
- **Vendor Type:** service_provider
- **Service Styles:** at_center, at_home
- **Features:**
  - Pet cremation services
  - Burial arrangements
  - Memorial ceremonies
  - Grief support
  - Keepsake creation
- **Pricing Control:** ✅ Enabled (₹2,000-₹50,000)
- **Document Requirements:**
  - Aadhar Card ✅
  - PAN Card ✅
  - Crematorium License ✅
  - Pollution Control Certificate ✅
  - Facility Photos
- **Capabilities:** booking, grief_support, memorial_services, documents, chat

---

## ✅ Step 2: Verify Service Catalog Categories

### Navigate to: Service Catalog → Categories Tab

**Check for these NEW categories:**

| Category ID | Name | Status | Sub-Categories |
|-------------|------|--------|----------------|
| cat_pet_cafe | Pet Cafe Services | Active | 4 |
| cat_sunset_services | Pet Sunset Services | Active | 5 |

### Expand Pet Cafe Services - Verify Sub-Categories:
1. ✅ Dining & Treats
2. ✅ Playtime Sessions
3. ✅ Special Events
4. ✅ Cafe Daycare

### Expand Sunset Services - Verify Sub-Categories:
1. ✅ Cremation Services
2. ✅ Burial Services
3. ✅ Memorial Services
4. ✅ Transport Services
5. ✅ Grief Support

---

## ✅ Step 3: Verify Pet Cafe Services (15 services)

### Navigate to: Service Catalog → Services Tab → Filter by Role: "Pet Cafe"

**Should show 15 services:**

### Dining & Treats (5 services):
1. ✅ Cafe Table Reservation - 2 Pax (₹500, 120 min)
2. ✅ Cafe Table Reservation - 4 Pax (₹800, 120 min)
3. ✅ Puppuccino & Owner Coffee Combo (₹350, 60 min)
4. ✅ Pet Birthday Cake & Celebration (₹1,500, 90 min)
5. ✅ Gourmet Pet Meal Combo (₹600, 60 min)

### Playtime Sessions (3 services):
6. ✅ 1-Hour Playtime Session (₹400, 60 min)
7. ✅ 2-Hour Playtime Session (₹700, 120 min)
8. ✅ Puppy Socialization Session (₹800, 90 min)

### Special Events (3 services):
9. ✅ Pet Birthday Party Package (₹3,500, 180 min) - Package
10. ✅ Pet Meetup Event - Per Pet (₹500, 120 min)
11. ✅ Pet Adoption Day Participation (₹0, 180 min) - Free

### Cafe Daycare (3 services):
12. ✅ Full Day Cafe Daycare (₹1,200, 480 min)
13. ✅ Half Day Cafe Daycare (₹700, 240 min)
14. ✅ Weekly Cafe Daycare Package (₹5,000, 2400 min) - Package

### Premium (1 service):
15. ✅ Premium Cafe Experience - VIP Table (₹1,500, 120 min)

**Total Services:** 15  
**Price Range:** ₹0 - ₹5,000  
**Service Style:** All at_center

---

## ✅ Step 4: Verify Sunset Services (16 services)

### Navigate to: Service Catalog → Services Tab → Filter by Role: "Pet Sunset Services"

**Should show 16 services:**

### Cremation Services (3 services):
1. ✅ Individual Pet Cremation (₹8,000, 240 min, at_center)
2. ✅ Communal Pet Cremation (₹3,000, 120 min, at_center)
3. ✅ Premium Cremation with Viewing (₹12,000, 300 min, at_center)

### Burial Services (3 services):
4. ✅ Pet Cemetery Burial - Standard Plot (₹15,000, 180 min, at_center)
5. ✅ Pet Cemetery Burial - Premium Plot (₹25,000, 240 min, at_center)
6. ✅ Home Burial Arrangement Service (₹5,000, 120 min, at_home)

### Memorial Services (4 services):
7. ✅ Memorial Service - Basic (₹4,000, 90 min, at_center)
8. ✅ Memorial Service - Premium (₹8,000, 120 min, at_center)
9. ✅ Paw Print & Fur Keepsake (₹2,500, 60 min, at_center)
10. ✅ Custom Memorial Portrait (₹5,000, 0 min, at_center)

### Transport Services (2 services):
11. ✅ Pet Transport to Crematorium (₹2,000, 90 min, at_home)
12. ✅ 24/7 Emergency Sunset Transport (₹3,500, 60 min, at_home)

### Grief Support (2 services):
13. ✅ Pet Loss Grief Counseling - Single Session (₹1,500, 60 min, tele)
14. ✅ Pet Loss Support Group - Monthly (₹500, 90 min, tele)

### Packages (2 services):
15. ✅ Rainbow Bridge Memorial Package (₹20,000, 360 min, at_center) - Package
16. ✅ Compassionate Care Complete Package (₹35,000, 480 min, at_center) - Package

**Total Services:** 16  
**Price Range:** ₹500 - ₹35,000  
**Service Styles:** at_center, at_home, tele

---

## ✅ Step 5: Test Service Creation

### For Pet Cafe:
1. Navigate to: Service Catalog → Services Tab
2. Click **"Create Service"**
3. Select **Role:** Pet Cafe
4. Verify: Only `at_center` is available for service style
5. Verify: Category dropdown shows "Pet Cafe Services"
6. Create a test service (e.g., "Test Cafe Service")
7. Verify: Service appears in list with Pet Cafe badge

### For Sunset Services:
1. Click **"Create Service"**
2. Select **Role:** Pet Sunset Services
3. Verify: `at_center`, `at_home`, and `tele` are available
4. Verify: Category dropdown shows "Pet Sunset Services"
5. Create a test service (e.g., "Test Sunset Service")
6. Verify: Service appears in list with Sunset Services badge

---

## ✅ Step 6: Test Price & Duration Editing

### For Pet Cafe Service:
1. Find any Pet Cafe service (e.g., "Cafe Table Reservation - 2 Pax")
2. Click **Edit** (pencil icon)
3. Try to change base price
4. Verify: Can edit price (pricing control enabled)
5. Try to change duration
6. Verify: Can edit duration
7. Save and verify changes persist

### For Sunset Service:
1. Find any Sunset service (e.g., "Individual Pet Cremation")
2. Click **Edit** (pencil icon)
3. Try to change base price
4. Verify: Can edit price (pricing control enabled)
5. Try to change duration
6. Verify: Can edit duration
7. Save and verify changes persist

---

## ✅ Step 7: Verify Vendor Onboarding Configuration

### Navigate to: Settings → Onboarding Configuration

### Select Role: Pet Cafe
Verify custom fields:
- ✅ FSSAI License Number (text)
- ✅ Seating Capacity (Pax) (number)
- ✅ Max Pets at Once (number)

Verify required documents:
- ✅ Aadhar Card
- ✅ PAN Card
- ✅ FSSAI License
- ✅ Fire Safety Certificate

### Select Role: Pet Sunset Services
Verify custom fields:
- ✅ Crematorium License Number (text)
- ✅ Cemetery Location (text, optional)
- ✅ Certified Grief Counselor on Staff (checkbox)

Verify required documents:
- ✅ Aadhar Card
- ✅ PAN Card
- ✅ Crematorium License
- ✅ Pollution Control Certificate

---

## ✅ Step 8: Verify Role Selection Screen

### Test in Vendor App:
1. Open Vendor App (incognito/private window)
2. Click "Register as Vendor"
3. Enter test phone number
4. Complete OTP verification
5. **Verify on Role Selection screen:**
   - ✅ Pet Cafe card with ☕ icon
   - ✅ Pet Sunset Services card with 💜 icon
   - ✅ Both cards have correct descriptions
   - ✅ Both cards are selectable (not grayed out)

---

## ✅ Step 9: Check Database Counts

### Navigate to: Admin Dashboard

**Expected counts after seeding:**
- Total Roles: 12 (including Pet Cafe & Sunset Services)
- Total Categories: 11 (including 2 new)
- Total Sub-Categories: 9 new (4 cafe + 5 sunset)
- Total Services: 60+ (including 31 new services)

### Quick Count Verification:
```
Previous: ~60 services
New: 31 services (15 cafe + 16 sunset)
Total: ~91 services
```

---

## ✅ Step 10: Verify Icon Themes

### Open Browser Console on Admin Panel:
```javascript
// Check if icon themes are loaded
console.log('Pet Cafe theme:', window.VENDOR_ICON_THEMES?.pet_cafe);
console.log('Sunset theme:', window.VENDOR_ICON_THEMES?.sunset_services);
```

Should show:
- Pet Cafe: Coffee icon, Amber colors
- Sunset Services: Heart icon, Gray colors

---

## Troubleshooting Guide

### Issue: Roles don't appear in Role Management
**Fix:**
1. Go to Role Management
2. Click "Seed Initial Roles" button
3. Wait for "12 roles seeded successfully" message
4. Refresh page

### Issue: Services don't appear in Service Catalog
**Fix:**
1. Go to Service Catalog → Admin Controls
2. Find "Catalog Seed Panel"
3. Click "Seed Catalog" button
4. Wait for "31 services added" message
5. Refresh page

### Issue: Categories don't show in dropdown
**Fix:**
1. Verify categories were seeded (check Categories Tab)
2. Clear browser cache
3. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### Issue: Services show wrong role
**Fix:**
1. Check if `applicableRoles` field is correct in database
2. Re-seed catalog if needed
3. Use "Edit Service" to fix individual services

### Issue: Can't edit prices for new roles
**Fix:**
1. Verify `pricingControl.canControlPrice` is `true` in role config
2. Check if role has `priceRangeMin` and `priceRangeMax` set
3. Re-seed roles if needed

---

## Success Criteria

### ✅ All checks pass when:

**Roles:**
- [ ] Pet Cafe appears in role list (order 10)
- [ ] Sunset Services appears in role list (order 11)
- [ ] Both roles are marked as "Active"
- [ ] Both roles show correct icons (☕ & 💜)

**Categories:**
- [ ] Pet Cafe Services category exists
- [ ] Sunset Services category exists
- [ ] Pet Cafe has 4 sub-categories
- [ ] Sunset Services has 5 sub-categories

**Services:**
- [ ] Pet Cafe has exactly 15 services
- [ ] Sunset Services has exactly 16 services
- [ ] All services have correct prices
- [ ] All services have correct durations
- [ ] All services show correct service style badges

**Onboarding:**
- [ ] Pet Cafe shows FSSAI license field
- [ ] Sunset Services shows Crematorium license field
- [ ] Document requirements match role config
- [ ] Custom fields appear in vendor registration

**Permissions:**
- [ ] Can create new services for both roles
- [ ] Can edit prices for both roles
- [ ] Can edit durations for both roles
- [ ] Can delete test services

---

## Quick Stats Summary

After successful implementation, you should see:

| Metric | Previous | Added | New Total |
|--------|----------|-------|-----------|
| Roles | 10 | 2 | 12 |
| Categories | 9 | 2 | 11 |
| Sub-Categories | ~25 | 9 | ~34 |
| Services | ~60 | 31 | ~91 |
| Service Styles | 3 | 0 | 3 |
| Vendor Types | 3 | 0 | 3 |

---

## Final Verification Command

Run this in browser console on Admin Panel to verify everything:

```javascript
const verifyImplementation = async () => {
  // Check roles
  const rolesRes = await fetch(
    'https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475/config/roles',
    { headers: { 'Authorization': 'Bearer YOUR_ANON_KEY' } }
  );
  const roles = await rolesRes.json();
  const cafeRole = roles.roles?.find(r => r.id === 'pet_cafe');
  const sunsetRole = roles.roles?.find(r => r.id === 'sunset_services');
  
  // Check services
  const servicesRes = await fetch(
    'https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475/admin/catalog/services',
    { headers: { 'Authorization': 'Bearer YOUR_ANON_KEY' } }
  );
  const services = await servicesRes.json();
  const cafeServices = services.services?.filter(s => s.applicableRoles?.includes('pet_cafe'));
  const sunsetServices = services.services?.filter(s => s.applicableRoles?.includes('sunset_services'));
  
  // Print results
  console.log('=== VERIFICATION RESULTS ===');
  console.log('Pet Cafe Role:', cafeRole ? '✅ Found' : '❌ Missing');
  console.log('Sunset Role:', sunsetRole ? '✅ Found' : '❌ Missing');
  console.log('Pet Cafe Services:', cafeServices?.length === 15 ? '✅ 15 services' : `❌ ${cafeServices?.length} services (expected 15)`);
  console.log('Sunset Services:', sunsetServices?.length === 16 ? '✅ 16 services' : `❌ ${sunsetServices?.length} services (expected 16)`);
  console.log('=========================');
  
  return {
    success: cafeRole && sunsetRole && cafeServices?.length === 15 && sunsetServices?.length === 16,
    details: {
      cafeRole: !!cafeRole,
      sunsetRole: !!sunsetRole,
      cafeServicesCount: cafeServices?.length,
      sunsetServicesCount: sunsetServices?.length
    }
  };
};

verifyImplementation();
```

---

**Time to Complete:** ~10 minutes  
**Required Access:** Admin Panel with Super Admin privileges  
**Next Step:** If all checks pass, proceed to vendor onboarding testing
