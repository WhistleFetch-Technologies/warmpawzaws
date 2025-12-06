# 🗺️ INDEX.TSX ENDPOINT EXTRACTION MAP

**Total Inline Endpoints**: 130  
**Target**: Extract all to modular files  
**Goal**: Reduce index.tsx from 5,970 lines to ~300 lines

---

## 📋 EXTRACTION CATEGORIES

### 1. **CONFIG ENDPOINTS** → Move to `config-endpoints.tsx` (NEW)
- Line 181: `GET /config/google-maps-key`

**Action**: Create new file `config-endpoints.tsx`

---

### 2. **AUTH ENDPOINTS** → Already in `auth-endpoints.tsx` but DUPLICATED
- Line 205: `POST /auth/customer/signup` ❌ DUPLICATE
- Line 254: `POST /auth/vendor/signup` ❌ DUPLICATE  
- Line 375: `POST /auth/admin/signup` ❌ DUPLICATE
- Line 427: `GET /auth/check-admin/:userId` ❌ DUPLICATE

**Action**: DELETE from index.tsx (already handled by auth-endpoints.tsx at line 127)

---

### 3. **VENDOR REGISTRATION & MANAGEMENT** → Move to appropriate vendor files

#### TO `vendor-onboarding.tsx`:
- Line 450: `POST /vendor/register`
- Line 549: `GET /vendor/by-id/:vendorId`

#### TO `admin-vendor-routes.tsx` (Admin Vendor Management):
- Line 567: `GET /admin/vendors/pending` ❌ DUPLICATE (exists in admin-vendor-routes)
- Line 590: `GET /admin/vendors/approved` ❌ DUPLICATE
- Line 607: `GET /admin/vendors/rejected` ❌ DUPLICATE
- Line 624: `POST /admin/vendor/:vendorId/approve` ❌ DUPLICATE
- Line 667: `POST /admin/vendor/:vendorId/reject` ❌ DUPLICATE
- Line 742: `POST /admin/vendor/:vendorId/note`
- Line 778: `GET /admin/vendors` ❌ DUPLICATE
- Line 818: `POST /admin/vendors/:vendorId/verify`
- Line 869: `POST /admin/vendors/renewals/send`
- Line 958: `POST /admin/vendors/applications/export`
- Line 1052: `GET /admin/vendors/renewals/expiring`
- Line 1082: `GET /admin/vendors/support/tickets`
- Line 1179: `POST /admin/vendors/support/tickets`
- Line 1230: `GET /admin/vendors/compliance/issues`
- Line 1321: `POST /admin/vendors/compliance/issues`
- Line 1383: `GET /admin/vendors/applications/active` ✅ FIXED (now uses real data)
- Line 1583: `GET /admin/vendors/payment/disputes`
- Line 1629: `GET /admin/vendors/active`
- Line 1679: `GET /admin/vendors/:vendorId/details`
- Line 1821: `POST /admin/vendors/create`
- Line 1870: `GET /admin/vendors/all`
- Line 4251: `GET /admin/vendors/stats` ❌ DUPLICATE (exists in admin-vendor-routes)
- Line 4297: `GET /admin/vendors/deactivation-requests`

#### TO `vendor-dashboard-endpoints.tsx`:
- Line 3004: `GET /vendor/profile`
- Line 3026: `PUT /vendor/profile`
- Line 3063: `GET /vendor/bookings`

#### TO `vendor-service-management.tsx`:
- Line 2608: `POST /vendor/setup-services`
- Line 2649: `POST /vendor/setup/availability`
- Line 2696: `GET /vendor/setup/status/:vendorId`
- Line 2798: `GET /vendor/services`
- Line 2830: `POST /vendor/services`
- Line 2869: `PUT /vendor/services`
- Line 2906: `DELETE /vendor/services/:serviceId`
- Line 2937: `GET /vendor/catalog/services`

#### TO `reverification.tsx`:
- Line 4352: `POST /vendor/deactivation-request`
- Line 4381: `POST /admin/vendors/deactivation/:requestId/approve`
- Line 4420: `POST /admin/vendors/deactivation/:requestId/reject`

---

### 4. **VENDOR SERVICES & SEARCH** → `search-endpoints.tsx`
- Line 706: `GET /vendors/by-service/:serviceType`

---

### 5. **ADMIN PROFILE** → Move to `user-account-routes.tsx`
- Line 1733: `GET /admin/profile/:adminId`
- Line 1770: `PUT /admin/profile/:adminId`
- Line 1787: `POST /admin/profile/:adminId/api-key`
- Line 1804: `GET /admin/profile/:adminId/export`

---

### 6. **ADMIN CATALOG** → Move to `catalog-endpoints.tsx`
- Line 1887: `GET /admin/catalog/stats` ❌ DUPLICATE
- Line 1903: `GET /admin/catalog/categories` ❌ DUPLICATE
- Line 1943: `POST /admin/catalog/categories/create` ❌ DUPLICATE
- Line 1980: `POST /admin/catalog/services/create` ❌ DUPLICATE
- Line 2049: `PUT /admin/catalog/services/:serviceId` ❌ DUPLICATE
- Line 2117: `DELETE /admin/catalog/categories/:categoryId` ❌ DUPLICATE
- Line 2170: `PUT /admin/catalog/categories/:categoryId` ❌ DUPLICATE
- Line 2200: `PUT /admin/catalog/subcategories/:subcategoryId` ❌ DUPLICATE
- Line 2230: `GET /admin/catalog/categories/:categoryId/check-bookings`
- Line 2302: `GET /admin/catalog/subcategories/:subcategoryId/check-bookings`
- Line 2373: `DELETE /admin/catalog/subcategories/:subcategoryId` ❌ DUPLICATE
- Line 2432: `DELETE /admin/catalog/services/:serviceId` ❌ DUPLICATE
- Line 2452: `POST /admin/catalog/process-scheduled-deletions`
- Line 2507: `POST /admin/catalog/create-test-bookings`
- Line 2554: `POST /admin/catalog/clear-test-bookings`
- Line 2578: `GET /admin/catalog/inventory`
- Line 5461: `GET /admin/service-catalog`
- Line 5480: `POST /admin/service-catalog/seed`
- Line 5527: `POST /admin/service-category-mappings/seed`
- Line 5596: `POST /admin/service-catalog`
- Line 5632: `PUT /admin/service-catalog/:catalogId`
- Line 5672: `DELETE /admin/service-catalog/:catalogId`

---

### 7. **SERVICE CATALOG PUBLIC** → Move to `catalog-endpoints.tsx`
- Line 4751: `GET /catalog/services`
- Line 4799: `GET /catalog/services/:serviceId`
- Line 4839: `GET /catalog/services/:serviceId/subscriptions`
- Line 5708: `GET /service-catalog/all`
- Line 5726: `GET /service-catalog/role/:roleId`
- Line 5759: `GET /service-catalog/categories/:roleId`
- Line 5801: `GET /service-catalog/subcategories/:categoryId/:roleId`
- Line 5845: `GET /service-catalog/services/:roleId`

---

### 8. **VENDOR CONSULTATION** → Move to `vendor-dashboard-endpoints.tsx`
- Line 2720: `POST /vendor/consultation/create`
- Line 2768: `GET /vendor/consultation/history/:vendorId`

---

### 9. **CUSTOMER ROUTES** → Move to `customer-routes.tsx`
- Line 3085: `POST /customer/questionnaire`
- Line 3113: `GET /customer/questionnaire/:phone/:type`
- Line 3132: `DELETE /customer/questionnaire/:phone/:type`
- Line 3147: `POST /customer/onboarding`
- Line 3175: `POST /customer/pets` ❌ DUPLICATE (pet-endpoints.tsx)
- Line 3213: `GET /customer/pets/:phone` ❌ DUPLICATE
- Line 3282: `DELETE /customer/pets/:phone/:petId` ❌ DUPLICATE
- Line 3361: `POST /customer/profile`
- Line 3392: `GET /customer/profile/:phone`
- Line 3441: `GET /customer/vendors`
- Line 3468: `POST /customer/bookings`
- Line 4660: `GET /customer/booking-settings/:serviceType`
- Line 4688: `GET /customer/refund-policy`
- Line 4699: `POST /customer/request-refund`

---

### 10. **BOOKING ROUTES** → Move to `booking-endpoints.tsx`
- Line 3520: `GET /bookings/:phone` ❌ DUPLICATE
- Line 3581: `GET /booking/:bookingId` ❌ DUPLICATE
- Line 3674: `POST /create-booking` ❌ DUPLICATE

---

### 11. **DEALS & PROMOTIONS** → Move to NEW `promotions-endpoints.tsx`
- Line 3746: `GET /deals`
- Line 3757: `POST /admin/deals`

---

### 12. **WALKER SPECIFIC** → Move to `booking-endpoints.tsx` or NEW `walker-endpoints.tsx`
- Line 3799: `POST /walkers`
- Line 3847: `POST /walker/booking`
- Line 3938: `GET /walker/bookings/:phone`
- Line 3953: `GET /walker/session/:bookingId`
- Line 3972: `POST /walker/session/:bookingId`
- Line 3996: `POST /session/verify-otp`
- Line 4049: `PUT /session/:sessionId/update`
- Line 4091: `POST /session/:sessionId/complete`
- Line 4150: `GET /session/:sessionId/tracking`

---

### 13. **ADMIN SETTINGS** → Move to `vendor-settings-rules.tsx`
- Line 4447: `GET /admin/vendor-settings` ❌ DUPLICATE
- Line 4506: `POST /admin/vendor-settings/booking` ❌ DUPLICATE
- Line 4610: `POST /admin/vendor-settings/payment` ❌ DUPLICATE
- Line 4623: `POST /admin/vendor-settings/refund` ❌ DUPLICATE
- Line 5318: `GET /admin/vendor-settings/refund-policies`
- Line 5359: `POST /admin/vendor-settings/refund-policies`
- Line 5377: `GET /admin/vendor-settings/reservation-payment-types`
- Line 5398: `POST /admin/vendor-settings/reservation-payment-types`
- Line 5416: `GET /admin/vendor-settings/booking-rules`
- Line 5440: `POST /admin/vendor-settings/booking-rules`

---

### 14. **VENDOR SETTINGS** → Move to `vendor-dashboard-endpoints.tsx`
- Line 4636: `GET /vendor/settings/:vendorId`

---

### 15. **DEBUG ENDPOINTS** → Move to NEW `debug-endpoints.tsx` (DEV ONLY)
- Line 4519: `GET /debug/bookings/:phone`
- Line 4572: `POST /debug/init-demo-customer`
- Line 5019: `GET /debug/vendor-lookup/:phone` ✅ KEEP (useful)
- Line 5112: `GET /debug/vendor-by-id/:vendorId` ✅ KEEP
- Line 5170: `GET /debug/pending-applications` ✅ KEEP (newly added)

---

### 16. **SEED/DATA ENDPOINTS** → Already in `seed-data.tsx` but DUPLICATED
- Line 4951: `POST /admin/seed/vendors` ❌ DUPLICATE
- Line 4970: `POST /admin/seed/clear-vendors` ❌ DUPLICATE
- Line 4989: `POST /admin/seed/reset-and-seed` ❌ DUPLICATE
- Line 5893: `POST /vendor/:vendorId/seed-services`

---

### 17. **UTILITY ENDPOINTS** → Move to vendor files
- Line 5264: `POST /vendor/ensure-exists` → Move to `vendor-onboarding.tsx`

---

## 🎯 CONSOLIDATION SUMMARY

### Files to CREATE:
1. ✅ `config-endpoints.tsx` (1 endpoint)
2. ✅ `debug-endpoints.tsx` (3-4 endpoints for dev)
3. ✅ `promotions-endpoints.tsx` (2 endpoints)
4. ⚠️ `walker-endpoints.tsx` (9 endpoints) OR merge into booking-endpoints

### Files with DUPLICATES (need cleanup):
1. ❌ `admin-vendor-routes.tsx` - Has endpoints also in index.tsx
2. ❌ `catalog-endpoints.tsx` - Has endpoints also in index.tsx
3. ❌ `auth-endpoints.tsx` - Has endpoints also in index.tsx
4. ❌ `booking-endpoints.tsx` - Has endpoints also in index.tsx
5. ❌ `pet-endpoints.tsx` - Has endpoints also in index.tsx
6. ❌ `vendor-settings-rules.tsx` - Has endpoints also in index.tsx

### Endpoints to DELETE from index.tsx:
- **Auth**: 4 endpoints (already in auth-endpoints.tsx)
- **Admin Vendor**: ~25 endpoints (already in admin-vendor-routes.tsx)
- **Catalog**: ~30 endpoints (already in catalog-endpoints.tsx)
- **Booking**: ~5 endpoints (already in booking-endpoints.tsx)
- **Pets**: 3 endpoints (already in pet-endpoints.tsx)
- **Settings**: ~10 endpoints (already in vendor-settings-rules.tsx)
- **Seed**: 3 endpoints (already in seed-data.tsx)

**Total to DELETE**: ~80 duplicate endpoints

### Endpoints to MOVE from index.tsx:
- **Config**: 1 endpoint → NEW file
- **Debug**: 3 endpoints → NEW file
- **Promotions**: 2 endpoints → NEW file
- **Customer**: ~15 endpoints → customer-routes.tsx
- **Vendor Dashboard**: ~8 endpoints → vendor-dashboard-endpoints.tsx
- **Vendor Services**: ~8 endpoints → vendor-service-management.tsx
- **Vendor Onboarding**: ~3 endpoints → vendor-onboarding.tsx
- **Walker**: 9 endpoints → NEW file or booking-endpoints
- **Admin Profile**: 4 endpoints → user-account-routes.tsx

**Total to MOVE**: ~50 endpoints

---

## 📊 FINAL TARGET

**Current**: 5,970 lines, 130 inline endpoints  
**After Cleanup**: ~300 lines, 0 inline endpoints  

**Reduction**: ~95% fewer lines in index.tsx!
