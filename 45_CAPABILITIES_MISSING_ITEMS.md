# 45 Capabilities - Missing Items Summary

## ✅ Components Status: 40/45 (88.9%)

### ❌ Missing Components (5)

1. **multi_doctor_management**
   - Status: ❌ Component missing
   - Handler: ✅ `onNavigateToMultiDoctorManagement` exists in VendorDashboard
   - Location: Should be in `src/components/vendor/VendorMultiDoctorManagement.tsx`
   - Priority: 🔴 HIGH (for clinics with multiple doctors)

2. **table_management**
   - Status: ❌ Component missing
   - Handler: ❌ No handler in dashboard
   - Location: Should be in `src/components/vendor/VendorTableManagement.tsx`
   - Priority: 🟡 MEDIUM (for pet cafes)

3. **pax_management**
   - Status: ❌ Component missing
   - Handler: ❌ No handler in dashboard
   - Location: Should be in `src/components/vendor/VendorPaxManagement.tsx`
   - Priority: 🟡 MEDIUM (for pet cafes)

4. **occupancy_tracking**
   - Status: ❌ Component missing
   - Handler: ❌ No handler in dashboard
   - Location: Should be in `src/components/vendor/VendorOccupancyTracking.tsx`
   - Priority: 🟡 MEDIUM (for boarding/resort)

5. **nightly_pricing**
   - Status: ❌ Component missing
   - Handler: ❌ No handler in dashboard
   - Location: Should be in `src/components/vendor/VendorNightlyPricing.tsx`
   - Priority: 🟡 MEDIUM (for boarding/resort)

---

## ⚠️ Dashboard Integration Gaps (10)

### Components exist but NOT in dashboard quick actions:

1. **medical_records**
   - Component: ✅ PetMedicalHistoryModal.tsx, MedicalHistoryModal.tsx
   - Dashboard: ❌ Not in quick actions
   - Fix: Add to dashboard when `capabilities.medical_records` is true

2. **emergency**
   - Component: ✅ EmergencyProtocolEditModal.tsx
   - Dashboard: ❌ Not in quick actions
   - Fix: Add to dashboard when `capabilities.emergency` is true

3. **emergency_protocols**
   - Component: ✅ EmergencyProtocolEditModal.tsx
   - Dashboard: ❌ Not in quick actions
   - Fix: Add to dashboard when `capabilities.emergency_protocols` is true

4. **vet_summary**
   - Component: ✅ VetSummaryDashboard.tsx, AddVetSummaryModal.tsx
   - Dashboard: ❌ Not in quick actions
   - Fix: Add to dashboard when `capabilities.vet_summary` is true

5. **room_management**
   - Component: ✅ BoardingRoomManager.tsx
   - Dashboard: ❌ Not in quick actions
   - Fix: Add to dashboard when `capabilities.room_management` is true

6. **claims_management**
   - Component: ✅ ClaimsManagement.tsx
   - Dashboard: ❌ Not in quick actions
   - Fix: Add to dashboard when `capabilities.claims_management` is true

7. **diagnostic_lab**
   - Component: ✅ DiagnosticEditModal.tsx, HomeSampleCollectionManager.tsx
   - Dashboard: ⚠️ Only via VetSpecializedServices
   - Fix: Add standalone access when `capabilities.diagnostic_lab` is true

8. **ambulance_services**
   - Component: ✅ AmbulanceEditModal.tsx
   - Dashboard: ⚠️ Only via VetSpecializedServices
   - Fix: Add standalone access when `capabilities.ambulance_services` is true

9. **photo_updates**
   - Component: ⚠️ Part of booking (not standalone)
   - Dashboard: ❌ Not in quick actions
   - Fix: Consider creating standalone component or keep as part of booking

10. **multi_doctor_management**
    - Component: ❌ Missing
    - Dashboard: ⚠️ Handler exists but component missing
    - Fix: Create component first, then add to dashboard

---

## ⚠️ Booking Integration Gaps (18)

### Components exist but NOT accessible from booking:

1. **diagnostic_lab** - Not in AppointmentDetailModal
2. **ambulance_services** - Not in AppointmentDetailModal
3. **controlled_substances** - Not in AppointmentDetailModal
4. **gallery** - Not linked to booking
5. **portfolio** - Not linked to booking
6. **progress_tracking** - Not linked to booking/packages
7. **cctv_access** - Not accessible from booking
8. **distance_pricing** - Not integrated with booking pricing
9. **room_management** - Not integrated with booking
10. **menu** - Not integrated with booking (cafe)
11. **meal_plans** - Not integrated with orders
12. **diet_charts** - Not linked to consultations
13. **counseling** - Not integrated with booking
14. **adoption** - Not integrated with customer flow
15. **events** - Not integrated with booking
16. **memorial** - Not integrated with booking
17. **claims_management** - Not accessible from booking
18. **policy_management** - Not integrated with booking

---

## ⚠️ Service Catalog Validation Gaps (30)

### Capabilities that need validation in service catalog:

1. prescription
2. medical_records
3. emergency
4. diagnostic_lab
5. patient_monitoring
6. emergency_protocols
7. ambulance_services
8. controlled_substances
9. prescription_verification
10. vet_summary
11. orders
12. inventory
13. delivery
14. expiry_management
15. gallery
16. portfolio
17. progress_tracking
18. cctv_access
19. distance_pricing
20. multi_doctor_management
21. room_management
22. table_management
23. pax_management
24. occupancy_tracking
25. nightly_pricing
26. menu
27. meal_plans
28. diet_charts
29. counseling
30. adoption
31. events
32. memorial
33. claims_management
34. policy_management

**Note:** Service catalog already has capability filtering implemented, but services need to have `requiredCapabilities` field in the catalog data.

---

## Action Items

### 🔴 High Priority
1. Create `VendorMultiDoctorManagement.tsx`
2. Add missing capabilities to dashboard quick actions
3. Add missing capabilities to booking detail modal

### 🟡 Medium Priority
1. Create hospitality components (table, pax, occupancy, nightly)
2. Integrate capabilities with booking
3. Add capability validation to service catalog (backend data)

### 🟢 Low Priority
1. Create standalone photo_updates component (optional)
2. Enhance service catalog with capability requirements
3. Add capability upgrade prompts

---

## Quick Fix Checklist

### Dashboard Quick Actions
- [ ] Add medical_records button when capability enabled
- [ ] Add emergency button when capability enabled
- [ ] Add emergency_protocols button when capability enabled
- [ ] Add vet_summary button when capability enabled
- [ ] Add room_management button when capability enabled
- [ ] Add claims_management button when capability enabled
- [ ] Add diagnostic_lab standalone access
- [ ] Add ambulance_services standalone access

### Booking Detail Modal
- [ ] Add diagnostic_lab action
- [ ] Add ambulance_services action
- [ ] Add controlled_substances action
- [ ] Link gallery to booking
- [ ] Link portfolio to booking
- [ ] Link progress_tracking to booking
- [ ] Add cctv_access for boarding bookings
- [ ] Integrate distance_pricing
- [ ] Integrate room_management
- [ ] Integrate menu for cafe bookings
- [ ] Integrate meal_plans
- [ ] Link diet_charts to consultations
- [ ] Integrate counseling
- [ ] Integrate events
- [ ] Integrate memorial
- [ ] Add claims_management
- [ ] Add policy_management

### Missing Components
- [ ] Create VendorMultiDoctorManagement.tsx
- [ ] Create VendorTableManagement.tsx
- [ ] Create VendorPaxManagement.tsx
- [ ] Create VendorOccupancyTracking.tsx
- [ ] Create VendorNightlyPricing.tsx

---

## Summary

**Total Missing:**
- 5 components
- 10 dashboard integrations
- 18 booking integrations
- 30 service catalog validations (needs backend data)

**Overall Completion: 71%**
- Components: 88.9%
- Dashboard: 77.8%
- Booking: 17.8%
- Service Catalog: 6.7%

