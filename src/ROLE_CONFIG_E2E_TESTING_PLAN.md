# 🧪 ROLE CONFIGURATION SYSTEM - END-TO-END TESTING PLAN

**Generated:** December 9, 2025  
**Status:** Ready for Testing  
**Updated Capabilities:** 48 total (21 new + 27 existing)

---

## 🎯 TESTING OBJECTIVES

1. **Verify all 21 new capabilities are in the Admin UI**
2. **Ensure capabilities can be assigned to any role (modular)**
3. **Confirm vendor onboarding respects role capabilities**
4. **Validate vendor dashboard renders based on capabilities**
5. **Test universal service discovery filtering**

---

## 📋 PRE-TESTING CHECKLIST

### Backend Configuration Update
- [ ] **Step 1:** Call the update-capabilities endpoint to push new config to database
  ```bash
  POST https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/roles/update-capabilities
  Authorization: Bearer {publicAnonKey}
  ```
  **Expected Response:**
  ```json
  {
    "success": true,
    "message": "Capability update complete. Updated: 18, Skipped: 0",
    "stats": { "updated": 18, "skipped": 0 }
  }
  ```

### Verify Config Propagation
- [ ] **Step 2:** Check all roles have updated capabilities
  ```bash
  GET https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/config/roles
  ```
  **Verify:**
  - All 18 roles returned
  - Each role has capabilities array
  - New capabilities present (facility_management, schedule_management, etc.)

---

## 🧩 TEST SUITE 1: ADMIN UI - CAPABILITY CONFIGURATION

### Test 1.1: View All Capabilities in Role Editor
**Steps:**
1. Navigate to Admin Dashboard → Role Management
2. Click "Edit" on any existing role (e.g., Veterinarian)
3. Go to "Types & Styles" tab
4. Scroll to "Capabilities" section

**Expected Results:**
- [ ] ✅ All 48 capabilities visible in 2-column grid
- [ ] ✅ Capabilities have proper labels (e.g., "Facility Management" not "facility_management")
- [ ] ✅ Currently enabled capabilities are checked
- [ ] ✅ Checkboxes are interactive

**Verify Specific New Capabilities Visible:**
- [ ] `facility_management` → "Facility Management"
- [ ] `schedule_management` → "Schedule Management"
- [ ] `custom_services` → "Custom Services"
- [ ] `package_management` → "Package Management"
- [ ] `vet_summary` → "Vet Summary"
- [ ] `patient_monitoring` → "Patient Monitoring"
- [ ] `multi_doctor_management` → "Multi-Doctor Management"
- [ ] `ambulance_services` → "Ambulance Services"
- [ ] `diagnostic_lab` → "Diagnostic Lab"
- [ ] `room_management` → "Room Management"
- [ ] `nightly_pricing` → "Nightly Pricing"
- [ ] `table_management` → "Table Management"
- [ ] `pax_management` → "Pax Management"
- [ ] `prescription_verification` → "Prescription Verification"
- [ ] `meal_plans` → "Meal Plans"
- [ ] `policy_management` → "Policy Management"
- [ ] `claims_management` → "Claims Management"
- [ ] `distance_pricing` → "Distance Pricing"
- [ ] `adoption` → "Pet Adoption"
- [ ] `donation` → "Donation Management"
- [ ] `memorial` → "Memorial Services"

---

### Test 1.2: Edit Existing Role - Add New Capabilities
**Test Case:** Add clinic-specific capabilities to Veterinarian role

**Steps:**
1. Edit "Veterinarian" role
2. Go to "Types & Styles" tab
3. Enable these capabilities:
   - [x] `multi_doctor_management`
   - [x] `ambulance_services`
   - [x] `diagnostic_lab`
4. Click "Update Role"

**Expected Results:**
- [ ] ✅ Success message: "Role saved successfully!"
- [ ] ✅ Role card shows updated capability count
- [ ] ✅ Closing and reopening shows capabilities persisted

**Database Verification:**
```bash
GET /config/roles
# Check veterinarian role has new capabilities in array
```

---

### Test 1.3: Create New Custom Role with Mixed Capabilities
**Test Case:** Create "Pet Daycare" role with boarding + cafe capabilities

**Steps:**
1. Click "Create Role"
2. **Basic Tab:**
   - Name: "Pet Daycare"
   - Description: "Daycare center for pets with cafe"
   - Icon: "🏖️"
   - Order: 50
   - Active: ON
3. **Types & Styles Tab:**
   - Vendor Types: ☑ Service Provider
   - Service Styles: ☑ At Center
   - Capabilities:
     - ☑ `facility_management`
     - ☑ `schedule_management`
     - ☑ `booking`
     - ☑ `chat`
     - ☑ `custom_services`
     - ☑ `package_management`
     - ☑ `staff_management`
     - ☑ `room_management` (from boarding)
     - ☑ `table_management` (from cafe)
     - ☑ `menu` (from cafe)
     - ☑ `photo_updates`
4. **Pricing Tab:**
   - Can Control Price: ON
   - Can Control Duration: OFF
5. Click "Create Role"

**Expected Results:**
- [ ] ✅ Role created successfully
- [ ] ✅ New role appears in grid
- [ ] ✅ All selected capabilities shown on role card
- [ ] ✅ Role available in vendor onboarding role selector

---

## 🧩 TEST SUITE 2: VENDOR ONBOARDING - ROLE-BASED BEHAVIOR

### Test 2.1: Veterinarian Onboarding with New Capabilities
**Steps:**
1. Start vendor onboarding as new user
2. Select "Veterinarian" role
3. Complete profile setup
4. Navigate to Vendor Dashboard

**Expected Results:**
- [ ] ✅ Dashboard shows "Facility Management" option
- [ ] ✅ Dashboard shows "Schedule Management" option
- [ ] ✅ Dashboard shows "Custom Services" option
- [ ] ✅ Dashboard shows "Package Management" option
- [ ] ✅ Medical Records, Prescription, Vet Summary options visible
- [ ] ✅ No clinic-specific options (unless added in Test 1.2)

**Capability-to-UI Mapping Verification:**
| Capability | Expected UI Element | Location |
|------------|---------------------|----------|
| `facility_management` | "Manage Centers" button | Dashboard sidebar |
| `schedule_management` | "Schedule" button | Dashboard sidebar |
| `custom_services` | "Custom Services" tab | Services section |
| `package_management` | "Create Package" button | Services section |
| `prescription` | "Write Prescription" button | Bookings detail |
| `medical_records` | "View Medical History" button | Pet profile |
| `vet_summary` | "Vet Summary" tab | Bookings detail |

---

### Test 2.2: Veterinary Clinic Onboarding with Extended Capabilities
**Steps:**
1. Start new vendor onboarding
2. Select "Veterinary Clinic" role (has all clinic capabilities)
3. Complete onboarding
4. Navigate to Clinic Dashboard

**Expected Results:**
- [ ] ✅ All veterinarian capabilities visible
- [ ] ✅ **PLUS** these additional options:
  - [ ] "Doctor Management" section
  - [ ] "Ambulance Services" section
  - [ ] "Diagnostic Lab" section
  - [ ] "Emergency Protocols" section
- [ ] ✅ Specialized "ClinicDashboard.tsx" renders (not generic VendorDashboard)

**Clinic-Specific UI Elements:**
- [ ] Multi-doctor appointment calendar
- [ ] Doctor-wise statistics
- [ ] Customer lobby tracking
- [ ] Ambulance fleet manager (basePrice + pricePerKm)
- [ ] Diagnostic test catalog

---

### Test 2.3: Pet Resort Onboarding - Room Management
**Steps:**
1. Start vendor onboarding
2. Select "Pet Resort" role
3. Complete onboarding
4. Navigate to Resort Dashboard

**Expected Results:**
- [ ] ✅ "Room Management" section visible
- [ ] ✅ Can create room types (Standard, Deluxe, Suite, Villa)
- [ ] ✅ Can set amenities (AC, Heating, Camera, Play Area, Private Garden)
- [ ] ✅ Can configure pet size compatibility
- [ ] ✅ Can set nightly pricing per room type
- [ ] ✅ Occupancy calendar shows bookings
- [ ] ✅ Current guests dashboard visible

**Specialized Dashboard:** `ResortManagementDashboard.tsx` should render

---

### Test 2.4: Pet Cafe Onboarding - Table & Pax Management
**Steps:**
1. Start vendor onboarding
2. Select "Pet Cafe" role
3. Complete onboarding
4. Navigate to Cafe Dashboard

**Expected Results:**
- [ ] ✅ "Table Management" section visible
- [ ] ✅ Can create tables with capacity
- [ ] ✅ "Pax Management" shows party size tracking
- [ ] ✅ Today's reservations visible
- [ ] ✅ Table status (Available/Occupied/Reserved)

**Specialized Dashboard:** `CafeVendorDashboard.tsx` should render

---

### Test 2.5: Nutritionist Onboarding - Meal Plan Capabilities
**Steps:**
1. Start vendor onboarding
2. Select "Nutritionist" role
3. Complete onboarding
4. Navigate to Nutritionist Dashboard

**Expected Results:**
- [ ] ✅ "Meal Plan Builder" visible
- [ ] ✅ Can create meal plans with:
  - Meal name
  - Description
  - Diet type
  - Calorie target
  - Ingredients
- [ ] ✅ "Diet Chart Creator" visible
- [ ] ✅ Progress tracking for client weight/health

**Specialized Dashboard:** `NutritionistMealManager.tsx` should render

---

### Test 2.6: Insurance Provider Onboarding
**Steps:**
1. Start vendor onboarding
2. Select "Insurance" role
3. Complete onboarding
4. Navigate to Insurance Dashboard

**Expected Results:**
- [ ] ✅ "Policy Management" section
- [ ] ✅ Can create policies with coverage details
- [ ] ✅ "Claims Management" section
- [ ] ✅ Can view/process claims

**Specialized Dashboard:** `InsuranceVendorContainer.tsx` should render

---

## 🧩 TEST SUITE 3: VENDOR DASHBOARD - CAPABILITY-BASED RENDERING

### Test 3.1: Dashboard Sidebar Dynamic Rendering
**Objective:** Verify sidebar menu items change based on role capabilities

**Test Scenarios:**

#### Scenario A: Pet Walker (Simple Role)
**Expected Capabilities:** 
- `facility_management`, `schedule_management`, `booking`, `chat`, `gps_tracking`, `photo_updates`, `custom_services`, `package_management`

**Expected Sidebar Items:**
- [ ] Dashboard (always)
- [ ] Bookings (always)
- [ ] Centers (facility_management)
- [ ] Schedule (schedule_management)
- [ ] Services (custom_services)
- [ ] Packages (package_management)
- [ ] Chat (chat)
- [ ] GPS Tracking (gps_tracking)

**Should NOT see:**
- [ ] ❌ Medical Records
- [ ] ❌ Prescriptions
- [ ] ❌ Room Management
- [ ] ❌ Ambulance Services

#### Scenario B: Veterinary Clinic (Complex Role)
**Expected Sidebar Items:**
- [ ] Dashboard
- [ ] Bookings
- [ ] Centers
- [ ] Schedule
- [ ] Services
- [ ] Packages
- [ ] Staff
- [ ] Doctors (multi_doctor_management)
- [ ] Ambulance (ambulance_services)
- [ ] Diagnostic Lab (diagnostic_lab)
- [ ] Prescriptions
- [ ] Medical Records
- [ ] Video Consultations (tele)
- [ ] Emergency Protocols

---

### Test 3.2: Service Creation with Custom Services Capability
**Steps:**
1. Login as vendor with `custom_services` capability
2. Navigate to Services
3. Click "Create Custom Service"

**Expected Results:**
- [ ] ✅ Service creation form appears
- [ ] ✅ Can define custom service outside admin catalog
- [ ] ✅ Service appears in customer search

**Without Capability:**
1. Login as vendor WITHOUT `custom_services` (e.g., Product Store)
2. Navigate to Services

**Expected Results:**
- [ ] ✅ "Create Custom Service" button hidden or disabled
- [ ] ✅ Can only select from admin catalog

---

### Test 3.3: Package Creation with Package Management Capability
**Steps:**
1. Login as vendor with `package_management` capability
2. Navigate to Packages
3. Click "Create Package"
4. Add 3 services to package
5. Set discount price
6. Save

**Expected Results:**
- [ ] ✅ Package created successfully
- [ ] ✅ Package visible in customer app
- [ ] ✅ Discounted pricing applied

**Without Capability:**
1. Login as Product Store (no package management)
2. Check for Packages menu

**Expected Results:**
- [ ] ✅ Packages menu item not visible

---

## 🧩 TEST SUITE 4: CUSTOMER APP - SERVICE DISCOVERY FILTERING

### Test 4.1: Universal Service Discovery with Capability Filtering
**Objective:** Verify customers can find vendors based on capabilities

**Steps:**
1. Open Customer App
2. Search for "Pet Daycare" (custom role created in Test 1.3)
3. Select the daycare vendor
4. View vendor profile

**Expected Results:**
- [ ] ✅ Vendor profile shows:
  - Facility photos/amenities (facility_management)
  - Available time slots (schedule_management)
  - Custom daycare services (custom_services)
  - Package deals (package_management)
  - Room types (room_management)
  - Cafe menu (menu)

**Filters to Test:**
- [ ] Location-based search works
- [ ] Service style filter (At Center) works
- [ ] Price range filter works

---

### Test 4.2: Clinic-Specific Service Discovery
**Steps:**
1. Customer searches for "Veterinary Clinic"
2. Filters by "Emergency Services"
3. Views clinic profile

**Expected Results:**
- [ ] ✅ Clinics with `emergency` capability shown
- [ ] ✅ Clinic profile shows:
  - Multiple doctors (multi_doctor_management)
  - Emergency contact button
  - Ambulance service option (ambulance_services)
  - Diagnostic tests catalog (diagnostic_lab)

---

### Test 4.3: Booking Flow with Capability-Specific Options
**Objective:** Verify booking flow adapts to vendor capabilities

#### Scenario A: Book Vet Clinic with Ambulance
**Steps:**
1. Search for vet clinic
2. Select "Emergency Visit"
3. Check "Need Pet Ambulance"
4. Complete booking

**Expected Results:**
- [ ] ✅ Ambulance pickup location selector appears
- [ ] ✅ Distance calculated
- [ ] ✅ Pricing: basePrice + (distance * pricePerKm)
- [ ] ✅ Ambulance assignment confirmed

#### Scenario B: Book Resort with Room Selection
**Steps:**
1. Search for pet resort
2. Select dates (3 nights)
3. Choose room type (Deluxe)
4. Select pet size (Medium)
5. Complete booking

**Expected Results:**
- [ ] ✅ Room type selector visible (room_management)
- [ ] ✅ Nightly pricing shown (₹500/night × 3 = ₹1500)
- [ ] ✅ Amenities listed (AC, Play Area, Camera)
- [ ] ✅ Booking confirmation with check-in/out dates

#### Scenario C: Book Nutritionist with Meal Plan
**Steps:**
1. Search for nutritionist
2. Select "Diet Consultation"
3. Choose "Meal Plan Included" add-on
4. Complete booking

**Expected Results:**
- [ ] ✅ Meal plan builder option visible
- [ ] ✅ Can select diet type (Weight Loss, Muscle Gain, Senior Care)
- [ ] ✅ Confirmation includes meal plan details

---

## 🧩 TEST SUITE 5: STAFF ASSIGNMENT & SERVICE SELECTION

### Test 5.1: Staff Management Capability
**Steps:**
1. Login as vendor with `staff_management` capability
2. Navigate to Staff section
3. Add new staff member
4. Assign services to staff
5. Set staff schedule

**Expected Results:**
- [ ] ✅ Staff CRUD interface visible
- [ ] ✅ Can assign multiple services to staff
- [ ] ✅ Staff schedule calendar functional
- [ ] ✅ Customer can select specific staff during booking

**Without Capability:**
1. Login as Pet Walker (individual, no staff)
2. Check for Staff menu

**Expected Results:**
- [ ] ✅ Staff menu not visible
- [ ] ✅ All bookings assigned to vendor directly

---

### Test 5.2: Multi-Doctor Management (Clinic Specific)
**Steps:**
1. Login as Veterinary Clinic
2. Navigate to Doctors section
3. Add 3 doctors with different specializations
4. Assign services to each doctor
5. Set doctor schedules

**Expected Results:**
- [ ] ✅ Doctor management interface (enhanced staff management)
- [ ] ✅ Specialization tags visible
- [ ] ✅ Customer can filter by doctor specialization
- [ ] ✅ Appointment slots show doctor availability

**Customer Experience:**
1. Customer books vet consultation
2. Can see all available doctors
3. Filters by specialization (e.g., "Orthopedic")
4. Books with specific doctor

**Expected Results:**
- [ ] ✅ Doctor filter works
- [ ] ✅ Only specialist doctors shown for specific problems
- [ ] ✅ Booking assigned to selected doctor

---

## 🧩 TEST SUITE 6: CAPABILITY PROPAGATION & EDGE CASES

### Test 6.1: Capability Update Propagation
**Objective:** Verify adding capability to existing role updates all vendors

**Steps:**
1. Edit "Pet Groomer" role
2. Add `meal_plans` capability (unusual but testing modularity)
3. Save role
4. Login as existing Pet Groomer vendor

**Expected Results:**
- [ ] ✅ "Meal Plans" section now visible in dashboard
- [ ] ✅ Can create meal plans (even though it's a groomer)

**This tests modular capability system - any capability can be added to any role**

---

### Test 6.2: Capability Removal Impact
**Steps:**
1. Edit "Pet Sitter" role
2. Remove `package_management` capability
3. Save
4. Login as Pet Sitter vendor who had created packages

**Expected Results:**
- [ ] ✅ Packages section hidden from dashboard
- [ ] ✅ Existing packages still exist in database (not deleted)
- [ ] ✅ Customers can still book old packages
- [ ] ✅ Vendor cannot create new packages

---

### Test 6.3: New Role Created Mid-Platform
**Objective:** Test creating entirely new role while platform is live

**Steps:**
1. Create new role "Pet Taxi Stand" with:
   - `facility_management`
   - `schedule_management`
   - `booking`
   - `gps_tracking`
   - `distance_pricing`
   - `staff_management`
2. New vendor onboards with this role
3. Customer searches for pet taxi

**Expected Results:**
- [ ] ✅ Role appears in vendor onboarding
- [ ] ✅ Vendor can complete onboarding
- [ ] ✅ Dashboard renders with correct capabilities
- [ ] ✅ Customer can discover and book
- [ ] ✅ Distance-based pricing works (basePrice + pricePerKm)

---

## 📊 PERFORMANCE & SCALABILITY TESTS

### Test 7.1: Role Fetch Performance
**Steps:**
1. Open Admin Dashboard → Role Management
2. Monitor network request for `/config/roles`

**Expected Results:**
- [ ] ✅ Response time < 500ms
- [ ] ✅ All 18+ roles returned in single request
- [ ] ✅ No duplicate roles
- [ ] ✅ All capabilities populated

---

### Test 7.2: Vendor Dashboard Load with Many Capabilities
**Steps:**
1. Login as Veterinary Clinic (17 capabilities)
2. Monitor dashboard load time

**Expected Results:**
- [ ] ✅ Dashboard renders in < 2 seconds
- [ ] ✅ All sidebar items visible
- [ ] ✅ No console errors
- [ ] ✅ Smooth navigation between sections

---

## 🐛 REGRESSION TESTS

### Test 8.1: Existing Vendors Still Work
**Objective:** Ensure vendors onboarded BEFORE capability update still function

**Steps:**
1. Find vendor onboarded before this update
2. Login to their dashboard
3. Test all existing features

**Expected Results:**
- [ ] ✅ Dashboard loads without errors
- [ ] ✅ All old features still work
- [ ] ✅ New capabilities visible (if role was updated)

---

### Test 8.2: Customer Bookings Not Affected
**Steps:**
1. Create test booking as customer
2. Vendor accepts booking
3. Complete booking lifecycle

**Expected Results:**
- [ ] ✅ Booking flow unchanged
- [ ] ✅ No errors during creation/acceptance/completion
- [ ] ✅ Capability-specific features work (e.g., ambulance, meal plan)

---

## ✅ SUCCESS CRITERIA

### Critical (Must Pass All)
- [ ] All 48 capabilities visible in Admin UI
- [ ] Can create new role with any combination of capabilities
- [ ] Can edit existing role to add/remove capabilities
- [ ] Vendor dashboard dynamically renders based on capabilities
- [ ] Customer can book services with capability-specific features

### High Priority (Must Pass 90%)
- [ ] All 18 standard roles have correct capabilities
- [ ] Specialized dashboards render (Clinic, Resort, Cafe, Nutritionist, Insurance)
- [ ] Capability removal doesn't break existing data
- [ ] New custom roles work immediately after creation

### Medium Priority (Must Pass 75%)
- [ ] Performance benchmarks met
- [ ] No duplicate roles in database
- [ ] All regression tests pass

---

## 📝 BUG REPORTING TEMPLATE

```markdown
### Bug Report

**Test:** [Test number and name]
**Severity:** Critical / High / Medium / Low
**Component:** Admin UI / Vendor Dashboard / Customer App / Backend

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Result:**

**Actual Result:**

**Screenshots/Console Logs:**

**Environment:**
- Browser: 
- Role: 
- Vendor ID: 
```

---

## 🚀 POST-TESTING ACTIONS

### If All Tests Pass:
1. ✅ Mark all capabilities as Production Ready
2. ✅ Update vendor onboarding documentation
3. ✅ Notify all existing vendors of new capabilities
4. ✅ Begin building P0 missing features (Pharmacy Rx, Shelter Adoption, Progress Tracking)

### If Tests Fail:
1. 🔴 Document all failures with bug reports
2. 🔴 Prioritize critical bugs
3. 🔴 Fix and re-test before proceeding

---

## 📅 ESTIMATED TESTING TIME

- **Test Suite 1 (Admin UI):** 45 minutes
- **Test Suite 2 (Vendor Onboarding):** 90 minutes
- **Test Suite 3 (Dashboard Rendering):** 60 minutes
- **Test Suite 4 (Customer Discovery):** 60 minutes
- **Test Suite 5 (Staff Assignment):** 45 minutes
- **Test Suite 6 (Edge Cases):** 45 minutes
- **Test Suite 7 (Performance):** 30 minutes
- **Test Suite 8 (Regression):** 30 minutes

**Total:** ~6 hours (can be split across team)

---

**End of Testing Plan**

Ready to execute? Run the update-capabilities endpoint first, then start with Test Suite 1!
