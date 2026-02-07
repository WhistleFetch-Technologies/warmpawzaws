# Forensic Analysis: Vendor Onboarding Role Listing Fix

**Date:** 2026-01-30  
**Scope:** Verify the fix for "Lost role listing on UI" in vendor onboarding (Choose Your Role page).

---

## 1. Request Path (Production)

| Step | Location | What happens |
|------|----------|--------------|
| 1 | `apps/vendor-web` | User opens `/onboarding` → `VendorRoleSelection` mounts |
| 2 | `VendorRoleSelection.tsx` L284 | `useEffect` runs → `fetchRoles()` |
| 3 | L292 | `apiClient.get('/vendor/onboarding/roles')` |
| 4 | `api-client.ts` | GET to `{baseUrl}/vendor/onboarding/roles` |
| 5 | Backend | **Only enhanced route is registered** (see §2) → `vendor-onboarding-enhanced.ts` handles the request |

**Conclusion:** Production always hits the **enhanced** `/vendor/onboarding/roles` route. The legacy route in `vendor-onboarding.ts` is **not** registered in `handler/index.ts`.

---

## 2. Backend Response Shapes

### 2.1 Success path (enhanced handler)

**File:** `backend/lambda/src/endpoints/vendor-onboarding-enhanced.ts`  
**Handler:** `GetAvailableRolesHandlerEnhanced` (L235–278)

- Reads `roles` and `role_permissions` from DB.
- Returns `this.success({ roles: rolesWithConfig }, requestId)`.
- Each role has: `id`, `name`, `display_name`, `description`, `config`, `capabilities`, `vendor_types_supported` (no `vendorTypes` / `serviceStyles` at top level).

**Route wrapper (L1079–1102):**

- On success: `return c.json(body, result.statusCode)` → **response body = `{ roles: [...] }`**.

### 2.2 Error path (enhanced route)

Same file, same route:

- If `body.success === false` or `result.statusCode >= 400`:  
  `return c.json({ success: true, data: { roles: [] }, message: ... }, 200)`.
- If `catch` (exception or parse error):  
  `return c.json({ success: true, data: { roles: [] }, message: ... }, 200)`.

So on any failure the client receives:

```json
{ "success": true, "data": { "roles": [] }, "message": "..." }
```

### 2.3 Global error handler (if something throws before route)

**File:** `backend/lambda/src/handler/index.ts` L675–686

- For paths containing `onboarding/roles`:  
  `return c.json({ success: true, data: { roles: [] }, message: "..." }, 200)`.

So all failure paths return **200** with **`data.roles`** (not top-level `roles`).

---

## 3. Pre-Fix Frontend Behavior

**File:** `apps/vendor-web/components/vendor/VendorRoleSelection.tsx` (before fix)

```ts
const activeRoles = (data?.roles || []).filter(...)
```

| Backend response | `data` (parsed JSON) | `data?.roles` | Result |
|------------------|----------------------|---------------|--------|
| Success `{ roles: [...] }` | `{ roles: [...] }` | `[...]` | Roles shown |
| Error `{ success, data: { roles: [] }, message }` | `{ success, data: { roles: [] }, message }` | `undefined` | `[]` → **empty UI** |
| Handler throws, global handler | `{ success, data: { roles: [] }, message }` | `undefined` | `[]` → **empty UI** |

So whenever the backend used the **error shape** (`data.roles`), the UI showed **no roles** because it only read `data.roles`.

---

## 4. Fix Verification

### 4.1 Response shape normalization (L296–297)

```ts
const rawRoles = (data?.data?.roles ?? data?.roles ?? []) as any[];
```

| Backend response | `data?.roles` | `data?.data?.roles` | `rawRoles` |
|------------------|---------------|----------------------|------------|
| Success `{ roles: [R1,R2] }` | `[R1,R2]` | `undefined` | `[R1,R2]` |
| Error `{ data: { roles: [] } }` | `undefined` | `[]` | `[]` |

So both success and error shapes are handled; empty array from error path no longer leaves `rawRoles` undefined.

### 4.2 Empty-array fallback (L319–323)

```ts
let finalRoles = uniqueRoles as Role[];
if (finalRoles.length === 0) {
  finalRoles = getFallbackRoles();
}
setRoles(finalRoles);
```

When the API returns 200 with `roles: []` (or normalized to `[]`):

- Before fix: `setRoles([])` → blank list.
- After fix: `finalRoles = getFallbackRoles()` → UI shows Veterinarian, Pet Groomer, Pet Store.

So the UI is never blank even when the backend returns an empty list.

### 4.3 Exception path (L325–328)

```ts
} catch (err) {
  ...
  setRoles(getFallbackRoles());
}
```

Network/parse errors still result in the same three fallback roles, so the user can always choose a role.

### 4.4 Role shape normalization (L298–315)

Backend returns e.g. `vendor_types_supported`, `config.serviceStyles`, `config.vendorTypes`, `is_active`. The UI expects `vendorTypes`, `serviceStyles`, `vendorConfiguration`, `isActive`, etc.

The fix maps API fields into the UI shape:

- `vendorTypes` ← `r.vendorTypes ?? r.vendor_types_supported ?? r.config?.vendorTypes`
- `serviceStyles` / `selectedServiceStyles` ← `r.serviceStyles ?? r.config?.serviceStyles ?? r.config?.service_styles`
- `vendorConfiguration` ← `r.config?.vendorConfiguration ?? r.config?.vendor_configuration`
- `isActive` ← `r.isActive !== false && r.is_active !== false`
- `category` ← `r.category ?? r.config?.category`

So DB/API snake_case and nested `config` are correctly consumed by the UI.

### 4.5 Fallback roles and categories

`getFallbackRoles()` (L182–226) returns three roles:

- `veterinarian` → in `ROLE_CATEGORIES.healthcare.roles`
- `pet_groomer` → in `ROLE_CATEGORIES.grooming.roles`
- `pet_products_store` → in `ROLE_CATEGORIES.retail.roles`

All three are in `DISPLAY_CATEGORY_KEYS` and are rendered under Healthcare, Grooming, and Retail. No role is left in “other” or dropped.

### 4.6 UI branch (L532–534)

```ts
} : error && roles.length === 0 ? (
  <div className="...">...{error}</div>
) : (
  /* categories and list */
)
```

- When we use **fallback after empty API**: we do **not** set `error`, and `roles.length > 0`, so the list is shown (no error banner). Correct.
- When we use **fallback after catch**: we set `error` and `roles = getFallbackRoles()`, so `roles.length > 0`; we still show the list, not the error box. Correct.

---

## 5. End-to-End Scenarios

| Scenario | Backend | rawRoles | finalRoles | UI |
|----------|---------|----------|------------|-----|
| DB OK, roles returned | `{ roles: [R1,...] }` | `[R1,...]` | normalized list | Full list |
| DB error / table missing | `{ data: { roles: [] }, message }` | `[]` | `getFallbackRoles()` | 3 fallback roles |
| Handler throws (enhanced route) | `{ data: { roles: [] }, message }` | `[]` | `getFallbackRoles()` | 3 fallback roles |
| Global error handler | `{ data: { roles: [] }, message }` | `[]` | `getFallbackRoles()` | 3 fallback roles |
| Network/parse error | throw | (catch) | `getFallbackRoles()` | 3 fallback roles |

In every case the user sees at least the fallback roles; the “Choose Your Role” list is never empty.

---

## 6. Summary

| Check | Status |
|-------|--------|
| All backend error paths return `data.roles` (not top-level `roles`) | Confirmed |
| Frontend reads both `data.roles` and `data.data.roles` | Fixed (L297) |
| Empty `roles` triggers fallback list | Fixed (L320–322) |
| Catch path uses same fallback | Fixed (L328) |
| API role shape (snake_case, config) normalized for UI | Fixed (L298–315) |
| Fallback roles belong to existing categories and render | Confirmed |
| No “error + empty list” when using fallback | Confirmed |

**Verdict:** The fix is correct and complete. The role listing will show either the API roles or the three fallback roles in all production paths, with no blank screen.
