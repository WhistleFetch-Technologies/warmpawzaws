# Optimization Exit Criteria (Reusable Rulebook)

**Status:** Authoritative template for performance / structure refactors across Warmpawz.  
**First application:** Discovery module — see [discovery-optimization-phased-plan.md](./discovery-optimization-phased-plan.md).  
**Related:** [endpoint-4-layer-parity.mdc](../.cursor/rules/endpoint-4-layer-parity.mdc), [discovery-perf-rca.md](./discovery-perf-rca.md).

---

## Purpose

Optimization is **not** “code feels cleaner.” It must be **measurable** and **verifiable**.

This document defines when a refactor is **complete**. Until all applicable criteria pass for the scoped module, the optimization is **not** done.

Use this rulebook for any subsystem where the goals are:

- smaller payloads
- fewer queries
- lean response DTOs
- cursor pagination / progressive loading
- strict layer separation
- maintainable services (readable in one sitting)

**Out of scope by default:** changing what the user can do, which buttons exist, booking rules, payment timing, or navigation semantics. Those require an explicit, separate product approval.

---

## Golden rules (all modules)

| # | Rule | Meaning |
|---|------|---------|
| G1 | **Behaviour lock** | Same user flows, same business rules, same HTTP intent unless a compatible contract evolution is documented (e.g. pagination). |
| G2 | **Screen-shaped responses** | Each endpoint serves **one UI screen** (or one loading step). No “fetch everything” list endpoints. |
| G3 | **Measure before claiming done** | Capture baseline and post-change metrics on the **same dataset** (dev API + fixed query params). |
| G4 | **Progressive loading** | Metadata → list cards → detail → booking depth. Deeper data only when the user navigates deeper. |
| G5 | **Layer discipline** | Route → Handler → Service → Repository. No shortcuts. |
| G6 | **Single owner per concern** | One mapper, one pagination helper, one enricher per screen class — no copy-paste orchestration. |
| G7 | **Bounded lists** | Every feed uses cursor pagination with documented default page sizes. |
| G8 | **Explicit exceptions** | Legacy/full payloads (e.g. booking) stay behind flags or “no limit” paths — never the default list path. |

---

## How to apply this to a new module

Copy the checklist below into `docs/<module>-optimization-exit-criteria.md` (or a PR appendix) and fill in:

1. **Module name** (e.g. Discovery, Shop catalog, Bookings list).
2. **Clients in scope** (customer-web, vendor-web, WarmpawzCustomer, admin-web).
3. **Endpoints in scope** (table).
4. **UI flow matrix** (screen → endpoint → DTO).
5. **Baseline capture date + branch + API environment**.
6. **Pass/fail per section** with evidence links (script output, test name, PR).

Do **not** start Phase 2+ work until Phase 0 baseline exists.

---

## 1. Functional verification

**Objective:** Nothing breaks from the user’s perspective.

### Verify

```text
✓ All in-scope UI flows work as before
✓ No new workarounds in frontend (only payload shape + pagination handling may change)
✓ Booking / payment / auth flows untouched unless explicitly in scope
✓ Native + web clients listed in scope are both checked (if applicable)
```

### Evidence required

- Flow matrix with pass/fail per row
- Contract or smoke tests for API shape
- Manual or automated E2E for critical paths

### Failure examples

- List shows fewer providers **without** infinite scroll wired
- Client still depends on removed fields with silent fallbacks
- One client migrated, another still expects `providers` twin array

---

## 2. Endpoint responsibility verification

**Objective:** One endpoint ≈ one UI loading step.

### Target pattern

```text
Bootstrap (metadata only)
  → Feed (card DTO + cursor)
    → Child feed (service cards + cursor)
      → Profile (full detail)
        → Booking (full service rows + packages)
```

### Verify

```text
✓ Bootstrap endpoints run no vendor/catalog SQL
✓ List endpoints return card DTOs only by default
✓ Detail endpoints own full enrichment
✓ Booking endpoints own packages / eligibility / tax hooks
✓ No list endpoint returns nested full service catalog by default
```

---

## 3. Layer verification

**Objective:** Strict four-layer architecture.

```text
Route → Handler → Service → Repository
```

| Layer | Maximum responsibility |
|-------|------------------------|
| **Route** | Register path + method |
| **Handler** | Auth, validation, delegate |
| **Service** | Orchestration, DTO mapping, pagination, status codes |
| **Repository** | SQL only |

### Checklist

```text
✓ No SQL in route or handler
✓ No HTTP response construction in repository
✓ No validation in repository
✓ Services do not import rds-connection directly (use repos)
✓ npm run validate:customer-layers passes (customer API)
```

**Note:** Shared SQL *builders* may live in `utils/` only when reused by multiple repos; execution stays in repos.

---

## 4. Service complexity verification

**Objective:** Services readable in one sitting.

### Targets (guidelines, not dogma)

| Metric | Target |
|--------|--------|
| Single service file | ~150–250 LOC (orchestrator); split modules ≤200 LOC |
| Single method | ~50–70 LOC max |
| Responsibility | One pipeline stage per file (parse, load, enrich, finish) |

### Verify

```text
✓ No monolithic 700+ LOC service files without split plan
✓ Orchestrator (run.ts) is thin
✓ No duplicated orchestration between similar endpoints
```

---

## 5. Repository verification

**Objective:** Repositories are boring — mostly SQL.

### Verify

```text
✓ Named query functions (findX, listY, countZ)
✓ No response DTO mapping in repo
✓ No enrichment / slot resolution in repo
✓ Minimal branching; complex filters in dedicated SQL modules called from repo
```

---

## 6. Legacy helper review

**Objective:** No god files.

### Verify

```text
✓ No single file mixing mapping + slots + specialization + enrichment + HTTP
✓ Dead code and imports removed
✓ Each helper has a clear owner (mapper, enricher, availability, photo)
✓ “legacy” in filename is a migration target, not a permanent home
```

---

## 7. Enrichment verification

**Objective:** Pay for enrichment only on the screen that needs it.

| Screen class | Enrichment level |
|--------------|------------------|
| Card list | Stats batch, priceMin, availability text, photo URL |
| Service list | ServiceCardDTO only |
| Profile | Full vendor + facility + reviews |
| Booking | Full rows, packages, discounts, tax |

### Verify

```text
✓ Card endpoints: includeAvailability / fullEnrich off by default
✓ No N+1 hydration on list endpoints
✓ Client does not fetch per-row services for list cards unless expand UX requires it
```

---

## 8. Response DTO verification

**Objective:** UI-specific DTOs, not database shapes.

### Verify

```text
✓ Dedicated DTO types per screen (e.g. VendorCardDTO, ServiceCardDTO)
✓ No duplicate top-level arrays (providers + vendors)
✓ No unused fields in default list responses
✓ Backend metadata / internal IDs not leaked unless UI needs them
```

---

## 9. Payload verification (mandatory metrics)

**Objective:** Prove size reduction.

### Capture per endpoint × scenario

| Field | How |
|-------|-----|
| Response bytes (raw) | `curl -w '%{size_download}'` or script |
| Response bytes (gzip) | `curl -H 'Accept-Encoding: gzip'` |
| Top-level keys | JSON parse |
| Array lengths | `vendors.length`, `services.length` |
| Duplicate fields | diff key inventory |

### Verify

```text
✓ Baseline recorded on develop (or pre-refactor tag)
✓ Post-change recorded on same queries
✓ Trend is down for list endpoints (document exceptions)
✓ No duplicate arrays / unused blobs
```

**Optimization is not complete without numbers.**

---

## 10. Query verification (mandatory metrics)

### Capture per endpoint × scenario

| Metric | How |
|--------|-----|
| SQL statement count | RDS log / forensic trace script |
| N+1 patterns | Code review + trace |
| Setup queries | columnExists / schema probes — batched? |

### Verify

```text
✓ List endpoints: O(1) vendor query + O(1) batch stats (not O(N) per vendor)
✓ View services for one vendor: bounded by page size
✓ No duplicated setup queries per request
```

---

## 11. Pagination verification

### Defaults (Discovery — adjust per module in module doc)

| Feed | Default page | Max |
|------|--------------|-----|
| Vendor list | 3 | 20 |
| Service list (cards) | 5 | 50 |

### Verify

```text
✓ Cursor pagination on every feed endpoint
✓ Stable ordering documented
✓ No duplicate records across pages
✓ No skipped records (composite cursor if in-memory + SQL offset)
✓ UI wires loadMore / infinite scroll for every long list screen
```

---

## 12. Code duplication review

Search for duplicated:

- mappers
- DTO builders
- SQL fragments
- enrich logic
- response envelopes

### Verify

```text
✓ Single implementation per concern
✓ Parallel pipelines (e.g. discover vs by-style) share utils where behaviour must match
```

---

## 13. Maintainability review

A new developer should answer without opening unrelated files:

| Question | Answer location |
|----------|-----------------|
| Where is SQL? | Repository (+ shared SQL builders) |
| Where is business logic? | Service |
| Where is validation? | Handler / service |
| Where is mapping? | `utils/*-dto.ts` or dedicated mapper |
| Where is pagination? | `utils/*-pagination.ts` |
| Where is enrichment? | Dedicated enricher per screen class |

---

## 14. Final acceptance statement

A module optimization is **complete** only when **all** are simultaneously true:

- [ ] Users experience the same flows and business behaviour (in-scope clients).
- [ ] HTTP endpoints preserve functional intent; intentional contract changes are documented.
- [ ] Services are split/readable; no unjustified 700+ LOC monoliths.
- [ ] Four-layer architecture is enforced and validator passes.
- [ ] Legacy god helpers are split or removed.
- [ ] List payloads are screen-specific DTOs with measured size reduction.
- [ ] Feeds use cursor pagination end-to-end (API + UI).
- [ ] Query count and N+1 issues are measured and acceptable.
- [ ] Duplication is consolidated.
- [ ] Exit checklist signed off with evidence (PR link, script output, test run).

---

## Measurement toolkit (recommended)

Add or use scripts under `scripts/`:

| Script | Purpose |
|--------|---------|
| `benchmark-<module>-payloads.sh` | Bytes + key inventory per endpoint |
| `forensic-<module>-db-trace.js` | SQL count per request |
| `validate_<module>.sh` | Smoke HTTP status (existing: `validate_discovery.sh`) |

Store outputs in `docs/benchmarks/<module>/<date>-baseline.json` (gitignored if large) or paste summary into PR.

---

## Relationship to other rules

| Document | Role |
|----------|------|
| `endpoint-4-layer-parity.mdc` | **How** to structure customer API code |
| `optimization-exit-criteria.md` (this file) | **When** optimization is done |
| `discovery-perf-rca.md` | Discovery baseline + target contracts |
| `discovery-optimization-phased-plan.md` | Discovery gap closure order |

---

## Module sign-off template

```markdown
## Module: ___________
Branch: ___________
Date: ___________
Reviewer: ___________

| Section | Pass | Evidence |
|---------|------|----------|
| 1 Functional | ☐ | |
| 2 Endpoints | ☐ | |
| 3 Layers | ☐ | validate:customer-layers |
| 4 Service LOC | ☐ | |
| 5 Repos | ☐ | |
| 6 Legacy helpers | ☐ | |
| 7 Enrichment | ☐ | |
| 8 DTOs | ☐ | |
| 9 Payload | ☐ | benchmarks/... |
| 10 Queries | ☐ | trace/... |
| 11 Pagination | ☐ | |
| 12 Duplication | ☐ | |
| 13 Maintainability | ☐ | |

Accepted: ☐  Not accepted: ☐  Comments:
```
