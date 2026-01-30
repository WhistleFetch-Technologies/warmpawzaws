# Rule Engine: Attribute for Value + Map to Services / Service Styles

**Date:** 2026-01-30  
**Context:** Platform Settings → Rule Book currently shows **Value** with no **Attribute**, and rules are keyed by **Role** (and Flow) only. This doc summarizes current behaviour and suggests changes.

---

## 1. Current State

### 1.1 Value with no attribute

| Where | What exists today |
|-------|--------------------|
| **DB** | `discovery_rules.rule_value` is JSONB: `{ "value": 5 }` or `{ "value": "mobile_then_base" }`. No `unit`, `type`, or `label` stored per row. |
| **Backend** | `GET /admin/discovery-rules/keys` returns for each key: `key`, `label`, `type` (number \| string \| array). So the **key** has a type and label, but they are not shown per row. |
| **UI** | Table columns: Role, Rule key, **Value**, Flow, Active, Actions. The "Value" column shows only the raw value (e.g. `5`, `50`, `mobile_then_base`). There is **no column** for unit/type (e.g. "minutes", "km", "hours"). |

So a value like `5` is ambiguous in the table (minutes? km? hours?) unless you remember the key. The key’s label (e.g. "Appointment reminder (min before)") is only visible when selecting the key in the form, not in the table.

### 1.2 Mapped to role only (no services / service styles)

| Where | What exists today |
|-------|--------------------|
| **DB** | `discovery_rules` has: `role_id`, `rule_key`, `rule_value`, `applies_to_flow`, `city`. No column for **service** (e.g. grooming, training, vet) or **service_style** (at_home, at_center, tele). |
| **Resolution** | `getDiscoveryRules(roleId, flow)` merges: platform defaults → `role_id = 'all'` → specific `role_id`, with optional `applies_to_flow` match. |
| **Consumers** | Discovery uses **role** (e.g. `getDiscoveryRules(roleId || 'all', 'discover')`). Some APIs also have **serviceStyle** (at_home, at_center, tele) in the request but do **not** pass it into the rule engine; rules are not differentiated by service style. |

So today you can say “for role **groomer** in flow **discover**, radius = 15 km”, but you **cannot** say “for **at_home** grooming radius = 10 km, for **at_center** grooming radius = 25 km” or “for service style **tele** use different max_results”.

---

## 2. What You Want

1. **Attribute for value**  
   - Each value should have a visible **attribute** (unit/type), e.g. "5" with "minutes", "50" with "km", so the table is self-explanatory.

2. **Map to services and service styles**  
   - Rules should be mappable to **service styles** (at_home, at_center, tele) and optionally to **services/categories** (e.g. grooming, training, veterinary), not only to role (+ flow).

---

## 3. Recommendations

### 3.1 Attribute for value (low effort)

**Option A – UI only (no schema change)**  
- **Table:** Add an **Attribute** column. For each row, derive it from the rule key: call `GET /admin/discovery-rules/keys` (or use cached keys) and show the key’s `label` and/or a human-readable **unit** (e.g. "min", "hours", "km") in the Attribute column.  
- **Unit per key:** Extend the keys response to include a `unit` field where applicable (e.g. `appointment_reminder_minutes_before` → unit `"minutes"`, `discovery_radius_km` → unit `"km"`).  
- **Form:** In Add/Edit, show the key’s type and unit next to the value input (e.g. "Value (number, unit: minutes)").

**Option B – Store attribute in rule_value (flexible)**  
- Allow `rule_value` to store optional metadata: e.g. `{ "value": 5, "unit": "minutes" }` or `{ "value": 5, "type": "number" }`.  
- UI: show `value` in Value column and `unit` (or type) in Attribute column; if missing, fall back to key’s default unit from keys API.  
- Backend: keep existing `extractRuleValue()` behaviour (use `value`); optional: validate or surface `unit`/`type` in admin GET.

Recommendation: do **Option A** first (Attribute column from keys + optional `unit` in keys API). Add Option B later if you need per-rule unit overrides.

### 3.2 Map to services and service styles (schema + API + UI)

**Schema (add optional dimensions)**  
- Add to `discovery_rules`:  
  - `service_style` TEXT (nullable): `'at_home' | 'at_center' | 'tele'` or empty = applies to all styles.  
  - Optionally `service_type` or `category` TEXT (nullable): e.g. `'grooming'`, `'training'`, `'veterinary'`, or empty = all.  
- Uniqueness: extend the unique constraint to include `service_style` and `service_type` (e.g. `UNIQUE(role_id, rule_key, applies_to_flow, city, COALESCE(service_style,''), COALESCE(service_type,''))`).

**Resolution order (backend)**  
- In `getDiscoveryRules(roleId, flow, serviceStyle?, serviceType?)`:  
  1. Platform defaults  
  2. Rules with `role_id = 'all'`, no style, no type  
  3. Rules with `role_id = 'all'` + matching `service_style` (and optional `service_type`)  
  4. Rules with specific `role_id`, no style, no type  
  5. Rules with specific `role_id` + matching `service_style` (and optional `service_type`)  
- More specific (role + style + type) overrides less specific (role only).

**API**  
- `GET /admin/discovery-rules`: add optional query params `service_style`, `service_type` (or `category`).  
- `POST /admin/discovery-rules`: body may include `service_style`, `service_type`.  
- `PUT /admin/discovery-rules/:id`: allow updating `service_style`, `service_type`.

**UI**  
- **Filters:** Add "Service style" and optionally "Service / Category" dropdowns (at_home, at_center, tele; and grooming, training, vet, etc.).  
- **Table:** Add columns **Service style** and optionally **Service type** (or **Category**).  
- **Add/Edit form:** Add optional fields "Service style" and "Service type" (or "Category") so admins can scope a rule to e.g. at_home only or grooming only.

**Consumers**  
- Where discovery (or booking, chat, etc.) already has `serviceStyle` or category, pass it into `getDiscoveryRules(roleId, flow, serviceStyle, category)` so that style- or service-specific rules are used when present.

---

## 4. Implementation order

| Priority | Task | Effort |
|----------|------|--------|
| 1 | Add **Attribute** column in Rule Book UI (from keys’ label/unit); add `unit` to keys API where needed | Small |
| 2 | Add **Service style** (and optionally **Service type**) to schema, API, and UI; extend `getDiscoveryRules(roleId, flow, serviceStyle?, serviceType?)` and wire discovery/booking to pass style/category | Medium |
| 3 | (Optional) Store `unit`/`type` in `rule_value` and show in Attribute when present | Small |

---

## 5. Files to touch (for reference)

- **Attribute (UI + keys):**  
  - `apps/admin-web/components/admin/platform-settings/integrations/ruleBook/DiscoveryRulesManager.tsx` (table column, form label).  
  - `backend/lambda/src/endpoints/discovery-rules-admin.ts` (keys: add `unit` per key).
- **Service style / type:**  
  - `db/migrations/` (new migration: add `service_style`, optional `service_type`, unique constraint).  
  - `backend/lambda/src/endpoints/discovery-rules-admin.ts` (GET/POST/PUT filters and body).  
  - `backend/lambda/src/lib/rule-engine.ts` (`getDiscoveryRules(roleId, flow, serviceStyle?, serviceType?)` and resolution order).  
  - `DiscoveryRulesManager.tsx` (filters, table columns, form fields).  
  - Discovery/booking/chat call sites (e.g. `service-discovery.ts`, `bookings-enhanced.ts`) to pass `serviceStyle`/category into `getDiscoveryRules` where available.

If you tell me which part you want to implement first (attribute column only, or attribute + service_style/service_type), I can outline the exact code changes step by step.
