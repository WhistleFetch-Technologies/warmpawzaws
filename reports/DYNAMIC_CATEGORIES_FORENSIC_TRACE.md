# Dynamic Category Updates – Forensic Code Trace

**Date:** 2026-01-29  
**Scope:** End-to-end trace of admin catalog → backend API → customer web (CustomerHomeComplete, ServiceDiscovery).

---

## 1. Backend: Route Registration & Handler

### 1.1 Lambda entry and route order

- **File:** `backend/lambda/src/handler/index.ts`
- **Line 72:** `import { registerServiceCatalogEndpoints } from '../endpoints/service-catalog';`
- **Line 404:** `registerServiceCatalogEndpoints(app);` — registered before parameterized `/customer/:customerId` so service-catalog routes are available.

### 1.2 Service catalog route order (Hono matches in registration order)

- **File:** `backend/lambda/src/endpoints/service-catalog.ts`
- **Line 90:** `app.get("/services", ...)`
- **Line 137:** `app.get("/services/:serviceId", ...)`
- **Line 195:** `app.get("/service-catalog/role/:roleId", ...)`
- **Line 351:** `app.get("/service-catalog/:serviceId", ...)` ← **matches `/service-catalog/categories` first** (serviceId = `"categories"`)
- **Line 433:** `app.get("/service-catalog/categories", ...)` ← never reached for path `/service-catalog/categories` when parameterized route is first

So **GET /service-catalog/categories** is handled by the **parameterized** handler at line 351.

### 1.3 Parameterized handler – "categories" branch (actual code path)

- **File:** `backend/lambda/src/endpoints/service-catalog.ts`
- **Lines 358–398:** `if (serviceId === 'categories') { ... }`

**Before fix:** This branch queried only `id`, `name`, `description` → **no `icon` or `icon_color`** for customer web.

**After fix:** This branch now runs the same payload as the dedicated categories handler:

- **SQL (lines 364–377):**
  - `id::text as id`
  - `COALESCE(category_id::text, '') as category_id`
  - `name::text as name`
  - `COALESCE(description::text, '') as description`
  - `COALESCE(icon::text, '') as icon`
  - `COALESCE(icon_color::text, 'text-gray-500') as icon_color`
  - `COALESCE(display_order::integer, 0) as display_order`
  - `COALESCE(created_at::text, '') as created_at`
  - `FROM service_categories`
  - `WHERE (is_active = true OR is_active IS NULL)`
  - `LIMIT 1000`

- **Response:** `{ success: true, categories: sorted, total: sorted.length }` (200). Sort by `display_order` then `name`.

### 1.4 Dedicated GET /service-catalog/categories handler (fallback path)

- **File:** `backend/lambda/src/endpoints/service-catalog.ts`
- **Lines 433–447:** Same SELECT (icon, icon_color, display_order, is_active), extra error handling (table exists, UUID/text conflicts). If route order were changed so this matched first, behavior would match the parameterized branch after the fix.

### 1.5 Global error handler for categories

- **File:** `backend/lambda/src/handler/index.ts`
- **Lines 607–614, 648:** Requests whose path includes `service-catalog/categories` are forced to return 200 with empty categories on error, so the front end never gets 5xx for this endpoint.

---

## 2. Customer Web: API client → categories request

### 2.1 API base URL

- **File:** `apps/customer-web/lib/api-client.ts`
- **Lines 27–34:** `getApiBaseUrl()` uses `window.__WARMPAWZ_RUNTIME_CONFIG__?.apiBaseUrl` or `process.env.NEXT_PUBLIC_API_BASE_URL`.

### 2.2 GET request construction

- **File:** `apps/customer-web/lib/api-client.ts`
- **Line 254–256:** `get<T>(endpoint, retryConfig?)` calls `this.request<T>(endpoint, { method: 'GET' }, retryConfig)`.
- **Lines 94–96:** `url = base + path` with `path = '/service-catalog/categories'` (single leading slash). So full URL is `{apiBaseUrl}/service-catalog/categories`.
- **Line 217:** On success, `return response.json()` — parsed JSON is returned to the caller.

---

## 3. Hook: useCustomerCategories

### 3.1 Invocation and fetch

- **File:** `apps/customer-web/hooks/useCustomerCategories.ts`
- **Line 81:** `const res = await apiClient.get<...>('/service-catalog/categories');`
- **Line 80:** `res` is the parsed JSON (e.g. `{ success, categories, total }`).

### 3.2 Response parsing

- **Line 80:** `const list = (res as any)?.categories ?? [];`
- **Line 82:** `setCategories(Array.isArray(list) ? list : []);`

So `categories` state is the raw API array: `{ id, category_id, name, description?, icon?, icon_color?, display_order?, created_at? }`.

### 3.3 Mapping to QuickServiceTile

- **Lines 84–94:** For each `cat` in `list`:
  - **Line 85:** `screen = categoryIdToScreen[cat.category_id] ?? cat.category_id` (see 3.5).
  - **Line 86:** `IconComponent = getIcon(cat.icon)` from `@/lib/icon-utils` (see 4.1).
  - **Lines 87–93:** One tile: `{ icon: IconComponent, label: cat.name || cat.category_id, color: iconColorToBg(cat.icon_color), screen, categoryId: cat.category_id }`.
- **Line 95:** `setQuickServiceTiles(tiles)`.

### 3.4 Error handling

- **Lines 96–100:** On catch: `setError(...)`, `setCategories([])`, `setQuickServiceTiles([])`. So on API failure the UI falls back to hardcoded lists.

### 3.5 category_id → screen mapping

- **File:** `apps/customer-web/hooks/useCustomerCategories.ts`
- **Lines 19–41:** `categoryIdToScreen` maps e.g. `veterinary` → `vet`, `grooming` → `grooming`, `marketplace` → `shop`, `walking` → `walker`, etc. Unmapped keys fall back to `cat.category_id`.

---

## 4. Icon resolution (icon-utils)

### 4.1 getIcon

- **File:** `apps/customer-web/lib/icon-utils.tsx`
- **Lines 53–57:** `getIcon(iconKey, fallback?)`:
  - Normalize: `key = iconKey.toLowerCase().replace(/[^a-z_]/g, '')` (e.g. `"Stethoscope"` → `"stethoscope"`).
  - Return `iconMap[key] || fallback || Package`.

### 4.2 iconMap entries used by categories

- **Lines 12–50:** Includes `stethoscope`, `scissors`, `shopping` (ShoppingBag), `graduationcap`, `health`/`stethoscope`, `medicine`/`pill`, `training`, `wheat`, `insurance`, `sparkles`, etc. Admin-set icon strings (e.g. `Stethoscope`) resolve to Lucide components; unknown keys fall back to `Package`.

---

## 5. CustomerHomeComplete: All Services grid

### 5.1 Hook and source list

- **File:** `apps/customer-web/components/customer/CustomerHomeComplete.tsx`
- **Line 24:** `import { useCustomerCategories } from '@/hooks/useCustomerCategories';`
- **Line 295:** `const { quickServiceTiles } = useCustomerCategories();`
- **Lines 297–324:** Hardcoded `quickServices` (Lucide icons, label, color, screen).
- **Line 331:** `const sourceQuickServices = quickServiceTiles.length > 0 ? quickServiceTiles : quickServices;`

So the grid source is API-driven when the API returns at least one category; otherwise hardcoded.

### 5.2 Geography / service launch filter

- **Lines 482–694:** `useEffect` with deps `[phone, refreshKey, quickServiceTiles.length]`:
  - **Line 494:** Initially `setFilteredQuickServices(sourceQuickServices)`.
  - If `phone` is set: fetches `/customer/profile` (city/state), then `/config/service-launch/customer?state=&city=`. From response builds `blockedServiceIds` and `comingSoonServiceIds` via `serviceScreenMap` (lines 577–614).
  - **Lines 664–672:** `filtered = sourceQuickServices.filter(service => !blockedServiceIds.has(service.screen))`, then each item gets `isComingSoon: comingSoonServiceIds.has(service.screen)`. `setFilteredQuickServices(withComingSoon.length > 0 ? withComingSoon : sourceQuickServices)`.
  - If no phone: **Line 692:** `setFilteredQuickServices(sourceQuickServices)`.

So `filteredQuickServices` is always derived from `sourceQuickServices` (dynamic or fallback), then optionally filtered by geography.

### 5.3 Render

- **Lines 1574–1582:** Count uses `(filteredQuickServices.length > 0 ? filteredQuickServices : sourceQuickServices).length`. Grid maps `(filteredQuickServices.length > 0 ? filteredQuickServices : sourceQuickServices)` and renders `service.icon`, `service.color`, `service.label`, `onNavigate?.(service.screen)`.

End-to-end: **Backend categories (with icon/icon_color) → useCustomerCategories → sourceQuickServices → (optional geography filter) → filteredQuickServices → grid.**

---

## 6. ServiceDiscovery: Category grid

### 6.1 Hook and display list

- **File:** `apps/customer-web/components/customer/ServiceDiscovery.tsx`
- **Line 8:** `import { useCustomerCategories } from '@/hooks/useCustomerCategories';`
- **Line 31:** `const { quickServiceTiles } = useCustomerCategories();`
- **Lines 68–77:** `displayCategories = quickServiceTiles.length > 0 ? quickServiceTiles.map(t => ({ id: t.categoryId, name: t.label, icon: t.icon, color: t.color })) : FALLBACK_CATEGORIES` (emoji fallback at lines 16–24).

### 6.2 Category grid render

- **Lines 96–115:** `displayCategories.map(category => ...)`:
  - **Line 100:** `onClick={() => setSelectedCategory(category.id)}` — `category.id` is `categoryId` (e.g. `vet`, `grooming`).
  - **Lines 103–108:** Icon: `typeof category.icon === 'string'` → render string (emoji); else `<category.icon className="w-10 h-10 text-gray-600" />` (Lucide).
  - **Line 111:** Label: `category.name`.

### 6.3 Vendor search after category selection

- **Lines 51–56:** `searchVendors` builds `category: selectedCategory || ''` and calls `apiClient.get(\`/customer/vendors/search?${params}\`)`. So the search uses the same `category_id` as the grid (e.g. `vet`, `grooming`).

### 6.4 Back header title

- **Line 132:** `displayCategories.find(c => c.id === selectedCategory)?.name` for the "Back" header (e.g. "Veterinary Services").

End-to-end: **Backend categories → useCustomerCategories → quickServiceTiles → displayCategories (or FALLBACK_CATEGORIES) → grid and vendor search.**

---

## 7. Data flow summary

| Stage | Location | Data shape |
|-------|----------|------------|
| DB | `service_categories` | id, category_id, name, description, icon, icon_color, display_order, is_active, created_at |
| Backend response | GET /service-catalog/categories (parameterized branch) | `{ success: true, categories: [...], total }` — each category has id, category_id, name, description, icon, icon_color, display_order, created_at |
| Hook state | useCustomerCategories | categories: ApiCategory[]; quickServiceTiles: { icon, label, color, screen, categoryId }[] |
| CustomerHomeComplete | sourceQuickServices → filteredQuickServices | Same tile shape; filtered by geography when logged in |
| ServiceDiscovery | displayCategories | { id: categoryId, name: label, icon, color } or fallback emoji list |

---

## 8. Fix applied (route order / parameterized branch)

- **Issue:** The parameterized route `/service-catalog/:serviceId` is registered before the specific route `/service-catalog/categories`, so GET `/service-catalog/categories` was handled by the parameterized handler. Its "categories" branch previously returned only `id`, `name`, `description` — no `icon` or `icon_color`.
- **Change:** In `backend/lambda/src/endpoints/service-catalog.ts`, the parameterized handler’s `if (serviceId === 'categories')` block was updated to run the same full SELECT (including icon, icon_color, display_order, is_active) and to return the same sorted payload as the dedicated categories handler. Customer web now receives icon and icon_color regardless of which route matches.

---

## 9. Verification checklist

- [x] Backend returns `icon`, `icon_color` on the actual code path (parameterized "categories" branch).
- [x] apiClient.get builds URL as `{baseUrl}/service-catalog/categories` and returns parsed JSON.
- [x] useCustomerCategories reads `res.categories`, maps to QuickServiceTile with getIcon(cat.icon) and iconColorToBg(cat.icon_color).
- [x] categoryIdToScreen maps category_id to screen for CustomerHomeComplete navigation.
- [x] CustomerHomeComplete uses sourceQuickServices (API or hardcoded), then geography filter → filteredQuickServices → grid.
- [x] ServiceDiscovery uses displayCategories (API tiles or FALLBACK_CATEGORIES), supports both string (emoji) and Lucide icon in render.
- [x] icon-utils getIcon normalizes key and resolves admin icon names (e.g. Stethoscope) to Lucide components.
