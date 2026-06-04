# WarmPawz → Pidge Create Order (Meal Deliveries)

**Purpose:** Trace and **analyze** WarmPawz Pidge **Create Order** package design for meal deliveries: API field semantics, unit assumptions, dashboard mismatches (450 in³ / 0.5 kg), code ownership, risks, and a production-ready package strategy.

**Scope:** Analysis only (no code changes).  
**Last verified:** 2026-06-01 (prod RDS, Pidge help center, Postman reference link in repo, codebase).

**Primary API reference in repo:** [Pidge Integration APIs (Postman)](https://documenter.getpostman.com/view/13758726/2s93RKzFtk) — surfaced in `PidgeStoreChannelController.java`. Public help center does **not** publish per-field units for `packages[]`.

---

## 1. End-to-end flow

| Step | Component | What happens |
|------|-----------|--------------|
| 1 | Vendor UI | Vendor moves meal order to **Preparing** (Start Preparing). |
| 2 | Lambda | `PUT …/meal-orders/{id}/status` → `preparing` triggers dispatch. |
| 3 | `backend/lambda/src/utils/meal-dispatch.ts` | Loads `meal_orders` + `meal_plans` + vendor/customer addresses; builds **compact** `pidgePayload`. |
| 4 | Lambda → ECS | `POST {DELIVERY_SERVICE_BASE_URL}/logistics/meal/dispatch` body: `{ mealOrderId, prepMinutes, expectedReadyAt, pidgePayload }`. |
| 5 | `MealLogisticsDispatchService.java` | Idempotency check on `delivery_tracking`; calls `PidgeIntegrationService.createOrder(pidgePayload)`. |
| 6 | `PidgeOrderPayloadBuilder.java` | Transforms compact payload → **native** Pidge JSON (`trips[].packages`, `products`, etc.). |
| 7 | `PidgeIntegrationService.java` | `POST {pidgeBaseUrl}/v1.0/store/channel/vendor/order` with vendor store token. |
| 8 | Pidge | Returns order id → stored in `meal_orders.pidge_order_id` and `delivery_tracking.external_task_id`. |

**Pidge endpoint:** `POST /v1.0/store/channel/vendor/order`  
(`PidgeIntegrationService.CREATE_ORDER_PATH`)

**Meal orders omit brand:** Lambda sets `omit_brand: true` so the outgoing body has **no** `brand` object (store/vendor Pidge login).

---

## 2. Compact payload (Lambda → delivery-service)

Built in `dispatchMealOrderToPidge()` in `meal-dispatch.ts` when status becomes `preparing`.

### Weight source (meal product data)

1. `meal_plans.pack_weight_grams` (SQL column, preferred)
2. Else `meal_plans.dietary_requirements` JSON (`packWeightGrams`, `pack_weight_grams`, `weight_g`, or `packSize` like `"200g"`)
3. Else `meal_orders.purchase_snapshot` (`packWeightGrams` / `pack_weight_grams`)

If none found → dispatch **fails** with “no pack weight (grams)”.

**Line weight:** `lineWeightGrams = round(packWeightGrams × quantity)` (min 1).

### Compact `pidgePayload` shape (abbreviated)

```json
{
  "omit_brand": true,
  "sourceOrderId": "<order_number>",
  "sender": { "name", "mobile", "email", "address": { "address_line_1", "city", "state", "country", "pincode", "landmark", "lat", "lng" } },
  "receiver": { "name", "mobile", "email", "address": { ... } },
  "items": [
    {
      "name": "<plan_name>",
      "sku": "<meal_plan_id>",
      "price": <plan_price>,
      "quantity": <order_qty>,
      "weight_g": <lineWeightGrams>,
      "dead_weight": <lineWeightGrams>,
      "packWeightGrams": <lineWeightGrams>
    }
  ],
  "packageWeightGrams": <lineWeightGrams>,
  "totalWeightGrams": <lineWeightGrams>,
  "billAmount": <total_amount>,
  "codAmount": 0,
  "notes": [],
  "promised_prep_time": "<ISO>",
  "promised_delivery_time": "<ISO>",
  "delivery_date": "<optional>",
  "delivery_slot": "<optional>"
}
```

**Not in compact payload:** `length`, `breadth`, `height`, `volumetric_weight`, `package_size`, or vendor-level dimension settings.

### Logging gap

Lambda logs `[PIDGE DISPATCH]` with scheduling fields only — **not** package grams or dimensions.  
Java `MealLogisticsDispatchService` logs errors only — **not** the full outbound Pidge JSON.

---

## 3. Native Pidge payload (delivery-service → Pidge API)

Built by `PidgeOrderPayloadBuilder.buildFromSimplified()` (mirror: `backend/lambda/src/lib/services/pidge-logistics.ts` → `buildPidgeOrderPayloadFromSimplified`).

### Top-level structure

```json
{
  "channel": "<from PidgeProperties / defaults>",
  "sender_detail": { "name", "mobile", "email", "address": { ... } },
  "poc_detail": { "name", "mobile", "email" },
  "trips": [
    {
      "source_order_id": "<order_number>",
      "reference_id": "<order_number>",
      "receiver_detail": { "name", "mobile", "email", "address": { ... } },
      "bill_amount": <number>,
      "cod_amount": 0,
      "products": [ ... ],
      "packages": [ ... ],
      "notes": [],
      "promised_prep_time": "<ISO>",
      "promised_delivery_time": "<ISO>",
      "delivery_date": "<optional>",
      "delivery_slot": "<optional>"
    }
  ]
}
```

(No `brand` for meal dispatch.)

### `products[]` (from `items[]`)

| Field | Source |
|-------|--------|
| `name` | Item `name` / `product_name` / `"Item"` |
| `sku` | Item `sku` / `product_id` |
| `price` | Item `price` / `selling_price` / `unit_price` |
| `quantity` | Item `quantity` / `units` |
| `dimension.dead_weight` | First positive among: `dead_weight`, `weight_g`, `packWeightGrams`, `pack_weight_grams`, `weightGrams`, or `dimension.dead_weight`; else **100** |

**Meal path:** `dimension.dead_weight` = `lineWeightGrams` from meal plan (e.g. 200).

### `packages[]` (critical — dimensions & volumetric)

Populated in `packagesFromProducts()` (`PidgeOrderPayloadBuilder.java` ~312–331):

| Field | How it is set | Source type |
|-------|----------------|-------------|
| `label` | Product `name` | Derived from item |
| `quantity` | Product `quantity` | Order qty |
| `code` | Product `sku` (if non-empty) | Meal plan id |
| **`dead_weight`** | `round(dimension.dead_weight)` grams, min 1 | **Meal product** (`pack_weight_grams` × qty) |
| **`volumetric_weight`** | **Same value as `dead_weight`** (grams copied) | **Hardcoded logic** — not L×W×H |
| **`length`** | **Hardcoded `2`** | **Not** from catalog/vendor |
| **`breadth`** | **Hardcoded `2`** | **Not** from catalog/vendor |
| **`height`** | **Hardcoded `2`** | **Not** from catalog/vendor |

If `products` is empty, `defaultPackages()` uses `packageWeightGrams` / `totalWeightGrams` / etc. from input, else **500 g**, with the same **2×2×2** dims and `volumetric_weight = dead_weight`.

**There is no:**
- `meal_plans` length/breadth/height columns in this path
- Vendor settings for package size
- `package_size` or explicit `volume` field in the outbound JSON

---

## 4. Field provenance summary

| Field | Meal deliveries |
|-------|-----------------|
| `dead_weight` | **Meal product:** `meal_plans.pack_weight_grams` (× quantity), via Lambda `items[].weight_g` / `dead_weight` |
| `volumetric_weight` | **Hardcoded:** set equal to `dead_weight` (grams), **not** volumetric formula |
| `length`, `breadth`, `height` | **Hardcoded defaults:** `2`, `2`, `2` (units assumed by Pidge; not documented in WarmPawz) |
| Vendor settings | **Not used** for package dims/weight |
| Package size configuration | **Not implemented** for Pidge meal dispatch |

---

## 5. Order ML2606034554 (prod)

### RDS facts (2026-06-01)

| Field | Value |
|-------|--------|
| `order_number` | `ML2606034554` |
| `pidge_order_id` | `1780482811195A25I9J9S` |
| Plan | Veg Bowl |
| `pack_weight_grams` | **200** |
| `quantity` | **1** |
| `purchase_snapshot.packWeightGrams` | **200** |
| `total_amount` | 101.00 |

### Reconstructed values sent to Pidge

WarmPawz does **not** persist the outbound Create Order JSON. Values below are **reconstructed** from code + RDS (not from Pidge GET).

**Compact payload (Lambda → Java):**

- `items[0].weight_g` / `dead_weight` / `packWeightGrams`: **200**
- `packageWeightGrams` / `totalWeightGrams`: **200**

**Native payload (`trips[0].packages[0]`):**

```json
{
  "label": "Veg Bowl",
  "quantity": 1,
  "code": "<meal_plan_uuid>",
  "dead_weight": 200,
  "volumetric_weight": 200,
  "length": 2,
  "breadth": 2,
  "height": 2
}
```

**`trips[0].products[0].dimension.dead_weight`:** **200**

### How to confirm on Pidge

1. Pidge dashboard / API for order `1780482811195A25I9J9S`
2. `GET /v1.0/store/channel/vendor/order/{id}` via delivery-service or Postman
3. CloudWatch around dispatch time: `[meal-dispatch]` + delivery-service (no full body today)

---

## 6. Pidge API documentation review (field semantics & units)

### What is publicly documented

| Source | What it says about packages |
|--------|------------------------------|
| [Generate API Token](https://pidge.in/helpcenter/getting-started/generate-api-token) | At channel setup you set **Minimum Threshold for package weight** and **package volume**. These apply **when no information is added** on create-order. |
| [Create Orders (UI)](https://pidge.in/helpcenter/order/create-orders) | Manual “Add Package” in dashboard; no JSON field glossary. |
| Postman collection (repo link above) | Create-order body includes `trips[].packages[]` with `dead_weight`, `volumetric_weight`, `length`, `breadth`, `height`. **Per-field unit strings are not in the public Postman HTML export** — confirm in your tenant’s saved Postman examples or Pidge solutions contact. |
| WarmPawz code comments | Java builder mirrors TS; treats `dead_weight` path as **grams** (`pack_weight_grams` → `dead_weight`). **No comment on L/B/H unit.** |

### Inferred intended meaning (must confirm with Pidge account team)

| Field | Likely intent (industry + Pidge examples) | WarmPawz today | Confidence |
|-------|------------------------------------------|----------------|------------|
| **`dead_weight`** | Actual shipment weight; **grams** is standard for Indian aggregators when values are 200–500 range | Grams from `pack_weight_grams × quantity` | **High** (code + product model) |
| **`volumetric_weight`** | **Chargeable volumetric weight**, not “copy of dead weight”. Doc examples use **`450` with `dead_weight: 0`**, which aligns with **450 in³** as a nominal volume bucket (15×10×3 in), **not** 450 g | Set **equal to `dead_weight` in grams** (e.g. 200) | **Low** — likely **wrong unit/semantics** |
| **`length` / `breadth` / `height`** | Physical outer dimensions for volume calculation and rider handling | Hardcoded **2 / 2 / 2** | Unit **unknown** in WarmPawz; see §7 |

### Standard courier math (for comparison — not confirmed as Pidge’s formula)

Many Indian carriers use:

- Dimensions in **centimeters**
- Volumetric weight (kg) = `(L × B × H in cm) / 5000`
- Chargeable weight = `max(dead_weight_kg, volumetric_weight_kg)`

If Pidge instead stores **volume in cubic inches** in the dashboard (450 in³), a parallel pattern is:

- `volumetric_weight` in API = **volume in in³** (or a precomputed index), and **`dead_weight`** in **grams or kg** separately.

**Critical:** Until Pidge confirms, do not assume `volumetric_weight` is grams.

---

## 7. `volumetric_weight` — calculated, independent, or omitted?

| Approach | When it applies | WarmPawz meal path |
|----------|-----------------|-------------------|
| **Calculated from L×B×H** | Carrier derives volumetric weight from dimensions + divisor | **Not done** — dims are placeholders; volumetric is not computed |
| **Supplied independently** | Client sends `volumetric_weight` per Pidge rules (doc example: 450, dead 0) | **Done incorrectly** — copies dead grams |
| **Omitted when dimensions present** | Some APIs derive one from the other | **Not applicable** — both weight fields and dims are always sent |

**Finding:** WarmPawz should treat **`volumetric_weight` and `dead_weight` as separate concepts**. Doc-style payloads suggest **`volumetric_weight` carries the volumetric/chargeable volume index** (example **450**), while **`dead_weight` carries actual mass** (example **0** when volumetric dominates).

**Recommendation:** After Pidge confirms units:

1. Send **`dead_weight`** = actual grams (or kg if API requires kg).
2. Compute **`volumetric_weight`** from `(L,B,H)` using Pidge’s formula **or** map from a **package-size enum** to Pidge-approved volumetric values.
3. Do **not** set `volumetric_weight = dead_weight` unless Pidge explicitly documents that equivalence.

---

## 8. Dimension units (inches vs cm vs other)

| Evidence | Implication |
|----------|-------------|
| Dashboard label **“450 in³”** | Pidge **displays** volume in **cubic inches** |
| Doc example **`volumetric_weight: 450`** | Same numeric constant as **15×10×3 in³** — strong hint that **450 is a volume index in in³**, not grams |
| WarmPawz sends **`2×2×2`** | If **inches** → 8 in³ (absurdly small). If **cm** → 8 cm³ (also absurd). Either case is below any real meal bag |
| Shiprocket path in `logistics.ts` uses **cm-style defaults (10×10×10)** for a different partner | Shows WarmPawz knows partners differ; **Pidge path never inherited real dims** |

**Finding:** **`2×2×2` is not a credible meal package** in any common unit. Pidge is likely **rejecting or replacing** it with **channel minimum volume** (450 in³) configured at token creation.

**Recommendation:** Confirm with Pidge whether `length` / `breadth` / `height` are **cm** or **inches** (Postman sample or support ticket). Then store catalog dimensions in that unit (or cm + convert at dispatch).

---

## 9. Do hardcoded `2×2×2` dimensions cause default profiles / minimum chargeable weight?

**Yes — highly likely**, for three reinforcing reasons:

1. **Channel minimums (documented)**  
   Pidge token setup includes **minimum package weight** and **minimum package volume** when create-order omits package info. WarmPawz *does* send package info, but **invalid/trivial dimensions** may be treated as unusable, triggering the same floors.

2. **Numeric alignment with dashboard**  
   - **450 in³** = standard small-parcel bucket (15×10×3 in) — matches API example `volumetric_weight: 450`.  
   - **0.5 kg** = **500 g** — matches `defaultPackages()` fallback in `PidgeOrderPayloadBuilder` when weight resolution fails, **and** is a common **minimum weight threshold** at channel setup (not proven for your tenant without reading Pidge channel settings).

3. **Semantic mismatch amplifies floors**  
   Sending `volumetric_weight: 200` (grams) while UI expects a **volume index (~450 in³)** may cause Pidge to **discard** the volumetric field and apply defaults. Sending **`dead_weight: 200`** while a **500 g floor** exists yields dashboard **0.5 kg** = `max(200, 500)` g.

**ML2606034554:** RDS shows **200 g**; reconstructed API payload uses **200 / 200 / 2×2×2**. Dashboard **450 | 0.5 kg** is consistent with **Pidge channel floors + mis-specified volumetric/dims**, not with catalog weight.

**Verify:** In Pidge **Settings → Channel Integration**, read configured **minimum package weight/volume** for the vendor/store token used by Bindu Pet Nutrition. `GET` order `1780482811195A25I9J9S` and compare raw `packages[]` to reconstructed payload.

---

## 10. Meal dispatch code review — where dimensions should come from

### Current data model

| Data | Exists today? | Used in Pidge dispatch? |
|------|---------------|-------------------------|
| `meal_plans.pack_weight_grams` | Yes (`1021_meal_plans_structured_catalog.sql`) | Yes → `dead_weight` |
| `meal_plans.dietary_requirements.packWeightGrams` | Yes (legacy JSON) | Fallback for weight |
| `meal_orders.quantity` | Yes | Multiplies pack weight |
| `meal_plans.meals_per_delivery` | Yes (weekly plans) | **No** — not passed to Pidge |
| Package L/B/H or `package_size` | **No columns** | **No** — hardcoded 2×2×2 in Java builder |

### Dispatch touchpoints (all paths that build `packages[]`)

| Layer | File | Role |
|-------|------|------|
| Lambda compact payload | `backend/lambda/src/utils/meal-dispatch.ts` | Weight only in `items[]`; no dimensions |
| Java transform | `services/delivery-service/.../PidgeOrderPayloadBuilder.java` | **`packagesFromProducts()`** — sets volumetric + 2×2×2 |
| TS mirror (non-meal / generic) | `backend/lambda/src/lib/services/pidge-logistics.ts` | Same logic as Java |
| Meal HTTP entry | `MealLogisticsDispatchService.java` | Forwards compact payload to `createOrder` |
| Generic Pidge create | `backend/lambda/src/endpoints/logistics.ts` | Uses same builder for manual/API creates |

**Vendor settings:** No vendor-level package dimension configuration found for meals.

**Package size enum:** Not implemented. Closest precedent is **Shiprocket** defaults in `logistics.ts` (`10×10×10` for another partner) — not reused for Pidge meals.

### Should `meal_plans` store dimensions?

**Yes**, for production accuracy. Recommended columns (or JSON block):

- `package_length_cm`, `package_breadth_cm`, `package_height_cm` **or**
- `package_size_code` enum → lookup table of L/B/H + optional default volumetric index

Vendor UI already captures **pack weight (g)** via `meal-product.contract.ts`; dimensions should be added alongside (or derived from enum).

### Enum vs raw dimensions?

| Approach | Pros | Cons |
|----------|------|------|
| **XS/S/M/L enum** | Simple vendor UX; maps to tested Pidge profiles; consistent rider expectations | Less precise for custom packaging |
| **Raw cm per product** | Accurate for varied meal containers | Vendors may not know; needs validation bounds |
| **Hybrid** | Enum default + optional override cm | Slightly more UI work |

**Recommendation:** **Hybrid** — default enum per meal category (e.g. single bowl, multi-meal insulated bag), optional advanced override for enterprise vendors.

---

## 11. Production-ready package strategy (meals)

### Design principles

1. **One physical shipment = one `trips[]` entry** (current model) — keep for meal dispatch.
2. **`dead_weight`** = sum of actual food mass in grams for everything in the bag.
3. **`volumetric_weight`** = per Pidge contract (from dims or enum), **never** auto-copy of dead weight.
4. **`length` / `breadth` / `height`** = outer shipping dimensions in **Pidge’s required unit**.
5. **Chargeable display** on Pidge may still apply **channel minimums** — set channel thresholds ≤ smallest meal SKU or accept billing delta.

### A. Single meal (one pack, `quantity = 1`)

Example: ML2606034554 — 200 g Veg Bowl.

| Field | Strategy |
|-------|----------|
| `dead_weight` | `pack_weight_grams` (200) |
| Dimensions | From plan enum e.g. `MEAL_SINGLE_BOWL` → 20×15×8 cm (example — calibrate with Pidge) |
| `volumetric_weight` | Compute per Pidge formula from dims **or** enum’s pre-approved volumetric value (e.g. 450 if that is the correct in³ index for that box) |
| `packages[].quantity` | 1 |

### B. Multiple meals in one order (`quantity > 1` or `meals_per_delivery > 1`)

Today: `lineWeightGrams = pack_weight_grams × meal_orders.quantity` — **one package line** with aggregated weight but **still 2×2×2** dims.

| Option | Behavior | Recommendation |
|--------|----------|----------------|
| **Single package, scaled weight** | One bag, weight = N × pack weight, dims = “multi-meal” enum size | **Preferred** for one rider pickup of one bag |
| **N packages in `packages[]`** | N entries each with pack weight + single-meal dims | Use if kitchen packs **separate** insulated containers |
| **Use `meals_per_delivery`** | Weekly plan: 2 meals per drop | Multiply **weight** and use **larger enum** (e.g. `MEAL_DUAL_PACK`), even when `quantity` is 1 |

**Rule:** When `meals_per_delivery > 1` and order represents one delivery drop, set:

- `dead_weight = pack_weight_grams × meals_per_delivery` (if one bag), **or**
- multiple `packages[]` rows if physically separate.

Do **not** rely on `meal_orders.quantity` alone without defining what quantity means at checkout (packs vs meals).

### C. Subscription meal packs

- Each **`meal_orders` row** that goes to **Preparing** triggers **one** Pidge create (idempotent per order).
- Subscription does **not** batch multiple delivery days into one Pidge order in current code.
- **Strategy:** Same as (A) or (B) per order row; ensure **purchase_snapshot** copies `packWeightGrams` and future `packageSizeCode` at order time so dispatch does not depend on later catalog edits.

### Suggested package size enum (draft — calibrate with Pidge)

| Code | Typical use | Indicative outer dims (cm)* | Notes |
|------|-------------|-----------------------------|--------|
| `MEAL_XS` | Single small bowl ≤250 g | 18×13×6 | Light meals |
| `MEAL_S` | Single bowl 250–400 g | 20×15×8 | ML2606034554 class |
| `MEAL_M` | Large bowl / 2 cups | 22×18×10 | |
| `MEAL_L` | Dual-meal or family pack | 28×22×12 | Use when `meals_per_delivery ≥ 2` |
| `MEAL_INSULATED` | Cold chain / large subscription drop | 30×25×15 | |

\*Convert to Pidge’s unit before send; map each code to **`volumetric_weight`** per Pidge confirmation.

---

## 12. Risks (current design)

| Risk | Severity | Description |
|------|----------|-------------|
| **Under/over billing vs actual weight** | High | Dashboard 0.5 kg vs 200 g order → wrong courier rating, SLA, or customer fees |
| **Wrong rider / vehicle class** | Medium | Volume floors may allocate larger vehicle than needed |
| **Dispute support** | Medium | No persisted outbound `packages[]` JSON for audits |
| **Multi-meal orders mis-sized** | Medium | Weight scales; dimensions do not |
| **Regulatory / customer trust** | Low–Medium | Label shows 200 g product; courier manifest shows 500 g |
| **Cross-partner confusion** | Low | Developers may assume Shiprocket cm defaults apply to Pidge |

---

## 13. Recommended implementation approach (phased, no code in this doc)

### Phase 0 — Contract confirmation (1–2 days, Pidge + ops)

- [ ] Written confirmation: units for `dead_weight`, `volumetric_weight`, `length`, `breadth`, `height`.
- [ ] Formula for `volumetric_weight` from dimensions (or enum table from Pidge).
- [ ] Read **channel minimum weight/volume** on prod vendor token; document values (hypothesis: **500 g** and **450 in³**).

### Phase 1 — Data model & vendor UX

- [ ] Add `package_size_code` (enum) to `meal_plans` + Zod contract + vendor meal product form.
- [ ] Optional override: `package_length_cm`, `package_breadth_cm`, `package_height_cm`.
- [ ] Snapshot `packageSizeCode` + dims on `meal_orders.purchase_snapshot` at checkout.

### Phase 2 — Dispatch & builder

- [ ] `meal-dispatch.ts`: pass `packageSizeCode` or dims in compact payload.
- [ ] `PidgeOrderPayloadBuilder.packagesFromProducts()`: remove hardcoded 2×2×2; compute volumetric per Phase 0 formula.
- [ ] Align `pidge-logistics.ts` mirror.
- [ ] Incorporate `meals_per_delivery` in weight/dim logic.

### Phase 3 — Observability & verification

- [ ] Log `trips[0].packages` (redacted) on create-order.
- [ ] Support playbook: compare RDS `pack_weight_grams` vs Pidge GET order.
- [ ] Quote API (`/logistics/pidge/quote`) spot-check before/after for Bindu vendor routes.

### Phase 4 — Channel tuning

- [ ] Lower Pidge channel minimums to smallest SKU **or** accept floors and adjust customer delivery fee logic.

---

## 14. Why Pidge dashboard shows Volume = 450 in³ and Weight = 0.5 KG (summary)

For **ML2606034554** (200 g in WarmPawz):

| Dashboard | Most likely cause |
|-----------|-------------------|
| **450 in³** | Channel **minimum volume** and/or API example bucket; **not** from `meal_plans`. Triggered because **`volumetric_weight` semantics and 2×2×2 dims do not describe a real parcel**. |
| **0.5 kg** | Channel **minimum weight (500 g)** applied on top of submitted 200 g, **or** chargeable weight = `max(actual, minimum)`. |

WarmPawz **did** send 200 g in `dead_weight` / `volumetric_weight`; Pidge **display/rating** does not mirror that — treat as **integration contract issue**, not wrong RDS catalog weight.

---

## 15. Source class / file map

| Role | Path |
|------|------|
| Dispatch trigger + compact payload | `backend/lambda/src/utils/meal-dispatch.ts` |
| Pack weight resolution | `backend/lambda/src/utils/meal-pack-weight.ts` |
| Meal plan column | `db/migrations/1021_meal_plans_structured_catalog.sql` (`pack_weight_grams`) |
| Vendor product save | `backend/lambda/src/utils/meal-product-persistence.ts`, `meal-product.contract.ts` |
| TS payload builder (pharmacy/other; mirror of Java) | `backend/lambda/src/lib/services/pidge-logistics.ts` |
| Meal dispatch HTTP | `services/delivery-service/.../MealLogisticsDispatchService.java` |
| Pidge HTTP client | `services/delivery-service/.../PidgeIntegrationService.java` |
| **Package dims + volumetric** | `services/delivery-service/.../PidgeOrderPayloadBuilder.java` |
| Controller | `services/delivery-service/.../LogisticsController.java` (`POST /logistics/meal/dispatch`) |
| Pidge scheduling fields | `packages/shared-types/src/meal-pidge-scheduling.ts`, `backend/lambda/src/utils/meal-pidge-scheduling.ts` |

---

## 16. Quick reference — meal vs Pidge doc example

| | Pidge doc example (typical) | WarmPawz meal dispatch (today) |
|--|---------------------------|------------------------------|
| `dead_weight` | 0 | Pack grams (e.g. 200) |
| `volumetric_weight` | 450 | Same as dead_weight (e.g. 200) |
| L × B × H | (in example, often implied) | 2 × 2 × 2 (hardcoded) |
| Weight source | Manual / API | `meal_plans.pack_weight_grams` |

---

## 17. Investigation helper (optional)

Prod RDS query script (local, not committed): `scripts/_query-ml4554-pidge-dims.js`  
Example: `node scripts/_query-ml4554-pidge-dims.js`

---

*Generated for copy-paste / Confluence / ticket attachment. Do not deploy from this file.*
