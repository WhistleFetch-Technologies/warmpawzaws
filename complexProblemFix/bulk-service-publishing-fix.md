# Bulk Service Publishing Fix — End-to-End Implementation

**Created:** 2026-02-22  
**Last Updated:** 2026-02-22  
**Environments:** Production + Dev/UAT  
**Affected Roles:** All vendor roles (vet, groomer, trainer, etc.)

---

## 1. Problem Statement

### Symptoms
When a vendor published **1 service** on the vendor-web UI, the frontend fired **144 individual API calls** — one `PUT /vendor/:vendorId/services/:serviceId` for every service the vendor owned, regardless of whether that service had changed or even needed publishing.

**Example scenario:**
- Vendor has **166 tele services** (most are catalog-synced, some custom)
- User clicks "Publish" after enabling **1 service**
- Expected: **1 API call** (or at most 2: save + publish)
- Actual: **144+ API calls** — one PUT per service

### Impact
- Massive network overhead; browser devtools showed 144 requests in quick succession
- Lambda throttling / 503 errors on the backend
- Poor UX — publish button locked for 30+ seconds
- Risk of partial updates if some calls fail mid-batch

---

## 2. Root Cause Analysis

### Root Cause 1: `saveConfiguration()` saved ALL services, not just dirty ones

```typescript
// BEFORE (broken) — saveConfiguration()
const servicesWithVendorRow = services.filter(s => {
  if (s.isVendorEnabled !== true) return false;
  // ... validation ...
  return true;
});

// This fires a PUT for EVERY vendor service
for (let i = 0; i < servicesToSave.length; i++) {
  await putWithRetry(() =>
    apiClient.put(`/vendor/${vendorId}/services/${service.vendorServiceId}`, { ... })
  );
}
```

**Problem:** No dirty tracking. Every call to `saveConfiguration()` iterated over ALL 72+ vendor services and fired a PUT for each one, even if no field changed.

### Root Cause 2: `publishServices()` published ALL enabled services, including already-published ones

```typescript
// BEFORE (broken) — publishServices()
const toPublish = services.filter(
  s => s.isEnabled && s.isVendorEnabled === true && ...
);
// Missing: && s.publishStatus !== 'published'
// This publishes EVERY enabled service, even if already published
for (let i = 0; i < toPublish.length; i++) {
  await putWithRetry(() =>
    apiClient.put(`/vendor/${vendorId}/services/${vendorServiceId}`, { publish_status: 'published' })
  );
}
```

**Problem:** No check for `publishStatus === 'published'`. If a vendor had 72 enabled+published services and published 1 new one, all 73 would fire PUTs.

### Root Cause 3: No bulk endpoint usage

The backend already had `POST /vendor/:vendorId/services/bulk-publish` that accepts `{ serviceIds: string[], publishStatus: string }` and updates them all in one request via `Promise.all`. The frontend was not using it.

---

## 3. Solution — Three-Part Fix

### Fix 1: Dirty Tracking with `dirtyServiceIds` (Frontend)

**File:** `apps/vendor-web/components/vendor/VendorServiceConfigurationScreen.tsx`

Introduced a `Set<string>` state variable called `dirtyServiceIds` that tracks which specific service IDs have been modified since the last load/save.

```typescript
const [dirtyServiceIds, setDirtyServiceIds] = useState<Set<string>>(new Set());
```

**Every function that modifies a service now adds its ID to the dirty set:**

| Function | What it tracks |
|---|---|
| `updateServicePrice(serviceId, price)` | `setDirtyServiceIds(prev => new Set(prev).add(serviceId))` |
| `updateServiceDuration(serviceId, duration)` | `setDirtyServiceIds(prev => new Set(prev).add(serviceId))` |
| `updateServiceDescription(serviceId, desc)` | `setDirtyServiceIds(prev => new Set(prev).add(serviceId))` |
| `enableAllServices()` | Adds ALL service IDs to dirty set |
| `disableAllServices()` | Adds ALL service IDs to dirty set |
| `enableCategory(category)` | Adds all IDs in that category to dirty set |
| `disableCategory(category)` | Adds all IDs in that category to dirty set |

**Reset points:**
- `loadServices()` → `setDirtyServiceIds(new Set())` — fresh load clears all dirty flags
- `saveConfiguration()` → `setDirtyServiceIds(new Set())` — successful save clears dirty flags

### Fix 2: `saveConfiguration()` — Only Save Dirty Services

```typescript
const saveConfiguration = async () => {
  const dirtyIds = dirtyServiceIds;
  
  if (dirtyIds.size === 0) {
    console.log('No dirty services to save - skipping');
    setHasChanges(false);
    return true;
  }
  
  // Only save services that:
  // 1. Are in the dirty set
  // 2. Have a valid vendor_services row (isVendorEnabled, valid UUID, etc.)
  const servicesToSave = services
    .filter(s => dirtyIds.has(s.id) && isValidVendorService(s))
    .map(s => ({ /* ... */ }));
  
  // Individual PUTs only for dirty services
  for (const service of servicesToSave) {
    await putWithRetry(() =>
      apiClient.put(`/vendor/${vendorId}/services/${service.vendorServiceId}`, { ... })
    );
  }
  
  setDirtyServiceIds(new Set()); // Clear after save
};
```

**Result:** If 1 service changed → 1 API call. If 3 services changed → 3 API calls.

### Fix 3: `publishServices()` — Only Publish Unpublished + Use Bulk Endpoint

```typescript
const publishServices = async () => {
  // 1. Save any pending dirty changes first
  await saveConfiguration();
  
  // 2. Filter to only unpublished services
  const toPublish = services.filter(s => {
    if (!s.isEnabled) return false;
    if (s.isVendorEnabled !== true) return false;
    if (!isValidVendorService(s)) return false;
    // KEY FIX: Skip already-published services
    if (s.publishStatus === 'published' || s.publish_status === 'published') return false;
    return true;
  });
  
  if (toPublish.length === 0) {
    toast.info('All enabled services are already published');
    return;
  }
  
  // 3. Use bulk-publish endpoint (1 API call for N services)
  try {
    const serviceIds = toPublish.map(s => s.vendorServiceId ?? s.id);
    await apiClient.post(`/vendor/${vendorId}/services/bulk-publish`, {
      serviceIds,
      publishStatus: 'published',
    });
  } catch {
    // Fallback to individual PUTs if bulk-publish fails
    for (const service of toPublish) {
      await putWithRetry(() =>
        apiClient.put(`/vendor/${vendorId}/services/${vendorServiceId}`, { publish_status: 'published' })
      );
    }
  }
  
  await loadServices(); // Refresh state
};
```

**Result:** Publishing 1 new service → 1 API call (via bulk-publish). Publishing 3 new services → still 1 API call.

---

## 4. Helper Function: `isValidVendorService()`

This helper prevents saving catalog-only entries or temp IDs:

```typescript
const isValidVendorService = (s: Service): boolean => {
  if (s.isVendorEnabled !== true) return false;        // Must have a vendor_services row
  if (!s.id) return false;                              // Must have an ID
  if (s.id.startsWith('temp_')) return false;            // Skip temp IDs
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.id);
  if (!isUUID) return false;                            // Must be valid UUID
  if (s.id === s.serviceId || s.id === s.catalogServiceId) return false;  // Must not be catalog UUID
  return true;
};
```

---

## 5. Backend Endpoints Used

### `PUT /vendor/:vendorId/services/:serviceId`
- **File:** `backend/lambda/src/endpoints/vendor-services.ts`
- **Purpose:** Update a single vendor service
- **Safeguards (already in place):**
  - Prioritizes lookup by `vendor_services.id` (primary key) first
  - If `serviceId` is a catalog UUID matching multiple entries, returns error instead of bulk-updating
  - Count checks prevent accidental mass updates

### `POST /vendor/:vendorId/services/bulk-publish`
- **File:** `backend/lambda/src/endpoints/vendor-services.ts` (line ~2021)
- **Purpose:** Bulk update `publish_status` for multiple services in one call
- **Request body:**
  ```json
  {
    "serviceIds": ["uuid1", "uuid2", "uuid3"],
    "publishStatus": "published"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "results": [
      { "serviceId": "uuid1", "success": true },
      { "serviceId": "uuid2", "success": true }
    ],
    "message": "Updated 2 of 2 services"
  }
  ```
- **Each service update:** `UPDATE vendor_services SET publish_status=$1, is_enabled=true WHERE id=$2 AND vendor_id=$3`

### `POST /vendor/:vendorId/services/bulk-update`
- **File:** `backend/lambda/src/endpoints/vendor-services.ts` (line ~1845)
- **Purpose:** Bulk update services (enable/disable, pricing)
- **Matches by:** `catalog_service_id` (not `vendor_services.id`)
- **Used for:** Initial setup / bulk sync scenarios

---

## 6. Database Schema

### `vendor_services` Table
```sql
CREATE TABLE vendor_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  service_id UUID REFERENCES service_catalog(id),   -- catalog foreign key
  service_name TEXT,
  category TEXT,
  price NUMERIC(10,2),
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  service_style TEXT,                                -- 'tele', 'at_home', 'at_center'
  publish_status TEXT DEFAULT 'draft',               -- 'draft', 'pending_approval', 'published'
  is_enabled BOOLEAN DEFAULT false,
  is_custom_service BOOLEAN DEFAULT false,
  custom_price NUMERIC(10,2),
  custom_duration INTEGER,
  custom_description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_for_approval_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  UNIQUE(vendor_id, service_id, service_style)
);
```

### Key Fields for This Fix
| Field | Role |
|---|---|
| `id` (PK) | The `vendor_services.id` used in frontend as `service.id` |
| `service_id` (FK) | The `service_catalog.id` — used for catalog matching |
| `publish_status` | Controls customer visibility: `draft` → `published` |
| `is_enabled` | Controls vendor-side toggle state |

---

## 7. Frontend State Model

### Service Interface (relevant fields)
```typescript
interface Service {
  id: string;                    // vendor_services.id (primary key)
  serviceId?: string;            // service_catalog.id (foreign key)
  catalogServiceId?: string;     // alias for serviceId
  isEnabled: boolean;            // toggle state
  isVendorEnabled: boolean;      // true if service has a vendor_services row
  isPlatformService: boolean;    // true if from service_catalog
  publishStatus?: string;        // 'draft' | 'published' | 'pending_approval'
  publish_status?: string;       // backend snake_case alias
  customPrice?: number;
  customDuration?: number;
  customDescription?: string;
  // ... other fields
}
```

### State Variables
```typescript
const [services, setServices] = useState<Service[]>([]);
const [hasChanges, setHasChanges] = useState(false);
const [dirtyServiceIds, setDirtyServiceIds] = useState<Set<string>>(new Set());
```

---

## 8. Flow Diagram

### Before Fix (144 API calls)
```
User clicks "Publish"
  → publishServices()
    → saveConfiguration()                    ← Saves ALL 72 vendor services (72 PUTs)
    → filter toPublish (all 72 enabled)      ← No publishStatus check
    → for each toPublish                     ← 72 more PUTs
  Total: 144 API calls
```

### After Fix (1-3 API calls)
```
User clicks "Publish"
  → publishServices()
    → saveConfiguration()
      → dirtyServiceIds.size === 0?          ← Skip if nothing changed (0 PUTs)
      → OR: save only dirty services         ← N PUTs where N = # of changed services
    → filter toPublish
      → EXCLUDE publishStatus==='published'  ← Only unpublished services
    → bulk-publish endpoint                  ← 1 POST with all serviceIds
  Total: 1 API call (if no dirty + all bulk-published)
         or N+1 API calls (N dirty saves + 1 bulk-publish)
```

---

## 9. toggleService() — Immediate Save (No Dirty Tracking Needed)

`toggleService()` already saves immediately via individual API calls and does not go through `saveConfiguration()`:

```typescript
const toggleService = async (serviceId: string) => {
  if (newEnabled && !service.isVendorEnabled) {
    // Add from catalog → POST /vendor/:vendorId/services/add-from-catalog
    await apiClient.post(`/vendor/${vendorId}/services/add-from-catalog`, { ... });
    await loadServices(); // Refresh
  } else if (!newEnabled && service.isVendorEnabled) {
    // Disable → PUT /vendor/:vendorId/services/:id { is_enabled: false }
    await apiClient.put(`/vendor/${vendorId}/services/${service.id}`, { is_enabled: false });
  } else if (newEnabled && service.isVendorEnabled) {
    // Re-enable → PUT /vendor/:vendorId/services/:id { is_enabled: true }
    await apiClient.put(`/vendor/${vendorId}/services/${service.id}`, { is_enabled: true });
  }
  setHasChanges(false); // Saved immediately
};
```

This is correct — toggle is a single-service operation and saves immediately. No dirty tracking needed.

---

## 10. Deployment

### Files Changed
| File | Environment | Change |
|---|---|---|
| `apps/vendor-web/components/vendor/VendorServiceConfigurationScreen.tsx` | Frontend (vendor-web) | Dirty tracking + publish optimization |
| `backend/lambda/src/endpoints/vendor-services.ts` | Backend (Lambda) | Count safeguards for PUT/POST (already deployed in prior fix) |

### Deployment Commands
```powershell
# 1. Build vendor-web
cd D:\WFTPL\warmpawzApp\warmpawzaws\apps\vendor-web
npm run build

# 2. Deploy to PRODUCTION
$runtimeConfigContent = @"
(function() {
  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com",
    uatMode: false, environment: "production"
  };
})();
"@
Set-Content -Path "dist\runtime-config.js" -Value $runtimeConfigContent -Encoding UTF8
aws s3 sync "dist/" "s3://warmpawz-prod-vendor-frontend-ap-south-1/" --delete --exclude "*.map" --region ap-south-1
aws cloudfront create-invalidation --distribution-id E3JDHOY1XIFOWE --paths "/*" --region ap-south-1

# 3. Deploy to DEV/UAT
$runtimeConfigContent = @"
(function() {
  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com",
    uatMode: true
  };
})();
"@
Set-Content -Path "dist\runtime-config.js" -Value $runtimeConfigContent -Encoding UTF8
aws s3 sync "dist/" "s3://warmpawz-dev-vendor-frontend-ap-south-1/" --delete --exclude "*.map" --region ap-south-1
aws cloudfront create-invalidation --distribution-id E95171GX1I6HN --paths "/*" --region ap-south-1

# 4. Build + deploy Lambda (both envs)
cd D:\WFTPL\warmpawzApp\warmpawzaws\backend\lambda
npm run build:bundle
Remove-Item "dist\handler.zip" -Force -ErrorAction SilentlyContinue
Compress-Archive -Path "dist\handler.js" -DestinationPath "dist\handler.zip" -Force
aws lambda update-function-code --function-name warmpawz-prod-api-handler --zip-file fileb://dist/handler.zip --region ap-south-1
aws lambda update-function-code --function-name warmpawz-api-dev-api --zip-file fileb://dist/handler.zip --region ap-south-1
```

### AWS Resources
| Resource | Prod | Dev/UAT |
|---|---|---|
| S3 Bucket | `warmpawz-prod-vendor-frontend-ap-south-1` | `warmpawz-dev-vendor-frontend-ap-south-1` |
| CloudFront | `E3JDHOY1XIFOWE` | `E95171GX1I6HN` |
| CloudFront URL | `https://d1y5ywletev82x.cloudfront.net` | `https://d1s6ykkj381k58.cloudfront.net` |
| API Gateway | `https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com` | `https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com` |
| Lambda | `warmpawz-prod-api-handler` | `warmpawz-api-dev-api` |

---

## 11. Verification Steps

### Manual Test Procedure
1. Log in as vendor on vendor-web
2. Go to Services page
3. Enable 1 service
4. Open browser DevTools → Network tab
5. Click "Publish"
6. **Expected:** 1-2 API calls (save dirty + bulk-publish), NOT 144
7. Verify the specific service shows `publish_status: published`
8. Verify no other services were changed

### API Verification
```powershell
# Verify single service update (1 call = 1 service)
$body = '{"is_enabled":true,"price":400,"duration":20}'
Invoke-RestMethod -Uri "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/vendor/$vendorId/services/$serviceId" -Method PUT -Body $body -ContentType "application/json"

# Verify bulk-publish (1 call = N services)
$bulkBody = @{ serviceIds = @("uuid1","uuid2"); publishStatus = "published" } | ConvertTo-Json
Invoke-RestMethod -Uri "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/vendor/$vendorId/services/bulk-publish" -Method POST -Body $bulkBody -ContentType "application/json"
```

---

## 12. Critical Rules for Cursor AI (Auto Mode)

1. **NEVER iterate over all services for save/publish** — always use `dirtyServiceIds` to determine what changed
2. **NEVER remove the `publishStatus !== 'published'` check** in `publishServices()` — this is the key optimization
3. **ALWAYS reset `dirtyServiceIds` to `new Set()` after `loadServices()` and `saveConfiguration()`**
4. **ALWAYS use `isValidVendorService()` before sending a PUT** — this prevents saving catalog-only entries
5. **Prefer `bulk-publish` endpoint** over individual PUTs for publishing — 1 API call vs N
6. **`toggleService()` saves immediately** — it should NOT set dirty flags or go through `saveConfiguration()`
7. **The `bulk-publish` endpoint expects `serviceIds` (array of vendor_services.id)** and `publishStatus` (string)
8. **Both prod and dev/UAT share the same codebase** — any fix must work in both environments

---

## 13. Summary Checklist for Re-implementation

- [ ] `dirtyServiceIds` state (Set<string>) initialized as empty
- [ ] Every price/duration/description/enable/disable function adds serviceId to dirty set
- [ ] `loadServices()` clears dirtyServiceIds
- [ ] `saveConfiguration()` checks `dirtyServiceIds.size === 0` and skips if empty
- [ ] `saveConfiguration()` only iterates dirty services, not all services
- [ ] `saveConfiguration()` clears `dirtyServiceIds` after successful save
- [ ] `publishServices()` filters out `publishStatus === 'published'`
- [ ] `publishServices()` uses `bulk-publish` endpoint with `{ serviceIds, publishStatus }`
- [ ] `publishServices()` has fallback to individual PUTs if bulk-publish fails
- [ ] `isValidVendorService()` prevents catalog-only, temp, or invalid IDs from being saved
- [ ] Backend `bulk-publish` endpoint exists at `POST /vendor/:vendorId/services/bulk-publish`
- [ ] Backend single PUT has count safeguards to prevent accidental mass updates
