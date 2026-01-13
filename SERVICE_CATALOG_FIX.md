# Service Catalog UI Fix

## Issue Found
The Service Catalog tab was not showing services because it was using the wrong API endpoint.

## Problem
- Component was calling: `/service-catalog` (returns 404)
- Correct endpoint: `/admin/service-catalog` (returns 119 services)

## Fix Applied
Updated `ServiceCatalogTab.tsx` to use `/admin/service-catalog` endpoint.

## Services Status
✅ **119 services exist in database** (verified via API)
✅ **Services are properly structured** with:
- service_id, service_name, display_name
- category_id, category_name
- applicable_roles
- service_style (at_center, at_home, tele, delivery)
- base_price, duration_minutes
- status, publish_status

## Next Steps
1. Refresh the Admin UI page
2. Navigate to Catalog & Services → Service Catalog tab
3. Services should now be visible

## Verification
Run this in browser console to verify:
```javascript
const API_BASE = window.__WARMPAWZ_RUNTIME_CONFIG__?.apiBaseUrl;
fetch(`${API_BASE}/admin/service-catalog`)
  .then(r => r.json())
  .then(data => console.log('Services:', data.data?.length || 0));
```
