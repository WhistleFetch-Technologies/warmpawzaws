# Root Cause Analysis - Service Catalog Issues

## Date: 2026-01-13

## CRITICAL ISSUES FOUND

### Issue 1: DUPLICATE ENDPOINTS - Multiple `/admin/service-catalog` GET handlers
**ROOT CAUSE**: Three different handlers for the same endpoint returning different data structures.

#### Endpoint Locations:
1. **service-catalog.ts:525** - GET `/admin/service-catalog` (Complex, hierarchical grouping, role filtering)
2. **admin-advanced.ts:1755** - GET `/admin/catalog/services` (Returns `services` key)
3. **admin-advanced.ts:4386** - GET `/admin/service-catalog` (Simple query, duplicate!)

#### Data Structure Conflicts:
- **service-catalog.ts:525**: Returns `{ success: true, services: [...], total, grouped, role }`
- **admin-advanced.ts:1755**: Returns `{ success: true, services: [...] }`
- **admin-advanced.ts:4386**: Returns `{ success: true, services: [...], total }`

**IMPACT**: The last registered handler (admin-advanced.ts:4386) wins, causing:
- Loss of hierarchical grouping feature
- Loss of role filtering
- Simple query without proper formatting
- UI gets wrong data structure

### Issue 2: DUPLICATE POST ENDPOINTS - Multiple service creation handlers

#### Endpoint Locations:
1. **service-catalog.ts:868** - POST `/admin/service-catalog`
   - Requires: `service_id`, `service_name`, `applicable_roles`
   - Creates with full validation
   
2. **admin-advanced.ts:1805** - POST `/admin/catalog/services`
   - Requires: `name`, `price`
   - Different field names (`name` vs `service_name`)
   - Sets `applicable_roles: []` (empty - WRONG!)

**IMPACT**: AddServiceModal uses `/admin/catalog/services` which:
- Uses different field names
- Sets `applicable_roles` to empty array
- Services created without role assignments
- Services won't appear for vendors

### Issue 3: UI Component uses wrong endpoint

**AddServiceModal.tsx:70**: `apiClient.post('/admin/catalog/services', formData)`

**ServiceCatalogTab.tsx:66**: Initially used `/service-catalog` (404), fixed to `/admin/service-catalog`

**IMPACT**: 
- Modal sends data to wrong endpoint
- Field name mismatch (name vs service_name)
- Services created but not properly linked to roles

### Issue 4: Missing data in response

**ServiceCatalogTab expects**: `data.data` array
**API returns**: `{ services: [...] }` or `{ data: [...] }`

Inconsistent response structure across endpoints.

## VENDOR SERVICE FLOW ISSUES

### Service Visibility Chain:
1. Admin creates service in `service_catalog` with `applicable_roles`
2. Vendor dashboard queries services by their role
3. Vendor enables services from catalog
4. Staff are assigned to enabled services
5. Customer sees services filtered by vendor role

### Current Breaks:
- ❌ Services created via modal have empty `applicable_roles`
- ❌ Vendors can't see these services (role filter excludes them)
- ❌ Duplicate endpoints cause wrong data structure
- ❌ UI expects different response format

## SOLUTION PLAN

### 1. Remove Duplicate Endpoints
- **KEEP**: service-catalog.ts:525 (GET /admin/service-catalog) - Most comprehensive
- **KEEP**: service-catalog.ts:868 (POST /admin/service-catalog) - Proper validation
- **REMOVE**: admin-advanced.ts:4386 (duplicate GET)
- **KEEP**: admin-advanced.ts:1755 (GET /admin/catalog/services) - Different path, OK
- **KEEP**: admin-advanced.ts:1805 (POST /admin/catalog/services) - Fix to match schema

### 2. Fix POST /admin/catalog/services endpoint
- Map `name` → `service_name`
- Parse `serviceType` → `service_style`
- Parse `duration` from string to int
- Generate proper `service_id`
- Set default `applicable_roles` based on category or require role selection

### 3. Fix AddServiceModal
- Add role selection field
- Map field names properly
- Add service_style options (at_center, at_home, tele, delivery)
- Ensure duration is sent as integer

### 4. Standardize Response Format
- All GET endpoints return: `{ success: true, data: [...] }` OR `{ services: [...] }`
- Choose one and update all

### 5. Update UI Components
- ServiceCatalogTab: Handle both response formats gracefully
- AddServiceModal: Send correct field names
- Add role selection to modal

## TESTING REQUIREMENTS

After fixes:
1. ✅ Admin creates service via modal → service appears in list
2. ✅ Service has proper applicable_roles
3. ✅ Vendor sees service in their catalog (role-filtered)
4. ✅ Vendor enables service
5. ✅ Staff can be assigned to service
6. ✅ Customer sees service from vendor

## FILES TO MODIFY

1. `backend/lambda/src/endpoints/admin-advanced.ts`
   - Line 4386: Remove duplicate GET /admin/service-catalog
   - Line 1805: Fix POST /admin/catalog/services field mapping
   
2. `backend/lambda/src/endpoints/service-catalog.ts`
   - Line 525: Ensure GET /admin/service-catalog returns `data` key consistently
   
3. `apps/admin-web/components/admin/catalog/AddServiceModal.tsx`
   - Add role selection field
   - Fix field names in handleSubmit
   - Add service_style options
   
4. `apps/admin-web/components/admin/catalog/ServiceCatalogTab.tsx`
   - Handle both response formats
   - Ensure proper data extraction

## PRIORITY

🔥 **CRITICAL** - Services being created but not visible to vendors
🔥 **CRITICAL** - Duplicate endpoints causing data structure conflicts
🚨 **HIGH** - UI/API field name mismatches
