# Specializations Not Loading – Forensic Fix

**Date:** 2026-02-04  
**Issue:** Create/Edit Service modal shows "No specializations for this category and selected roles" after selecting Applicable Roles (e.g. Groomer (Center), Nutritionist (Center)).

---

## 1. Code trace

### UI → API

| Location | What happens |
|----------|--------------|
| **AddServiceModal.tsx** (Service Catalog tab) | `loadSpecializations(categoryIdVal, rolesArr)` builds `categoryId` + `roleIds` and calls `GET /admin/specializations?categoryId=...&roleIds=...`. Category comes from Parent Category dropdown (`/admin/catalog/categories` → `id` = UUID) or empty. Roles come from checkboxes; stored and sent as **canonical codes** via `toCanonicalRoleCode(role?.roleCode ?? role?.name)`. |
| **catalog/page.tsx** (Catalog page modal) | `loadSpecializationsForCatalog(catId, rolesArr)` same contract. Category from dropdown = `cat.id` (UUID from `/service-catalog/categories`). Roles from ROLES buttons; `toCanonicalRoleCode` must map display strings to codes. |

### Backend GET /admin/specializations

| Step | Logic |
|------|--------|
| Params | `categoryId` (optional), `roleIds` (comma-separated). |
| Role expansion | `expandRoleIdsForOverlap(roleIds)` normalizes and expands (e.g. `groomer_center` → groomer, pet_groomer, groomer_center, groomer_solo). |
| Category resolution | If `categoryId` looks like UUID or unknown slug → resolve via `service_categories` to slug. If no `categoryId` but `roleIds` → derive categories from `service_catalog` (WHERE applicable_roles && expandedRoleIds). |
| Query | `specialization_master` WHERE `is_active = true` AND (category filter) AND (role filter: `applicable_roles = '{}'` OR overlap with expandedRoleIds). |

### Possible failure points

1. **Category:** Frontend sent UUID; backend must resolve to slug. `specialization_master.category_id` is slug (e.g. `grooming`). Case mismatch (e.g. `Grooming` vs `grooming`) would return no rows.
2. **Roles:** Frontend must send canonical codes (e.g. `groomer_center`). Catalog page `toCanonicalRoleCode` was missing groomer/nutritionist mappings.
3. **Role filter:** Specs with `applicable_roles = '{}'` or NULL should match; we now treat NULL/empty explicitly.
4. **Empty result:** When category + role filter returned 0 rows, UI showed "No specializations" with no fallback.

---

## 2. Fixes applied

### Backend (`specialization-master.ts`)

- **Forensic logging:** Log incoming `categoryId`, `roleIdsRaw`, `expandedRoleIds`, resolved `effectiveCategoryId`, `categoriesFromRoles`, and `rowCount`.
- **Category match:** Category filter now uses case-insensitive match: `(sm.category_id = $N OR LOWER(sm.category_id) = LOWER($N))` (and equivalent for `ANY(...)`).
- **Role filter:** Explicitly allow NULL/empty: `(sm.applicable_roles = '{}' OR sm.applicable_roles IS NULL OR array_length(...) IS NULL OR sm.applicable_roles && $N::text[])`.
- **Fallback when 0 rows:** If we have a category (or categories from roles) and role filter returns 0 rows, run the same query **without** the role filter and return all active specializations for that category so the list is never empty when a category is selected.

### Frontend

- **AddServiceModal.tsx:** Already used `getCategorySlugForSpec` (slug from `/admin/catalog/categories`). Added dev logging of request params and error logging in `.catch()`.
- **catalog/page.tsx:**  
  - Added `getCategorySlugForSpec(catId)` using `categories` (from `/service-catalog/categories`: `id`, `category_id`). Request now sends **slug** as `categoryId` when available.  
  - Extended `toCanonicalRoleCode` with `groomer_center`, `groomer_solo`, `pet_groomer`, `nutritionist_center`, `nutritionist`, `pet_nutritionist` (and display variants).  
  - Added dev logging and `.catch()` logging for the specializations request.

---

## 3. API contract (reference)

- **Request:** `GET /admin/specializations?categoryId=<slug-or-uuid>&roleIds=<code1>,<code2>`  
  - `categoryId`: optional; slug (e.g. `grooming`) or UUID (resolved to slug via `service_categories`).  
  - `roleIds`: optional; comma-separated canonical codes (e.g. `groomer_center,nutritionist_center`).
- **Response:** `{ success, data: [...], specializations: [...], byCategory, total }`. Each item has `specializationId`, `name`, `displayName`, `categoryId`, `applicableRoles`, etc.
- **Behaviour:** If only `roleIds` is sent, categories are derived from `service_catalog` for those roles; then specs are filtered by those categories and role overlap. If both are sent, filter by resolved category and role overlap; if that yields 0 rows, fallback returns all specs for that category.

---

## 4. How to verify

1. **Backend:** Redeploy Lambda; check CloudWatch for `[SPEC-MASTER]` logs (incoming params, resolved category, row count, fallback use).
2. **Frontend:** In dev, open console; select category and roles in Create/Edit Service; confirm `[AddServiceModal]` / `[Catalog]` request URL and any error logs.
3. **UI:** Select a category (e.g. Grooming) and roles (e.g. Groomer (Center)); Specializations list should load. If role filter matches nothing, fallback should still show all specs for that category.

---

## 5. Data sources (for your reference)

| Data | Source |
|------|--------|
| Categories (Create/Edit in Service Catalog tab) | `GET /admin/catalog/categories` → `service_categories` (id, category_id, name, ...). |
| Categories (Catalog page modal) | `GET /service-catalog/categories` → same `service_categories` (id, category_id, name, ...). |
| Roles (both modals) | `GET /admin/roles` → roles table (roleCode, name, display_name, ...). |
| Specializations | `GET /admin/specializations?categoryId=&roleIds=` → `specialization_master` (category_id slug, applicable_roles array). |
| Categories-by-role (when no categoryId) | `service_catalog` DISTINCT category_id WHERE applicable_roles && expandedRoleIds. |
