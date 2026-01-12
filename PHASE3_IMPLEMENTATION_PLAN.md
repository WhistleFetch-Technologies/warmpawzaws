# Phase 3: Vendor Ecosystem Implementation Plan

**Date:** 2026-01-28  
**Status:** 🟢 IN PROGRESS

---

## 🎯 Phase 3 Objectives

**Goal:** Dynamic dashboards for 20 distinct roles.

### Requirements from CURSOR_INSTRUCTION_MANUAL.md:

1. **Onboarding (Enhance):**
   - File: `EnhancedVendorOnboarding.tsx`
   - Action: Ensure the "Role Selection" dropdown includes all 20 roles from `MOCK_VENDOR_ROLES`.

2. **Core Modules (Reuse):**
   - Files: `VendorServiceManagementComplete.tsx`, `StaffManagement.tsx`, `SettlementDashboardEnhanced.tsx`
   - Action: Ensure they read `vendor.role_id` to show/hide relevant fields (e.g., Hide "Home Service Radius" for a Cafe).

3. **Role-Specific UIs (Fill Gaps):**
   - Cafe: `VendorCafeMenuManagement.tsx` (Check if exists, else create)
   - Resort: `BoardingRoomManager.tsx` (Check if exists, else create)

4. **Verification:**
   - Run `VERIFICATION_GUIDE.md` -> "Vendor App Verification"

---

## ✅ Current Status

### 1. Role Selection ✅
- **File:** `apps/vendor-web/components/vendor/VendorRoleSelection.tsx`
- **Status:** ✅ Already fetches from `/config/roles` API endpoint
- **Action:** Verify API returns all 20 roles (should be automatic)

### 2. Core Modules Status

#### VendorServiceManagementComplete.tsx
- **Status:** ✅ Uses `roleConfig` from API
- **Action:** Verify role-based conditional fields are properly implemented
- **Note:** Uses `allowedServiceStyles` based on role config

#### StaffManagement.tsx
- **Status:** ⏳ Need to verify
- **Action:** Check if it reads `vendor.role_id` for conditional fields

#### SettlementDashboardEnhanced.tsx
- **Status:** ⏳ Need to verify
- **Action:** Check if it reads `vendor.role_id` for conditional fields

### 3. Role-Specific UIs

#### VendorCafeMenuManagement.tsx
- **Status:** ❌ Placeholder only
- **Action:** Implement full menu management UI
- **Reference:** `Warmpawz Ecosystem Development/src/components/vendor/VendorCafeMenuManagement.tsx`

#### BoardingRoomManager.tsx
- **Status:** ✅ Exists (577 lines)
- **Action:** Verify completeness

---

## 📋 Implementation Tasks

### Task 1: Implement VendorCafeMenuManagement ✅ IN PROGRESS
- [x] Read reference implementation
- [ ] Create full menu management UI
- [ ] Add menu item CRUD operations
- [ ] Add category management
- [ ] Add table management
- [ ] Integrate with API endpoints
- [ ] Add image upload support
- [ ] Add availability toggle
- [ ] Add vegetarian/pet-friendly flags

### Task 2: Verify Role-Based Conditional Fields
- [ ] Check VendorServiceManagementComplete for role-based field visibility
- [ ] Check StaffManagement for role-based features
- [ ] Check SettlementDashboardEnhanced for role-based features
- [ ] Add conditional logic if missing (e.g., hide "Home Service Radius" for Cafe)

### Task 3: Verify All 20 Roles in Selection
- [ ] Test API endpoint `/config/roles` returns all 20 roles
- [ ] Verify fallback roles are comprehensive
- [ ] Test role selection flow

### Task 4: Run Verification Checklist
- [ ] Solo Onboarding (Dog Walker)
- [ ] Business Onboarding (Pet Resort)
- [ ] Dashboard Adaptation (Vet, Cafe, Seller)
- [ ] Service Creation
- [ ] Cafe Menu Management
- [ ] Resort Room Management
- [ ] Home Service Flows

---

## 🔍 20 Vendor Roles (From Backend)

Based on `backend/lambda/src/endpoints/role-seeding.ts`:

1. `veterinarian` - Veterinarian
2. `veterinary_clinic` - Veterinary Clinic
3. `pet_groomer` - Pet Groomer
4. `pet_boarding` - Pet Boarding
5. `pet_resort` - Pet Resort
6. `pet_walker` - Pet Walker
7. `pet_trainer` - Pet Trainer
8. `pet_behaviorist` - Pet Behaviorist
9. `pet_sitter` - Pet Sitter
10. `pet_taxi` - Pet Taxi
11. `pet_products_store` - Pet Store / Retailer
12. `pet_pharmacy` - Pet Pharmacy
13. `pet_cafe` - Pet Cafe
14. `pet_photographer` - Pet Photographer
15. `pet_shelter` - Pet Shelter / NGO
16. `pet_sunset_services` - Pet Sunset Services
17. `nutritionist` - Pet Nutritionist
18. `pet_insurance` - Insurance Agent
19. `pet_ambulance` - Pet Ambulance
20. `pet_breeder` - Pet Breeder

---

## 📝 Next Steps

1. **Implement VendorCafeMenuManagement** (Priority 1)
2. **Verify role-based conditional fields** (Priority 2)
3. **Test all 20 roles in selection** (Priority 3)
4. **Run verification checklist** (Priority 4)

---

## ✅ Completion Criteria

- [ ] All 20 roles visible in role selection
- [ ] VendorServiceManagementComplete shows/hides fields based on role
- [ ] StaffManagement shows/hides features based on role
- [ ] SettlementDashboardEnhanced shows/hides features based on role
- [ ] VendorCafeMenuManagement fully implemented
- [ ] BoardingRoomManager verified complete
- [ ] All verification checklist items pass

