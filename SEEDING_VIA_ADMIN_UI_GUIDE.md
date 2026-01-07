# 🌱 SEEDING VIA ADMIN UI - COMPLETE GUIDE

**Date:** January 2026  
**Purpose:** Seed Roles, Services, and Activate India Region using Admin Portal UI

---

## 📋 PREREQUISITES

1. ✅ Admin portal is running and accessible
2. ✅ Admin user is logged in
3. ✅ Backend API is running and connected to database
4. ✅ Database tables exist (roles, service_catalog, regions)

---

## 🎯 SEEDING STEPS

### STEP 1: Seed Roles (20 Roles)

**Location:** Admin Portal → `/roles` page

**Method 1: Use Admin UI (Manual)**
1. Navigate to Admin Portal → Roles tab
2. Click "+ Add Role" button
3. Fill in role details:
   - **Name (ID):** `veterinarian` (lowercase, underscore separated)
   - **Display Name:** `Veterinarian`
   - **Description:** `Licensed veterinary professional providing medical care for pets`
   - **Category:** Select from dropdown (healthcare, service_provider, etc.)
   - **Capabilities:** Select relevant capabilities from checkboxes
4. Click "Create Role"
5. Repeat for all 20 roles

**Method 2: Use API Script (Automated)**
```bash
cd /Users/ketan/Documents/warmpawzecodev
export API_BASE_URL="https://your-api-url.com"  # Or http://localhost:3000 for local
export ADMIN_TOKEN="your-admin-token"  # If authentication required
node scripts/seed-via-admin-api.js
```

**Roles to Seed:**
1. `veterinarian` - Veterinarian
2. `vet_clinic` - Veterinary Clinic
3. `pet_groomer` - Pet Groomer
4. `pet_trainer` - Pet Trainer
5. `pet_walker` - Pet Walker
6. `pet_sitter` - Pet Sitter
7. `pet_boarder` - Pet Boarding
8. `pet_daycare` - Pet Daycare
9. `ambulance` - Pet Ambulance Service
10. `diagnostics_center` - Diagnostics Center
11. `pharmacy` - Pet Pharmacy
12. `pet_nutritionist` - Pet Nutritionist
13. `pet_spa` - Pet Spa
14. `pet_cafe` - Pet Cafe
15. `pet_transport` - Pet Transport
16. `pet_photographer` - Pet Photographer
17. `pet_adoption_center` - Pet Adoption Center
18. `pet_event_organizer` - Pet Event Organizer
19. `pet_relocation` - Pet Relocation Services
20. `pet_insurance` - Pet Insurance Provider

**For each role, configure:**
- Capabilities (checkboxes in admin UI)
- Onboarding form fields (via Onboarding Designer tab - if available)
- Service styles (at_center, at_home, tele)
- Vendor types (solo_provider, center)

---

### STEP 2: Seed Service Catalog (65+ Services)

**Location:** Admin Portal → `/catalog` page

**Method 1: Use Admin UI (Manual)**
1. Navigate to Admin Portal → Service Catalog tab
2. Click "+ Add Service" button
3. Fill in service details:
   - **Service Name (ID):** `vet_general_checkup`
   - **Display Name:** `General Health Checkup`
   - **Description:** `Comprehensive health checkup for your pet`
   - **Category:** Select from dropdown (Veterinary Services, Grooming, etc.)
   - **Service Style:** Select (Centre Visit, Home Service, Tele-consultation, etc.)
   - **Base Price:** `500` (in ₹)
   - **Duration:** `30` (minutes)
   - **Applicable Roles:** Select multiple roles (checkboxes)
   - **Status:** `Active`
   - **Publish Status:** `Published`
4. Click "Create Service"
5. Repeat for all 65+ services

**Method 2: Use API Script (Automated)**
The script `seed-via-admin-api.js` includes a subset of services. To seed all 65+ services, you can:
- Run the script multiple times with different service batches
- Or manually add remaining services via UI

**Key Services by Category:**

**Veterinary (10 services):**
- General Health Checkup, Vaccination, Deworming, Dental Checkup
- Minor/Major Surgery, Home Visit, Tele-Consultation, Emergency Care, Spay/Neuter

**Grooming (8 services):**
- Bath & Dry, Haircut & Styling, Nail Trimming, Ear Cleaning
- Teeth Brushing, Full Spa Treatment, De-matting, Home Grooming

**Training (7 services):**
- Basic Obedience, Advanced Training, Puppy Training
- Behavior Modification, Agility Training, Protection Training, Home Training

**Walking (5 services):**
- 30 Min Walk, 60 Min Walk, Group Walk, Jogging Session, Park Visit

**Boarding (7 services):**
- Overnight Boarding, Weekend Boarding, Weekly Boarding
- Full Day Daycare, Half Day Daycare, Pet Sitting Visit, Overnight Sitting

**Diagnostic (8 services):**
- X-Ray, Ultrasound, Blood Test, Urine Test, Stool Test
- ECG, Biopsy, Home Sample Collection

**Pharmacy (3 services):**
- Prescription Medicine, Supplements, Medicine Delivery

**Emergency (2 services):**
- Emergency Ambulance, Scheduled Transport

**Wellness (2 services):**
- Nutrition Consultation, Custom Meal Plan

**Specialty (13 services):**
- Pet Portrait Session, Event Photography
- Local Transport, Intercity Transport
- Domestic Relocation, International Relocation
- Cafe Dine-in, Pet Party Booking
- Adoption Consultation
- Pet Birthday Party, Pet Wedding Ceremony
- Basic Pet Insurance, Premium Pet Insurance

---

### STEP 3: Activate India Region

**Location:** Admin Portal → `/regions` page

**Steps:**
1. Navigate to Admin Portal → Regions tab
2. Check if "India" region exists:
   - If exists: Click "Edit" → Ensure `is_active: true` → Save
   - If not exists: Click "+ Add Region" → Fill in:
     - **Name:** `India`
     - **Code:** `india`
     - **Country:** `India`
     - **Timezone:** `Asia/Kolkata`
     - **Currency:** `INR`
     - **Service Radius:** `10` km
     - **Status:** `Active` ✅
3. Deactivate other regions (if any):
   - Click "Edit" on each non-India region
   - Set `is_active: false`
   - Save

**Or use API:**
```bash
# The seed script automatically activates India region
node scripts/seed-via-admin-api.js
```

---

## 🧪 TESTING THE FLOW

After seeding, test the complete vendor onboarding flow:

### Test 1: Role Selection
1. Open Vendor Web App → `/onboarding`
2. Enter phone number → Verify OTP (use `123456` in UAT mode)
3. **Expected:** See 20 roles loaded dynamically
4. Select a role (e.g., "Veterinarian")
5. **Expected:** Role selected, proceed to business type selection

### Test 2: Business Type & Form
1. Choose "Solo Provider" or "Multi-Staff Business"
2. **Expected:** 
   - Solo → Minimal static form loads
   - Business → Dynamic form loads (if form schema seeded)
3. Fill form and submit
4. **Expected:** Application submitted successfully

### Test 3: Service Catalog
1. After approval, go to Service Management
2. **Expected:** See services filtered by selected role
3. Enable services, set prices
4. **Expected:** Services can be published

### Test 4: Customer Discovery
1. Open Customer App → Service Discovery
2. **Expected:** See vendors with published services
3. Filter by role/category
4. **Expected:** Services appear correctly

---

## 🚀 QUICK START (Automated)

If you want to seed everything quickly:

```bash
# Option 1: Run the Node.js script
cd /Users/ketan/Documents/warmpawzecodev
export API_BASE_URL="https://api.warmpawz.com"  # Update with your API URL
node scripts/seed-via-admin-api.js

# Option 2: Run SQL migrations directly (faster, but bypasses admin UI)
# This is recommended if you have direct database access
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f db/migrations/047_seed_roles.sql
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f db/migrations/048_seed_service_catalog.sql

# Then activate India region via admin UI
```

---

## ✅ VERIFICATION

After seeding, verify:

1. **Roles:**
   ```bash
   # Check via API
   curl $API_BASE_URL/config/roles
   # Expected: 20 roles returned
   ```

2. **Services:**
   ```bash
   # Check via API
   curl $API_BASE_URL/admin/service-catalog
   # Expected: 65+ services returned
   ```

3. **India Region:**
   ```bash
   # Check via API
   curl $API_BASE_URL/admin/regions
   # Expected: India region with is_active: true
   ```

---

## 📝 NOTES

- **Idempotency:** The admin API endpoints should handle duplicate creation gracefully
- **Form Schemas:** Onboarding form schemas can be configured via the Onboarding Designer tab (if available)
- **Capabilities:** Each role needs capabilities assigned - use the checkboxes in the admin UI
- **Service Roles:** Each service needs `applicable_roles` array populated - use the role checkboxes in service creation form

---

**Ready to seed?** Follow the steps above or run the automated script!

