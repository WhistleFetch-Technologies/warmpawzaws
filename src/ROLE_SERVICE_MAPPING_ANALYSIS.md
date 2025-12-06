# Role-to-Service Mapping Analysis & Implementation Plan
## Generated: UAT Testing Phase

---

## 🎯 Platform Admin Configured Roles (12 Total)

| # | Role ID | Name | Service Styles | Status |
|---|---------|------|----------------|---------|
| 1 | `veterinarian` | Veterinarian | at_home, at_center, tele | ✅ COMPLETE |
| 2 | `pet_groomer` | Pet Groomer | at_home, at_center | ✅ COMPLETE |
| 3 | `pet_trainer` | Pet Trainer | at_home, at_center | ✅ COMPLETE |
| 4 | `pet_walker` | Pet Walker | at_home | ✅ COMPLETE |
| 5 | `pet_boarder` | Pet Boarder | at_center | ✅ COMPLETE |
| 6 | `pet_photographer` | Pet Photographer | at_home, at_center | ❌ MISSING |
| 7 | `pet_pharmacy` | Pet Pharmacy | at_center | ✅ COMPLETE |
| 8 | `pet_clinic` | Pet Clinic | at_home, at_center, tele | ❌ MISSING |
| 9 | `pet_insurance` | Pet Insurance Provider | tele | ✅ COMPLETE |
| 10 | `pet_cafe` | Pet Cafe | at_center | ✅ COMPLETE |
| 11 | `sunset_services` | Pet Sunset Services | at_home, at_center | ❌ MISSING |
| 12 | `service-provider` | Service Provider (Generic) | all | N/A (Fallback) |

---

## 📱 Customer App "All Services" Section

Current quickServices array in CustomerHomeComplete.tsx:

| Icon | Label | Screen | Should Map To | Status |
|------|-------|--------|---------------|---------|
| ✂️ | Grooming | grooming | `pet_groomer` | ✅ Working |
| 🏥 | Vet Care | vet | `veterinarian` | ✅ Working |
| 🛍️ | Shop | shop | `pet_pharmacy` | ✅ Landing Page Created |
| 🎓 | Training | training | `pet_trainer` | ✅ Landing Page Created |
| 🚴 | Walker | walker | `pet_walker` | ✅ Working |
| 🏠 | Boarding | boarding | `pet_boarder` | ✅ Landing Page Created |
| ❤️ | Adoption | adoption | N/A | ✅ Coming Soon (OK) |
| ☕ | Pet Cafes | cafes | `pet_cafe` | ✅ Landing Page Created |
| 👥 | Mating | mating | N/A | ✅ Coming Soon (OK) |
| 🛡️ | Insurance | insurance | `pet_insurance` | ✅ Landing Page Created |
| 📖 | Articles | articles | N/A | ✅ Coming Soon (OK) |
| 🌾 | Pet Food | food | `pet_pharmacy` | ⚠️ Maps to shop |

---

## ✅ Existing Customer Flows

### 1. Vet Services (`veterinarian`)
**Files:**
- `/components/customer/VetServicesLanding.tsx` - Main landing
- `/components/customer/vet/VetServiceBooking.tsx` - Service selection
- `/components/customer/vet/ClinicListView.tsx` - Clinic listings
- `/components/customer/vet/ClinicProfileView.tsx` - Clinic details
- `/components/customer/vet/VetBookingFlow.tsx` - Booking flow
- `/components/customer/vet/VetDoctorDetails.tsx` - Doctor details

**Service Styles:**
- ✅ At Home (home_visit)
- ✅ At Center (clinic)
- ✅ Tele (teleconsultation)

**API Integration:** ✅ Complete with `roleId=veterinarian`

---

### 2. Grooming Services (`pet_groomer`)
**Files:**
- `/components/customer/GroomingServicesLanding.tsx` - Main landing
- `/components/customer/GroomingServiceRouter.tsx` - Router
- `/components/customer/grooming/GroomingCenterListView.tsx` - Center listings
- `/components/customer/grooming/GroomingCenterProfileView.tsx` - Center details
- `/components/customer/GroomingAtHome.tsx` - At home booking
- `/components/customer/GroomingCenterVisit.tsx` - Center booking

**Service Styles:**
- ✅ At Home (grooming_home)
- ✅ At Center (grooming_center)

**API Integration:** ✅ Complete with `roleId=pet_groomer`

---

### 3. Walker Services (`pet_walker`)
**Files:**
- `/components/customer/WalkerService.tsx` - Main landing
- `/components/customer/walker/WalkerDashboard.tsx` - Dashboard
- `/components/customer/WalkerSelection.tsx` - Walker selection
- `/components/customer/WalkerBookingConfirm.tsx` - Booking confirmation
- `/components/customer/WalkerActiveSession.tsx` - Live tracking
- `/components/customer/WalkerSessionSummary.tsx` - Session summary

**Service Styles:**
- ✅ At Home (walker service)

**API Integration:** ⚠️ Needs roleId parameter verification

---

## ❌ Missing Customer Flows

### 1. Pet Training (`pet_trainer`)
**Service Styles Needed:**
- At Home Training
- Training Center Visit

**Required Components:**
- TrainingServicesLanding.tsx
- TrainingCenterListView.tsx
- TrainingAtHome.tsx
- TrainerProfileView.tsx

---

### 2. Pet Boarding (`pet_boarder`)
**Service Styles Needed:**
- At Center (boarding facility)

**Required Components:**
- BoardingServicesLanding.tsx
- BoardingFacilityListView.tsx
- BoardingFacilityProfileView.tsx
- BoardingBookingFlow.tsx

---

### 3. Pet Pharmacy (`pet_pharmacy`)
**Service Styles Needed:**
- At Center (physical store with delivery)

**Required Components:**
- PharmacyServicesLanding.tsx
- PharmacyListView.tsx
- PharmacyProfileView.tsx
- MedicineOrderFlow.tsx

---

### 4. Pet Photography (`pet_photographer`)
**Service Styles Needed:**
- At Home (outdoor/home shoots)
- At Center (studio photography)

**Required Components:**
- PhotographyServicesLanding.tsx
- PhotographerListView.tsx
- PhotographerProfileView.tsx
- PhotographyBookingFlow.tsx

---

### 5. Pet Clinic (`pet_clinic`)
**Note:** Different from veterinarian - multi-service facility

**Service Styles Needed:**
- At Center (comprehensive facility)
- At Home (for specific services)
- Tele (consultations)

**Required Components:**
- ClinicServicesLanding.tsx (different from vet)
- MultiServiceClinicListView.tsx
- MultiServiceClinicProfileView.tsx

---

### 6. Pet Insurance (`pet_insurance`)
**Service Styles Needed:**
- Tele (online/phone only)

**Required Components:**
- InsuranceServicesLanding.tsx
- InsuranceProviderListView.tsx
- InsuranceProviderProfileView.tsx
- InsurancePlanComparison.tsx
- InsuranceEnrollmentFlow.tsx

---

### 7. Pet Cafe (`pet_cafe`)
**Service Styles Needed:**
- At Center (cafe visit with reservation)

**Required Components:**
- PetCafeServicesLanding.tsx
- PetCafeListView.tsx
- PetCafeProfileView.tsx
- PetCafeReservationFlow.tsx

---

### 8. Sunset Services (`sunset_services`)
**Note:** Not in current quickServices - needs to be added

**Service Styles Needed:**
- At Home (home service)
- At Center (facility)

**Required Components:**
- SunsetServicesLanding.tsx
- SunsetServiceProviderListView.tsx
- SunsetServiceProviderProfileView.tsx
- SunsetServiceBookingFlow.tsx

---

## 🔧 Backend API Status

### ✅ Working Endpoints
```
GET /customer/services?roleId={roleId}&serviceStyle={style}
```
- Returns services filtered by vendor roleId
- Supports serviceStyle filtering
- Used by vet and grooming flows

### ⚠️ Testing Required
- Verify all 12 roles return correct services
- Test service style filtering for each role
- Verify vendor status (isLive, isApproved)

---

## 📋 Implementation Checklist

### Phase 1: Pet Training Service
- [ ] Create TrainingServicesLanding.tsx
- [ ] Create training/TrainingCenterListView.tsx
- [ ] Create training/TrainingCenterProfileView.tsx
- [ ] Create training/TrainingAtHomeBooking.tsx
- [ ] Create TrainingServiceRouter.tsx
- [ ] Update CustomerHomeWrapper.tsx navigation
- [ ] Add screen types
- [ ] Test API with `roleId=pet_trainer`

### Phase 2: Pet Boarding Service
- [ ] Create BoardingServicesLanding.tsx
- [ ] Create boarding/BoardingFacilityListView.tsx
- [ ] Create boarding/BoardingFacilityProfileView.tsx
- [ ] Create boarding/BoardingBookingFlow.tsx
- [ ] Update CustomerHomeWrapper.tsx navigation
- [ ] Test API with `roleId=pet_boarder`

### Phase 3: Pet Pharmacy Service
- [ ] Create PharmacyServicesLanding.tsx
- [ ] Create pharmacy/PharmacyListView.tsx
- [ ] Create pharmacy/PharmacyProfileView.tsx
- [ ] Create pharmacy/MedicineOrderFlow.tsx
- [ ] Update CustomerHomeWrapper.tsx navigation
- [ ] Test API with `roleId=pet_pharmacy`

### Phase 4: Pet Photography Service
- [ ] Create PhotographyServicesLanding.tsx
- [ ] Create photography/PhotographerListView.tsx
- [ ] Create photography/PhotographerProfileView.tsx
- [ ] Create photography/PhotographyBookingFlow.tsx
- [ ] Update CustomerHomeWrapper.tsx navigation
- [ ] Test API with `roleId=pet_photographer`

### Phase 5: Pet Insurance Service
- [ ] Create InsuranceServicesLanding.tsx
- [ ] Create insurance/InsuranceProviderListView.tsx
- [ ] Create insurance/InsurancePlanComparison.tsx
- [ ] Create insurance/InsuranceEnrollmentFlow.tsx
- [ ] Update CustomerHomeWrapper.tsx navigation
- [ ] Test API with `roleId=pet_insurance`

### Phase 6: Pet Cafe Service
- [ ] Create PetCafeServicesLanding.tsx
- [ ] Create cafe/PetCafeListView.tsx
- [ ] Create cafe/PetCafeProfileView.tsx
- [ ] Create cafe/PetCafeReservationFlow.tsx
- [ ] Update CustomerHomeWrapper.tsx navigation
- [ ] Test API with `roleId=pet_cafe`

### Phase 7: Sunset Services
- [ ] Add to quickServices array
- [ ] Create SunsetServicesLanding.tsx
- [ ] Create sunset/SunsetProviderListView.tsx
- [ ] Create sunset/SunsetServiceBookingFlow.tsx
- [ ] Update CustomerHomeWrapper.tsx navigation
- [ ] Test API with `roleId=sunset_services`

### Phase 8: UAT Testing
- [ ] Test all service flows end-to-end
- [ ] Verify role-based filtering works correctly
- [ ] Test service style sub-flows
- [ ] Verify vendor approval workflow
- [ ] Test booking creation for all services
- [ ] Verify OTP completion flow
- [ ] Test prescription/notes for applicable services

---

## 🚨 Critical Rules

1. **DO NOT BREAK** existing vet and grooming flows
2. **ALWAYS** use `roleId` parameter in API calls
3. **ALWAYS** add `API_BASE` constant in components
4. **FOLLOW** the pattern from VetServicesLanding and GroomingServicesLanding
5. **HANDLE** multiple service styles per role
6. **VERIFY** vendors are isLive and isApproved
7. **TEST** before marking as complete

---

## 🎨 UI Pattern to Follow

Based on GroomingServicesLanding.tsx:
```typescript
const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

// Load services
const response = await fetch(
  `${API_BASE}/customer/services?roleId=ROLE_ID_HERE`,
  { headers: { Authorization: `Bearer ${publicAnonKey}` } }
);

// Filter by vendor role (already done server-side)
const services = data.services || [];

// Group by vendorId to get unique vendors
const vendorMap = new Map();
services.forEach((service: any) => {
  if (!vendorMap.has(service.vendorId)) {
    vendorMap.set(service.vendorId, {
      id: service.vendorId,
      businessName: service.vendorName,
      rating: service.vendorRating,
      // ... other fields
    });
  }
});
```

---

**Status:** Ready for implementation
**Next Step:** Create components starting with Pet Training