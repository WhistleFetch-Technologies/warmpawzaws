# Specialization / Catalog Flow – Forensic Verification & Systematic Testing

**Date:** 2026-01-29  
**Scope:** End-to-end linking of Catalog specializations to vendor selector, customer home grid, and service landings.

---

## 1. Forensic Verification (Code & Data Paths)

### 1.1 Backend Route Registration

| Check | Status | Detail |
|-------|--------|--------|
| `problem-grid.ts` exists | ✅ | Backend endpoint module |
| GET `/vendor/problem-grid-specializations/:roleId` | ✅ | Vendor specialization list (prefers `specialization_master`) |
| Vendor specs from `specialization_master` | ✅ | Query uses `show_in_vendor_profile` and `applicable_roles` |
| `specialization-master.ts` exists | ✅ | Admin + public endpoints |
| GET `/public/problem-grid` (no param) | ✅ | Customer home “all” problems; registered **before** `:roleId` |
| GET `/public/problem-grid/:roleId` | ✅ | Customer service landing problems by role |
| Filter by `show_in_problem_grid` | ✅ | Used in public problem-grid queries |
| Handler registration | ✅ | Both `registerProblemGridEndpoints(app)` and `registerSpecializationMasterEndpoints(app)` on main app |

### 1.2 Frontend API Paths and Response Shapes

| Component | Endpoint | Response shape | Fallback |
|-----------|----------|----------------|----------|
| **ProblemGridNavigation** | GET `/public/problem-grid` | `data.success`, `data.problems[]` | Hardcoded `ProblemGridSection` when API empty/fail |
| **HomeServiceLanding** | GET `/public/problem-grid/:roleId` | `data.success`, `data.problems[]` | `config.problems` from `SERVICE_CONFIGS` |
| **SpecializationSelector** | GET `/vendor/problem-grid-specializations/:roleId` | `data.specializations[]` | None (shows error/retry) |

### 1.3 CategoryId / RoleId Mappings

| Location | Mapping | Purpose |
|----------|---------|--------|
| **ProblemGridNavigation** | `CATEGORY_ID_TO_SLUG` (e.g. `veterinary` → `vet`, `veterinarian`) | Map API `categoryId` to UI category slug and `roleId` |
| **HomeServiceLanding** | `ROLE_ID_FOR_PROBLEM_GRID` (e.g. `pet_groomer` → `groomer`) | Map config `roleId` to API role for GET `/public/problem-grid/:roleId` |

### 1.4 Data Flow Summary

```
Admin Catalog (Categories tab)
  → POST/PUT /admin/specializations
  → specialization_master (DB)

Vendor profile specialization selector
  → GET /vendor/problem-grid-specializations/:roleId (problem-grid.ts)
  → specialization_master (primary) else problem_grid_mappings (fallback)

Customer home “What’s your need?”
  → GET /public/problem-grid (specialization-master.ts)
  → specialization_master (show_in_problem_grid = true)

Customer service landing “What do you need?”
  → GET /public/problem-grid/:roleId (specialization-master.ts)
  → specialization_master (show_in_problem_grid, role in applicable_roles)
```

---

## 2. Systematic Testing

### 2.1 Verification Script

**Script:** `scripts/verify-specialization-flow.js`

- **Code-only (no API):**  
  `node scripts/verify-specialization-flow.js`
- **With live API:**  
  `API_BASE_URL=https://<api-id>.execute-api.<region>.amazonaws.com node scripts/verify-specialization-flow.js`

**Latest run (code-only):** 15 passed, 0 failed, 1 skipped (live checks skipped when `API_BASE_URL` not set).

### 2.2 Builds

| Build | Result | Notes |
|-------|--------|--------|
| Backend `npm run build:bundle` (esbuild) | ✅ | Success; no errors in `problem-grid.ts` or `specialization-master.ts` |
| Backend `npm run build:ts` (tsc --noEmit) | ⚠️ | Pre-existing TS errors in other files (e.g. appointment-reminders, problem-grid-admin); **none in changed files** |
| Customer-web `npm run build` | ✅ | Success |

### 2.3 Existing Tests

| Test | Result | Notes |
|------|--------|------|
| `tests/uat-veterinary-flow-fixes.test.ts` (B2 specialization) | ⚠️ | Jest does not parse TypeScript (no ts-jest/transform); **pre-existing** |
| `tests/verify-uat-fixes.ts` | — | Expects `/vendor/problem-grid-specializations/veterinarian`; run with ts-node if needed |

### 2.4 Optional Live API Checks

When `API_BASE_URL` is set, the verification script asserts:

1. **GET /public/problem-grid** – 200, `success: true`, `problems` array.
2. **GET /public/problem-grid/groomer** – 200, `success: true`, `problems` array (length may be 0).
3. **GET /vendor/problem-grid-specializations/veterinarian** – 200, `success: true`, `specializations` array (length may be 0).

---

## 3. Checklist for New Specializations

1. **Admin:** Create category in Catalog → Categories if needed.
2. **Admin:** Add specialization under that category; set **Applicable roles** and **Show in Customer App** / **Show in Vendor Profile**.
3. **Vendor app:** Specialization appears in center/profile specialization selector for matching roles.
4. **Customer app:** Specialization appears in home “What’s your need?” and in the relevant service landing “What do you need?” when the role mapping matches.

---

## 4. Files Touched (Implementation)

- `backend/lambda/src/endpoints/problem-grid.ts` – Vendor specializations prefer `specialization_master`.
- `backend/lambda/src/endpoints/specialization-master.ts` – GET `/public/problem-grid` (all).
- `apps/vendor-web/components/vendor/SpecializationSelector.tsx` – Catalog icon (iconName/iconColor) support.
- `apps/customer-web/components/customer/ProblemGridNavigation.tsx` – Fetch from `/public/problem-grid`, fallback to hardcoded.
- `apps/customer-web/components/customer/home-services/HomeServiceLanding.tsx` – Fetch problems from `/public/problem-grid/:roleId`, fallback to config.
