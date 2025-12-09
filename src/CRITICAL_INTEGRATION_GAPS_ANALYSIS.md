# 🚨 CRITICAL INTEGRATION GAPS - ANALYSIS & FIX PLAN

**Date:** December 9, 2025  
**Status:** 🔴 CRITICAL ISSUES IDENTIFIED  
**Priority:** P0 - Must Fix Before Production

---

## 📊 EXECUTIVE SUMMARY

### Issues Identified (7 Critical Gaps)

| # | Issue | Component Affected | Severity | Status |
|---|-------|-------------------|----------|--------|
| 1 | Service Add Button Shows "Not Found" | Service Configuration | 🔴 P0 | Identified |
| 2 | Services Not Saving to Database | Service Management | 🔴 P0 | Identified |
| 3 | Previously Added Services Not Displaying | Staff/Center Management | 🔴 P0 | Identified |
| 4 | Center Profile Creation Route Broken | Facility Management | 🔴 P0 | Identified |
| 5 | Staff Cannot See Center Services | Service Assignment | 🔴 P0 | Identified |
| 6 | Specialized Service Configuration Missing | Ambulance/Pharmacy/Diagnostics | 🔴 P0 | Identified |
| 7 | Customer App Integration Incomplete | Universal Discovery | 🔴 P0 | Identified |

---

## 🔍 ISSUE 1: SERVICE ADD BUTTON SHOWS "NOT FOUND"

### Current Behavior
- Vendor navigates to Service Management
- Selects "At Center" service style
- Sees list of certified services
- Clicks "Add" button on a service
- **ERROR:** "Not found" message appears
- Service is NOT added to vendor's enabled services

### Root Cause Analysis

**Problem:** Multi-step service enablement flow is broken

**Current Flow (BROKEN):**
```
1. Service Configuration Screen loads services
2. User clicks "Add" button
3. ??? (Missing handler) ???
4. Error: "Not found"
```

**Expected Flow:**
```
1. Service Configuration Screen loads services
2. User selects multiple services (checkboxes)
3. User clicks "Save Selected" button
4. Backend saves all selected services to vendor_services table
5. Success message + reload services
```

### Files Affected
- `/components/vendor/VendorServiceConfigurationScreen.tsx` (Lines 143-148)
- `/supabase/functions/server/vendor-service-endpoints.tsx` (Missing route handler)

### Fix Required

**Frontend Changes:**
```typescript
// Change from individual "Add" buttons to multi-select checkboxes

// BEFORE (BROKEN):
<Button onClick={() => addService(service.id)}>Add</Button>

// AFTER (FIXED):
<Checkbox 
  checked={service.isEnabled} 
  onCheckedChange={() => toggleService(service.id)}
/>

// Add bulk save button
<Button onClick={saveConfiguration}>
  Save Selected ({services.filter(s => s.isEnabled).length})
</Button>
```

**Backend Changes:**
```typescript
// Endpoint: POST /vendor/:vendorId/services/configure
// Must save array of selected services to:
// Key: vendor_service:{vendorId}:{serviceStyle}:{serviceId}
// Value: { serviceId, isEnabled: true, customPrice, customDuration }
```

---

## 🔍 ISSUE 2: SERVICES NOT SAVING TO DATABASE

### Current Behavior
- Vendor enables services via checkboxes
- Clicks "Save Configuration" button
- Success toast appears
- **BUT:** Services are NOT persisted in database
- On page reload, all selections are lost

### Root Cause Analysis

**Problem:** `saveConfiguration()` function has incomplete database write logic

**Current Code (Line 205-210):**
```typescript
body: JSON.stringify({
  serviceStyle,
  services: servicesToSave // ← This is correct
})
```

**Backend Issue:**
```typescript
// The backend endpoint is receiving data but not writing to KV store properly
// Location: /supabase/functions/server/vendor-service-endpoints.tsx

// BROKEN CODE:
const services = body.services; // ← Received correctly
// ❌ MISSING: await kv.set() calls to persist each service
```

### Fix Required

**Backend Fix:**
```typescript
app.post('/make-server-3dd53475/vendor/:vendorId/services/configure', async (c) => {
  const { vendorId } = c.req.param();
  const { serviceStyle, services } = await c.req.json();
  
  console.log(`💾 Saving ${services.length} services for vendor ${vendorId}, style: ${serviceStyle}`);
  
  // ✅ FIX: Persist each service to database
  for (const service of services) {
    const key = `vendor_service:${vendorId}:${serviceStyle}:${service.id}`;
    const value = {
      vendorId,
      serviceId: service.id,
      serviceStyle,
      isEnabled: service.isEnabled,
      customPrice: service.customPrice,
      customDuration: service.customDuration,
      customDescription: service.customDescription,
      enabledAt: new Date().toISOString()
    };
    
    await kv.set(key, value);
    console.log(`✅ Saved service: ${key}`);
  }
  
  return sendSuccess(c, { 
    message: 'Services saved successfully',
    count: services.length 
  });
});
```

---

## 🔍 ISSUE 3: PREVIOUSLY ADDED SERVICES NOT DISPLAYING

### Current Behavior
- Vendor added services yesterday
- Logs back in today
- Opens Staff Management → "Add Services to Staff"
- **Only count shows** (e.g., "5 services enabled")
- **No service list appears**
- Cannot assign services to staff

### Root Cause Analysis

**Problem:** Service retrieval logic is incomplete

**Current Code (Line 90-141):**
```typescript
const loadServices = async () => {
  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/services/${serviceStyle}`,
    { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
  );
  
  const data = await response.json();
  setServices(data.services || []); // ← Returns empty array even when services exist
};
```

**Backend Issue:**
```typescript
// Endpoint: GET /vendor/:vendorId/services/:serviceStyle
// BROKEN: Not querying saved services from KV store

app.get('/make-server-3dd53475/vendor/:vendorId/services/:serviceStyle', async (c) => {
  const { vendorId, serviceStyle } = c.req.param();
  
  // ❌ PROBLEM: Only returns catalog services, not vendor's enabled services
  const catalogServices = await kv.getByPrefix('service_catalog:');
  
  // ❌ MISSING: Query vendor's saved services
  // const vendorServices = await kv.getByPrefix(`vendor_service:${vendorId}:${serviceStyle}:`);
  
  return c.json({ services: catalogServices }); // ← Wrong! Should merge catalog + vendor enabled status
});
```

### Fix Required

**Backend Fix:**
```typescript
app.get('/make-server-3dd53475/vendor/:vendorId/services/:serviceStyle', async (c) => {
  const { vendorId, serviceStyle } = c.req.param();
  
  // 1. Load all catalog services for this style
  const catalogServices = await kv.getByPrefix('service_catalog:');
  const filteredCatalog = catalogServices.filter(s => s.serviceStyle === serviceStyle);
  
  // 2. ✅ FIX: Load vendor's enabled services
  const vendorServiceKeys = await kv.getByPrefix(`vendor_service:${vendorId}:${serviceStyle}:`);
  const vendorEnabledIds = new Set(vendorServiceKeys.map(s => s.serviceId));
  
  // 3. Merge: Mark catalog services as enabled if vendor has them
  const mergedServices = filteredCatalog.map(catalogService => ({
    ...catalogService,
    isEnabled: vendorEnabledIds.has(catalogService.id),
    customPrice: vendorServiceKeys.find(v => v.serviceId === catalogService.id)?.customPrice,
    customDuration: vendorServiceKeys.find(v => v.serviceId === catalogService.id)?.customDuration
  }));
  
  console.log(`✅ Returning ${mergedServices.length} services, ${vendorEnabledIds.size} enabled`);
  
  return sendSuccess(c, { 
    services: mergedServices,
    enabledCount: vendorEnabledIds.size
  });
});
```

---

## 🔍 ISSUE 4: CENTER PROFILE CREATION ROUTE BROKEN

### Current Behavior
- Vendor clicks "At Center" service style
- **EXPECTED:** Opens center profile creation form
  - Upload photos
  - Add specializations
  - Set operating hours
  - Configure address
- **ACTUAL:** Shows service list instead (wrong screen)

### Root Cause Analysis

**Problem:** Missing routing logic for "At Center" selection

**Current Flow (BROKEN):**
```
1. User clicks "At Center" button
2. setSelectedServiceStyle('at_center') is called
3. VendorServiceConfigurationScreen renders
4. ❌ PROBLEM: Should render FacilityManagement instead
```

**Expected Flow:**
```
1. User clicks "At Center" button
2. Check if center profile exists:
   - If NO → Navigate to FacilityManagement (create profile)
   - If YES → Navigate to VendorServiceConfigurationScreen (manage services)
```

### Fix Required

**VendorServiceManagementComplete.tsx (Line 102-113):**
```typescript
// ❌ CURRENT (BROKEN):
if (selectedServiceStyle) {
  return (
    <VendorServiceConfigurationScreen
      vendorId={vendorId}
      serviceStyle={selectedServiceStyle}
      onBack={() => setSelectedServiceStyle(null)}
    />
  );
}

// ✅ FIX:
if (selectedServiceStyle === 'at_center') {
  // First check if center profile exists
  const [centerExists, setCenterExists] = useState(false);
  const [checkingCenter, setCheckingCenter] = useState(true);
  
  useEffect(() => {
    checkCenterProfile();
  }, []);
  
  const checkCenterProfile = async () => {
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/facility/${vendorId}`
    );
    const data = await response.json();
    setCenterExists(data.success && data.facility);
    setCheckingCenter(false);
  };
  
  if (checkingCenter) return <Loading />;
  
  if (!centerExists) {
    // Redirect to center profile creation
    return (
      <FacilityManagement
        vendorId={vendorId}
        vendorData={vendorData}
        onBack={() => setSelectedServiceStyle(null)}
        onComplete={() => {
          setCenterExists(true); // After profile created, show services
        }}
      />
    );
  }
  
  // Center exists, show service configuration
  return (
    <VendorServiceConfigurationScreen
      vendorId={vendorId}
      serviceStyle="at_center"
      onBack={() => setSelectedServiceStyle(null)}
    />
  );
}
```

---

## 🔍 ISSUE 5: STAFF CANNOT SEE CENTER SERVICES

### Current Behavior
- Admin vendor creates center and enables 10 services
- Goes to Staff Management
- Adds a staff member
- Clicks "Assign Services to Staff"
- **Staff assignment screen shows 0 services**
- Cannot assign any services

### Root Cause Analysis

**Problem:** Staff service assignment fetches wrong endpoint

**Current Code:**
```typescript
// File: StaffManagement.tsx (Line ~350)
const loadServicesForStaff = async (staffId) => {
  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/${staffId}/available-services`
  );
  // ❌ PROBLEM: This endpoint returns services assigned to staff, not center's available services
};
```

**Expected Logic:**
```typescript
// Should query:
// 1. Get all vendor's enabled services (from center)
// 2. Get staff's currently assigned services
// 3. Show available services = (center services) - (staff services)
```

### Fix Required

**Backend New Endpoint:**
```typescript
// GET /vendor/:vendorId/services/available-for-staff
// Returns all center services that can be assigned to staff

app.get('/make-server-3dd53475/vendor/:vendorId/services/available-for-staff', async (c) => {
  const { vendorId } = c.req.param();
  
  // Get all vendor's enabled services across all styles
  const vendorServices = await kv.getByPrefix(`vendor_service:${vendorId}:`);
  
  // Filter only enabled services
  const enabledServices = vendorServices.filter(s => s.isEnabled);
  
  // Enrich with catalog details
  const enriched = await Promise.all(
    enabledServices.map(async (vs) => {
      const catalogService = await kv.get(`service_catalog:${vs.serviceId}`);
      return {
        ...catalogService,
        ...vs,
        source: 'center'
      };
    })
  );
  
  return sendSuccess(c, {
    services: enriched,
    count: enriched.length
  });
});
```

**Frontend Fix:**
```typescript
// File: StaffManagement.tsx
const loadServicesForAssignment = async () => {
  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/services/available-for-staff`,
    { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
  );
  
  const data = await response.json();
  setAvailableServices(data.services || []);
};
```

---

## 🔍 ISSUE 6: SPECIALIZED SERVICE CONFIGURATION MISSING

### Current Behavior
- Vet clinic enables "Ambulance Service"
- **No option to configure:**
  - Ambulance operating hours
  - Ambulance coverage area
  - Ambulance vehicle details
- Pharmacy has no prescription receiving UI
- Diagnostics has no test package builder

### Root Cause Analysis

**Problem:** Specialized service types lack dedicated configuration screens

**Missing Components:**
1. **Ambulance Configuration UI**
2. **Pharmacy Profile UI** (with prescription receiving)
3. **Diagnostics Center UI** (with test packages)
4. **Address Search Integration** (for logistics pickup)

### Fix Required

**1. Create AmbulanceServiceConfiguration.tsx:**
```typescript
export function AmbulanceServiceConfiguration({ vendorId }: { vendorId: string }) {
  return (
    <div>
      <h2>Ambulance Service Configuration</h2>
      
      {/* Operating Hours */}
      <Section title="Operating Hours">
        <Input label="24/7 Available" type="checkbox" />
        <Input label="Custom Hours" placeholder="Mon-Fri: 9AM-6PM" />
      </Section>
      
      {/* Coverage Area */}
      <Section title="Coverage Area">
        <Input label="Service Radius (km)" type="number" />
        <MapPicker onSelectArea={(area) => setCoverageArea(area)} />
      </Section>
      
      {/* Vehicle Details */}
      <Section title="Ambulance Details">
        <Input label="Vehicle Type" placeholder="e.g., SUV, Van" />
        <Input label="License Plate" />
        <Input label="Equipment" placeholder="Oxygen, Stretcher..." />
      </Section>
      
      {/* Pricing */}
      <Section title="Pricing">
        <Input label="Base Fare" type="number" prefix="₹" />
        <Input label="Per KM Charge" type="number" prefix="₹" />
      </Section>
    </div>
  );
}
```

**2. Create PharmacyProfileConfiguration.tsx:**
```typescript
export function PharmacyProfileConfiguration({ vendorId }: { vendorId: string }) {
  return (
    <div>
      <h2>Pharmacy Profile</h2>
      
      {/* License Details */}
      <Section title="Pharmacy License">
        <Input label="License Number" />
        <Input label="Issuing Authority" />
        <FileUpload label="Upload License Copy" />
      </Section>
      
      {/* Address with Search */}
      <Section title="Pharmacy Location">
        <AddressSearchBar 
          onSelect={(address) => setPharmacyAddress(address)}
          enableGPS={true}
          placeholder="Search pharmacy address for delivery pickup..."
        />
      </Section>
      
      {/* Operating Hours */}
      <Section title="Operating Hours">
        <Input label="Opening Time" type="time" />
        <Input label="Closing Time" type="time" />
        <Checkbox label="Open 24/7" />
      </Section>
      
      {/* Prescription Settings */}
      <Section title="Prescription Settings">
        <Toggle label="Accept Online Prescriptions" />
        <Toggle label="Controlled Substances Available" />
        <Toggle label="Home Delivery Available" />
      </Section>
      
      {/* Inventory Categories */}
      <Section title="Available Medicine Categories">
        <CheckboxGroup options={[
          'Antibiotics', 'Pain Relief', 'Vitamins', 'Vaccines',
          'Dewormers', 'Flea & Tick', 'Digestive', 'Skin Care'
        ]} />
      </Section>
    </div>
  );
}
```

**3. Create DiagnosticsConfiguration.tsx:**
```typescript
export function DiagnosticsConfiguration({ vendorId }: { vendorId: string }) {
  const [testPackages, setTestPackages] = useState([]);
  
  return (
    <div>
      <h2>Diagnostics Center Configuration</h2>
      
      {/* Operating Hours */}
      <Section title="Lab Hours">
        <Input label="Lab Timing" />
      </Section>
      
      {/* Test Packages */}
      <Section title="Available Test Packages">
        <Button onClick={() => setShowAddPackage(true)}>
          + Add Test Package
        </Button>
        
        {testPackages.map(pkg => (
          <TestPackageCard key={pkg.id} package={pkg} />
        ))}
      </Section>
      
      {/* Home Sample Collection */}
      <Section title="Home Sample Collection">
        <Toggle label="Offer Home Sample Collection" />
        <Input label="Collection Charge" type="number" prefix="₹" />
        <Input label="Service Radius (km)" type="number" />
        <TimeSlotPicker label="Available Time Slots" />
      </Section>
      
      {/* Test Categories */}
      <Section title="Test Categories">
        <CheckboxGroup options={[
          'Blood Tests', 'Urine Tests', 'Stool Tests', 'X-Ray',
          'Ultrasound', 'ECG', 'Allergy Tests', 'Genetic Tests'
        ]} />
      </Section>
    </div>
  );
}
```

**4. Integration in Service Configuration:**
```typescript
// VendorServiceConfigurationScreen.tsx (Add specialized config)

const renderSpecializedConfig = (service: Service) => {
  if (service.id === 'ambulance_service') {
    return <AmbulanceServiceConfiguration vendorId={vendorId} />;
  }
  
  if (service.category === 'pharmacy' && service.isEnabled) {
    return <PharmacyProfileConfiguration vendorId={vendorId} />;
  }
  
  if (service.id === 'diagnostic_lab') {
    return <DiagnosticsConfiguration vendorId={vendorId} />;
  }
  
  return null;
};
```

---

## 🔍 ISSUE 7: CUSTOMER APP INTEGRATION INCOMPLETE

### Current Behavior
- Vendor enables "Tele Consultation" service
- Customer opens app → Services tab
- **Service does NOT appear** in any category
- Cannot book the service

### Root Cause Analysis

**Problem:** Customer app queries wrong endpoint or missing service mapping

**Current Customer App Logic:**
```typescript
// File: CustomerHomeComplete.tsx (Line ~250)
const loadServices = async () => {
  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/services/discovery`
  );
  // ❌ PROBLEM: This endpoint doesn't include vendor-enabled services
};
```

**Expected Logic:**
```typescript
// Should query:
// GET /customer/services/discovery?city=Bangalore&petType=dog&serviceType=tele

// Backend should return:
// 1. All vendors in city
// 2. Filter by vendor.serviceStyles includes requested style
// 3. Include vendor's enabled services for that style
// 4. Match services to Universal Problem Grid categories
```

### Fix Required

**Backend Enhanced Discovery Endpoint:**
```typescript
app.get('/make-server-3dd53475/customer/services/discovery', async (c) => {
  const { city, petType, serviceType, problemId } = c.req.query();
  
  console.log(`🔍 Customer discovery: city=${city}, serviceType=${serviceType}, problem=${problemId}`);
  
  // 1. Find vendors in city with requested service style
  const vendorsInCity = await kv.getByPrefix('vendor_');
  const filteredVendors = vendorsInCity.filter(v => 
    v.city === city && 
    v.status === 'approved' &&
    (v.serviceStyle === serviceType || v.serviceStyle === 'both')
  );
  
  // 2. For each vendor, get their enabled services
  const vendorsWithServices = await Promise.all(
    filteredVendors.map(async (vendor) => {
      const vendorServices = await kv.getByPrefix(
        `vendor_service:${vendor.vendorId}:${serviceType}:`
      );
      
      const enabledServices = vendorServices
        .filter(s => s.isEnabled)
        .map(s => ({
          ...s,
          vendorName: vendor.businessName,
          vendorId: vendor.vendorId,
          vendorRating: vendor.rating || 4.5,
          vendorDistance: calculateDistance(vendor.location, customerLocation)
        }));
      
      return {
        vendor,
        services: enabledServices
      };
    })
  );
  
  // 3. If problemId specified, filter by Universal Problem Grid mapping
  if (problemId) {
    const problemConfig = await kv.get(`problem_grid:${problemId}`);
    const relevantServiceIds = problemConfig?.serviceIds || [];
    
    vendorsWithServices = vendorsWithServices.map(v => ({
      ...v,
      services: v.services.filter(s => relevantServiceIds.includes(s.serviceId))
    }));
  }
  
  // 4. Flatten and sort by relevance
  const allServices = vendorsWithServices
    .flatMap(v => v.services)
    .sort((a, b) => {
      // Sort by: rating * (1 / distance) * availability
      const scoreA = a.vendorRating * (1 / (a.vendorDistance + 1));
      const scoreB = b.vendorRating * (1 / (b.vendorDistance + 1));
      return scoreB - scoreA;
    });
  
  return sendSuccess(c, {
    services: allServices,
    vendorCount: vendorsWithServices.length,
    serviceCount: allServices.length
  });
});
```

**Customer App Integration:**
```typescript
// Update service cards to show:
// 1. Vendor name
// 2. Distance
// 3. Rating
// 4. Service name
// 5. Price
// 6. "Book Now" button → Opens booking flow with pre-filled vendor + service
```

---

## 📋 COMPLETE FIX PLAN

### Phase 1: Database Persistence (Priority 1) ⏱️ 2 hours
**Goal:** Fix service saving to database

1. **Update Backend Endpoint** (`/supabase/functions/server/vendor-service-endpoints.tsx`)
   - [ ] Add proper KV store persistence in `POST /vendor/:vendorId/services/configure`
   - [ ] Add logging for each service save
   - [ ] Add error handling for failed saves

2. **Update Service Retrieval** (Same file)
   - [ ] Modify `GET /vendor/:vendorId/services/:serviceStyle` to merge catalog + vendor enabled status
   - [ ] Add caching for performance

3. **Test Fix**
   - [ ] Enable 5 services
   - [ ] Refresh page
   - [ ] Verify all 5 still enabled

**Expected Result:** Services persist after save ✅

---

### Phase 2: UI/UX Improvements (Priority 1) ⏱️ 1.5 hours
**Goal:** Fix "Add" button and improve multi-select experience

1. **Update Service Configuration Screen**
   - [ ] Remove individual "Add" buttons
   - [ ] Add checkboxes for multi-select
   - [ ] Add "Save Selected (X)" button at bottom
   - [ ] Add search bar for filtering services

2. **Add Visual Feedback**
   - [ ] Show count of selected services
   - [ ] Add "Clear All" button
   - [ ] Show loading state during save

3. **Test Fix**
   - [ ] Select 3 services
   - [ ] Click "Save Selected"
   - [ ] Verify success toast
   - [ ] Verify all 3 appear as enabled on reload

**Expected Result:** Intuitive multi-select with bulk save ✅

---

### Phase 3: Center Profile Creation (Priority 1) ⏱️ 2 hours
**Goal:** Fix routing for "At Center" selection

1. **Add Center Profile Check Logic**
   - [ ] Update `VendorServiceManagementComplete.tsx` with profile check
   - [ ] Add `onComplete` callback to `FacilityManagement`
   - [ ] Handle first-time vs existing center flow

2. **Enhance Facility Management**
   - [ ] Add "Continue to Services" button after profile creation
   - [ ] Add validation (photos, specialization required)
   - [ ] Add progress indicator

3. **Test Fix**
   - [ ] New vendor clicks "At Center"
   - [ ] Sees center profile form
   - [ ] Completes profile with 3 photos
   - [ ] Clicks "Continue"
   - [ ] Sees service configuration screen

**Expected Result:** Smooth center profile → service configuration flow ✅

---

### Phase 4: Staff Service Assignment (Priority 1) ⏱️ 2 hours
**Goal:** Fix staff-center service integration

1. **Create New Backend Endpoint**
   - [ ] `GET /vendor/:vendorId/services/available-for-staff`
   - [ ] Returns all center's enabled services
   - [ ] Enriched with catalog details

2. **Update Staff Management**
   - [ ] Change service fetch endpoint
   - [ ] Show center services in assignment UI
   - [ ] Add bulk assignment checkbox

3. **Update Service Assignment Save**
   - [ ] Persist staff-service mappings
   - [ ] Key: `staff_service:{vendorId}:{staffId}:{serviceId}`

4. **Test Fix**
   - [ ] Center has 10 enabled services
   - [ ] Add staff member
   - [ ] Assign 5 services to staff
   - [ ] Verify staff sees only assigned 5 in their dashboard

**Expected Result:** Staff can see and be assigned center services ✅

---

### Phase 5: Specialized Service Configuration (Priority 2) ⏱️ 4 hours
**Goal:** Build service-specific configuration UIs

1. **Create Ambulance Configuration Component**
   - [ ] Build UI with operating hours, coverage area, vehicle details
   - [ ] Add map picker for coverage area
   - [ ] Add pricing configuration

2. **Create Pharmacy Profile Component**
   - [ ] Build UI with license, address search, operating hours
   - [ ] Integrate Google Places API for address search
   - [ ] Add inventory category selection
   - [ ] Add prescription receiving toggle

3. **Create Diagnostics Configuration Component**
   - [ ] Build UI with lab hours, test packages, home collection
   - [ ] Add test package builder
   - [ ] Add time slot picker for home collection

4. **Integrate with Service Configuration**
   - [ ] Detect specialized services and show dedicated config
   - [ ] Show specialized config as expandable section under service

5. **Test Fix**
   - [ ] Vet enables ambulance → Sees ambulance config form
   - [ ] Pharmacy enables online orders → Sees pharmacy profile form
   - [ ] Diagnostics enables tests → Sees test package builder

**Expected Result:** Each specialized service has proper configuration UI ✅

---

### Phase 6: Customer App Integration (Priority 2) ⏱️ 3 hours
**Goal:** Make vendor services discoverable to customers

1. **Enhance Customer Discovery Endpoint**
   - [ ] Update `GET /customer/services/discovery` to include vendor services
   - [ ] Add filtering by city, service type, problem ID
   - [ ] Add sorting by rating, distance, price

2. **Add Service Mapping Logic**
   - [ ] Map vendor services to Universal Problem Grid categories
   - [ ] Show services under correct category tabs

3. **Update Service Cards**
   - [ ] Show vendor name, distance, rating
   - [ ] Show service name, price, duration
   - [ ] Add "Book Now" button

4. **Test Fix**
   - [ ] Vendor enables "Grooming" service
   - [ ] Customer opens app → Grooming category
   - [ ] Sees vendor's grooming service
   - [ ] Clicks "Book Now"
   - [ ] Booking flow opens with pre-filled details

**Expected Result:** Customers can discover and book vendor services ✅

---

### Phase 7: Policies Integration (Priority 3) ⏱️ 2 hours
**Goal:** Add policy configuration and display

1. **Create Policy Configuration UI**
   - [ ] Refund policy editor (Markdown supported)
   - [ ] Payment policy (advance %, full payment, etc.)
   - [ ] Cancellation policy (timeframes, charges)
   - [ ] Rescheduling policy

2. **Add Policy Display in Booking Flow**
   - [ ] Show policies before payment
   - [ ] Require customer acknowledgment
   - [ ] Store policy version with booking

3. **Test Fix**
   - [ ] Vendor sets "24-hour cancellation" policy
   - [ ] Customer books service
   - [ ] Sees policy before payment
   - [ ] Must check "I agree" before proceeding

**Expected Result:** Clear policies protect vendor and customer ✅

---

## 📊 TESTING PLAN

### Test Suite 1: Service Management (30 minutes)
- [ ] Login as vet clinic vendor
- [ ] Go to Service Management
- [ ] Select "At Center"
- [ ] See 20 certified services
- [ ] Select 5 services via checkboxes
- [ ] Click "Save Selected (5)"
- [ ] See success message
- [ ] Refresh page
- [ ] Verify 5 services still selected

**Pass Criteria:** Services persist after save ✅

---

### Test Suite 2: Center Profile (20 minutes)
- [ ] Login as new daycare vendor
- [ ] Go to Service Management
- [ ] Click "At Center"
- [ ] Redirected to center profile creation
- [ ] Upload 3 photos
- [ ] Select 3 specializations
- [ ] Set operating hours
- [ ] Click "Continue to Services"
- [ ] See service configuration screen

**Pass Criteria:** Smooth profile → services flow ✅

---

### Test Suite 3: Staff Assignment (20 minutes)
- [ ] Login as groomer with 8 enabled services
- [ ] Go to Staff Management
- [ ] Add staff "John Doe"
- [ ] Click "Assign Services"
- [ ] See all 8 center services
- [ ] Select 4 services for John
- [ ] Save
- [ ] Login as John (staff)
- [ ] Verify sees only assigned 4 services

**Pass Criteria:** Staff-center service sync works ✅

---

### Test Suite 4: Specialized Services (30 minutes)
- [ ] Login as vet clinic
- [ ] Enable "Ambulance Service"
- [ ] See ambulance configuration form
- [ ] Set operating hours: "24/7"
- [ ] Set coverage: 20 km radius
- [ ] Set vehicle: "SUV, License ABC123"
- [ ] Set pricing: Base ₹500 + ₹20/km
- [ ] Save
- [ ] Customer searches for ambulance
- [ ] Sees clinic's ambulance service with pricing

**Pass Criteria:** Specialized config flows work ✅

---

### Test Suite 5: Customer Discovery (30 minutes)
- [ ] Vendor enables 3 services: Grooming, Training, Boarding
- [ ] Customer opens app
- [ ] Navigates to "Grooming" category
- [ ] Sees vendor's grooming service
- [ ] Clicks service card
- [ ] Sees full details (price, duration, description)
- [ ] Clicks "Book Now"
- [ ] Booking form opens with pre-filled vendor + service
- [ ] Completes booking
- [ ] Vendor receives booking notification

**Pass Criteria:** End-to-end discovery → booking works ✅

---

## 🎯 SUCCESS METRICS

### Technical Metrics
- [ ] 100% of enabled services persist in database
- [ ] 100% of center services visible to staff
- [ ] 100% of vendor services discoverable by customers
- [ ] < 500ms service loading time
- [ ] < 1s booking flow initialization

### Business Metrics
- [ ] 0 "service not found" errors
- [ ] 95% vendor onboarding completion rate
- [ ] 80% customers find desired service in < 30 seconds
- [ ] 90% bookings complete successfully

---

## 🚨 DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] All 7 issues fixed
- [ ] All 5 test suites pass
- [ ] No console errors in vendor dashboard
- [ ] No console errors in customer app
- [ ] Database migration script ready
- [ ] Rollback plan prepared

### Deployment Steps
1. [ ] Deploy backend changes
2. [ ] Run database migration
3. [ ] Deploy frontend changes
4. [ ] Test on staging environment
5. [ ] Monitor error logs for 1 hour
6. [ ] If no errors → Deploy to production
7. [ ] If errors → Rollback immediately

### Post-Deployment Monitoring
- [ ] Monitor error rate (target: < 0.1%)
- [ ] Monitor API latency (target: < 500ms)
- [ ] Monitor booking completion rate (target: > 90%)
- [ ] Collect vendor feedback for 24 hours
- [ ] Make iterative improvements

---

## 📞 SUPPORT & ESCALATION

### If Issues Persist After Fix
1. **Check Database:**
   ```javascript
   // Get all vendor services
   const services = await kv.getByPrefix('vendor_service:vendor_123:');
   console.log('Saved services:', services);
   ```

2. **Check API Logs:**
   - Supabase Dashboard → Edge Functions → make-server-3dd53475 → Logs
   - Look for "❌" error markers

3. **Check Browser Console:**
   - Open DevTools (F12)
   - Check Console tab for errors
   - Check Network tab for failed requests

4. **Contact Support:**
   - Create GitHub issue with:
     - Error screenshot
     - Browser console logs
     - API response logs
     - Steps to reproduce

---

**Status:** 🔴 CRITICAL GAPS IDENTIFIED - FIX PLAN READY  
**Estimated Fix Time:** ~16 hours total  
**Priority:** Start with Phase 1-4 (7.5 hours) for core functionality  
**Timeline:** Can be completed in 2 days with focused effort

---

**Next Action:** Begin Phase 1 - Database Persistence Fix
