# Warmpawz Pay — Admin Module Analysis (V2)

**Milestone:** `feature/wpay-admin`  
**Supersedes:** `WARMPAWZ_PAY_ADMIN_ANALYSIS.md` (V1)  
**Prerequisite:** Phase 1 schema deployed (`1080_warmpawz_pay_phase1_schema.sql`)  
**Document type:** Architectural analysis — **no code, no SQL**  
**Date:** July 23, 2026  

**Architectural adjustment (V2):** All **payment observability** (payment list, detail, settlement/promotion display, exports, payment admin APIs) is **removed from `feature/wpay-admin`** and assigned to **`feature/wpay-payment-flow`**. This document covers **vendor catalogue administration only**.

**References:**

- `docs/WARMPAWZ_PAY_TECHNICAL_ARCHITECTURE_FINAL.md`
- `docs/WARMPAWZ_PAY_PHASE1_IMPLEMENTATION_PLAN.md`
- `docs/WARMPAWZ_PAY_PHASE1_SCHEMA_VERIFICATION.md`
- `docs/WARMPAWZ_PAY_ADMIN_IMPLEMENTATION_PLAN.md` (companion — execution checklist)

**Binding constraint:** `warmpawz_pay_vendor_catalog` is **visibility-only**. No pricing, promotions, discounts, payments, settlements, ledger, or promotion usage in this module.

---

## 1. Executive Summary

`feature/wpay-admin` delivers the **Warmpawz Pay Vendor Catalogue Admin** — the operations console for controlling which vendors appear in the customer Pay Bill discovery experience.

| In scope (`feature/wpay-admin`) | Out of scope (other branches) |
|--------------------------------|-------------------------------|
| Catalogue CRUD | Payment list / detail / exports → **`feature/wpay-payment-flow`** |
| Publish / unpublish lifecycle | Settlement status display → **`feature/wpay-payment-flow`** |
| Vendor candidate search | Promotion usage display → **`feature/wpay-payment-flow`** |
| Eligibility validation (read + warnings) | Refunds → architecture Sprint 4 / payment-flow |
| Admin RBAC + audit logging | Customer vendor list API → **`feature/abhi-wpay-customer`** |
| Admin UI (catalogue only) | Quote / initiate / verify → **`feature/wpay-payment-flow`** |
| Bulk publish / unpublish / delete | Post-payment async → **`feature/wpay-post-payment`** |

**Rationale for split:** Payment observability depends on payment rows existing and on payment-flow repositories (`PaymentIntentRepository`, etc.). Catalogue admin is independent and can ship immediately after Phase 1 schema merge.

**Delivery model:** Self-contained slice at `backend/lambda/src/endpoints/warmpawz-pay/admin/catalogue/` registered via `registerWarmpawzPayCatalogueAdminRoutes(app)`, plus admin-web at `/warmpawz-pay/catalogue` (single-purpose page — no payments sub-tab in this branch).

**Verdict:** **GO** — Phase 1 schema fully supports catalogue admin; no migration changes required.

---

## 2. Admin Architecture

### 2.1 Bounded context placement

```text
┌────────────────────────────────────────────────────────────┐
│  apps/admin-web/app/warmpawz-pay/catalogue/                │
│    List │ Add vendor │ Publish toggle │ Bulk actions       │
└────────────────────────────┬───────────────────────────────┘
                             │ HTTPS + admin JWT + RBAC
                             ▼
┌────────────────────────────────────────────────────────────┐
│  warmpawz-pay/admin/catalogue/                             │
│    routes → handlers → services → repositories             │
└────────────────────────────┬───────────────────────────────┘
                             │
         ┌───────────────────┴───────────────────┐
         ▼                                       ▼
 warmpawz_pay_vendor_catalog              vendors (read-only)
```

**Explicit boundary:** This module **never imports or queries** `payments`, `settlements`, `transactions`, `promotion_usages`, or `coupon_usages`.

### 2.2 Layering

| Layer | Responsibility |
|-------|----------------|
| **Routes** | Register `/admin/warmpawz-pay/catalogue/*` |
| **Handlers** | Auth, parse, delegate (~≤12 lines) |
| **Services** | `VendorCatalogAdminService`, `VendorEligibilityService`, `CatalogueAuditService` |
| **Repositories** | `VendorCatalogRepository`, `VendorEligibilityRepository` |
| **DTOs** | Zod schemas — catalogue only |

### 2.3 Cross-cutting concerns

| Concern | Pattern |
|---------|---------|
| Auth | `requireAdminAuth(c)` |
| RBAC | `admin.warmpawz_pay` or `admin.full_access` |
| Audit | `entity_audit_log` / `admin_audit_log` on create/publish/unpublish/delete |
| Errors | `{ success, data }` / `{ success: false, error: { code, message } }` |
| Feature flag | `WARMPAWZ_PAY_ENABLED` gates routes + nav |
| Idempotency | Publish when already published → 200 with current row |

### 2.4 Dependency rules (catalogue admin)

**May import:**

- `database/rds-connection` (via repositories only in services)
- `admin.controller` → `requireAdminAuth`
- `admin-rbac-permissions`, `admin-resolve-permissions-from-request`
- `warmpawz-pay/repositories/*`, `warmpawz-pay/constants/*`

**Must NOT import:**

- `payments-enhanced.ts`, `razorpay.razorpay.ts`
- `endpoints/booking/**`, `endpoints/ecommerce/**`
- Payment repositories or payment admin services (owned by `feature/wpay-payment-flow`)

### 2.5 Handoff to payment-flow (documented only)

When `feature/wpay-payment-flow` ships payment observability, it will add **separate** routes (e.g. `/admin/warmpawz-pay/payments`) and **separate** admin-web tab under `/warmpawz-pay/payments`. Catalogue admin remains unchanged.

---

## 3. Repository Design

### 3.1 `IVendorCatalogRepository` / `VendorCatalogRepository`

**Owns:** `warmpawz_pay_vendor_catalog`

#### Write methods

| Method | Purpose | TX |
|--------|---------|-----|
| `insertDraft(vendorId, createdBy)` | Create draft row | Single statement |
| `updatePublishStatus(id, status, publishedAt?)` | Publish / unpublish | Single statement |
| `deleteById(catalogueId)` | Hard delete | Single statement |
| `deleteByIds(catalogueIds[])` | Bulk delete helper | Per-id or batched |

#### Read methods

| Method | Purpose |
|--------|---------|
| `findById(catalogueId)` | Admin detail |
| `findByVendorId(vendorId)` | Duplicate guard |
| `existsForVendor(vendorId)` | Pre-create check |
| `listAdmin(filters)` | Paginated admin list with vendor JOIN |
| `countAdmin(filters)` | Pagination total |
| `listPublishedEligible(filters)` | **Shared export** for customer API (Abhi) — not used by admin UI directly but same repo |

#### Error mapping

| DB | App |
|----|-----|
| `23505` on `vendor_id` | `409 DUPLICATE_CATALOGUE_ENTRY` |
| `23503` FK vendor | `404 VENDOR_NOT_FOUND` |
| 0 rows updated/deleted | `404 CATALOGUE_ENTRY_NOT_FOUND` |

#### Must NOT

- Touch pricing/discount columns (none exist)
- Query payment or settlement tables

### 3.2 `IVendorEligibilityRepository` / `VendorEligibilityRepository`

**Owns:** read-only `vendors`

| Method | Purpose |
|--------|---------|
| `getSnapshot(vendorId)` | Eligibility flags + display fields |
| `searchCandidates(filters)` | Vendors not yet in catalogue |
| `countCandidates(filters)` | Picker pagination |
| `assertVendorExists(vendorId)` | Create validation |

### 3.3 Read vs write split

| Repository | Catalogue admin writes | Catalogue admin reads | Customer API reads |
|------------|------------------------|----------------------|-------------------|
| `VendorCatalogRepository` | ✅ | ✅ | ✅ (`listPublishedEligible`) |
| `VendorEligibilityRepository` | ❌ | ✅ | ❌ (customer uses joined data via catalogue repo) |

### 3.4 Transaction boundaries

| Operation | Boundary |
|-----------|----------|
| Create draft | Single INSERT |
| Publish / unpublish | Single UPDATE + audit insert (audit outside or same TX — prefer audit after successful UPDATE) |
| Bulk ops | Independent per-item updates; aggregate results in service |
| Delete | Single DELETE |

### 3.5 Caching

**None for MVP.** Catalogue changes must reflect immediately in admin UI and customer discovery.

---

## 4. Service Design

### 4.1 `VendorCatalogAdminService`

| Operation | Logic |
|-----------|-------|
| **createEntry** | Validate vendor → duplicate check → `insertDraft` → audit `created` |
| **getEntry** | Load by id → attach eligibility snapshot + warnings |
| **listEntries** | Apply filters → map to list DTOs |
| **publish** | Validate exists → idempotent if already published → `updatePublishStatus` → eligibility warnings → audit |
| **unpublish** | `published → draft` → audit |
| **delete** | Hard delete → audit |
| **bulkPublish / bulkUnpublish / bulkDelete** | Loop with per-item result envelope |

### 4.2 `VendorEligibilityService`

**Predicate:**

```text
customerVisible =
  catalogue.publish_status = 'published'
  AND vendor.status = 'active'
  AND vendor.bank_verified = true
  AND vendor.pay_bill_enabled = true
  AND vendor.is_deleted IS NOT TRUE
```

| Context | Behavior |
|---------|----------|
| Admin publish | **Allow** with **warnings** if not customer-visible |
| Customer list (Abhi) | **Filter** to customerVisible |

**Warning examples:**

- `VENDOR_NOT_ACTIVE`
- `BANK_NOT_VERIFIED`
- `PAY_BILL_NOT_ENABLED`

### 4.3 `CatalogueAuditService` (optional thin wrapper)

Centralizes audit log inserts for consistency:

```text
entity_type: warmpawz_pay_vendor_catalog
entity_id, action, actor_id, changes JSON
```

### 4.4 Publish status state machine

```text
create → draft ←→ published
         (publish / unpublish)
```

Idempotent: `published + publish` → 200; `draft + unpublish` → 200.

### 4.5 Duplicate prevention

DB unique on `vendor_id` + service pre-check + API `409`.

---

## 5. API Design

**Base:** `/admin/warmpawz-pay/catalogue`  
**Auth:** Admin JWT + `admin.warmpawz_pay`

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/catalogue` | List (paginated, filterable, sortable) |
| `GET` | `/catalogue/:catalogueId` | Detail |
| `POST` | `/catalogue` | Create draft |
| `POST` | `/catalogue/:catalogueId/publish` | Publish |
| `POST` | `/catalogue/:catalogueId/unpublish` | Unpublish |
| `DELETE` | `/catalogue/:catalogueId` | Delete |
| `GET` | `/catalogue/vendor-candidates` | Search vendors to add |
| `POST` | `/catalogue/bulk/publish` | Bulk publish |
| `POST` | `/catalogue/bulk/unpublish` | Bulk unpublish |
| `POST` | `/catalogue/bulk/delete` | Bulk delete |

**No `/payments` routes in this branch.**

### Request / response (catalogue only)

See V1 §5.3–5.4 catalogue sections — unchanged. Payment DTOs removed.

### Errors

| HTTP | Code |
|------|------|
| 400 | `VALIDATION_ERROR` |
| 401 | `UNAUTHORIZED` |
| 403 | `FORBIDDEN` |
| 404 | `VENDOR_NOT_FOUND`, `CATALOGUE_ENTRY_NOT_FOUND` |
| 409 | `DUPLICATE_CATALOGUE_ENTRY` |
| 503 | `FEATURE_DISABLED` |

---

## 6. Validation Rules

### Create

- Valid UUID `vendorId`
- Vendor exists, not deleted
- No duplicate catalogue row
- Reject unknown body fields (strict Zod)

### Publish

- Entry exists; vendor not deleted
- Warn (not block) on eligibility gaps

### Unpublish / delete

- Entry exists (404 if not)
- Delete: no catalogue FK from payments (none — safe)

### List / search

- `pageSize` max 100
- Bulk max 100 IDs
- Valid enum values for `publishStatus`, `sortBy`, `sortOrder`, `eligibility`

---

## 7. Business Rules

| ID | Rule |
|----|------|
| BR-01 | One catalogue row per vendor |
| BR-02 | New entries always `draft` |
| BR-03 | Set `published_at` on every transition to `published` |
| BR-04 | Publish does **not** mutate `pay_bill_enabled` or `bank_verified` |
| BR-05 | Customer visibility = published + eligibility (§4.2) |
| BR-06 | No pricing on catalogue |
| BR-07 | Delete removes vendor from discovery immediately |
| BR-08 | `created_by` immutable after create |
| BR-09 | Bulk ops: partial success allowed |
| BR-10 | Catalogue admin never reads payment history |

---

## 8. Permissions

### MVP permission

| Field | Value |
|-------|-------|
| `permissionId` | `admin.warmpawz_pay` |
| Nav label | Warmpawz Pay — Catalogue |
| Path | `/warmpawz-pay/catalogue` |

### Future granular RBAC (optional)

| Permission | Capability |
|------------|------------|
| `admin.warmpawz_pay.catalogue.read` | List/view |
| `admin.warmpawz_pay.catalogue.write` | Create/publish/delete/bulk |

Payment observability permissions will be defined on **`feature/wpay-payment-flow`** (e.g. `admin.warmpawz_pay.payments.read`).

### Audit ownership

| Field | Source |
|-------|--------|
| `created_by` | Admin JWT at create |
| Updates | `actor_id` in audit log (no `updated_by` column in schema) |

---

## 9. Database Access Strategy

### Indexes used (Phase 1 — sufficient)

| Index | Use |
|-------|-----|
| `idx_wpay_catalog_vendor_id` UNIQUE | Duplicate prevention, lookup |
| `idx_wpay_catalog_published` | Customer discovery (shared repo method) |

### Admin list query

```text
SELECT c.*, v.business_name, v.owner_name, v.city, v.phone, v.status,
       v.pay_bill_enabled, v.bank_verified, v.is_deleted
FROM warmpawz_pay_vendor_catalog c
INNER JOIN vendors v ON v.id = c.vendor_id
WHERE (v.is_deleted IS NOT TRUE)
  [filters]
ORDER BY [sort]
LIMIT/OFFSET
```

### Vendor candidates query

```text
SELECT v.id, v.business_name, v.city, v.status, ...
FROM vendors v
WHERE (v.is_deleted IS NOT TRUE)
  AND NOT EXISTS (SELECT 1 FROM warmpawz_pay_vendor_catalog c WHERE c.vendor_id = v.id)
  [q filter]
ORDER BY v.business_name
LIMIT/OFFSET
```

### Delete strategy

**Hard delete** catalogue rows only. Never delete vendors from this module.

### Future index (post-MVP, optional)

`(publish_status, updated_at DESC)` on catalogue if admin list grows large — **not required for MVP**.

---

## 10. Search / Pagination Strategy

| Aspect | Choice |
|--------|--------|
| Pagination | Offset (`page`, `pageSize`), default 20 |
| Sort | `updatedAt`, `publishedAt`, `businessName`, `publishStatus` |
| Search `q` | ILIKE on `business_name`, `city`, `phone` |
| Filter `publishStatus` | `draft` \| `published` \| `all` |
| Filter `eligibility` | `customer_visible` \| `not_customer_visible` \| `all` (computed) |
| Bulk | Sequential processing; max 100 per request |

Customer API uses **cursor** pagination — catalogue repo exposes separate methods; admin does not share cursor logic.

---

## 11. Future Customer Integration

| Customer need | Catalogue admin provides |
|---------------|-------------------------|
| Published vendor list | `listPublishedEligible()` in shared repo |
| Vendor name/address | JOIN in repo — customer service maps to lean DTO |
| Search | Same ILIKE pattern; customer adds cursor |
| Pay screen header | Published + eligible vendor by id |
| Discounts | **Not catalogue** — Quote API + Engine V2 |

**Admin architecture stable when customer adds:** category filter, geo radius, sort by distance — all extend **read queries** in shared repository, not admin services.

---

## 12. Out of Scope — Payment Flow Ownership

The following are **explicitly owned by `feature/wpay-payment-flow`** (not repeated here in design detail):

- Admin payment list / detail APIs
- Payment observability services
- `PaymentIntentRepository` read methods for admin
- Settlement / promotion / ledger status in admin UI
- Payment filters, exports, dashboards
- Admin refund orchestration (later sprint)

**Catalogue → payment-flow contract:** Published catalogue entries define **which vendors may appear** in customer discovery. Payment-flow does not mutate catalogue.

```text
feature/wpay-admin          feature/wpay-payment-flow
(catalogue CRUD)            (quote, initiate, verify, payment observability)
        │                              │
        └─ listPublishedEligible ─────►│ customer + admin payment views
```

---

## 13. Performance Considerations

| Area | Target |
|------|--------|
| Catalogue list p95 | < 50 ms at ~1k rows |
| Vendor candidates search | < 100 ms |
| Bulk publish 100 | < 3 s sequential |
| Lambda handler | Thin — no N+1 |

Low QPS admin traffic — prioritize correctness and audit trail over caching.

---

## 14. Security Considerations

| Risk | Mitigation |
|------|------------|
| IDOR on catalogue IDs | Admin auth + RBAC every route |
| Mass assignment (pricing fields) | Strict Zod `.strict()` |
| Bulk abuse | Max 100 IDs; rate limit bulk endpoints |
| SQL injection | Parameterized repo queries only |
| Audit tampering | Append-only audit inserts |
| Feature flag bypass | Backend check, not UI-only |

No payment PII in this module.

---

## 15. Future Scalability

| Dimension | Path |
|-----------|------|
| Large catalogues | Keyset pagination on `(updated_at, id)` |
| RBAC split | Granular catalogue read/write permissions |
| Approval workflow | Future `review_status` column — separate migration |
| Event-driven | Publish → EventBridge (post-MVP) |
| Multi-admin concurrency | Optimistic locking via `updated_at` check (post-MVP) |

Module remains **catalogue-only** — payment scale concerns live in payment-flow branch.

---

## 16. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| V1 sprint plan / UI includes payments tab | **High** | V2 scope: catalogue page only; payments tab in payment-flow PR |
| Sprint plan discount % on catalogue UI | **High** | Visibility-only — link to Promotion Engine for discounts |
| Publish invisible vendor | **Medium** | Eligibility warnings + UI badges |
| `bank_verified` unset on vendors | **Medium** | Warn on publish; document vendor-ops prerequisite |
| Handler registration conflicts | **Medium** | `registerWarmpawzPayCatalogueAdminRoutes` — single owner |
| Bulk partial failure UX | **Low** | Per-item result envelope |
| Shared repo coupling with customer branch | **Low** | Interface-first; customer consumes read methods only |

---

## 17. Recommended Folder Structure

### Backend

```text
backend/lambda/src/endpoints/warmpawz-pay/
├── admin/
│   └── catalogue/
│       ├── routes/
│       │   └── catalogue-admin.routes.ts
│       ├── handlers/
│       │   ├── catalogue-list.handler.ts
│       │   ├── catalogue-detail.handler.ts
│       │   ├── catalogue-create.handler.ts
│       │   ├── catalogue-publish.handler.ts
│       │   ├── catalogue-unpublish.handler.ts
│       │   ├── catalogue-delete.handler.ts
│       │   ├── catalogue-bulk.handler.ts
│       │   └── vendor-candidates.handler.ts
│       ├── services/
│       │   ├── vendor-catalog-admin.service.ts
│       │   ├── vendor-eligibility.service.ts
│       │   └── catalogue-audit.service.ts
│       ├── dto/
│       │   ├── catalogue.requests.ts
│       │   └── catalogue.responses.ts
│       ├── middleware/
│       │   └── require-warmpawz-pay-catalogue-admin.ts
│       └── index.ts              → registerWarmpawzPayCatalogueAdminRoutes(app)
├── repositories/
│   ├── vendor-catalog.repository.ts
│   ├── vendor-eligibility.repository.ts
│   └── interfaces/
│       ├── IVendorCatalogRepository.ts
│       └── IVendorEligibilityRepository.ts
├── constants/
│   └── publish-status.ts
└── index.ts                      → aggregates warmpawz-pay registrations
```

**Not in wpay-admin:**

- `payment-intent.repository.ts` admin read methods → payment-flow branch
- `admin/catalogue/../payments/*`
- `wpay-payments-admin.service.ts`

### Admin web

```text
apps/admin-web/
├── app/warmpawz-pay/
│   └── catalogue/
│       └── page.tsx
├── components/admin/warmpawz-pay/catalogue/
│   ├── CatalogueTable.tsx
│   ├── AddVendorDialog.tsx
│   ├── PublishStatusBadge.tsx
│   ├── EligibilityWarnings.tsx
│   └── BulkActionBar.tsx
└── lib/api/warmpawz-pay-catalogue-admin.ts
```

### Shared types

```text
packages/shared-types/src/
├── admin-portal-nav.ts           → nav entry (catalogue path)
└── warmpawz-pay-catalogue-admin.ts  → optional shared DTO types
```

---

## 18. Development Sequence

| Step | Deliverable | Branch |
|------|-------------|--------|
| 1 | Interfaces, DTOs, constants | `feature/wpay-admin` |
| 2 | `VendorCatalogRepository` | `feature/wpay-admin` |
| 3 | `VendorEligibilityRepository` + `VendorEligibilityService` | `feature/wpay-admin` |
| 4 | `VendorCatalogAdminService` + audit | `feature/wpay-admin` |
| 5 | CRUD + list APIs | `feature/wpay-admin` |
| 6 | Publish / unpublish APIs | `feature/wpay-admin` |
| 7 | Bulk APIs | `feature/wpay-admin` |
| 8 | RBAC + feature flag | `feature/wpay-admin` |
| 9 | Admin web catalogue UI | `feature/wpay-admin` |
| 10 | Integration tests + smoke | `feature/wpay-admin` |
| 11 | Handler registration | `feature/warmpawzpay` (integration) |

**Parallel:** Abhi customer API can consume `listPublishedEligible` once Step 2 merges.

**Payment observability:** Separate sequence on `feature/wpay-payment-flow` — see architecture doc §9.

---

## 19. Testing Strategy

### Unit

- `VendorCatalogAdminService` — create, duplicate, publish idempotent, warnings, bulk partial failure
- `VendorEligibilityService` — all flag combinations
- `VendorCatalogRepository` — conflict mapping
- Zod — reject unknown/pricing fields

### Integration (dev RDS)

- Create draft → row + `created_by`
- Publish with warnings
- Duplicate → 409
- Delete → absent from `listPublishedEligible`
- Bulk mixed results
- RBAC 403 without permission
- Feature disabled → 503

### Admin web

- Nav + route guard
- Add vendor dialog → create API
- Publish toggle → publish/unpublish API
- Eligibility warning badges render

### Manual smoke

1. Admin creates catalogue entry (draft).  
2. Admin publishes vendor.  
3. Customer list (Abhi) shows vendor when eligibility met.  
4. Admin unpublishes → customer list hides vendor.

**No payment smoke in wpay-admin** — payment smoke belongs to payment-flow branch.

---

## 20. Final Recommendations

### Do

1. Ship **catalogue-only** admin on `feature/wpay-admin`.  
2. Place code under `warmpawz-pay/admin/catalogue/`.  
3. Share `VendorCatalogRepository.listPublishedEligible` with customer API.  
4. Show eligibility warnings on publish.  
5. Hard-delete catalogue rows.  
6. Audit all mutating operations.  
7. Use strict DTOs — no pricing fields.  
8. Register routes via dedicated catalogue admin registrar.  
9. Defer all payment observability to `feature/wpay-payment-flow`.  
10. Update sprint plan UI to remove payments sub-tab from wpay-admin PR.

### Do not

1. Query `payments` or settlement tables from wpay-admin.  
2. Add payments tab to wpay-admin UI.  
3. Implement `PaymentIntentRepository` admin reads in this branch.  
4. Modify Phase 1 migration or schema.  
5. Couple catalogue to Promotion Engine pricing.

### GO / NO-GO

**GO** for catalogue-only `feature/wpay-admin`.

Payment observability is a **separate GO** on `feature/wpay-payment-flow` after payment write path exists.

---

*V2 — catalogue administration only. Payment observability removed per architectural adjustment.*
