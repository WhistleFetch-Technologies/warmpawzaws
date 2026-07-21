# Discovery Performance RCA (baseline)

**Exit rulebook:** [optimization-exit-criteria.md](./optimization-exit-criteria.md)  
**Phased plan:** [discovery-optimization-phased-plan.md](./discovery-optimization-phased-plan.md)

Branch: `feature/abhi-discovery-perf`  
Date: 2026-07-21

## Progressive loading model (target)

```
Home → Category bootstrap (metadata only) → Vendor feed (VendorCardDTO) → Service feed (ServiceCardDTO) → Vendor profile (full) → Book
```

Each screen requests only fields it renders. Category metadata (styles, problems, banner) must not trigger vendor SQL.

## UI field matrix

| Screen | Endpoint | Fields rendered |
|--------|----------|-----------------|
| Category metadata | discovery-meta / content | style names, icons, problems, banner — **no vendors** |
| Vendor card (hub / style list) | discover-services / by-style | image, name, verified, role, distance, priceMin, availability, short address |
| View Services | vendor/:id/services?limit=5 | name, short description, duration, category, price, package flag |
| Vendor profile | vendor/:id | full detail — no slimming |
| Booking | vendor/:id/services (no limit) | full row + packages |

## Payload audit (before fix)

- Duplicate `providers` + `vendors` on discover + by-style (~2× list JSON).
- by-style default N+1 `fetchServices` + nested `services[]`.
- discover defaults cards-only; asymmetric with by-style.
- List cards included phone, city, vendorType, priceMax, specializations, metadata.
- vendor-services returned full booking model for all rows; no pagination.

## Query count class

| Endpoint | Before | After |
|----------|--------|-------|
| discover-services | ~1 vendor + 1 stats | unchanged cost; smaller JSON |
| services/by-style | ~1 + N fetchServices | ~1 vendor + 1 stats |
| vendor-services (card mode) | all rows | slice limit+1 with cursor |

## LOC map

| File | ~LOC | Notes |
|------|------|-------|
| discover-services.service.ts | 696 | DTO response + pagination |
| services-by-style.service.ts | 772 | cards-only default + DTO |
| vendor-services.service.ts | 433 | card mode when limit/cursor |
| discovery-vendor-query.ts | 718 | EXISTS shared (future split) |

New utils: `discovery-cursor`, `discovery-vendor-card-dto`, `discovery-service-card-dto`, `discovery-list-pagination`, `discovery-list-response`, `discovery-vendor-list-setup`.

## Target contracts (implemented)

**Vendor list** (`discover-services`, `services/by-style`):

```json
{ "success": true, "vendors": [VendorCardDTO], "nextCursor": "...", "total": 3, "appliedFilters": {} }
```

**Vendor services card mode** (`limit` or `cursor` present):

```json
{ "success": true, "services": [ServiceCardDTO], "nextCursor": "...", "count": 5 }
```

**Vendor services legacy** (booking — no limit/cursor):

```json
{ "success": true, "services": [...], "packages": [...], "count": N, "hasActivePackage": bool }
```

## EXPLAIN

Run on dev when RDS available:

```bash
node scripts/forensic-discovery-db-trace.js
```

## SQL ladder status

| Step | Status |
|------|--------|
| 0.5 setup dedupe | `getDiscoveryVendorListSchemaFlags()` caches column probes per container |
| 1 aggregation | AVG/COUNT remain in main SELECT; stats batch for cards |
| 2 EXISTS | shared `buildDiscoveryVendorExistsSql` (existing) |
| 3 stats batch | `fetchDiscoveryListStatsForVendors` for page vendor IDs |
| 4 residual main | only if benchmarks still hot |
| 5 cache | schema flags in-process |
