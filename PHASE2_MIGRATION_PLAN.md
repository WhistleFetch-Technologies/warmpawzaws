# 🎯 PHASE 2: SYSTEMATIC KV MIGRATION PLAN

**Date:** 2024-12-24  
**Status:** READY FOR EXECUTION  
**Method:** Proof-based, systematic migration

---

## ✅ PROOF OF SQL READINESS

### Repositories Available: 84 repositories
**Confirmed:** All major entities have SQL repositories

### SQL Tables Available:
- ✅ `bookings` - EXISTS
- ✅ `vendors` - EXISTS  
- ✅ `staff` - EXISTS
- ✅ `pets` - EXISTS
- ✅ `service_packages` - EXISTS
- ✅ `package_enrollments` - EXISTS
- ✅ `services` - EXISTS
- ✅ `customers` - EXISTS

---

## 🎯 MIGRATION PRIORITY ORDER

### **PRIORITY 1: Core Business Logic (Start Here)**

#### File 1: `service-package-management.tsx`
**KV Operations:** 30+  
**Risk Level:** LOW (repositories exist)

**KV Patterns Found:**
```typescript
// Pattern 1: Get packages
await kv.get(`vendor:${vendorId}:service_packages`)

// Pattern 2: Set packages  
await kv.set(`vendor:${vendorId}:service_packages`, packages)

// Pattern 3: Get enrollments
await kv.get(`vendor:${vendorId}:package_enrollments`)

// Pattern 4: Get staff
await kv.get(`staff:${staffId}`)

// Pattern 5: Get pet
await kv.get(`pet:${petId}`)
```

**SQL Replacements (PROOF):**
1. ✅ `service_packages` table exists
2. ✅ `package_enrollments` table exists  
3. ✅ `PackagesRepository` exists (`supabase/lib/repositories/packages.ts`)
4. ✅ `StaffRepository` exists
5. ✅ `PetsRepository` exists

**Migration Steps:**
1. Import repositories: `getPackagesRepository()`, `getStaffRepository()`, `getPetsRepository()`
2. Replace `kv.get('vendor:${vendorId}:service_packages')` with SQL query
3. Replace `kv.set('vendor:${vendorId}:service_packages')` with repository `create()/update()`
4. Replace `kv.get('vendor:${vendorId}:package_enrollments')` with SQL query
5. Replace `kv.get('staff:${staffId}')` with `StaffRepository.findById()`
6. Replace `kv.get('pet:${petId}')` with `PetsRepository.findById()`
7. Remove `import * as kv from './kv_store.tsx'`
8. Test endpoints

---

#### File 2: `booking-lifecycle.tsx`
**KV Operations:** 20+  
**Risk Level:** LOW (repository exists)

**KV Patterns:**
```typescript
await kv.get(`booking:${bookingId}`)
await kv.set(`booking:${bookingId}`, booking)
```

**SQL Replacement:**
- ✅ `BookingsRepository` exists
- ✅ `bookings` table exists

**Migration Steps:**
1. Import `getBookingsRepository()`
2. Replace all `kv.get('booking:${id}')` → `bookingsRepo.findById()`
3. Replace all `kv.set('booking:${id}')` → `bookingsRepo.create()/update()`
4. Remove KV import
5. Test

---

#### File 3: `vendor-service-management.tsx`
**KV Operations:** 15+  
**Risk Level:** LOW

**KV Patterns:**
```typescript
await kv.get(`vendor:${vendorId}:services`)
await kv.set(`vendor:${vendorId}:services`, services)
```

**SQL Replacement:**
- ✅ `ServicesRepository` exists
- ✅ `services` table exists (with `vendor_id` column)

**Migration Steps:**
1. Import `getServicesRepository()`
2. Replace with SQL queries filtering by `vendor_id`
3. Remove KV import
4. Test

---

### **PRIORITY 2: Search & Analytics**

#### File 4: `search-endpoints.tsx`
**KV Operations:** 50+  
**Risk Level:** MEDIUM (performance impact)

**KV Patterns:**
```typescript
await kv.getByPrefix('vendor:vendor_')
await kv.get('featured:vendors')
```

**SQL Replacement:**
- ✅ `VendorsRepository.findAll()` exists
- ⚠️ Need to verify performance with large datasets

**Migration Steps:**
1. Replace `getByPrefix` with `VendorsRepository.findAll()`
2. Create `featured_vendors` table or use existing vendor flags
3. Test performance
4. Remove KV import

---

### **PRIORITY 3: Remove KV Parameter Passing**

#### File 5: `index.ts`
**KV Parameter Passing:** 60+ endpoint registrations

**Pattern:**
```typescript
endpointFunction(app, kv);
```

**Fix:**
```typescript
endpointFunction(app); // Remove kv parameter
```

**Migration Steps:**
1. Update all endpoint function signatures to remove `kv` parameter
2. Update all endpoint registrations in `index.ts`
3. Remove `import * as kv from './kv_store.tsx'` from `index.ts`
4. Test deployment

---

## 🔧 SYSTEMATIC EXECUTION PLAN

### Step 1: Verify Current State
- [x] Scan all files for KV usage
- [x] Identify top files by KV count
- [x] Verify SQL tables exist
- [x] Verify repositories exist
- [ ] Test current endpoints (baseline)

### Step 2: Migrate P1 Files (One at a time)
- [ ] Migrate `service-package-management.tsx`
- [ ] Test endpoints
- [ ] Deploy
- [ ] Verify functionality
- [ ] Migrate `booking-lifecycle.tsx`
- [ ] Test, deploy, verify
- [ ] Migrate `vendor-service-management.tsx`
- [ ] Test, deploy, verify

### Step 3: Migrate P2 Files
- [ ] Migrate `search-endpoints.tsx`
- [ ] Performance test
- [ ] Deploy

### Step 4: Remove KV Parameter
- [ ] Update all endpoint signatures
- [ ] Update `index.ts` registrations
- [ ] Remove KV import from `index.ts`
- [ ] Deploy and test

---

## ⚠️ SAFETY CHECKLIST (Before Each Migration)

- [ ] Repository exists and has required methods
- [ ] SQL table exists with correct schema
- [ ] Current endpoint tested (baseline)
- [ ] Migration code written
- [ ] Linter passes
- [ ] Deploy to test environment
- [ ] Test endpoint functionality
- [ ] Verify no regressions
- [ ] Deploy to production

---

## 📊 PROGRESS TRACKING

**Total Files with KV:** 30+  
**Files Migrated:** 1 (`auth-service.tsx`)  
**Files Remaining:** 29+

**Estimated Time:**
- P1 Files: 2-3 hours each
- P2 Files: 3-4 hours each
- KV Parameter Removal: 1-2 hours

---

**Status:** ✅ PLAN READY - Starting with `service-package-management.tsx`

