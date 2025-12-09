# 🧪 E2E TESTING EXECUTION CHECKLIST

**Date:** December 9, 2025  
**Status:** Ready to Execute  
**P0 Features:** ✅ Built (Pharmacy Rx, Adoption, Progress Tracking)

---

## 📋 PRE-TEST SETUP

### ✅ Step 1: Update Role Capabilities in Database
```bash
POST https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/roles/update-capabilities
Authorization: Bearer {publicAnonKey}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Capability update complete",
  "stats": { "updated": 18, "skipped": 0 }
}
```

### ✅ Step 2: Verify Server Health
```bash
GET https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/health
```

**Expected:** `{"status": "ok"}`

### ✅ Step 3: Clear Browser Cache
- Press `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
- Open DevTools (F12) → Network tab → Check "Disable cache"

---

## 🧩 TEST SUITE 1: ADMIN UI - VERIFY ALL 48 CAPABILITIES VISIBLE

### Test 1.1: Access Role Management
- [ ] Navigate to Admin Dashboard
- [ ] Click "Role Management" or equivalent
- [ ] Verify page loads without errors

### Test 1.2: Open Edit Role Modal
- [ ] Click "Edit" on any role (e.g., Veterinarian)
- [ ] Navigate to "Types & Styles" tab
- [ ] Scroll to "Capabilities" section

### Test 1.3: Verify All Capabilities Present
Check for these NEW capabilities (21 total):

**Universal (4):**
- [ ] ✅ `facility_management` → "Facility Management"
- [ ] ✅ `schedule_management` → "Schedule Management"
- [ ] ✅ `custom_services` → "Custom Services"
- [ ] ✅ `package_management` → "Package Management"

**Healthcare (6):**
- [ ] ✅ `vet_summary` → "Vet Summary"
- [ ] ✅ `patient_monitoring` → "Patient Monitoring"
- [ ] ✅ `multi_doctor_management` → "Multi-Doctor Management"
- [ ] ✅ `ambulance_services` → "Ambulance Services"
- [ ] ✅ `diagnostic_lab` → "Diagnostic Lab"
- [ ] ✅ `emergency_protocols` → "Emergency Protocols"

**Boarding/Resort (3):**
- [ ] ✅ `room_management` → "Room Management"
- [ ] ✅ `nightly_pricing` → "Nightly Pricing"
- [ ] ✅ `occupancy_tracking` → "Occupancy Tracking"

**Cafe (2):**
- [ ] ✅ `table_management` → "Table Management"
- [ ] ✅ `pax_management` → "Pax Management"

**Pharmacy (3):**
- [ ] ✅ `prescription_verification` → "Prescription Verification"
- [ ] ✅ `controlled_substances` → "Controlled Substances"
- [ ] ✅ `expiry_management` → "Expiry Management"

**Nutritionist (2):**
- [ ] ✅ `meal_plans` → "Meal Plans"
- [ ] ✅ `diet_charts` → "Diet Charts"

**Insurance (2):**
- [ ] ✅ `policy_management` → "Policy Management"
- [ ] ✅ `claims_management` → "Claims Management"

**Other (3):**
- [ ] ✅ `distance_pricing` → "Distance Pricing"
- [ ] ✅ `adoption` → "Pet Adoption"
- [ ] ✅ `memorial` → "Memorial Services"

**Plus 27 Existing:**
- [ ] `booking`, `chat`, `prescription`, `medical_records`, `tele`, `emergency`
- [ ] `staff_management`, `catalog`, `inventory`, `orders`, `delivery`
- [ ] `gps_tracking`, `progress_tracking`, `portfolio`, `gallery`
- [ ] `cctv_access`, `photo_updates`, `menu`, `events`
- [ ] `donation`, `counseling`

**Total Verified:** __/48

### Test 1.4: Test Capability Assignment
- [ ] Check/uncheck a few capabilities
- [ ] Click "Update Role"
- [ ] Verify success message
- [ ] Close and reopen modal
- [ ] Verify changes persisted

### Test 1.5: Create New Custom Role
- [ ] Click "Create Role"
- [ ] Name: "Test Pet Daycare"
- [ ] Select vendor type: Service Provider
- [ ] Select mixed capabilities (boarding + cafe)
- [ ] Save role
- [ ] Verify new role appears in role grid

**PASS CRITERIA:**  
- ✅ All 48 capabilities visible with proper labels  
- ✅ Capabilities are checkboxes (not just text)  
- ✅ Can toggle capabilities on/off  
- ✅ Changes persist after save  
- ✅ Can create custom roles with any capability mix  

---

## 🧩 TEST SUITE 2: VENDOR ONBOARDING - ROLE-BASED DASHBOARDS

### Test 2.1: Pet Pharmacy Onboarding
1. **Onboard New Vendor:**
   - [ ] Start vendor onboarding
   - [ ] Select "Pet Pharmacy" role
   - [ ] Complete profile (name, phone, address)
   - [ ] Upload documents
   - [ ] Submit application

2. **Admin Approve:**
   - [ ] Go to Admin → Vendor Management
   - [ ] Find the pharmacy application
   - [ ] Click "Approve"
   - [ ] Verify status changes to "Approved"

3. **Login as Pharmacy Vendor:**
   - [ ] Logout and login with pharmacy phone number
   - [ ] Verify dashboard loads

4. **Verify Prescription Verification Feature:**
   - [ ] Dashboard should show "Prescription Verification" section
   - [ ] Click on it
   - [ ] Verify `PharmacyPrescriptionVerification.tsx` component renders
   - [ ] Check for:
     - [ ] Stats cards (Total, Pending, Verified, Rejected, Controlled)
     - [ ] Filters (Search, Status, Type)
     - [ ] Prescription list (empty initially is OK)
   - [ ] Try creating a test prescription (if admin tool available)

**Expected Capabilities for Pharmacy:**
- [ ] `facility_management` → Manage pharmacy locations
- [ ] `schedule_management` → Operating hours
- [ ] `catalog` → Medicine catalog
- [ ] `inventory` → Stock management
- [ ] `orders` → Order processing
- [ ] `delivery` → Delivery coordination
- [ ] `prescription` → View prescriptions
- [ ] `prescription_verification` ✅ → **Verify prescriptions (NEW!)**
- [ ] `controlled_substances` ✅ → **Schedule H/X tracking (NEW!)**
- [ ] `expiry_management` ✅ → **Expiry monitoring (NEW!)**

---

### Test 2.2: Pet Shelter Onboarding
1. **Onboard New Vendor:**
   - [ ] Start vendor onboarding
   - [ ] Select "Pet Shelter" role
   - [ ] Complete profile
   - [ ] Submit & approve

2. **Login as Shelter Vendor:**
   - [ ] Verify dashboard loads

3. **Verify Adoption System Feature:**
   - [ ] Dashboard should show "Adoption Management" section
   - [ ] Click on it
   - [ ] Verify `ShelterAdoptionSystem.tsx` component renders
   - [ ] Check for:
     - [ ] Stats cards (Total Pets, Available, Adopted, Pending Apps)
     - [ ] Two tabs: "Pets" and "Applications"
     - [ ] "Add Pet" button visible
   
4. **Test Add Pet Flow:**
   - [ ] Click "Add Pet"
   - [ ] Fill form:
     - Name: "Buddy"
     - Species: Dog
     - Breed: "Labrador"
     - Age: "2 years"
     - Gender: Male
     - Description: "Friendly dog"
     - Vaccinated: Yes
     - Adoption Fee: 500
   - [ ] Click "Add Pet"
   - [ ] Verify pet appears in grid
   - [ ] Verify pet has "Available" badge

5. **Test Pet Detail View:**
   - [ ] Click "View" on the pet card
   - [ ] Verify modal opens with full details
   - [ ] Verify images, stats, and info display correctly

**Expected Capabilities for Shelter:**
- [ ] `facility_management` → Shelter locations
- [ ] `schedule_management` → Visit hours
- [ ] `chat` → Communication
- [ ] `staff_management` → Volunteer management
- [ ] `adoption` ✅ → **Pet adoption system (NEW!)**
- [ ] `donation` → Donation tracking
- [ ] `events` → Adoption events

---

### Test 2.3: Pet Trainer Onboarding
1. **Onboard New Vendor:**
   - [ ] Start vendor onboarding
   - [ ] Select "Pet Trainer" role
   - [ ] Complete profile
   - [ ] Submit & approve

2. **Login as Trainer Vendor:**
   - [ ] Verify dashboard loads

3. **Verify Progress Tracking Feature:**
   - [ ] Dashboard should show "Progress Tracking" section
   - [ ] Click on it
   - [ ] Verify `ProgressTrackingDashboard.tsx` component renders
   - [ ] Check for:
     - [ ] Stats cards (Total Programs, Active, Completed, Avg Completion %)
     - [ ] Filters (Search, Status, Program Type)
     - [ ] Empty state (no trackers yet is OK)

4. **Test Creating Progress Tracker (if possible):**
   - [ ] If admin can create test tracker, do so
   - [ ] Otherwise, verify the UI structure is correct
   - [ ] Check that tabs for Milestones, Measurements, Notes, Media, Goals are present

**Expected Capabilities for Trainer:**
- [ ] `facility_management` → Training centers
- [ ] `schedule_management` → Class schedules
- [ ] `booking` → Class bookings
- [ ] `chat` → Customer communication
- [ ] `custom_services` → Custom training programs
- [ ] `package_management` → Training packages
- [ ] `staff_management` → Assistant trainers
- [ ] `progress_tracking` ✅ → **Progress dashboard (ENHANCED!)**
- [ ] `portfolio` → Training portfolio
- [ ] `gallery` → Success stories

---

### Test 2.4: Veterinary Clinic Onboarding
1. **Onboard New Vendor:**
   - [ ] Select "Veterinary Clinic" role (NOT solo veterinarian)
   - [ ] Complete profile
   - [ ] Submit & approve

2. **Login as Clinic Vendor:**
   - [ ] Verify dashboard loads

3. **Verify Clinic-Specific Features:**
   - [ ] Check sidebar for these sections:
     - [ ] "Doctor Management" (multi_doctor_management)
     - [ ] "Ambulance Services" (ambulance_services)
     - [ ] "Diagnostic Lab" (diagnostic_lab)
     - [ ] "Emergency Protocols" (emergency_protocols)
   - [ ] Click each section
   - [ ] Verify components render (even if empty state)

4. **Test Multi-Doctor Management:**
   - [ ] Navigate to "Doctor Management"
   - [ ] Verify can add multiple doctors
   - [ ] Each doctor should have:
     - Name, specialization, license number
     - Schedule configuration
     - Service assignment

**Expected Capabilities for Clinic:**
- [ ] All Veterinarian capabilities (13)
- [ ] PLUS:
  - [ ] `multi_doctor_management` ✅ → **Multiple doctors (NEW!)**
  - [ ] `ambulance_services` ✅ → **Pet ambulance (NEW!)**
  - [ ] `diagnostic_lab` ✅ → **Lab tests (NEW!)**
  - [ ] `emergency_protocols` ✅ → **Emergency response (NEW!)**

---

### Test 2.5: Pet Resort Onboarding
1. **Onboard New Vendor:**
   - [ ] Select "Pet Resort" role
   - [ ] Complete profile
   - [ ] Submit & approve

2. **Login as Resort Vendor:**
   - [ ] Verify dashboard loads

3. **Verify Room Management Feature:**
   - [ ] Dashboard should show "Room Management" section
   - [ ] Click on it
   - [ ] Check for:
     - [ ] Room type configuration
     - [ ] Nightly pricing per room type
     - [ ] Occupancy calendar
     - [ ] Amenities selection (AC, Heating, Camera, Play Area, Garden)
     - [ ] Pet size compatibility

4. **Test Creating Room Type:**
   - [ ] Click "Add Room Type"
   - [ ] Configure:
     - Name: "Deluxe Suite"
     - Capacity: 2 pets
     - Price per night: ₹1500
     - Amenities: AC, Camera, Play Area
     - Pet size: Medium, Large
   - [ ] Save
   - [ ] Verify room type appears

**Expected Capabilities for Resort:**
- [ ] `facility_management` → Resort locations
- [ ] `schedule_management` → Check-in/out times
- [ ] `booking` → Room reservations
- [ ] `chat` → Guest communication
- [ ] `custom_services` → Special packages
- [ ] `package_management` → Stay packages
- [ ] `staff_management` → Caretakers
- [ ] `room_management` ✅ → **Room inventory (NEW!)**
- [ ] `nightly_pricing` ✅ → **Per-night pricing (NEW!)**
- [ ] `occupancy_tracking` ✅ → **Booking calendar (NEW!)**
- [ ] `cctv_access` → Live camera feeds
- [ ] `photo_updates` → Daily photos to parents

---

### Test 2.6: Pet Cafe Onboarding
1. **Onboard New Vendor:**
   - [ ] Select "Pet Cafe" role
   - [ ] Complete profile
   - [ ] Submit & approve

2. **Login as Cafe Vendor:**
   - [ ] Verify dashboard loads

3. **Verify Table Management Feature:**
   - [ ] Dashboard should show "Table Management" section
   - [ ] Click on it
   - [ ] Check for:
     - [ ] Table list/grid
     - [ ] Table capacity (pax)
     - [ ] Table status (Available/Occupied/Reserved)
     - [ ] Today's reservations

4. **Test Creating Table:**
   - [ ] Click "Add Table"
   - [ ] Configure:
     - Table Number: "T1"
     - Capacity: 4 people
     - Location: "Window side"
     - Pet-friendly: Yes
   - [ ] Save
   - [ ] Verify table appears

**Expected Capabilities for Cafe:**
- [ ] `facility_management` → Cafe locations
- [ ] `schedule_management` → Operating hours
- [ ] `booking` → Table reservations
- [ ] `chat` → Customer communication
- [ ] `custom_services` → Special menu items
- [ ] `package_management` → Meal combos
- [ ] `staff_management` → Waitstaff
- [ ] `table_management` ✅ → **Table reservations (NEW!)**
- [ ] `pax_management` ✅ → **Party size tracking (NEW!)**
- [ ] `menu` → Menu management
- [ ] `events` → Pet events/parties

---

### Test 2.7: Nutritionist Onboarding
1. **Onboard New Vendor:**
   - [ ] Select "Nutritionist" role
   - [ ] Complete profile
   - [ ] Submit & approve

2. **Login as Nutritionist Vendor:**
   - [ ] Verify dashboard loads

3. **Verify Meal Plan Features:**
   - [ ] Dashboard should show "Meal Plan Builder" section
   - [ ] Click on it
   - [ ] Check for:
     - [ ] Meal plan creation form
     - [ ] Diet type selection (Weight Loss, Muscle Gain, Senior Care, etc.)
     - [ ] Ingredient management
     - [ ] Calorie calculator
     - [ ] Diet chart templates

4. **Test Creating Meal Plan:**
   - [ ] Click "Create Meal Plan"
   - [ ] Fill details:
     - Plan Name: "Weight Loss Program"
     - Diet Type: Weight Loss
     - Target Calories: 1200/day
     - Duration: 30 days
     - Ingredients: [Chicken, Rice, Vegetables]
   - [ ] Save
   - [ ] Verify meal plan appears

**Expected Capabilities for Nutritionist:**
- [ ] `facility_management` → Consultation centers
- [ ] `schedule_management` → Appointment slots
- [ ] `booking` → Consultations
- [ ] `chat` → Client communication
- [ ] `custom_services` → Custom diet plans
- [ ] `package_management` → Diet packages
- [ ] `staff_management` → Assistant nutritionists
- [ ] `tele` → Online consultations
- [ ] `meal_plans` ✅ → **Meal plan builder (NEW!)**
- [ ] `diet_charts` ✅ → **Diet chart creator (NEW!)**
- [ ] `progress_tracking` → Weight/health tracking

---

### Test 2.8: Insurance Provider Onboarding
1. **Onboard New Vendor:**
   - [ ] Select "Insurance" role
   - [ ] Complete profile
   - [ ] Submit & approve

2. **Login as Insurance Vendor:**
   - [ ] Verify dashboard loads

3. **Verify Insurance Features:**
   - [ ] Dashboard should show "Policy Management" section
   - [ ] Dashboard should show "Claims Management" section
   - [ ] Check for:
     - [ ] Policy creation form
     - [ ] Coverage configuration
     - [ ] Premium calculator
     - [ ] Claims processing queue

4. **Test Creating Policy:**
   - [ ] Click "Create Policy"
   - [ ] Fill details:
     - Policy Name: "Comprehensive Pet Insurance"
     - Coverage: ₹100,000
     - Premium: ₹500/month
     - Coverage includes: Accidents, Illness, Surgery
   - [ ] Save
   - [ ] Verify policy appears

**Expected Capabilities for Insurance:**
- [ ] `facility_management` → Office locations
- [ ] `schedule_management` → Support hours
- [ ] `chat` → Customer support
- [ ] `staff_management` → Claims agents
- [ ] `policy_management` ✅ → **Policy catalog (NEW!)**
- [ ] `claims_management` ✅ → **Claims processing (NEW!)**

---

**TEST SUITE 2 PASS CRITERIA:**
- ✅ All 8 specialized roles onboard successfully
- ✅ Each role's dashboard shows role-specific features
- ✅ All 3 P0 features render correctly (Pharmacy Rx, Adoption, Progress Tracking)
- ✅ Capability-based UI rendering works (sidebar items change per role)
- ✅ No console errors during onboarding or dashboard access

---

## 🧩 TEST SUITE 3: DASHBOARD RENDERING - CAPABILITY-BASED UI

### Test 3.1: Dynamic Sidebar Rendering

**Test Scenario A: Simple Role (Pet Walker)**
- [ ] Login as Pet Walker vendor
- [ ] Verify sidebar shows ONLY these items:
  - [ ] Dashboard
  - [ ] Bookings
  - [ ] Centers (facility_management)
  - [ ] Schedule (schedule_management)
  - [ ] Services (custom_services)
  - [ ] Packages (package_management)
  - [ ] Chat
  - [ ] GPS Tracking (gps_tracking)
- [ ] Verify it does NOT show:
  - [ ] Medical Records
  - [ ] Prescriptions
  - [ ] Room Management
  - [ ] Ambulance Services

**Test Scenario B: Complex Role (Veterinary Clinic)**
- [ ] Login as Vet Clinic vendor
- [ ] Verify sidebar shows ALL these items:
  - [ ] Dashboard
  - [ ] Bookings
  - [ ] Centers
  - [ ] Schedule
  - [ ] Services
  - [ ] Packages
  - [ ] Staff
  - [ ] Doctors (multi_doctor_management) ✅
  - [ ] Ambulance (ambulance_services) ✅
  - [ ] Diagnostic Lab (diagnostic_lab) ✅
  - [ ] Prescriptions
  - [ ] Medical Records
  - [ ] Video Consultations (tele)
  - [ ] Emergency Protocols ✅

---

### Test 3.2: Feature Visibility Based on Capabilities

**Test: Service Creation**
- [ ] Login as vendor WITH `custom_services` capability
- [ ] Navigate to Services
- [ ] Verify "Create Custom Service" button IS visible
- [ ] Click it and verify form opens

- [ ] Login as Product Store (NO `custom_services`)
- [ ] Navigate to Services (if available)
- [ ] Verify "Create Custom Service" button IS HIDDEN
- [ ] Can only select from admin catalog

**Test: Package Creation**
- [ ] Login as vendor WITH `package_management` capability
- [ ] Navigate to Packages
- [ ] Verify "Create Package" button IS visible
- [ ] Can create bundle packages

- [ ] Login as Product Store (NO `package_management`)
- [ ] Verify no Packages menu item in sidebar

**Test: Staff Management**
- [ ] Login as Groomer (HAS `staff_management`)
- [ ] Verify "Staff" section in sidebar
- [ ] Can add/edit staff members

- [ ] Login as Pet Walker (NO `staff_management`)
- [ ] Verify no "Staff" section in sidebar
- [ ] All bookings assigned to vendor directly

---

### Test 3.3: Conditional Component Rendering

**Check for each specialized feature:**
- [ ] Pharmacy → `PharmacyPrescriptionVerification.tsx` only renders if `prescription_verification` capability
- [ ] Shelter → `ShelterAdoptionSystem.tsx` only renders if `adoption` capability
- [ ] Trainer → `ProgressTrackingDashboard.tsx` enhanced view only with `progress_tracking` capability
- [ ] Clinic → Multi-doctor UI only renders if `multi_doctor_management` capability
- [ ] Resort → Room management only renders if `room_management` capability
- [ ] Cafe → Table management only renders if `table_management` capability

---

**TEST SUITE 3 PASS CRITERIA:**
- ✅ Sidebar dynamically renders based on role capabilities
- ✅ No unauthorized features visible
- ✅ Capability removal hides features immediately
- ✅ Capability addition shows features immediately (after re-login)

---

## 🧩 TEST SUITE 4: CUSTOMER DISCOVERY - SERVICE FILTERING

### Test 4.1: Universal Service Discovery

1. **Open Customer App:**
   - [ ] Go to customer home screen
   - [ ] See service categories

2. **Search for Pet Pharmacy:**
   - [ ] Search: "pharmacy" or "medicine"
   - [ ] Verify pharmacy vendors appear
   - [ ] Click on a pharmacy
   - [ ] Verify profile shows:
     - [ ] Facility photos
     - [ ] Operating hours
     - [ ] Medicine catalog
     - [ ] "Upload Prescription" button

3. **Search for Pet Shelter:**
   - [ ] Search: "adoption" or "shelter"
   - [ ] Verify shelter vendors appear
   - [ ] Click on a shelter
   - [ ] Verify profile shows:
     - [ ] Adoptable pets gallery
     - [ ] Pet details (age, breed, vaccination status)
     - [ ] "Apply for Adoption" button

4. **Search for Pet Trainer:**
   - [ ] Search: "training" or "obedience"
   - [ ] Verify trainer vendors appear
   - [ ] Click on a trainer
   - [ ] Verify profile shows:
     - [ ] Training programs
     - [ ] Success stories (portfolio)
     - [ ] "Book Training" button

---

### Test 4.2: Filter by Service Style

- [ ] Filter by "At Home" → Should show walkers, sitters, groomers who visit home
- [ ] Filter by "At Center" → Should show clinics, daycares, cafes, resorts
- [ ] Filter by "Tele Consultation" → Should show vets, trainers, nutritionists with tele capability

---

### Test 4.3: Filter by Location

- [ ] Set location to specific city (e.g., Bangalore)
- [ ] Verify only vendors in that city appear
- [ ] Sort by distance
- [ ] Verify nearest vendors appear first

---

### Test 4.4: Capability-Specific Filters

**Pharmacy-Specific:**
- [ ] Filter "Prescription Verification Available" → Only pharmacies with `prescription_verification` capability
- [ ] Filter "Controlled Substances Available" → Only pharmacies with `controlled_substances` capability

**Shelter-Specific:**
- [ ] Filter "Has Adoptable Pets" → Only shelters with pets marked "available"
- [ ] Filter by pet species (Dog/Cat/Bird)
- [ ] Filter by pet age (Puppy/Adult/Senior)

**Clinic-Specific:**
- [ ] Filter "Emergency Services" → Only clinics with `emergency` capability
- [ ] Filter "Ambulance Available" → Only clinics with `ambulance_services` capability
- [ ] Filter "Diagnostic Lab On-Site" → Only clinics with `diagnostic_lab` capability

---

**TEST SUITE 4 PASS CRITERIA:**
- ✅ Customers can discover vendors by capability
- ✅ Filters work correctly
- ✅ Vendor profiles show capability-specific features
- ✅ Booking flows include capability-specific options (e.g., ambulance, prescription upload)

---

## 🧩 TEST SUITE 5: STAFF ASSIGNMENT & SERVICE SELECTION

### Test 5.1: Basic Staff Management

**Vendor Side:**
- [ ] Login as Groomer (has `staff_management`)
- [ ] Navigate to "Staff" section
- [ ] Click "Add Staff"
- [ ] Fill form:
  - Name: "John Doe"
  - Phone: "9876543210"
  - Services: [Grooming, Nail Trimming]
  - Schedule: Mon-Fri, 9 AM - 5 PM
- [ ] Save staff member
- [ ] Verify staff appears in list

**Customer Side:**
- [ ] Open customer app
- [ ] Search for that groomer
- [ ] Select a service (e.g., "Full Grooming")
- [ ] On booking screen, verify:
  - [ ] "Select Groomer" dropdown appears
  - [ ] Shows vendor name + all staff names
  - [ ] Can select specific staff member
- [ ] Complete booking with staff selection
- [ ] Verify booking assigned to selected staff

---

### Test 5.2: Multi-Doctor Management (Clinic)

**Vendor Side:**
- [ ] Login as Vet Clinic
- [ ] Navigate to "Doctors" section
- [ ] Add 3 doctors:
  1. Dr. Smith - Orthopedic Specialist
  2. Dr. Jones - Dermatology Specialist
  3. Dr. Lee - General Practice
- [ ] Assign services to each:
  - Dr. Smith: Bone Surgery, Fracture Treatment
  - Dr. Jones: Skin Treatment, Allergy Consultation
  - Dr. Lee: General Checkup, Vaccination
- [ ] Set schedules for each

**Customer Side:**
- [ ] Search for that vet clinic
- [ ] Select service: "Skin Treatment"
- [ ] On booking screen, verify:
  - [ ] Only Dr. Jones appears in doctor selector (service-specific filtering)
  - [ ] Shows doctor's specialization
  - [ ] Shows available time slots for Dr. Jones only
- [ ] Select Dr. Jones
- [ ] Complete booking
- [ ] Verify booking assigned to Dr. Jones

**Test Doctor Filtering:**
- [ ] Book "General Checkup" → Should show all 3 doctors
- [ ] Book "Fracture Treatment" → Should show ONLY Dr. Smith
- [ ] Book "Allergy Consultation" → Should show ONLY Dr. Jones

---

### Test 5.3: Staff Schedule Conflicts

- [ ] Add staff member with schedule: Mon-Fri, 9 AM - 5 PM
- [ ] Customer books service with that staff for Monday 10 AM
- [ ] Try to book another service with same staff for Monday 10 AM
- [ ] Verify:
  - [ ] Time slot is NOT available (greyed out)
  - [ ] Or staff is NOT selectable for that slot
  - [ ] System prevents double-booking

---

**TEST SUITE 5 PASS CRITERIA:**
- ✅ Staff management works for roles with `staff_management` capability
- ✅ Multi-doctor management works for clinics with `multi_doctor_management`
- ✅ Customers can select specific staff/doctor during booking
- ✅ Service-staff assignment filtering works correctly
- ✅ Schedule conflicts are prevented

---

## 🧩 TEST SUITE 6: EDGE CASES - CAPABILITY PROPAGATION

### Test 6.1: Add Capability to Existing Role

**Steps:**
1. [ ] Edit "Pet Groomer" role
2. [ ] Add `meal_plans` capability (unusual but tests modularity)
3. [ ] Save role
4. [ ] Logout and login as existing Groomer vendor
5. [ ] Verify "Meal Plans" section now appears in dashboard
6. [ ] Can create meal plans (even though it's a groomer)

**Verification:**
- [ ] New capability immediately available to all vendors with that role
- [ ] No need to re-onboard

---

### Test 6.2: Remove Capability from Role

**Steps:**
1. [ ] Edit "Pet Sitter" role
2. [ ] Remove `package_management` capability
3. [ ] Save role
4. [ ] Login as existing Sitter vendor who had created packages
5. [ ] Verify:
   - [ ] "Packages" section HIDDEN from dashboard
   - [ ] Existing packages still exist in database
   - [ ] Customers can still book old packages
   - [ ] Vendor CANNOT create new packages

**Verification:**
- [ ] Capability removal hides feature
- [ ] Existing data NOT deleted
- [ ] Vendor cannot access removed feature

---

### Test 6.3: Create New Role Mid-Platform

**Steps:**
1. [ ] Create entirely new role "Pet Taxi Stand"
2. [ ] Assign capabilities:
   - `facility_management`
   - `schedule_management`
   - `booking`
   - `gps_tracking`
   - `distance_pricing`
   - `staff_management`
3. [ ] Save role
4. [ ] New vendor onboards with "Pet Taxi Stand" role
5. [ ] Verify:
   - [ ] Role appears in onboarding dropdown
   - [ ] Can complete onboarding
   - [ ] Dashboard renders with correct capabilities
   - [ ] Distance-based pricing works (basePrice + pricePerKm)

**Customer Side:**
- [ ] Search for "pet taxi"
- [ ] Verify new vendor appears
- [ ] Book ride
- [ ] Verify distance calculation and pricing works

---

### Test 6.4: Capability Conflict Resolution

**Test: Duplicate Capability Assignment**
- [ ] Edit role and check same capability twice
- [ ] Save
- [ ] Verify:
  - [ ] No duplicate entries in database
  - [ ] Feature appears only once in dashboard

---

**TEST SUITE 6 PASS CRITERIA:**
- ✅ Capability changes propagate to all vendors with that role
- ✅ Removed capabilities hide features but preserve data
- ✅ New roles work immediately after creation
- ✅ No capability conflicts or duplicates

---

## 🧩 TEST SUITE 7: PERFORMANCE - LOAD TIME BENCHMARKS

### Test 7.1: Admin Role Management Load Time

- [ ] Clear cache
- [ ] Navigate to Role Management
- [ ] Open Chrome DevTools → Network tab
- [ ] Record time to load role list

**Benchmark:**
- [ ] ✅ GET `/config/roles` response time < 500ms
- [ ] ✅ All 18+ roles returned
- [ ] ✅ Each role has populated capabilities array

---

### Test 7.2: Vendor Dashboard Load Time

**Test with Multiple Roles:**
1. [ ] Login as Pet Walker (9 capabilities)
   - [ ] Dashboard load time: ____ seconds
   - [ ] Target: < 2 seconds

2. [ ] Login as Vet Clinic (17 capabilities)
   - [ ] Dashboard load time: ____ seconds
   - [ ] Target: < 2 seconds

3. [ ] Login as Pharmacy (10 capabilities with P0 feature)
   - [ ] Dashboard load time: ____ seconds
   - [ ] Target: < 3 seconds (includes prescription verification component)

**Metrics to Check:**
- [ ] No console errors
- [ ] All sidebar items render
- [ ] No layout shifts
- [ ] Smooth navigation between sections

---

### Test 7.3: Customer Service Discovery Performance

- [ ] Search for vendors with 100+ results
- [ ] Measure load time
- [ ] Target: < 1 second for search results
- [ ] Apply filters
- [ ] Target: < 500ms for filter application

---

**TEST SUITE 7 PASS CRITERIA:**
- ✅ Role management loads in < 500ms
- ✅ Vendor dashboards load in < 2-3 seconds
- ✅ Customer search responds in < 1 second
- ✅ No performance degradation with many capabilities

---

## 🧩 TEST SUITE 8: REGRESSION - EXISTING VENDORS STILL WORK

### Test 8.1: Old Vendor Data Integrity

**Steps:**
1. [ ] Find a vendor onboarded BEFORE this capability update
2. [ ] Check their database record
3. [ ] Verify:
   - [ ] Old fields still present (businessName, phone, etc.)
   - [ ] No data corruption
   - [ ] Can login successfully

---

### Test 8.2: Old Bookings Still Accessible

- [ ] Find an old booking (before update)
- [ ] Verify:
  - [ ] Customer can see booking in history
  - [ ] Vendor can see booking in dashboard
  - [ ] Booking details correct
  - [ ] Can complete booking lifecycle (cancel/complete)

---

### Test 8.3: Legacy Feature Compatibility

**Test Old Features:**
- [ ] Booking creation flow (unchanged)
- [ ] Payment processing (unchanged)
- [ ] Chat system (unchanged)
- [ ] GPS tracking (unchanged)
- [ ] Medical records (unchanged)

**Verification:**
- [ ] All work exactly as before
- [ ] No new bugs introduced
- [ ] No UI regressions

---

### Test 8.4: Role Migration

**For vendors with old role format:**
- [ ] Check if they received new capabilities
- [ ] Verify backward compatibility
- [ ] Test if they can use new features

**Example:**
- Old "Pet Pharmacy" vendor → Should now have `prescription_verification` capability
- Old "Pet Trainer" vendor → Should have enhanced `progress_tracking`
- Old "Pet Shelter" vendor → Should have `adoption` capability

---

**TEST SUITE 8 PASS CRITERIA:**
- ✅ All existing vendors still function
- ✅ No data loss or corruption
- ✅ Old bookings accessible
- ✅ Legacy features work as before
- ✅ Vendors automatically get new capabilities from role config

---

## 📊 FINAL TESTING SUMMARY

### Overall Pass Criteria

**Critical (Must Pass 100%):**
- [ ] All 48 capabilities visible in Admin UI
- [ ] Can create/edit roles with any capability combination
- [ ] Vendor dashboards render dynamically based on capabilities
- [ ] All 3 P0 features work (Pharmacy Rx, Adoption, Progress Tracking)
- [ ] Customers can book services with capability-specific options

**High Priority (Must Pass 90%+):**
- [ ] All 18 standard roles have correct capabilities
- [ ] Specialized dashboards render (Clinic, Resort, Cafe, etc.)
- [ ] Capability changes propagate to existing vendors
- [ ] Staff/doctor management works correctly

**Medium Priority (Must Pass 75%+):**
- [ ] Performance benchmarks met
- [ ] No regressions in existing features
- [ ] Edge cases handled gracefully

---

## 🐛 BUG TRACKING

### Critical Bugs (P0)
| # | Description | Steps to Reproduce | Expected | Actual | Status |
|---|-------------|-------------------|----------|--------|--------|
| 1 |             |                   |          |        |        |
| 2 |             |                   |          |        |        |

### High Priority Bugs (P1)
| # | Description | Steps to Reproduce | Expected | Actual | Status |
|---|-------------|-------------------|----------|--------|--------|
| 1 |             |                   |          |        |        |

### Medium Priority Bugs (P2)
| # | Description | Steps to Reproduce | Expected | Actual | Status |
|---|-------------|-------------------|----------|--------|--------|
| 1 |             |                   |          |        |        |

---

## ✅ SIGN-OFF

### Test Suite Results

| Test Suite | Total Tests | Passed | Failed | Pass Rate |
|------------|-------------|--------|--------|-----------|
| 1. Admin UI | 5 | __ | __ | __% |
| 2. Vendor Onboarding | 8 | __ | __ | __% |
| 3. Dashboard Rendering | 3 | __ | __ | __% |
| 4. Customer Discovery | 4 | __ | __ | __% |
| 5. Staff Assignment | 3 | __ | __ | __% |
| 6. Edge Cases | 4 | __ | __ | __% |
| 7. Performance | 3 | __ | __ | __% |
| 8. Regression | 4 | __ | __ | __% |
| **TOTAL** | **34** | **__** | **__** | **__%** |

### Final Recommendation

- [ ] ✅ **PASS** - Deploy to production
- [ ] ⚠️ **PASS WITH ISSUES** - Deploy but monitor closely
- [ ] ❌ **FAIL** - Fix critical bugs before deployment

### Tested By
**Name:** ________________  
**Date:** ________________  
**Environment:** Dev / Staging / Production  

**Signature:** ________________

---

**END OF E2E TESTING CHECKLIST**

Ready to execute! Start with Test Suite 1 after running the capability update endpoint.
