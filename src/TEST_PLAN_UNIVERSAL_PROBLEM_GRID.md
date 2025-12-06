# 🎯 COMPREHENSIVE TEST PLAN: UNIVERSAL PROBLEM GRID SYSTEM

## Executive Summary

This document outlines the complete testing strategy for the Universal Problem Grid System across all 6 vendor types in the Warmpawz platform.

---

## 🏗️ System Architecture Overview

### Core Components

1. **Problem Grid Catalog** (`problem-grid-catalog.tsx`)
   - Defines problem categories for each vendor type
   - Maps problems to service subcategories

2. **Enhanced Problem Discovery** (`enhanced-problem-discovery.tsx`)
   - Role-based entity discovery
   - Returns appropriate entity types based on vendor role
   - Handles both staff and center entities

3. **Enhanced Vendor Discovery UI** (`EnhancedVendorDiscoveryByProblem.tsx`)
   - Displays results appropriately per vendor type
   - Handles booking flows for both entity types

4. **Staff Specialization System** (`staff-specialization-system.tsx`)
   - Manages staff specializations
   - Links specializations to problem categories

5. **Problem Subcategory Mapping** (`problem-subcategory-mapping.tsx`)
   - Maps problem IDs to service subcategory names
   - Supports multiple name variations

---

## 🎭 Vendor Type Configurations

### VETERINARIAN (Role ID: `veterinarian`, `role_veterinarian`, `pet_clinic`, etc.)

**Entity Types Returned:**
- ✅ Individual Doctors (Staff)
- ✅ Clinics/Centers

**Discovery Logic:**
1. **Staff Discovery:**
   - Search for staff with matching specializations
   - Staff.specializations array contains problem subcategories
   - Example: Dr. Anjali Pandey has `['cardiology', 'diagnostics']`

2. **Center Discovery:**
   - Search for clinics offering matching services
   - Services must be published (`publishStatus: 'published'`)
   - Match by service name OR subcategory name

**UI Behavior:**
- Show filter tabs: "All", "Doctors", "Centers"
- Doctor cards show: Photo, Name, Specializations, Parent Clinic, Rating, Fee
- Center cards show: Photo, Name, Staff Count, Services, Rating, Fee

**Booking Flow:**
- Doctor selected → Direct booking with that doctor
- Center selected → Show doctor selection → Book with chosen doctor

---

### GROOMING (Role ID: `groomer`, `pet_groomer`, `role_groomer`, etc.)

**Entity Types Returned:**
- ❌ Individual Staff (NOT shown)
- ✅ Grooming Centers ONLY

**Discovery Logic:**
1. **Center Discovery ONLY:**
   - Search for centers offering matching grooming services
   - Services must be published
   - Match by service name OR subcategory name

**UI Behavior:**
- No filter tabs (only centers shown)
- Center cards show: Photo, Name, Services, Service Styles, Rating
- Example Problems: Full Grooming, Bath & Brush, Haircut, Nail Care, Spa

**Booking Flow:**
- Center selected → Service selection → Date/Time selection → Payment
- Center assigns staff internally (customer doesn't choose)

---

### TRAINING (Role ID: `trainer`, `pet_trainer`, `role_trainer`, etc.)

**Entity Types Returned:**
- ❌ Individual Trainers (NOT shown)
- ✅ Training Centers ONLY

**Discovery Logic:**
1. **Center Discovery ONLY:**
   - Search for centers offering matching training services
   - Match by problem subcategories

**UI Behavior:**
- No filter tabs (only centers shown)
- Center cards show: Photo, Name, Programs, Service Styles, Rating
- Example Problems: Obedience Training, Puppy Training, Behavioral Issues

**Booking Flow:**
- Center selected → Program selection → Schedule selection → Payment
- Center assigns trainer internally

---

### WALKING (Role ID: `dog_walker`, `pet_walker`, `role_dog_walker`, etc.)

**Entity Types Returned:**
- ❌ Individual Walkers (NOT shown to customer via problem grid)
- ✅ Walking Service Centers ONLY

**Discovery Logic:**
1. **Center Discovery ONLY:**
   - Search for centers offering matching walking services
   - Match by problem subcategories

**UI Behavior:**
- No filter tabs (only centers shown)
- Center cards show: Photo, Name, Walk Types, Service Areas, Rating
- Example Problems: Daily Walk, Puppy Walk, Senior Walk, Multiple Dogs

**Booking Flow:**
- Center selected → Walk type selection → Schedule → Payment
- Center assigns walker based on availability

**Note:** Direct walker selection happens through the main Walking service flow, not problem grid

---

### BEHAVIORAL (Role ID: `behaviourist`, `behaviorist`, `role_behaviourist`, etc.)

**Entity Types Returned:**
- ❌ Individual Behaviorists (NOT shown)
- ✅ Behavioral Centers ONLY

**Discovery Logic:**
1. **Center Discovery ONLY:**
   - Search for centers offering behavioral services
   - Match by problem subcategories

**UI Behavior:**
- No filter tabs (only centers shown)
- Center cards show: Photo, Name, Issues Addressed, Rating
- Example Problems: Separation Anxiety, Barking, Destructive Behavior, Fear

**Booking Flow:**
- Center selected → Issue assessment → Session scheduling → Payment
- Center assigns behaviorist internally

---

### BOARDING (Role ID: `boarding`, `pet_boarding`, `role_boarding`, etc.)

**Entity Types Returned:**
- ❌ Individual Staff (NOT shown)
- ✅ Boarding Centers ONLY

**Discovery Logic:**
1. **Center Discovery ONLY:**
   - Search for centers offering boarding services
   - Match by problem subcategories

**UI Behavior:**
- No filter tabs (only centers shown)
- Center cards show: Photo, Name, Facility Type, Amenities, Rating
- Example Problems: Short Stay, Long Stay, Daycare, Luxury Boarding

**Booking Flow:**
- Center selected → Stay duration → Pet details → Payment
- Center manages staff internally

---

## 🧪 Test Scenarios

### Unit Tests

#### Test 1: Role Entity Configuration
```typescript
// File: enhanced-problem-discovery.tsx
// Expected: Correct entity types per role

VETERINARIAN roles → showIndividualStaff: true, showCenters: true
GROOMING roles → showIndividualStaff: false, showCenters: true
TRAINING roles → showIndividualStaff: false, showCenters: true
WALKING roles → showIndividualStaff: false, showCenters: true
BEHAVIORAL roles → showIndividualStaff: false, showCenters: true
BOARDING roles → showIndividualStaff: false, showCenters: true
```

#### Test 2: Problem Grid Mapping
```typescript
// File: problem-grid-catalog.tsx
// Expected: Each problem has valid mappedSubCategories

surgery → ['sub_surgical_services']
cardiology → ['sub_specialty_services', 'sub_diagnostics']
full_grooming → ['sub_grooming_basic', 'sub_grooming_specialty']
obedience_training → ['sub_training']
```

#### Test 3: Staff Specialization Matching
```typescript
// File: enhanced-problem-discovery.tsx: checkStaffSpecialization()
// Expected: Staff with matching specializations are found

Staff.specializations = ['cardiology', 'diagnostics']
Problem.mappedSubCategories = ['sub_specialty_services', 'sub_diagnostics']
→ MATCH

Staff.specializations = ['grooming']
Problem.mappedSubCategories = ['sub_specialty_services']
→ NO MATCH
```

#### Test 4: Vendor Service Matching
```typescript
// File: enhanced-problem-discovery.tsx: checkVendorServices()
// Expected: Vendors with matching published services are found

Vendor has published service: "Cardiac Consultation"
Service.subCategoryName = "Specialty Services"
Problem subcategories include "Specialty Services"
→ MATCH
```

---

### Integration Tests

#### Test 5: Vet Problem Grid End-to-End
```bash
# Setup
1. Create clinic: "Omega Veterinary Clinic"
2. Add staff: "Dr. Anjali Pandey" with specializations: ['cardiology', 'diagnostics']
3. Publish service: "Cardiac Consultation" in subcategory "Specialty Services"

# Execute
1. Customer selects problem: "Cardiology"
2. API call: GET /customer/discover-by-problem-v2/veterinarian/cardiology

# Expected Results
- Returns 2 entities:
  - Entity Type: 'staff' → Dr. Anjali Pandey
  - Entity Type: 'center' → Omega Veterinary Clinic
- Dr. Anjali shows: specializations, parent clinic name, location
- Clinic shows: staff count, available services
```

#### Test 6: Grooming Problem Grid End-to-End
```bash
# Setup
1. Create grooming center: "Paws & Claws Grooming"
2. Publish services: "Full Grooming Package", "Bath & Brush"
3. No individual staff setup needed

# Execute
1. Customer selects problem: "Full Grooming"
2. API call: GET /customer/discover-by-problem-v2/groomer/full_grooming

# Expected Results
- Returns 1 entity:
  - Entity Type: 'center' → Paws & Claws Grooming
- Shows: services, service styles, ratings
- NO individual groomers shown
- No "Doctors" filter tab
```

#### Test 7: Location-Based Filtering
```bash
# Setup
1. Create 3 vet clinics at different locations
2. Customer location: Bangalore (12.9716, 77.5946)

# Execute
1. API call with location: GET /...?lat=12.9716&lng=77.5946&radius=5

# Expected Results
- Only clinics within 5km returned
- Results sorted by distance
- Distance shown on each card
```

---

### API Tests

#### Test 8: Enhanced Discovery API Response
```bash
# Request
GET /customer/discover-by-problem-v2/veterinarian/cardiology?lat=12.9716&lng=77.5946&radius=50

# Expected Response
{
  "success": true,
  "problem": {
    "id": "cardiology",
    "name": "Cardiology",
    "displayName": "Heart & Cardiovascular",
    ...
  },
  "roleConfig": {
    "showIndividualStaff": true,
    "showCenters": true,
    "description": "Doctors and Clinics"
  },
  "results": [
    {
      "entityType": "staff",
      "entityId": "staff_123",
      "vendorId": "vendor_456",
      "name": "Dr. Anjali Pandey",
      "specializations": ["cardiology", "diagnostics"],
      "centerName": "Omega Veterinary Clinic",
      "consultationFee": 800,
      ...
    },
    {
      "entityType": "center",
      "entityId": "vendor_456",
      "vendorId": "vendor_456",
      "name": "Omega Veterinary Clinic",
      "staffCount": 3,
      "matchingServices": 5,
      ...
    }
  ],
  "count": 2,
  "breakdown": {
    "staff": 1,
    "centers": 1
  }
}
```

---

### UI/UX Tests

#### Test 9: Vet UI - Filter Tabs
```
Given: Vet problem grid with both staff and centers
When: User views results
Then: 
- Show 3 tabs: "All", "Doctors", "Centers"
- "All" tab shows both entity types mixed
- "Doctors" tab shows only staff entities
- "Centers" tab shows only center entities
- Tab counts are accurate
```

#### Test 10: Grooming UI - No Filter Tabs
```
Given: Grooming problem grid
When: User views results
Then:
- NO filter tabs shown
- Only center cards displayed
- Each card shows grooming services offered
- "Book Now" leads directly to service selection
```

#### Test 11: Entity Card Differentiation
```
Given: Results containing both staff and centers
When: User views entity card
Then:
Staff Card shows:
- Badge: "👨‍⚕️ Doctor"
- Name: Staff full name
- Parent clinic name below
- Specializations as tags
- "At Center", "At Home", "Tele" options

Center Card shows:
- Badge: "🏥 Center"
- Name: Center business name
- Staff count: "3 specialists"
- Services offered
- "At Center", "At Home" options
```

---

### UAT Test Scenarios

#### UAT 1: Customer Books Cardiologist
```
1. Customer opens Vet Services
2. Clicks "Heart & Cardiovascular" problem
3. Sees list of cardiologists and cardiac clinics
4. Filters to "Doctors" tab
5. Selects "Dr. Anjali Pandey"
6. Sees available slots for Dr. Anjali
7. Selects slot, confirms booking
8. Booking created with Dr. Anjali as assigned staff
```

#### UAT 2: Customer Books Grooming Service
```
1. Customer opens Grooming Services
2. Clicks "Full Grooming" problem
3. Sees list of grooming centers (NO individual groomers)
4. Selects "Paws & Claws Grooming"
5. Selects grooming package
6. Selects date/time
7. Completes payment
8. Booking created, center assigns groomer
```

#### UAT 3: Problem Grid Opens but Shows No Results
```
Given: Customer in location with no providers
When: Customer selects any problem
Then:
- Shows empty state: "😔 No Results Found"
- Message: "We couldn't find any specialists in your area"
- Button: "Try Another Category" → Goes back
```

#### UAT 4: Staff Specialization Migration
```
Given: Existing clinic with staff members
When: Admin runs Staff Specialization Migration
Then:
- All staff get specializations field populated
- Specializations derived from assigned services
- Staff immediately appear in problem grid results
```

---

## 🔧 Debugging Checklist

### Issue: Dr. Anjali Pandey not showing in Cardiology problem

**Check 1:** Staff has specializations field
```bash
# In KV store
staff:staff_id_anjali → specializations: ['cardiology', 'diagnostics']
```

**Check 2:** Problem mapping is correct
```bash
# problem-grid-catalog.tsx
cardiology → mappedSubCategories: ['sub_specialty_services', 'sub_diagnostics']
```

**Check 3:** Staff is active
```bash
staff.status === 'active'
staff.isActive !== false
```

**Check 4:** Parent clinic is approved
```bash
vendor.status === 'approved'
vendor.isActive !== false
```

**Check 5:** API returns staff
```bash
GET /customer/discover-by-problem-v2/veterinarian/cardiology
# Check results array for entityType: 'staff'
```

---

### Issue: Grooming centers not showing services

**Check 1:** Services are published
```bash
vendorService.publishStatus === 'published' || 'auto_published'
vendorService.isEnabled === true
```

**Check 2:** Service subcategory matches
```bash
service.subCategoryName matches problem.mappedSubCategories
```

**Check 3:** Vendor has services in KV
```bash
vendor_services:vendor_id:at_center → { services: [...] }
```

---

### Issue: Problem grid not opening

**Check 1:** Problem exists in catalog
```bash
# problem-grid-catalog.tsx
findProblemById('full_grooming') → returns problem object
```

**Check 2:** Subcategories are mapped
```bash
problem.mappedSubCategories.length > 0
```

**Check 3:** Frontend API call
```bash
# Check browser console
GET /customer/discover-by-problem-v2/{roleId}/{problemId}
```

---

## 🚀 Deployment Checklist

- [ ] Enhanced problem discovery endpoint deployed
- [ ] Enhanced UI component deployed
- [ ] Old discovery endpoint marked as deprecated
- [ ] Frontend updated to use new endpoint
- [ ] Staff specialization migration tool available
- [ ] Problem grid catalog seeded for all vendor types
- [ ] Service catalog has proper subcategory names
- [ ] All vendor services published with correct subcategories
- [ ] Booking flows updated for both entity types
- [ ] Schedule management handles both staff and center bookings
- [ ] OTP system works for both entity types
- [ ] Prescription/notes system works for both entity types
- [ ] Notifications sent to correct entity

---

## 📊 Success Metrics

### Discovery Accuracy
- ✅ 100% of staff with matching specializations appear
- ✅ 100% of centers with matching services appear
- ✅ 0% false positives (wrong vendors shown)

### UI/UX
- ✅ Correct entity types shown per vendor role
- ✅ Filter tabs appear only for vets
- ✅ Entity cards clearly differentiated
- ✅ Booking flows work for both entity types

### Performance
- ✅ Discovery API responds in < 2 seconds
- ✅ No timeout errors
- ✅ Location filtering works within radius

### Data Integrity
- ✅ All staff have specializations field
- ✅ All problems have mapped subcategories
- ✅ All services have correct subcategory names
- ✅ No orphaned data

---

## 🆘 Escalation Path

**Level 1 - Frontend Issues:**
- Check: EnhancedVendorDiscoveryByProblem component
- Check: API endpoint URL
- Check: Response handling

**Level 2 - API Issues:**
- Check: enhanced-problem-discovery.tsx endpoint
- Check: Role entity configuration
- Check: Service matching logic

**Level 3 - Data Issues:**
- Check: Staff specializations field
- Check: Service catalog subcategory names
- Check: Problem grid mappings
- Run: Staff Specialization Migration Tool

**Level 4 - System Architecture:**
- Review: Universal Problem Grid System design
- Review: Role-based entity type configuration
- Review: Booking flow for entity types

---

## 📝 Notes

1. **No Hardcoding:** All configurations driven by ROLE_ENTITY_CONFIG
2. **Backward Compatible:** Old endpoint still works during transition
3. **Admin Controlled:** Problem grids and mappings managed via admin portal
4. **Universal APIs:** Same booking/schedule APIs work for both entity types
5. **Flexible Specializations:** Staff can have multiple specializations
6. **Location Aware:** Distance calculated and displayed for all results
7. **Rating Based:** Results sorted by rating if no location provided

---

## 🎯 Next Steps

1. **Phase 1:** Deploy enhanced discovery endpoint
2. **Phase 2:** Update frontend to use new endpoint
3. **Phase 3:** Run staff specialization migration
4. **Phase 4:** Test each vendor type end-to-end
5. **Phase 5:** Monitor and optimize
6. **Phase 6:** Deprecate old endpoint

---

*Document Version: 1.0*
*Last Updated: 2025-11-26*
*Maintained by: Warmpawz Platform Engineering Team*
