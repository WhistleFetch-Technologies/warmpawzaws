# 📋 ENDPOINT REGISTRATION PLAN

**Agent 2: Lambda Migration Agent**  
**Date:** 2025-01-27  
**Status:** 🚀 **IN PROGRESS**

---

## 📊 DISCOVERY RESULTS

### Endpoint Files Found
- **Total endpoint files:** 145
- **Total .tsx files:** 568

### Core Endpoints Identified (Priority 1-10)
1. **Auth Endpoints** (`auth-endpoints.tsx`)
   - Function: `registerAuthEndpoints(app: Hono)`
   - Priority: 1
   - Status: ⏳ Pending registration

2. **Booking Endpoints** (`booking-endpoints-sql.tsx`)
   - Function: `bookingEndpointsSQL(app: Hono)`
   - Priority: 2
   - Status: ⏳ Pending registration

3. **Payment Endpoints** (`payment-endpoints-sql.tsx`)
   - Function: `paymentEndpointsSQL(app: Hono)`
   - Priority: 3
   - Status: ⏳ Pending registration

4. **Customer Endpoints** (`customer-routes.tsx`)
   - Function: `registerCustomerRoutes(app: Hono)`
   - Priority: 4
   - Status: ⏳ Pending registration

5. **Vendor Endpoints** (`vendor-routes.tsx`)
   - Function: `registerVendorRoutes(app: Hono)`
   - Priority: 5
   - Status: ⏳ Pending registration

6. **Staff Endpoints** (`staff-crud-endpoints.tsx`)
   - Function: `staffCrudEndpoints(app: Hono)`
   - Priority: 6
   - Status: ⏳ Pending registration

---

## 🎯 REGISTRATION STRATEGY

### Phase 1: Core Endpoints (Week 8)
**Target:** Register all 6 core endpoints

**Current Status:**
- ✅ Endpoint registry system created
- ✅ Core endpoints identified
- ✅ Lambda handler structure updated
- ⏳ **BLOCKED:** Deno imports need conversion first

**Blocking Issue:**
- Endpoint files use Deno imports (`npm:hono@4`, `jsr:`)
- Lambda requires Node.js imports
- Solution: Convert in Week 10-11, or create Node.js-compatible wrappers now

### Phase 2: Secondary Endpoints (Week 8-9)
**Target:** Register remaining 139 endpoints

**Categories:**
- Secondary endpoints (Priority 11-50): ~20 endpoints
- Specialized service endpoints (Priority 51-100): ~50 endpoints
- Admin endpoints (Priority 101-150): ~30 endpoints
- Analytics endpoints (Priority 151-200): ~10 endpoints
- Other endpoints: ~29 endpoints

### Phase 3: Deno → Node.js Conversion (Week 10-11)
**Target:** Convert all endpoint files to Node.js

**Tasks:**
1. Replace `npm:hono@4` → `hono`
2. Replace `jsr:` imports → npm packages
3. Replace `Deno.env.get()` → `process.env`
4. Update file paths and imports
5. Test all endpoints

---

## 🔧 CURRENT APPROACH

### Option 1: Register Now (Requires Conversion)
- Convert endpoint files to Node.js first
- Then register in Lambda handler
- **Pros:** Can test immediately
- **Cons:** Large conversion effort upfront

### Option 2: Prepare Structure Now, Convert Later (Current)
- Create registration structure in handler
- Comment out until conversion
- Convert all files in Week 10-11
- **Pros:** Organized, clear plan
- **Cons:** Can't test until conversion

### Option 3: Hybrid Approach (Recommended)
- Convert core endpoints now (6 files)
- Register and test core endpoints
- Convert remaining endpoints in Week 10-11
- **Pros:** Can test critical paths early
- **Cons:** Some duplication of effort

---

## 📝 NEXT STEPS

### Immediate (This Session)
1. ✅ Create endpoint registry system
2. ✅ Identify all endpoint files
3. ✅ Update Lambda handler structure
4. ⏳ **DECISION NEEDED:** Choose conversion approach

### Short-term (Week 8)
1. Convert core endpoints (6 files) OR prepare structure
2. Register core endpoints
3. Test core endpoint registration
4. Begin secondary endpoint registration

### Medium-term (Week 9)
1. Complete secondary endpoint registration
2. Register specialized service endpoints
3. Register admin endpoints
4. Register analytics endpoints
5. Test route discovery

### Long-term (Week 10-11)
1. Convert all Deno code to Node.js
2. Update all imports
3. Test all endpoints
4. Optimize Lambda cold starts

---

## 🚨 BLOCKERS

### Current Blocker
- **Deno Imports:** Endpoint files use Deno-specific imports
- **Solution Options:**
  1. Convert core endpoints now (6 files)
  2. Wait for Week 10-11 full conversion
  3. Create Node.js wrapper files

### Recommendation
**Convert core endpoints now** to enable early testing of critical business logic.

---

**Status:** 🚀 **ACTIVE - AWAITING CONVERSION DECISION**  
**Next Action:** Choose conversion approach and proceed

