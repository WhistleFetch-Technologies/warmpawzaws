# 📋 PHASE 1: FOUNDATION - DETAILED ANALYSIS

## 🎯 OBJECTIVE
Complete region management and service catalog migration to SQL, with seeding endpoints.

---

## 1. REGION MANAGEMENT

### Current State Analysis
**Files to Check**:
- `region-endpoints.tsx`
- `index.tsx` (region endpoint registration)

### SQL Schema Required
```sql
-- Verify regions table exists
CREATE TABLE IF NOT EXISTS regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    parent_region_id UUID REFERENCES regions(id),
    is_active BOOLEAN DEFAULT true,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_regions_region_id ON regions(region_id);
CREATE INDEX IF NOT EXISTS idx_regions_is_active ON regions(is_active);
```

### Migration Tasks
1. ✅ Verify `regions` table exists
2. ✅ Check `region-endpoints.tsx` for KV usage
3. ✅ Replace KV operations with SQL repository
4. ✅ Create `RegionsRepository` if not exists
5. ✅ Add seeding endpoint: `POST /admin/regions/seed`

### Seeding Endpoint Spec
```typescript
POST /admin/regions/seed
Body: {
  regions: [
    {
      region_id: "mumbai",
      name: "Mumbai",
      parent_region_id: null,
      is_active: true,
      metadata: { state: "Maharashtra", country: "India" }
    },
    // ... more regions
  ]
}
```

### Invariants to Enforce
- ✅ Region must have `region_id` (unique)
- ✅ Region must have `name`
- ✅ `is_active` defaults to `true`
- ✅ No region without proper hierarchy

---

## 2. SERVICE CATALOG

### Current State Analysis
**Files to Check**:
- `vendor-services-sql-endpoints.tsx`
- `custom-service-endpoints-refactored.tsx`
- `service-package-management-sql.tsx`

### SQL Schema Required
```sql
-- Verify services table exists
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    sub_category TEXT,
    base_price DECIMAL(10, 2) NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    service_style TEXT CHECK (service_style IN ('at_center', 'at_home', 'tele')),
    is_live BOOLEAN DEFAULT true,
    publish_status TEXT DEFAULT 'published',
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
CREATE INDEX IF NOT EXISTS idx_services_is_live ON services(is_live, publish_status);
```

### Migration Tasks
1. ✅ Verify `services` table exists
2. ✅ Check all service endpoints for KV usage
3. ✅ Replace KV operations with SQL repository
4. ✅ Create seeding endpoint: `POST /admin/catalog/seed`
5. ✅ Create UI seeding endpoint: `POST /admin/catalog/seed-ui`

### Seeding Endpoint Spec
```typescript
POST /admin/catalog/seed
Body: {
  services: [
    {
      service_id: "vet_consultation",
      name: "Veterinary Consultation",
      description: "Professional vet consultation",
      category: "healthcare",
      sub_category: "consultation",
      base_price: 500,
      duration_minutes: 30,
      service_style: "tele",
      is_live: true,
      publish_status: "published",
      metadata: {
        tags: ["vet", "consultation", "tele"],
        images: [],
        requirements: []
      }
    },
    // ... more services
  ]
}
```

### UI Seeding Endpoint Spec
```typescript
POST /admin/catalog/seed-ui
Body: {
  serviceName: "Custom Service",
  description: "...",
  category: "...",
  price: 1000,
  // ... other fields
}
Response: {
  success: true,
  service: { id, service_id, ... }
}
```

### Invariants to Enforce
- ✅ Service must have `service_id` (unique)
- ✅ Service must have `name`, `category`, `base_price`
- ✅ `is_live = true` AND `publish_status = 'published'` to be visible
- ✅ Service must be linked to catalog

---

## 3. VENDOR SERVICES (Already Partially Done)

### Current State
- ✅ `vendor_services` table exists
- ✅ `vendor-services-sql-endpoints.tsx` uses SQL
- ⚠️ Need to verify no KV fallback

### Tasks
1. ✅ Verify all vendor service operations use SQL
2. ✅ Remove any KV fallback
3. ✅ Add vendor service seeding endpoint (for testing)

---

## 4. FILE STRUCTURE

### Files to Create/Modify
```
supabase/functions/make-server-3dd53475/
├── region-endpoints.tsx (modify - remove KV)
├── service-catalog-seeding.tsx (create - new seeding endpoints)
├── admin-seeding-endpoints.tsx (create - unified admin seeding)
└── ...

supabase/lib/repositories/
├── regions.ts (verify/create)
└── services.ts (verify/create)
```

---

## 5. TESTING CHECKLIST

### Region Management
- [ ] Create region via SQL
- [ ] List regions (active only)
- [ ] Update region
- [ ] Deactivate region
- [ ] Seed regions via endpoint

### Service Catalog
- [ ] Create service via SQL
- [ ] List services (published only)
- [ ] Update service
- [ ] Seed services via endpoint
- [ ] Seed services via UI endpoint

### Vendor Services
- [ ] Vendor publishes service
- [ ] Service appears in discovery
- [ ] Service has complete information

---

## 6. BREAKING CHANGES ANALYSIS

### Potential Breaking Changes
1. **Region endpoints** - If currently using KV, need to migrate data first
2. **Service queries** - If frontend expects KV format, need to maintain compatibility
3. **Seeding endpoints** - New endpoints, no breaking changes

### Mitigation
1. ✅ Keep KV as read-only fallback during migration
2. ✅ Maintain response format compatibility
3. ✅ Add migration scripts before removing KV

---

## 7. NEXT STEPS

1. **Start with Region Management**
   - Read `region-endpoints.tsx`
   - Identify KV usage
   - Replace with SQL repository
   - Add seeding endpoint

2. **Then Service Catalog**
   - Read service-related endpoints
   - Identify KV usage
   - Replace with SQL repository
   - Add seeding endpoints

3. **Test After Each Change**
   - Verify region operations work
   - Verify service operations work
   - Verify seeding works

---

**Status**: 📋 Ready for Execution
**Estimated Time**: 2-3 days

