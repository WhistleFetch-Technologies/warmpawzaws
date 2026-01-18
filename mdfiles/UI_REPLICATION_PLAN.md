# UI Replication Plan - Customer & Vendor Apps

**Date:** 2026-01-07  
**Source:** `/Users/ketan/Documents/Warmpawz Ecosystem Development`  
**Target:** `apps/customer-web`, `apps/vendor-web`, `apps/WarmpawzCustomer`, `apps/WarmpawzVendor`

---

## 📋 EXECUTIVE SUMMARY

### Reference Folder Structure Discovered

**Source Location:** `/Users/ketan/Documents/Warmpawz Ecosystem Development`

**Customer Components:**
- Location: `src/components/customer/`
- Count: 70+ component files
- Key files: `CustomerHomeComplete.tsx`, `CustomerSidebar.tsx`, `BookingFlow.tsx`, etc.

**Vendor Components:**
- Location: `src/components/vendor/`
- Count: 50+ component files
- Key files: `VendorDashboard.tsx`, `VendorOnboardingFlow.tsx`, `VendorBookingManagement.tsx`, etc.

**Customer Web App:**
- Location: `src/apps/customer-web/src/`
- Pages: `page.tsx`, `discover/page.tsx`, `(auth)/login/page.tsx`

**Vendor Web App:**
- Location: `src/apps/vendor-web/src/`
- Pages: `page.tsx`, `login/page.tsx`

---

## 🎯 REPLICATION STRATEGY

### Phase 1: Customer Web App
1. Copy `src/apps/customer-web/src/app/page.tsx` → `apps/customer-web/app/page.tsx`
2. Copy customer components from `src/components/customer/` → `apps/customer-web/components/customer/`
3. Adapt imports (reference uses different paths)
4. Preserve UI structure exactly

### Phase 2: Vendor Web App
1. Copy `src/apps/vendor-web/src/app/page.tsx` → `apps/vendor-web/app/page.tsx`
2. Copy vendor components from `src/components/vendor/` → `apps/vendor-web/components/vendor/`
3. Adapt imports
4. Preserve UI structure exactly

### Phase 3: Mobile Apps
1. Identify mobile-specific screens in reference
2. Copy to `apps/WarmpawzCustomer/src/screens/`
3. Copy to `apps/WarmpawzVendor/src/screens/`

---

## ⚠️ IMPORTANT NOTES

1. **Import Adaptation Required:**
   - Reference uses: `../components/ui/button`
   - Target uses: `@/components/ui/button` or `@/lib/...`
   - Must adapt imports while keeping UI code identical

2. **No Backend Changes:**
   - Only UI components
   - No API calls modification
   - No business logic changes

3. **Pixel-Perfect Matching:**
   - Preserve all className values
   - Preserve all styling
   - Preserve all layout structure

---

## 📁 FILES TO COPY

### Customer Web - Key Components
- [ ] `CustomerHomeComplete.tsx`
- [ ] `CustomerSidebar.tsx`
- [ ] `BookingFlow.tsx`
- [ ] `CustomerBookingsPage.tsx`
- [ ] `ServiceDiscovery.tsx`
- [ ] `EnhancedSearchBar.tsx`
- [ ] `ProblemGridNavigation.tsx`
- [ ] All other customer components (70+ files)

### Vendor Web - Key Components
- [ ] `VendorDashboard.tsx`
- [ ] `VendorOnboardingFlow.tsx`
- [ ] `VendorBookingManagement.tsx`
- [ ] `VendorServiceManagementComplete.tsx`
- [ ] All other vendor components (50+ files)

---

## 🚨 STATUS

**Current Status:** Discovery Complete  
**Next Steps:** Begin systematic component copying with import adaptation

