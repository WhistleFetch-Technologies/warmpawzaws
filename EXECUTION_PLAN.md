# 🎯 SYSTEMATIC EXECUTION PLAN - COMPLETE KV MIGRATION

**Date:** 2024-12-24  
**Objective:** Eliminate all KV usage, migrate to SQL-only architecture  
**Status:** IN PROGRESS

---

## 📋 PHASE 1: KV MIGRATION - auth-service.tsx (P0 - CRITICAL)

### Task 1.1: Verify SQL Tables Exist
**Reference:** `KV_MIGRATION_PLAN_AUTH_SERVICE.md` - Step 1  
**Files to Check:**
- `db/schema.sql` - Main schema
- `db/migrations/*.sql` - Migration files
- `supabase/lib/repositories/sessions.ts` - SessionsRepository (✅ exists)

**Actions:**
- [ ] Check if `sessions` table exists ✅ (confirmed)
- [ ] Check if `access_tokens` table exists
- [ ] Check if `admin_profiles` table exists OR use existing admin table
- [ ] Document findings

**Output:** Table verification report

---

### Task 1.2: Create Missing SQL Tables (if needed)
**Reference:** `KV_MIGRATION_PLAN_AUTH_SERVICE.md` - Step 2  
**Files:**
- `db/migrations/024_access_tokens_table.sql` (if needed)
- `db/migrations/025_admin_profiles_table.sql` (if needed)

**Actions:**
- [ ] Create `access_tokens` table migration (if missing)
- [ ] Create `admin_profiles` table migration (if missing)
- [ ] Apply migrations to Supabase

**Output:** SQL migration files

---

### Task 1.3: Create Missing Repositories
**Reference:** `supabase/lib/repositories/sessions.ts` (template)  
**Files to Create:**
- `supabase/lib/repositories/access-tokens.ts`
- `supabase/lib/repositories/admin-profiles.ts`

**Actions:**
- [ ] Create `AccessTokensRepository` class
- [ ] Create `AdminProfilesRepository` class
- [ ] Follow pattern from `SessionsRepository`

**Output:** Repository files

---

### Task 1.4: Migrate Session Management
**Reference:** `supabase/functions/make-server-3dd53475/auth-service.tsx` - Lines 300-375  
**Reference:** `supabase/lib/repositories/sessions.ts` - Methods available

**Functions to Migrate:**
1. `createSession()` - Line 300-329
2. `getSession()` - Line 334-349
3. `getSessionByUserId()` - Line 354-359
4. `deleteSession()` - Line 364-375

**Actions:**
- [ ] Replace `kv.set()` with `SessionsRepository.create()`
- [ ] Replace `kv.get()` with `SessionsRepository.findById()`
- [ ] Replace `kv.get()` with `SessionsRepository.findByUser()`
- [ ] Replace `kv.del()` with `SessionsRepository.delete()`
- [ ] Update session data structure to match SQL schema

**Output:** Migrated session functions

---

### Task 1.5: Migrate Token Management
**Reference:** `supabase/functions/make-server-3dd53475/auth-service.tsx` - Lines 380-450  
**Reference:** `supabase/lib/repositories/access-tokens.ts` (to be created)

**Functions to Migrate:**
1. `generateAccessToken()` - Line 380-405
2. `validateAccessToken()` - Line 411-437
3. `deleteAccessToken()` - Line 442-450

**Actions:**
- [ ] Replace `kv.set()` with `AccessTokensRepository.create()`
- [ ] Replace `kv.get()` with `AccessTokensRepository.findByToken()`
- [ ] Replace `kv.del()` with `AccessTokensRepository.delete()`
- [ ] Update token data structure to match SQL schema

**Output:** Migrated token functions

---

### Task 1.6: Migrate Admin Profile Management
**Reference:** `supabase/functions/make-server-3dd53475/auth-service.tsx` - Lines 735-760  
**Reference:** `supabase/lib/repositories/admin-profiles.ts` (to be created)

**Functions to Migrate:**
1. `getAdminProfile()` - Line 735-760

**Actions:**
- [ ] Replace `kv.get()` with `AdminProfilesRepository.findById()`
- [ ] Replace `kv.set()` with `AdminProfilesRepository.create()` or `update()`
- [ ] Update admin profile data structure to match SQL schema

**Output:** Migrated admin profile functions

---

### Task 1.7: Remove KV Import and Test
**Reference:** `supabase/functions/make-server-3dd53475/auth-service.tsx` - Line 26

**Actions:**
- [ ] Remove `import * as kv from './kv_store.tsx';`
- [ ] Remove all KV-related code
- [ ] Test session creation
- [ ] Test session retrieval
- [ ] Test session deletion
- [ ] Test token creation
- [ ] Test token validation
- [ ] Test admin profile retrieval
- [ ] Deploy and verify

**Output:** Clean auth-service.tsx, tested and deployed

---

## 📋 PHASE 2: FULL KV AUDIT (P1 - HIGH)

### Task 2.1: Comprehensive KV Scan
**Reference:** All 425 TypeScript files in `supabase/functions/make-server-3dd53475/`

**Actions:**
- [ ] Search all files for `kv.` patterns
- [ ] Search for `kv_store` imports
- [ ] Search for `kv.getByPrefix` usage
- [ ] Create violation list with file paths and line numbers

**Output:** `KV_VIOLATIONS_COMPLETE.md`

---

### Task 2.2: Categorize Violations
**Reference:** `KV_AUDIT_REPORT_FINAL.md` (if exists)

**Categories:**
- P0: Critical (auth, payments, bookings)
- P1: High (user data, vendor data)
- P2: Medium (caching, temporary data)

**Actions:**
- [ ] Categorize each violation
- [ ] Identify SQL tables/repositories needed
- [ ] Prioritize by business impact

**Output:** Categorized violation report

---

### Task 2.3: Create Migration Plans
**Reference:** `KV_MIGRATION_PLAN_AUTH_SERVICE.md` (template)

**Actions:**
- [ ] Create migration plan for each P0 violation
- [ ] Create migration plan for each P1 violation
- [ ] Document SQL tables needed
- [ ] Document repositories needed

**Output:** Migration plans for all violations

---

## 📋 PHASE 3: ENDPOINT TESTING (P1 - HIGH)

### Task 3.1: Critical Endpoints Testing
**Reference:** `BACKEND_AUDIT_REPORT.md` - Verified Endpoint Map

**Endpoints to Test:**
- `/auth/login` (vendor)
- `/auth/login` (customer)
- `/staff/auth/check-phone`
- `/staff/auth/login`
- `/bookings/create`
- `/payments`

**Actions:**
- [ ] Test each endpoint with valid inputs
- [ ] Test each endpoint with invalid inputs
- [ ] Test CORS preflight
- [ ] Document test results

**Output:** Endpoint test report

---

### Task 3.2: Business Flow Testing
**Reference:** `BACKEND_AUDIT_REPORT.md` - Business Flow Proof

**Flows to Test:**
1. Signup → Profile → Wallet creation
2. Booking → Payment → Confirmation
3. Booking → Completion → Wallet credit

**Actions:**
- [ ] Test each flow end-to-end
- [ ] Verify SQL writes at each step
- [ ] Verify SQL reads at each step
- [ ] Document flow test results

**Output:** Business flow test report

---

## 📋 PHASE 4: CODE CLEANUP (P2 - MEDIUM)

### Task 4.1: File Extension Standardization
**Reference:** `FILE_AUTHORITY_REPORT.md` - File Extensions section

**Actions:**
- [ ] Identify all `.tsx` files without React/JSX
- [ ] Rename to `.ts` (if safe)
- [ ] Update imports

**Output:** Standardized file extensions

---

### Task 4.2: Remove Unused Files
**Reference:** `FILE_AUTHORITY_REPORT.md` - Dead Files section

**Actions:**
- [ ] Identify dead code
- [ ] Remove unused endpoint files
- [ ] Clean up backup files

**Output:** Cleaned codebase

---

## 🚀 EXECUTION ORDER

1. **Phase 1** (P0) - KV Migration auth-service.tsx
2. **Phase 2** (P1) - Full KV Audit
3. **Phase 3** (P1) - Endpoint Testing
4. **Phase 4** (P2) - Code Cleanup

---

**Status:** READY TO EXECUTE

