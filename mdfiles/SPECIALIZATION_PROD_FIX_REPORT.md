_Reference document only — no deployment performed_

# Specialization & Service-Style Mapping — Prod Issue Report

Date: 2026-04-28
Author: Pranay (with AI assistance)
Scope: Walker, Boarding, Training, Nutrition, Pet Sitter (customer app)
Branch: `dev-pranay`

---

## 1. Symptoms reported by user

1. Specialization tiles ("Custom Diet", "Senior Pet", "Basic Obedience", etc.) configured in Admin do not appear under the matching service hub in the customer app on **prod** (Walker, Boarding, Training, Nutrition, Pet Sitter).
2. When a tile *does* open, the "by-problem" providers screen renders **"No providers found"** even though the vendor has the specialization saved.
3. The "service style" choices on the Specialization → Style screen show all three styles (At Home / At Center / Video Call) instead of intersecting with what the role allows in Admin.
4. All three issues are **not reproducible in local & dev** — the same admin data and vendors work there.

---

## 2. Architecture in one diagram

```text
ADMIN (Catalog → Specializations)
   │ writes  specialization_master(applicable_roles, allowed_service_styles, show_in_problem_grid)
   │ writes  roles(config.serviceStyles.selected = ['at_home','at_center'…])
   ▼

VENDOR APP  (Profile → My specializations)
   │ writes  vendors.specializations  (JSONB array, e.g. ["custom_diet","senior_pet"])
   │ writes  vendor_specializations(vendor_id, specialization)   ← mirror table
   ▼

CUSTOMER APP                                                                BACKEND ENDPOINT
─────────────────────────────────                                           ──────────────────────────────────
Service hub (Walker / Training / Nutrition …)
  └─ useProblemGridByRole('trainer')                   →  GET /public/problem-grid/:roleId
                                                          (specialization-master.ts)
Tile click → ProblemGridFlowRouter
  ├─ fetchProblemDetails                               →  GET /public/problems?roleId=X
  │                                                       (problem-grid.ts)
  └─ fetchProviders                                    →  GET /customer/services/by-problem?problemId=Y&serviceStyle=Z
                                                          (problem-grid.ts)
DietConsultationVendors                                →  GET /customer/services/by-style?style=tele&category=…
                                                          (service-discovery.customer.ts)
```

The three customer endpoints all read `specialization_master` + `vendors.specializations` + `vendor_specializations` and filter by role + style. **All three were producing wrong joins for prod data shapes.**

---

## 3. Root causes (why prod ≠ dev)

The data in prod is *not* malformed — admin and vendors saved everything correctly. The mismatch is purely in how the API queries those tables.

### 3.1 Role overlap that returns nothing for base role keys

`expandRoleIdsForOverlap` (specialization-master.ts) maps a role string to its sibling list before the SQL `applicable_roles && $1::text[]` overlap. In prod, the customer hub for Trainer/Groomer/Behaviorist sends the **base** role key first (`trainer`, `groomer`, `behaviourist`):

```12:33:apps/customer-web/lib/problem-grid-role-aliases.ts
const VET = ['veterinarian', 'vet_solo', 'vet_clinic', 'vet_center', 'pet_clinic'] as const;
const GROOMER = ['groomer', 'groomer_solo', 'groomer_center', 'pet_groomer'] as const;
const TRAINER = ['trainer', 'trainer_solo', 'trainer_center', 'pet_trainer'] as const;
const WALKER = ['walker', 'pet_walker', 'walker_solo'] as const;
```

The previous `ROLE_EXPANSIONS` map had **no entry** for the base keys `trainer`, `groomer`, `behaviorist`, `behaviourist`, nor for the variants `walker_solo`, `boarding_solo`, `boarding_center`, `nutritionist_solo`, `vet_center`, `pet_clinic`, `behaviourist_solo`. For those, `expandRoleIdsForOverlap` returned **just `[input]`**, so the SQL `applicable_roles && ['trainer']::text[]` matched zero rows when prod admin had stored `applicable_roles = ['trainer_solo','trainer_center','pet_trainer']` (which is the standard).

Why dev works: dev specializations were seeded with `['trainer']` directly in `applicable_roles`, so the original `$1 = ANY(applicable_roles)` form happened to match. Prod uses the strict-by-role form `[*_solo, *_center, pet_*]`, so the overlap test missed.

### 3.2 Specialization key normalization

Vendors save specializations with mixed casing/punctuation:
- `vendors.specializations` JSONB → `["Custom Diet","Senior Pet"]` (display form, captured before slugification)
- `vendor_specializations.specialization` → sometimes `"custom_diet"`, sometimes `"Custom Diet"`
- `specialization_master.specialization_id` is always the slug (`custom_diet`)

The customer app sends `problemId = 'custom_diet'` (the slug). The original SQL used:

```sql
WHERE specialization = ANY($1::text[])
```

In prod, vendor rows storing `"Custom Diet"` never matched the slug `custom_diet`, so the discovery endpoint returned 0 vendors → "No providers found".

### 3.3 Role config service-style intersection always falling back to all 3

`getRoleAllowedStylesForProblemGrid(roleId)` looks up the `roles` table to read `config.serviceStyles.selected`. It also called `expandRoleIdsForOverlap`, so when the customer sent `trainer`/`groomer`/`behaviourist` (no expansion entry), the lookup found no matching role row and silently returned the default `['at_home','at_center','tele']`. The Specialization → Style screen therefore showed all three buttons regardless of admin config. In dev the role row was named `trainer` (matched directly) so it appeared correct.

### 3.4 Customer app fallback hard-coded styles

`apps/customer-web/components/customer/ProblemGridFlowRouter.tsx` previously had three separate places that set `setAllowedServiceStyles(['at_home', 'at_center'])` whenever a fetch failed or returned an empty list. Even when `sanitizeCustomerAllowedServiceStyles` produced the correct restricted list (e.g. Walker → `['at_home']`), these fallbacks could overwrite it with `['at_home','at_center']`, exposing buttons the role didn't allow.

### 3.5 Nutrition tele endpoint single-source

`DietConsultationVendors.tsx` called only one tele endpoint variant (`category=nutritionist&roleId=nutritionist`). In prod, vendor rows for nutrition diet consultation are stored with mixed `vendor_services.category` values (`nutrition`, `pet_nutritionist`, sometimes empty). One endpoint shape misses them.

### 3.6 (Note, not a bug, but explains a side log) Lambda environment

`backend/lambda/serverless.yml` sets `NODE_ENV: ${stage}` so on prod the value is `prod`, not `production`. The check in `problem-grid.ts` for "is production" treats prod as dev/UAT and includes vendors with `status = 'pending'`. This is intentional for permissiveness and is **not** the cause of "No providers found" — but worth noting if you ever want a stricter prod gate, set Lambda env `ENVIRONMENT=prod` (or `STAGE=prod`).

---

## 4. Fix (already applied locally, ready to ship)

All fixes are in the **dev-pranay** working tree, in five files. No DB migration is needed; no infra change is needed.

### 4.1 backend/lambda/src/endpoints/specialization-master.ts

- **`ROLE_EXPANSIONS`** now contains entries for **every** customer-app alias: base role keys (`trainer`, `groomer`, `behaviorist`, `behaviourist`, `vet`, `walker`, `boarding`, `nutritionist`) **and** every variant the customer iterates through (`walker_solo`, `boarding_solo`, `boarding_center`, `nutritionist_solo`, `vet_center`, `pet_clinic`, `behaviourist_solo`, `behavioral`). Each variant resolves to the same expansion set, so `applicable_roles && $1::text[]` is symmetric.
- **`/public/problem-grid/:roleId`** SQL changed from `$1 = ANY(applicable_roles)` to:

  ```sql
  AND (
    sm.applicable_roles = '{}'
    OR sm.applicable_roles IS NULL
    OR array_length(sm.applicable_roles, 1) IS NULL
    OR sm.applicable_roles && $1::text[]
  )
  ```

  This (a) accepts specs with empty `applicable_roles` (admin can omit roles for "global" specs) and (b) uses array overlap so any sibling role match counts.
- **`allowedServiceStyles`** in the response is now intersected with `getRoleAllowedStylesForProblemGrid(roleId)` (which reads `roles.config.serviceStyles.selected`). So if Admin says Walker = "At Home" only, the customer app sees only "At Home", regardless of what the per-spec default is.
- **`normalizeStylesForCustomer`** + **`STYLE_ALIAS_TO_CANONICAL`** centralize aliasing (`at_clinic`, `at_vendor`, `online`, `video_consultation` → canonical `at_home/at_center/tele`).

### 4.2 backend/lambda/src/endpoints/problem-grid.ts

- **`pgExpandRoleAliases`** rewritten so every variant in a role family resolves to the same group (same as `ROLE_EXPANSIONS` above). Used by `/public/problems` and the role-config style intersection.
- **`pushSpecializationKeyVariants`** + **`normalizeSpecializationKey`** added. We build a key set that contains every reasonable spelling of the requested `problemId`:
  - lowercased trim
  - dashes/spaces → underscores
  - all alternates from `specialization_master` (specialization_id, name, display_name) for that problem
- **`/customer/services/by-problem`** SQL now matches against vendors using:

  ```sql
  WHERE LOWER(TRIM(spec)) = ANY($N::text[])
     OR regexp_replace(LOWER(TRIM(spec)), '[[:space:]-]+', '_', 'g') = ANY($N::text[])
  ```

  applied to **all three** specialization sources: `vendors.specializations` JSONB, `vendor_specializations` table, and `vendors.metadata->'specializations'`. This recovers vendors that saved `"Custom Diet"`, `"custom-diet"`, `"Custom_Diet"`, etc.
- The **role-aliases lookup** in /public/problems now also matches `roles.name` with underscores OR spaces.

### 4.3 apps/customer-web/components/customer/ProblemGridFlowRouter.tsx

- All three fallback branches now run the result through `sanitizeCustomerAllowedServiceStyles` with the role/spec/category context — instead of hard-coding `['at_home','at_center']`. Walker only ever shows "At Home"; Boarding only "At Center"; Trainer/Groomer drop "Video Call"; etc.

### 4.4 apps/customer-web/components/customer/nutrition/DietConsultationVendors.tsx

- Diet tele list now fans out to four endpoint shapes in parallel and merges results by vendor id. Captures vendors saved under `category=nutritionist`, `category=nutrition`, and the older `discover-services` endpoint shape.

### 4.5 apps/admin-web/tsconfig.json

- Cosmetic only: includes the per-user Next.js types directory so admin builds don't trip in this dev environment. No runtime change.

---

## 5. Local vs Dev vs Prod — what works where (current)

| Symptom | Local | Dev | Prod |
| --- | --- | --- | --- |
| Walker hub shows admin-created specs | ✅ | ✅ | ❌ until backend deployed (4.1, 4.2) |
| Training hub shows "Basic Obedience" | ✅ | ✅ | ❌ until backend deployed |
| Nutrition hub shows "Custom Diet" / "Senior Pet" | ✅ | ✅ | ❌ until backend deployed |
| Pet Sitter hub shows specs | ✅ | ✅ | ❌ until backend deployed |
| Boarding hub shows specs | ✅ | ✅ | ❌ until backend deployed |
| Tile click → vendor appears (vendor saved spec correctly) | ✅ | ✅ | ❌ until backend deployed |
| Style screen respects role config (At Home / At Center / Video Call) | ✅ | ✅ | ❌ until backend + customer-web deployed |
| Tele Diet vendor list complete | ✅ | ✅ | ❌ until customer-web deployed (4.4) |
| Walker style buttons restricted to "At Home" | ✅ | ✅ | ❌ until customer-web deployed (4.3) |

**What passed in dev but would fail in prod even with old code:**
*nothing* — the 5.1/5.3 expansion bug was latent everywhere; it just happened that dev DB rows had role keys the old code matched. So the deploy plan is simple: ship all five files together.

---

## 6. Verification plan (do these in prod after deploy — _no deploy now_)

1. **Specialization listing endpoints**

   ```bash
   curl "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/public/problem-grid/trainer" | jq '.problems | length'
   curl "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/public/problem-grid/walker" | jq '.problems | length'
   curl "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/public/problem-grid/nutritionist" | jq '.problems | length'
   curl "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/public/problem-grid/boarding" | jq '.problems | length'
   curl "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/public/problem-grid/pet_sitter" | jq '.problems | length'
   ```

   All five should be > 0 and match the count in Admin → Catalog → Specializations for that role.

2. **Allowed-service-styles intersection**

   ```bash
   curl "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/public/problem-grid/walker" \
     | jq '.problems[] | {id, allowedServiceStyles}'
   ```

   Every row should be `["at_home"]` (since Walker's role config in prod admin = at_home only).

3. **By-problem providers**

   For a known prod vendor that has `custom_diet` in its specializations:

   ```bash
   curl "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/customer/services/by-problem?problemId=custom_diet&serviceStyle=tele" \
     | jq '{total, providers: [.providers[].vendorId]}'
   ```

   Should return that vendor. Repeat with `senior_pet`, `basic_obedience`.

4. **Customer app smoke tests** (https://customer.warmpawz.com or current prod CF URL):
   - Open Walker → tile grid populates with admin-created tiles. Open one → shows providers.
   - Open Training → tile grid populates with `basic_obedience` etc. Click → providers.
   - Open Nutrition → `custom_diet`, `senior_pet` tiles visible. Click → providers (+ Diet consultation tele card lists vendors).
   - Open Pet Sitter → tile grid populates.
   - Open Boarding → tile grid populates.

5. **Service-style buttons** — in any of the above, the Specialization → Style screen must only show the styles configured for the role in Admin → Roles → Pet Walker / Trainer / etc.

---

## 7. Deployment plan (when you're ready — explicitly NOT executed now)

Per `.cursor/rules/deployment.mdc` the only allowed deploy paths are the `scripts/deploy-*.sh` scripts.

```bash
# 1. Backend → prod Lambda (ap-south-1)
LAMBDA_FUNCTION_NAME=warmpawz-prod-api-handler ./scripts/deploy-lambda-direct.sh

# 2. Customer web → prod
./prodscripts/deploy-customer-web-prod.sh
```

No DB migration is required — `specialization_master`, `vendors.specializations`, `vendor_specializations`, `roles.config` already exist in prod (migrations 505 / 559 / 625 / 074b apply elsewhere). The backend simply queries them more permissively.

After deploy, run the verification curls in §6, then a smoke pass through the 5 hubs.

If anything in §6 step 1 returns 0 for a role, **not** a code issue — that means Admin → Catalog → Specializations has no rows for that role with `show_in_problem_grid = true`. Run:

```sql
SELECT specialization_id, name, applicable_roles, show_in_problem_grid, is_active
FROM specialization_master
WHERE 'trainer' = ANY(applicable_roles)
   OR 'trainer_solo' = ANY(applicable_roles)
   OR 'trainer_center' = ANY(applicable_roles)
   OR 'pet_trainer' = ANY(applicable_roles)
ORDER BY display_order;
```

to confirm.

---

## 8. Files changed in this session

| File | Lines | Reason |
| --- | --- | --- |
| `backend/lambda/src/endpoints/specialization-master.ts` | ~+115 / ~-15 | Role-overlap expansion completed; allowed-styles intersected with role config; canonical style aliasing |
| `backend/lambda/src/endpoints/problem-grid.ts` | ~+170 / ~-10 | Specialization key variant matching across all three vendor specialization sources; role-aliases for /public/problems |
| `apps/customer-web/components/customer/ProblemGridFlowRouter.tsx` | ~+15 / ~-5 | Style fallbacks routed through sanitizer instead of hard-coded |
| `apps/customer-web/components/customer/nutrition/DietConsultationVendors.tsx` | ~+30 / ~-15 | Multi-endpoint nutrition tele discovery |
| `apps/admin-web/tsconfig.json` | +2 | Cosmetic include path (this dev env only) |

— end of report —
