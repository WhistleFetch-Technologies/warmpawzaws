# Rule Book & Discovery – Gap Analysis

**Date:** 2026-02-04  
**Scope:** Platform Settings Rule Book, vendor discovery, service radius precedence, schema alignment, customer web implementation.

---

## 1. Rule Book (Admin Platform Settings) – Current Implementation

### 1.1 Location & Schema

| Component | Location | Status |
|-----------|----------|--------|
| **Admin UI** | `apps/admin-web/app/platform-settings` → Rules tab → `DiscoveryRulesManager` | ✅ Present |
| **API** | `GET/POST/PUT/DELETE /admin/discovery-rules` | ✅ Implemented |
| **DB Table** | `discovery_rules` (migration 090, 091) | ✅ Exists |
| **Rule Engine** | `backend/lambda/src/lib/rule-engine.ts` | ✅ Implemented |

### 1.2 Schema

```sql
-- discovery_rules (090 + 091)
role_id TEXT, rule_key TEXT, rule_value JSONB, applies_to_flow TEXT, city TEXT,
service_style TEXT, service_type TEXT, is_active BOOLEAN
UNIQUE(role_id, rule_key, applies_to_flow, city, service_style, service_type)
```

**Rule keys supported:**  
`discovery_radius_km`, `discovery_max_results`, `discovery_sort_default`, `discovery_location_source`,  
`hyperlocal_max_distance_km`, `order_accept_max_distance_km`, `broadcast_radius_km_initial`, `broadcast_radius_km_steps`,  
`follow_up_days`, `chat_available_days_post_appointment`, etc.

### 1.3 Validation

- Admin CRUD works; rules are stored in `discovery_rules`.
- Rule engine merges platform defaults → role `all` → specific role → role + service_style + service_type.
- Resolution order is correct.

---

## 2. Vendor Profile – Radius Definition

### 2.1 Schema

| Table | Column | Purpose |
|-------|--------|---------|
| `vendors` | `service_radius` (NUMERIC) | Solo vendor default radius (km) – migration 071 |
| `vendor_services` | `service_radius_km` (NUMERIC) | Per-service radius for at_home – migration 074 |
| `staff_services` | `radius_km` | Per-staff service radius – used by staff-based discovery |

### 2.2 API

- `GET/PUT /vendor/:vendorId/service-radius` – ServiceRadiusConfig
- `GET/PUT /vendor/:vendorId/general-settings` – includes `service_radius`
- Vendor profile and general settings can read/write radius.

---

## 3. Discovery – Enforcement & Precedence

### 3.1 Required Behaviour

> If solo vendor has defined the service radius, it should take precedent for home services; if not, rule book configuration should be enforced for service provider discovery.

Intended logic:

- For **at_home** discovery:
  - If vendor has `service_radius` or service has `service_radius_km` → use that as max distance.
  - Else → use `discovery_radius_km` from rule book.
- Filter: include only vendors where `customer_distance <= effective_radius`.

### 3.2 Current Behaviour

| Endpoint | Uses rule book? | Uses vendor radius? | Radius filter? |
|----------|-----------------|---------------------|----------------|
| `GET /customer/discover-services` (at_home) | ❌ No | ❌ No | ❌ No |
| `GET /customer/radar/providers` | ✅ Yes | ❌ No | ✅ Yes (rule only) |
| `GET /customer/discover-staff` (at_home) | ❌ No | ✅ staff_services.radius_km | ✅ Yes |
| Meal plans search | ✅ Yes | ❌ No | ✅ Yes (rule only) |
| Pharmacy broadcast | ✅ Yes | ❌ No | ✅ Yes (rule only) |

### 3.3 Gaps

1. **No radius filtering in discover-services (at_home)**  
   - All matching solo vendors are returned, regardless of distance.
   - Neither `discovery_radius_km` nor vendor/service radius is used.

2. **No vendor radius precedence**  
   - Vendor `service_radius` and `vendor_services.service_radius_km` are never consulted in discovery.

3. **Rule engine not used for at_home discovery**  
   - `getDiscoveryRules()` is not called for the at_home path in `discover-services`.

4. **Vendor SELECT omits radius**  
   - The at_home query does not select `v.service_radius` or join `vendor_services.service_radius_km`.

---

## 4. Customer Web – Implementation

### 4.1 Discovery Flow

- `HomeServiceProviderListView`, `WalkerService`, `UniversalServicesByStyle`, etc. call:
  - `GET /customer/discover-services?category=X&serviceStyle=at_home&roleId=Y&latitude=&longitude=`
- Customer location is passed via `latitude` and `longitude` when available.

### 4.4 Client-Side Behaviour

- Distance is computed for display (e.g. `distanceText`).
- There is a `maxDistance` filter in some flows, but the API returns all vendors, so client-side filtering is the only distance enforcement.

---

## 5. Schema vs Function – Alignment

| Rule / Function | Schema | Rule key | Enforced? |
|-----------------|--------|----------|-----------|
| Discovery radius | `discovery_rules.rule_value` | `discovery_radius_km` | ❌ Not for at_home discover-services |
| Max results | `discovery_rules.rule_value` | `discovery_max_results` | ⚠️ Hardcoded LIMIT 50, not rule-driven |
| Sort default | `discovery_rules.rule_value` | `discovery_sort_default` | ❌ Not used in discover-services |
| Location source | `discovery_rules.rule_value` | `discovery_location_source` | ❌ Not used |
| Pharmacy broadcast | `discovery_rules` | `broadcast_radius_km_*` | ✅ Used in pharmacy flows |
| Meal search | `discovery_rules` | `discovery_radius_km` | ✅ Used |

### Role ID Mismatch

- Rules use role **names** (e.g. `walker`, `pet_walker`).
- `getDiscoveryRules(roleId, flow, serviceStyle, serviceType)` expects role id/name; for discovery it is usually the role name. This is consistent.

---

## 6. Gaps Summary

### Critical (blocking intended behaviour)

1. **At_home discover-services: no radius filtering**
   - Vendors beyond any reasonable radius are still shown.
   - Fix: apply radius filtering using vendor radius (precedent) or rule book radius (fallback).

2. **Vendor radius not used**
   - `vendors.service_radius` and `vendor_services.service_radius_km` are ignored in discovery.
   - Fix: read these fields and use them when computing effective radius per vendor.

3. **Rule book not used for at_home**
   - `getDiscoveryRules()` is never called for at_home discovery.
   - Fix: call `getDiscoveryRules(roleId, 'discover', 'at_home', category)` and use `discovery_radius_km` when vendor radius is null.

### Medium (consistency / configurability)

4. **Max results not rule-driven**
   - LIMIT 50 is hardcoded instead of `discovery_max_results`.
   - Fix: use `rules.discovery_max_results` in the query.

5. **Sort default not used**
   - Sorting does not follow `discovery_sort_default` (e.g. nearest, relevance).
   - Fix: implement sort options based on rule.

6. **Location source not used**
   - `discovery_location_source` (mobile, base_address, mobile_then_base) is not applied.
   - Fix: use this when resolving customer location.

### Minor (docs / DX)

7. **Role list in Admin**
   - `DiscoveryRulesManager` uses a fixed `ROLES` array; some DB roles may be missing.
   - Fix: consider loading roles from API to keep Admin in sync with DB.

---

## 7. Recommended Implementation

### 7.1 At_home discovery radius (service-discovery.ts)

```text
1. Call getDiscoveryRules(roleId, 'discover', 'at_home', category)
2. Add v.service_radius, vs.service_radius_km to SELECT (or subquery)
3. For each vendor:
   - effectiveRadius = vendor.service_radius ?? first(vendor_services.service_radius_km) ?? rules.discovery_radius_km ?? 50
4. When lat/lng present: filter vendors where distance <= effectiveRadius
5. Apply rules.discovery_max_results as LIMIT
6. Apply rules.discovery_sort_default for ORDER BY (nearest, relevance, etc.)
```

### 7.2 Data flow

```text
Customer Web (lat, lng) 
  → GET /customer/discover-services?serviceStyle=at_home&category=walker&lat=&lng=
  → Backend: getDiscoveryRules('walker', 'discover', 'at_home')
  → For each vendor: effectiveRadius = vendor.service_radius ?? rule.discovery_radius_km
  → Filter: distance <= effectiveRadius
  → Sort by rules.discovery_sort_default
  → Limit by rules.discovery_max_results
```

---

## 8. Files to Update

| File | Changes |
|------|---------|
| `backend/lambda/src/endpoints/service-discovery.ts` | Add rule fetch, vendor radius, radius filtering, max results, sort |
| `backend/lambda/src/lib/rule-engine.ts` | No change; already supports service_style |
| `apps/admin-web/.../DiscoveryRulesManager.tsx` | Optional: load roles from API |
| `db/migrations` | No change; schema supports vendor and rule radius |

---

## 9. Checklist for Implementation

- [x] Fetch `getDiscoveryRules(roleId, 'discover', 'at_home', category)` in at_home path
- [x] Include `v.service_radius` in vendor SELECT
- [x] Join/aggregate `vendor_services.service_radius_km` for at_home services
- [x] Compute `effectiveRadius` per vendor (vendor > rule > default)
- [x] Filter vendors where `distance <= effectiveRadius` when lat/lng present
- [x] Use `discovery_max_results` for LIMIT
- [x] Use `discovery_sort_default` for ORDER BY
- [ ] Validate with walker, groomer, trainer, vet_solo at_home discovery (run `tests/verify-service-discovery-flows.ts` or e2e with `latitude`/`longitude` query params)
