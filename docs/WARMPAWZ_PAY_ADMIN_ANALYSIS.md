# Warmpawz Pay — Admin Module Analysis

**Milestone:** `feature/wpay-admin`  
**Prerequisite:** Phase 1 schema deployed (`1080_warmpawz_pay_phase1_schema.sql` on dev RDS)  
**Document type:** Architectural & implementation analysis — **no code, no SQL**  
**Date:** July 23, 2026  
**References:**

- `docs/WARMPAWZ_PAY_TECHNICAL_ARCHITECTURE_FINAL.md` (approved)
- `docs/WARMPAWZ_PAY_PHASE1_IMPLEMENTATION_PLAN.md`
- `docs/WARMPAWZ_PAY_PHASE1_SCHEMA_VERIFICATION.md`
- `docs/WARMPAWZ_PAY_SPRINT_PLAN.md` (UI tasks — catalogue is **visibility-only**, not pricing)

**Binding constraint:** `warmpawz_pay_vendor_catalog` controls **vendor publication visibility only**. Pricing, promotions, discounts, and quotes are owned by Promotion Engine V2 and payment-flow services — **not** this admin module.

---

## 1. Executive Summary

Warmpawz Pay Admin is the **operations console** for two distinct concerns:

| Concern | Scope in `feature/wpay-admin` | Data owner |
|---------|------------------------------|------------|
| **Vendor catalogue** | Add/remove vendors from Pay Bill discovery; draft ↔ published lifecycle | `warmpawz_pay_vendor_catalog` + read `vendors` eligibility flags |
| **Payment observability** | Read-only list/detail of Warmpawz Pay payments for finance/ops | `payments` WHERE `payment_source = 'warmpawz_pay'` |

Admin **does not** write payments, settlements, promotion usage, or ledger rows in this milestone. Those are owned by payment-flow (`feature/wpay-payment-flow`) and post-payment (`feature/wpay-post-payment`).

**Recommended delivery:** A self-contained admin slice inside the Warmpawz Pay bounded context (`backend/lambda/src/endpoints/warmpawz-pay/admin/`) registered via `registerWarmpawzPayAdminRoutes(app)`, plus admin-web pages under `/warmpawz-pay`. Reuse Phase 1 repository interfaces (`IVendorCatalogRepository`, read methods on `IPaymentIntentRepository`).

**Sprint-plan correction:** Older sprint notes mention “discount % on catalogue.” That is **superseded** by the approved architecture — admin catalogue APIs must **never** accept or return pricing/discount fields. Discount configuration belongs in Promotion Engine V2 / commercial campaigns, not `warmpawz_pay_vendor_catalog`.

**Verdict:** **GO** — schema supports all catalogue and read-only payment operations; no migration changes required for MVP admin.

---

## 2. Admin Architecture

### 2.1 Bounded context placement

```
┌─────────────────────────────────────────────────────────────────┐
│  apps/admin-web/app/warmpawz-pay/                               │
│    Catalogue tab │ Settlements/Payments tab                     │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS + admin JWT
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  warmpawz-pay/admin/                                            │
│    routes/ → handlers/ → services/ → repositories/              │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
 warmpawz_pay_vendor_catalog   vendors (read)   payments (read, filtered)
```

Admin routes live **inside** `warmpawz-pay/`, not in the monolith `admin-comprehensive.ts` blob. Registration is a single export consumed by `handler/index.ts` on the integration branch (`feature/warmpawzpay`).

### 2.2 Layering (mirrors architecture §22.6)

| Layer | Responsibility | Admin-specific |
|-------|----------------|----------------|
| **Routes** | Path, method, middleware hook | Register under `/admin/warmpawz-pay/*` |
| **Handlers** | Auth gate, parse request, map response | Thin (~≤12 lines); delegate to service |
| **Services** | Business rules, validation, audit orchestration | `VendorCatalogAdminService`, `WpayPaymentsAdminService` |
| **Repositories** | SQL only | `VendorCatalogRepository`, `PaymentIntentRepository` (read) |
| **DTOs** | Request/response shapes | Zod schemas in `warmpawz-pay/admin/dto/` |

**Forbidden:** Admin handlers importing `payments-enhanced.ts`, `razorpay.razorpay.ts`, booking/ecommerce modules (architecture §22.3).

### 2.3 Two admin sub-domains

**A. Catalogue administration (write-heavy)**  
Manages rows in `warmpawz_pay_vendor_catalog`. Does **not** mutate vendor core profile except optionally toggling `vendors.pay_bill_enabled` if product policy allows admin to enable Pay Bill on a vendor (recommend: **read-only display** of eligibility flags in MVP; separate vendor-ops flow sets `pay_bill_enabled`).

**B. Payment observability (read-only in this milestone)**  
Lists completed/pending Warmpawz Pay payments for ops. Refunds (`POST /v1/admin/warmpawz-pay/refunds`) are **Sprint 4** per architecture §9 — out of scope for initial `feature/wpay-admin` unless explicitly pulled forward.

### 2.4 Cross-cutting concerns

| Concern | Pattern |
|---------|---------|
| Auth | `requireAdminAuth(c)` from `admin.controller.ts` |
| RBAC | `resolveAdminPermissionsFromRequest` + `adminHasPermission(permissions, 'admin.warmpawz_pay')` |
| Audit | `entity_audit_log` or `admin_audit_log` insert on publish/unpublish/delete (follow `admin-comprehensive.ts` pattern) |
| Errors | `{ success: false, error: { code, message, details? } }` — align with architecture §9 envelope |
| Idempotency | Publish when already published → 200 no-op; unpublish when draft → 200 no-op |

### 2.5 Feature flag

Gate admin nav + routes on `WARMPAWZ_PAY_ENABLED` (Lambda env + admin runtime config). Backend returns `404` or `503 FEATURE_DISABLED` when flag off — prevents half-deployed UI.

---

## 3. Repository Design

### 3.1 `VendorCatalogRepository` (implements `IVendorCatalogRepository`)

**Owns:** `warmpawz_pay_vendor_catalog`  
**Transaction boundary:** Single-row writes in one statement; bulk ops in explicit `BEGIN…COMMIT` per batch.

#### Write methods

| Method | SQL intent | TX | Notes |
|--------|-----------|-----|-------|
| `insertDraft(vendorId, createdBy)` | `INSERT … publish_status='draft'` | Single stmt | Catch unique violation on `vendor_id` → `DUPLICATE_CATALOGUE_ENTRY` |
| `updatePublishStatus(catalogueId \| vendorId, status, publishedAt?)` | `UPDATE … SET publish_status, published_at, updated_at` | Single stmt | Set `published_at = NOW()` on transition to `published`; NULL on `draft` (product choice) |
| `deleteById(catalogueId)` | `DELETE FROM warmpawz_pay_vendor_catalog WHERE id = $1` | Single stmt | Hard delete — no soft-delete column |
| `deleteByVendorId(vendorId)` | Same by `vendor_id` | Single stmt | For bulk delete |
| `touchUpdatedAt(catalogueId)` | `UPDATE … updated_at = NOW()` | Single stmt | Implicit on all updates |

#### Read methods

| Method | Purpose | Joins |
|--------|---------|-------|
| `findById(catalogueId)` | Admin detail | `JOIN vendors v ON v.id = c.vendor_id` |
| `findByVendorId(vendorId)` | Duplicate check / upsert guard | Optional vendor join |
| `listAdmin(filters)` | Admin table | `JOIN vendors` — see §10 |
| `listPublishedEligible(filters)` | **Shared with customer API** (Abhi) | `JOIN vendors` + eligibility predicate |
| `countAdmin(filters)` | Pagination total | Same WHERE as list |
| `existsForVendor(vendorId)` | Pre-create validation | Index hit on `idx_wpay_catalog_vendor_id` |

#### Must NOT

- Read/write `discount_percent`, `promotion_id`, pricing columns (they do not exist — guard in code review).
- Write to `payments`, `settlements`, `promotion_usages`.

#### Error mapping

| DB error | App error |
|----------|-----------|
| `23505` unique on `vendor_id` | `409 DUPLICATE_CATALOGUE_ENTRY` |
| `23503` FK vendor missing | `404 VENDOR_NOT_FOUND` |
| `23503` FK RESTRICT on vendor delete | N/A for admin (admin deletes catalogue row, not vendor) |
| No row on update/delete | `404 CATALOGUE_ENTRY_NOT_FOUND` |

### 3.2 `PaymentIntentRepository` (read-only for admin)

**Owns reads:** `payments WHERE payment_source = 'warmpawz_pay'`

| Method | Purpose |
|--------|---------|
| `findByIdForAdmin(paymentId)` | Detail with vendor/customer names |
| `listForAdmin(filters)` | Settlements tab table |
| `countForAdmin(filters)` | Pagination |

**Always filter:** `payment_source = 'warmpawz_pay'` — never omit (architecture §22.5).

Optional LEFT JOINs for composite status (read-time, not stored):

- `settlements s ON s.payment_id = p.id AND s.order_type = 'warmpawz_pay'`
- `promotion_usages pu ON pu.payment_id = p.id`
- `customers c`, `vendors v`

### 3.3 `VendorEligibilityRepository` (thin read helper — optional)

**Owns:** read-only checks on `vendors`

| Method | Purpose |
|--------|---------|
| `getEligibilitySnapshot(vendorId)` | Returns `{ status, pay_bill_enabled, bank_verified, is_deleted, business_name, … }` |
| `searchCandidates(q, limit, offset)` | Vendor picker for “Add to catalogue” — approved/active vendors **not yet in catalogue** |

Keeps catalogue repository free of vendor-search SQL duplication.

### 3.4 Read vs write split

| Repository | Admin writes | Admin reads | Customer reads (future) |
|------------|-------------|-------------|-------------------------|
| `VendorCatalogRepository` | ✅ | ✅ | ✅ (`listPublishedEligible`) |
| `PaymentIntentRepository` | ❌ (payment-flow owns) | ✅ | ✅ (scoped to customer_id) |
| `SettlementAccrualRepository` | ❌ (post-payment owns) | Optional join in payment list | ❌ |

### 3.5 Caching opportunities (defer)

| Data | Cache | TTL | When |
|------|-------|-----|------|
| Published vendor list | CloudFront / app memory | 30–60s | High QPS customer list — **not admin** |
| Admin catalogue list | None MVP | — | Low volume; freshness matters |
| Eligibility flags | None | — | `bank_verified` changes must reflect immediately on publish attempt |

Admin path: **no caching** in MVP.

---

## 4. Service Design

### 4.1 `VendorCatalogAdminService`

**Responsibilities:**

| Operation | Service logic |
|-----------|---------------|
| **Create publication** | Validate vendor exists, not deleted, not duplicate catalogue row → `insertDraft` |
| **Update metadata** | MVP: no extra metadata columns — **update = publish status only** |
| **Publish** | Validate transition `draft → published`; optional eligibility **warnings** (see §7) |
| **Unpublish** | `published → draft`; clear or retain `published_at` (recommend retain for audit) |
| **Delete** | Hard delete catalogue row; idempotent 404 if gone |
| **Bulk publish/unpublish/delete** | Loop with per-item result envelope; partial success allowed |
| **List / search** | Map repo rows → admin DTOs with eligibility badges |

**Transaction boundaries:**

- Single-vendor publish: one `UPDATE` — no multi-table TX required for MVP.
- Bulk publish (N vendors): one TX with savepoints **or** N independent updates with aggregated result — prefer **independent updates** for partial failure clarity.

**Audit logging (application layer):**

After successful publish/unpublish/delete, insert audit row:

```text
entity_type: 'warmpawz_pay_vendor_catalog'
entity_id: catalogue.id
action: 'published' | 'unpublished' | 'created' | 'deleted'
actor_id: adminUserId (from JWT)
changes: { publish_status: { old, new }, vendor_id }
```

Use existing `entity_audit_log` / `admin_audit_log` pattern from governance endpoints.

### 4.2 `WpayPaymentsAdminService`

**Responsibilities:**

| Operation | Logic |
|-----------|-------|
| **List payments** | Filter `payment_source`, date range, vendor, customer, status |
| **Get payment detail** | Single payment + downstream composite status (read joins) |
| **Export** | Deferred — reuse `/admin/transactions/export` filter in post-MVP |

**No writes** in this milestone.

### 4.3 `VendorEligibilityService` (domain helper)

Encapsulates eligibility predicate (architecture §2):

```text
customerVisible =
  catalogue.publish_status = 'published'
  AND vendor.status = 'active'
  AND vendor.bank_verified = true
  AND vendor.pay_bill_enabled = true
  AND (vendor.is_deleted IS NOT true)
```

| Context | Behavior |
|---------|----------|
| Admin publish | **Allow** publish even if not customer-visible — show **warnings** in response |
| Customer list (Abhi) | **Filter** to customerVisible only |

This separates **admin intent** (published) from **runtime eligibility** (may block customer visibility until vendor completes bank/KYC).

### 4.4 Duplicate prevention

| Layer | Mechanism |
|-------|-----------|
| DB | `UNIQUE (vendor_id)` on catalogue + `idx_wpay_catalog_vendor_id` |
| Repository | Catch `23505` |
| Service | Pre-check `existsForVendor(vendorId)` before insert |
| API | `409` with clear message |

### 4.5 Publish status state machine

```text
                    ┌─────────┐
         create ──► │  draft  │◄── unpublish
                    └────┬────┘
                         │ publish
                         ▼
                    ┌───────────┐
                    │ published │
                    └───────────┘
```

Invalid transitions (e.g. `published → published`) → **idempotent success** with current row returned.

---

## 5. API Design

**Base path:** `/admin/warmpawz-pay`  
**Auth:** Admin Bearer JWT + permission `admin.warmpawz_pay` (or `admin.full_access`)  
**Envelope:** `{ success: true, data: … }` / `{ success: false, error: { code, message } }`

### 5.1 Catalogue endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/admin/warmpawz-pay/catalogue` | List catalogue entries (paginated, filterable) |
| `GET` | `/admin/warmpawz-pay/catalogue/:catalogueId` | Get single entry |
| `POST` | `/admin/warmpawz-pay/catalogue` | Create draft entry for vendor |
| `PUT` | `/admin/warmpawz-pay/catalogue/:catalogueId` | Update (MVP: no-op body fields except notes in audit — or reserve for future) |
| `POST` | `/admin/warmpawz-pay/catalogue/:catalogueId/publish` | Publish |
| `POST` | `/admin/warmpawz-pay/catalogue/:catalogueId/unpublish` | Unpublish → draft |
| `DELETE` | `/admin/warmpawz-pay/catalogue/:catalogueId` | Remove from catalogue |
| `GET` | `/admin/warmpawz-pay/catalogue/vendor-candidates` | Search vendors eligible to add (not in catalogue) |
| `POST` | `/admin/warmpawz-pay/catalogue/bulk/publish` | Bulk publish |
| `POST` | `/admin/warmpawz-pay/catalogue/bulk/unpublish` | Bulk unpublish |
| `POST` | `/admin/warmpawz-pay/catalogue/bulk/delete` | Bulk delete |

**Alternative REST shape (acceptable if team prefers):**  
`PATCH /catalogue/:id` with `{ publishStatus: 'published' | 'draft' }` instead of separate publish/unpublish POSTs — pick one style and stay consistent.

### 5.2 Payments / settlements observability endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/admin/warmpawz-pay/payments` | Paginated payment list |
| `GET` | `/admin/warmpawz-pay/payments/:paymentId` | Payment detail + downstream status |

Architecture also defines `POST /v1/admin/warmpawz-pay/refunds` — **defer** to payment/refund sprint unless product mandates in same branch.

### 5.3 Request models

**POST `/catalogue`**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `vendorId` | UUID | Yes | Exists, not deleted, not already in catalogue |

**Bulk POST body**

| Field | Type | Required |
|-------|------|----------|
| `catalogueIds` | UUID[] | Yes (min 1, max 100) |

**GET list query params**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `page` | int | 1 | 1-based |
| `pageSize` | int | 20 | Max 100 |
| `sortBy` | enum | `updatedAt` | `updatedAt`, `publishedAt`, `businessName`, `publishStatus` |
| `sortOrder` | enum | `desc` | `asc` \| `desc` |
| `publishStatus` | enum | — | `draft` \| `published` \| `all` |
| `q` | string | — | Search vendor name/city/phone |
| `eligibility` | enum | — | `customer_visible` \| `not_customer_visible` \| `all` |
| `city` | string | — | Future geo filter prep |
| `vendorId` | UUID | — | Exact filter |

**GET `/payments` query params**

| Param | Type | Notes |
|-------|------|-------|
| `page`, `pageSize`, `sortBy`, `sortOrder` | — | Same pattern |
| `paymentStatus` | enum | `pending`, `completed`, `failed`, … |
| `vendorId`, `customerId` | UUID | |
| `fromDate`, `toDate` | ISO date | On `created_at` or `completed_at` |
| `q` | string | Vendor/customer name search |

### 5.4 Response models

**Catalogue list item**

```ts
{
  catalogueId: string;
  vendorId: string;
  businessName: string;
  ownerName?: string;
  city?: string;
  phone?: string;
  publishStatus: 'draft' | 'published';
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  eligibility: {
    payBillEnabled: boolean;
    bankVerified: boolean;
    vendorStatus: string;
    customerVisible: boolean;  // computed
  };
  warnings?: string[];  // e.g. "Published but not customer-visible: bank not verified"
}
```

**Catalogue list envelope**

```ts
{
  success: true,
  data: {
    items: CatalogueListItem[];
    pagination: { page, pageSize, total, totalPages };
  }
}
```

**Payment list item**

```ts
{
  paymentId: string;
  vendorId: string;
  vendorName: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  originalAmount: number | null;
  discountAmount: number;
  payableAmount: number;
  paymentStatus: string;
  createdAt: string;
  completedAt: string | null;
  downstream?: {
    settlementStatus: string | 'not_created';
    promotionCommitted: boolean;
  };
}
```

### 5.5 Error responses

| HTTP | Code | When |
|------|------|------|
| 400 | `VALIDATION_ERROR` | Invalid UUID, invalid status, empty bulk array |
| 401 | `UNAUTHORIZED` | Missing/invalid admin auth |
| 403 | `FORBIDDEN` | Missing `admin.warmpawz_pay` |
| 404 | `VENDOR_NOT_FOUND` / `CATALOGUE_ENTRY_NOT_FOUND` / `PAYMENT_NOT_FOUND` |
| 409 | `DUPLICATE_CATALOGUE_ENTRY` | Vendor already in catalogue |
| 422 | `INVALID_STATE_TRANSITION` | Rare if idempotent design used |
| 503 | `FEATURE_DISABLED` | `WARMPAWZ_PAY_ENABLED=false` |

### 5.6 Bulk operation response

```ts
{
  success: true,
  data: {
    requested: number;
    succeeded: number;
    failed: number;
    results: Array<{ catalogueId: string; success: boolean; error?: { code, message } }>;
  }
}
```

---

## 6. Validation Rules

### 6.1 Catalogue — create

| Rule | Severity | Error |
|------|----------|-------|
| `vendorId` is valid UUID | Block | `VALIDATION_ERROR` |
| Vendor row exists | Block | `VENDOR_NOT_FOUND` |
| `vendors.is_deleted != true` | Block | `VENDOR_DELETED` |
| No existing catalogue row for vendor | Block | `DUPLICATE_CATALOGUE_ENTRY` |
| Vendor `status` in allowed set for onboarding | Warn | Warning only — allow draft for pending vendors |

**Recommend allowed statuses for create:** any non-deleted vendor (admin may pre-add before go-live).  
**Recommend publish block:** `status NOT IN ('active', 'approved')` → **warn**, not block (product decision: default **warn**).

### 6.2 Catalogue — publish

| Rule | Severity |
|------|----------|
| Catalogue entry exists | Block |
| Current status is `draft` (or idempotent if already `published`) | — |
| Vendor not deleted | Block |
| `pay_bill_enabled = true` | Warn |
| `bank_verified = true` | Warn |
| `status = 'active'` | Warn |

### 6.3 Catalogue — unpublish

| Rule | Severity |
|------|----------|
| Entry exists | Block |
| Idempotent if already `draft` | — |

### 6.4 Catalogue — delete

| Rule | Severity |
|------|----------|
| Entry exists | Block (404 if not) |
| No FK from payments to catalogue (none exists) | — |

Hard delete is safe — customer list simply stops showing vendor.

### 6.5 Payments — read

| Rule | Severity |
|------|----------|
| `paymentId` valid UUID | Block |
| Row exists AND `payment_source = 'warmpawz_pay'` | Block 404 if wrong source (do not leak other domains) |

### 6.6 Request sanitization

- Reject unknown body fields on create (prevent accidental pricing fields).
- Max `pageSize` 100.
- Bulk arrays max 100 IDs per request.

---

## 7. Business Rules

| ID | Rule |
|----|------|
| BR-01 | One catalogue row per vendor (DB unique + service guard). |
| BR-02 | New catalogue entries always start as `draft`. |
| BR-03 | `published_at` set on first publish; updated on republish if unpublish clears it (team choice: **set on every publish**). |
| BR-04 | Admin publish does **not** auto-set `vendors.pay_bill_enabled` or `bank_verified`. |
| BR-05 | Customer visibility requires catalogue **published** AND vendor eligibility flags (§4.3). |
| BR-06 | Catalogue has **no pricing** — discounts come from Promotion Engine V2 at quote time. |
| BR-07 | Deleting catalogue row removes vendor from Pay Bill discovery immediately. |
| BR-08 | Admin payment list includes all `payment_source = 'warmpawz_pay'` rows regardless of catalogue state (historical truth). |
| BR-09 | `created_by` set from admin JWT `userId` on create; immutable thereafter. |
| BR-10 | Bulk ops are best-effort per item — one failure must not roll back siblings. |

---

## 8. Permissions

### 8.1 New permission

Add to `packages/shared-types/src/admin-portal-nav.ts`:

| Field | Value |
|-------|-------|
| `id` | `warmpawz-pay` |
| `label` | Warmpawz Pay |
| `permissionId` | `admin.warmpawz_pay` |
| `pathPrefixes` | `['/warmpawz-pay']` |
| `section` | `main` |
| `sortOrder` | After settlements or ecommerce (TBD with design) |

Optional granular permissions (post-MVP RBAC):

| Permission | Capability |
|------------|------------|
| `admin.warmpawz_pay.catalogue.read` | List/view catalogue |
| `admin.warmpawz_pay.catalogue.write` | Create/publish/delete |
| `admin.warmpawz_pay.payments.read` | Payments tab |

MVP: single `admin.warmpawz_pay` covering all admin wpay routes.

### 8.2 Role mapping

| Role | Access |
|------|--------|
| Master admin / `admin.full_access` | All |
| Finance ops | `admin.warmpawz_pay` or payments.read only (future split) |
| Support | Read-only catalogue + payments |

### 8.3 Enforcement

1. **Backend (authoritative):** After `requireAdminAuth`, resolve permissions; deny 403 if missing.
2. **Frontend (UX):** `AdminRouteGuard` via `pathPrefixes`; hide nav item if no permission.

### 8.4 Audit ownership

| Field | Source |
|-------|--------|
| `created_by` | Admin UUID from JWT at create time |
| `updated_by` | **Not in schema** — use audit log `actor_id` for updates; defer column to future migration if needed |

UAT mode: `uat-admin-user` synthetic ID — acceptable on dev only.

---

## 9. Database Access Strategy

### 9.1 Existing indexes (Phase 1 — sufficient for MVP)

| Index | Admin use |
|-------|-----------|
| `idx_wpay_catalog_vendor_id` UNIQUE `(vendor_id)` | Duplicate prevention, lookup by vendor |
| `idx_wpay_catalog_published` `(vendor_id) WHERE publish_status = 'published'` | Customer list (Abhi) |
| `idx_payments_wpay_vendor_date` | Payment list by vendor |
| `idx_payments_wpay_customer_date` | Payment list by customer |
| `idx_payments_wpay_pending` | Ops filter pending |
| `idx_payments_status` (global) | Status filter fallback |

### 9.2 Recommended admin list query (catalogue)

```text
SELECT c.*, v.business_name, v.city, v.phone, v.status,
       v.pay_bill_enabled, v.bank_verified, v.is_deleted
FROM warmpawz_pay_vendor_catalog c
INNER JOIN vendors v ON v.id = c.vendor_id
WHERE (v.is_deleted IS NOT TRUE)
  AND ($publishStatus filter)
  AND ($q ILIKE on business_name, city, phone)
ORDER BY c.updated_at DESC
LIMIT $pageSize OFFSET ($page - 1) * $pageSize
```

**Pagination:** offset-based for admin (low volume). Customer API uses cursor (Abhi).

### 9.3 Recommended admin list query (payments)

```text
SELECT p.*, v.business_name, c.full_name, c.phone
FROM payments p
LEFT JOIN vendors v ON v.id = p.vendor_id
LEFT JOIN customers c ON c.id = p.customer_id
WHERE p.payment_source = 'warmpawz_pay'
  AND ($status, $vendorId, $dateRange, $q filters)
ORDER BY p.created_at DESC
LIMIT/OFFSET
```

Uses `idx_payments_wpay_*` when filters align; otherwise `idx_payments_created_at`.

### 9.4 Soft delete vs hard delete

| Entity | Strategy |
|--------|----------|
| Catalogue row | **Hard delete** — no `is_deleted` on catalogue |
| Vendor | Never deleted by admin module — only read |
| Payment | Never deleted — read-only |

### 9.5 Future index optimizations (post-MVP)

| Index | When |
|-------|------|
| `(publish_status, updated_at DESC)` on catalogue | Admin list always filters by status |
| `(payment_status, created_at DESC) WHERE payment_source = 'warmpawz_pay'` | Heavy ops dashboard |
| GIN on `vendors.business_name` | If `q` search slow — likely unnecessary at MVP scale |

**No migration in `feature/wpay-admin`** unless profiling proves need.

---

## 10. Search / Pagination Strategy

### 10.1 Admin catalogue

| Aspect | Choice |
|--------|--------|
| Pagination | Offset (`page`, `pageSize`) — simple admin tables |
| Default sort | `updated_at DESC` |
| Search `q` | `ILIKE` on `vendors.business_name`, `vendors.city`, `vendors.phone` |
| Filter `publishStatus` | Exact match on catalogue column |
| Filter `eligibility` | Computed in SQL or service layer |

**Vendor candidates search** (add flow):

```text
SELECT v.id, v.business_name, v.city, v.status
FROM vendors v
WHERE (v.is_deleted IS NOT TRUE)
  AND v.id NOT IN (SELECT vendor_id FROM warmpawz_pay_vendor_catalog)
  AND ($q filter)
  AND v.status IN ('active', 'approved')  -- tighten per product
ORDER BY v.business_name
LIMIT 20
```

### 10.2 Admin payments

| Aspect | Choice |
|--------|--------|
| Pagination | Offset MVP; cursor optional post-MVP for deep history |
| Default sort | `created_at DESC` |
| Search | Vendor name, customer name/phone, `payment_id` exact |
| Date range | Required for export-scale queries — recommend max 90-day window default |

### 10.3 Bulk operations

- Process sequentially or small parallel batches (5–10) to avoid RDS connection spike.
- Return per-item results — admin UI shows partial success toast.

---

## 11. Future Customer Integration

Admin module **prepares** customer discovery without coupling:

| Customer need | Admin provides | Customer API (Abhi) consumes |
|---------------|----------------|------------------------------|
| Published vendors only | `publish_status = 'published'` rows | `VendorCatalogRepository.listPublishedEligible()` |
| Vendor name/address | Join `vendors` in repo | Lean DTO `{ vendorId, name, address }` |
| Search by name | Same `q` ILIKE pattern | Cursor pagination, page size 5 |
| Pay screen header | Catalogue + vendor row | `GET /customer/warmpawz-pay/vendors/:id` |
| Discount display | **Not from catalogue** | Quote API + Promotion Engine V2 |

**Admin architecture unchanged when customer adds:**

- Category filter → extend list query JOIN on `vendors.category`
- Geo filter → `latitude/longitude` + radius (vendors already have lat/long)
- Sort by distance → customer service concern, not admin

**Contract stability:** Admin DTOs ≠ customer DTOs — map in respective services.

---

## 12. Future Payment Flow Integration

Interaction points only — **not implemented in `feature/wpay-admin`**.

```text
┌──────────────────┐     ┌─────────────────────┐     ┌────────────────────┐
│ Admin Catalogue  │     │ Customer Pay Flow   │     │ Post-Payment       │
│ (this milestone) │     │ (wpay-payment-flow) │     │ (wpay-post-payment)│
└────────┬─────────┘     └──────────┬──────────┘     └─────────┬──────────┘
         │                          │                          │
         │ published vendors        │                          │
         └────────────────────────► │ listPublishedEligible    │
                                    │                          │
                                    ▼                          │
                          QuoteService ◄── Discount Engine V2   │
                                    │                          │
                                    ▼                          │
                          PaymentIntentRepository.insert        │
                                    │                          │
                                    ▼                          │
                          verify ─────────────────────────────►│
                                                               │
                                    ┌──────────────────────────┤
                                    ▼                          ▼
                          SettlementAccrualRepository   PromotionUsageRepository
                                    │                          │
                                    └──────────┬───────────────┘
                                               ▼
                                    TransactionLedgerRepository
                                               │
                                               ▼
                                    Admin payments tab (read joins)
```

| Integration | Direction | Contract |
|-------------|-----------|----------|
| **PaymentIntentRepository** | Payment-flow writes; admin reads | Filter `payment_source` |
| **Quote API** | Independent of catalogue pricing | Engine resolves promos |
| **Discount Engine V2** | No admin catalogue coupling | Domain `WARMPAWZ_PAY` |
| **PostPaymentProcessor** | Writes settlement/usage/ledger | Admin observes via joins |
| **SettlementAccrualRepository** | Async insert after verify | Admin shows `settlement_status` |
| **PromotionUsageRepository** | Async promo commit | Admin shows committed flag |
| **TransactionLedgerRepository** | Async ledger | Finance may also use `/admin/transactions?category=warmpawz_pay` |

Admin refund (future): `RefundService` in warmpawz-pay — separate from catalogue service.

---

## 13. Performance Considerations

| Area | Expectation | Mitigation |
|------|-------------|------------|
| Catalogue list | < 50 ms p95 at 1k rows | Indexed joins, limit pageSize |
| Payment list | Depends on `payments` table size | Partial indexes + date filters |
| Bulk publish 100 | < 3 s | Sequential updates acceptable |
| N+1 eligibility | Avoid | Single JOIN query |
| Lambda cold start | +1 registration function | Keep admin handlers lightweight |

Admin traffic is **low QPS** — optimize for correctness and auditability over caching.

---

## 14. Security Considerations

| Risk | Mitigation |
|------|------------|
| IDOR on catalogue/payment IDs | Admin auth + permission check on every route |
| Cross-domain payment leak | Strict `payment_source = 'warmpawz_pay'` filter |
| Mass assignment (pricing fields) | Zod strict schema; reject unknown keys |
| Bulk abuse | Max 100 IDs; rate limit bulk endpoints (10/min/admin) |
| UAT bypass in prod | `requireAdminAuth` production guards already exist |
| SQL injection | Parameterized queries in repositories only |
| Audit tampering | Append-only audit log inserts |

**PII in payment list:** customer phone/name — mask in UI for non-support roles (future field-level RBAC).

---

## 15. Future Scalability

| Dimension | Path |
|-----------|------|
| **More vendors in catalogue** | Offset pagination → keyset on `(updated_at, id)` |
| **Multi-region** | No change — single RDS |
| **Admin teams / RBAC split** | Granular permissions (§8.1) |
| **Catalogue metadata** | New columns via future migration — not pricing |
| **Workflow (approval queue)** | Add `review_status` column later — not MVP |
| **Event-driven audit** | Publish event to EventBridge post-MVP |
| **Read replicas** | Admin list queries candidate for replica routing at scale |

Module stays cohesive: all Warmpawz Pay admin logic in one folder, one registration function.

---

## 16. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Sprint plan UI shows discount % on catalogue | **High** | Follow architecture — UI links to Promotion Engine, not catalogue |
| Admin publishes vendor not customer-visible | **Medium** | Eligibility warnings in API + admin UI badges |
| `bank_verified` / `pay_bill_enabled` not set on vendors | **Medium** | Document vendor-ops prerequisite; warn on publish |
| Duplicate handler registration conflicts | **Medium** | Single `registerWarmpawzPayAdminRoutes` owner (Abhi integration branch) |
| Offset pagination on large payment history | **Low** | Date filters + future cursor |
| `created_by` without admin FK | **Low** | Store UUID; validate exists when admins table reliable |
| Dev RDS missing `settlements.order_type` | **Low** | Already patched on dev; verify prod before 1080 apply |
| Bulk partial failure UX confusion | **Low** | Per-item result envelope |

---

## 17. Recommended Folder Structure

### 17.1 Backend

```text
backend/lambda/src/endpoints/warmpawz-pay/
├── admin/
│   ├── routes/
│   │   ├── admin-warmpawz-pay-catalogue.routes.ts
│   │   └── admin-warmpawz-pay-payments.routes.ts
│   ├── handlers/
│   │   ├── catalogue-list.handler.ts
│   │   ├── catalogue-create.handler.ts
│   │   ├── catalogue-publish.handler.ts
│   │   ├── catalogue-unpublish.handler.ts
│   │   ├── catalogue-delete.handler.ts
│   │   ├── catalogue-bulk.handler.ts
│   │   ├── vendor-candidates.handler.ts
│   │   ├── payments-list.handler.ts
│   │   └── payments-detail.handler.ts
│   ├── services/
│   │   ├── vendor-catalog-admin.service.ts
│   │   ├── wpay-payments-admin.service.ts
│   │   └── vendor-eligibility.service.ts
│   ├── dto/
│   │   ├── catalogue.requests.ts
│   │   ├── catalogue.responses.ts
│   │   └── payments.responses.ts
│   ├── middleware/
│   │   └── require-warmpawz-pay-admin.ts
│   └── index.ts                    → registerWarmpawzPayAdminRoutes(app)
├── repositories/
│   ├── vendor-catalog.repository.ts
│   ├── payment-intent.repository.ts
│   ├── vendor-eligibility.repository.ts
│   └── interfaces/
│       ├── IVendorCatalogRepository.ts
│       └── IPaymentIntentRepository.ts
├── constants/
│   └── publish-status.ts
└── index.ts                        → registerWarmpawzPayRoutes (customer + admin + payment)
```

### 17.2 Admin web

```text
apps/admin-web/
├── app/warmpawz-pay/
│   ├── page.tsx                      → layout with sub-sidebar
│   ├── catalogue/
│   │   └── page.tsx                  → list + add + publish toggles
│   └── payments/
│       └── page.tsx                  → settlements/payments table
├── components/admin/warmpawz-pay/
│   ├── CatalogueTable.tsx
│   ├── AddVendorDialog.tsx
│   ├── PublishStatusBadge.tsx
│   ├── EligibilityWarnings.tsx
│   └── PaymentsTable.tsx
└── lib/api/warmpawz-pay-admin.ts     → typed API client
```

### 17.3 Shared types

```text
packages/shared-types/src/
├── admin-portal-nav.ts               → add nav + permission
└── warmpawz-pay-admin.ts             → optional DTO types shared with admin-web
```

---

## 18. Development Sequence

| Step | Deliverable | Branch | Depends on |
|------|-------------|--------|------------|
| 1 | Repository interfaces + `VendorCatalogRepository` impl + unit tests | `feature/wpay-admin` | Phase 1 schema merged |
| 2 | `VendorEligibilityService` + vendor candidates query | `feature/wpay-admin` | Step 1 |
| 3 | `VendorCatalogAdminService` + audit logging | `feature/wpay-admin` | Step 1–2 |
| 4 | Catalogue admin routes/handlers (CRUD + publish + bulk) | `feature/wpay-admin` | Step 3 |
| 5 | `PaymentIntentRepository` read methods + `WpayPaymentsAdminService` | `feature/wpay-admin` | Step 1 |
| 6 | Payments admin routes/handlers | `feature/wpay-admin` | Step 5 |
| 7 | `admin.warmpawz_pay` permission + nav entry | `feature/wpay-admin` | — |
| 8 | Admin web catalogue tab | `feature/wpay-admin` | Step 4, 7 |
| 9 | Admin web payments tab | `feature/wpay-admin` | Step 6, 7 |
| 10 | Integration tests + dev smoke | `feature/wpay-admin` | Steps 4–9 |
| 11 | `registerWarmpawzPayAdminRoutes` wired in handler | `feature/warmpawzpay` (Abhi) | Step 4, 6 merged |

**Parallel work:** Abhi can start customer read repos using `listPublishedEligible` once Step 1 merges to `develop`.

---

## 19. Testing Strategy

### 19.1 Unit tests

| Target | Cases |
|--------|-------|
| `VendorCatalogAdminService` | create duplicate, publish idempotent, unpublish, eligibility warnings |
| `VendorEligibilityService` | all flag combinations for `customerVisible` |
| `VendorCatalogRepository` | mock PG — insert conflict mapping |
| Zod DTOs | reject pricing fields, invalid UUIDs |

### 19.2 Integration tests (dev RDS or testcontainers)

| Scenario | Assert |
|----------|--------|
| Create draft catalogue entry | Row exists, `publish_status=draft`, `created_by` set |
| Publish → customer repo returns vendor | Only when eligibility satisfied |
| Publish with unverified bank | 200 + warnings; customer list excludes |
| Duplicate create | 409 |
| Delete → customer list excludes | |
| Bulk publish partial failure | Mixed results envelope |
| Payment list | Only `warmpawz_pay` rows |
| Wrong payment source detail | 404 |

### 19.3 Admin web

| Test | Type |
|------|------|
| Nav visible with permission | Component |
| Route guard blocks without permission | E2E/manual |
| Publish toggle calls correct API | Integration |

### 19.4 Manual dev smoke (from sprint plan)

1. Admin adds vendor to catalogue (draft).  
2. Admin publishes vendor.  
3. Vendor appears in customer list (Abhi's API) when eligibility met.  
4. Complete test payment (Bindu payment-flow).  
5. Admin payments tab shows row with amounts.

### 19.5 CI gates

- `npm run build` in `backend/lambda`
- Optional: `validate:warmpawz-pay-deps` (forbidden imports) when script lands on payment-flow branch
- No `validate:customer-layers` required for admin module (not customer 4-layer)

---

## 20. Final Recommendations

### 20.1 Do

1. **Treat catalogue as visibility-only** — no discount/pricing APIs or UI fields.  
2. **Implement admin inside `warmpawz-pay/admin/`** with thin handlers and dedicated services.  
3. **Reuse `VendorCatalogRepository.listPublishedEligible`** as the single customer/admin visibility source of truth.  
4. **Show eligibility warnings** on publish — do not silently publish “invisible” vendors without UI feedback.  
5. **Hard-delete catalogue rows** — matches schema; simplest ops model.  
6. **Filter payments with `payment_source = 'warmpawz_pay'`** on every admin payment query.  
7. **Add `admin.warmpawz_pay` to shared-types nav** for RBAC + route guard parity.  
8. **Audit publish/unpublish/delete** to `entity_audit_log`.  
9. **Use offset pagination** for admin; leave cursor pagination to customer APIs.  
10. **Defer refunds** to architecture Sprint 4 unless product reprioritizes.

### 20.2 Do not

1. Do not add pricing columns to catalogue or admin APIs.  
2. Do not import booking/ecommerce/razorpay monolith handlers.  
3. Do not write payments/settlements from admin module in this milestone.  
4. Do not modify migration `1080` or schema.  
5. Do not auto-enable `pay_bill_enabled` on publish without explicit product approval.  
6. Do not duplicate vendor CRUD — catalogue references existing vendors only.

### 20.3 GO / NO-GO

**GO** for `feature/wpay-admin` implementation.

Schema, indexes, and repository contracts from Phase 1 are sufficient. No blocking database changes. Primary engineering discipline: **keep catalogue decoupled from Promotion Engine V2** while presenting a cohesive admin experience (catalogue + payment observability) under `/warmpawz-pay` in the admin portal.

---

*End of document — analysis only; no code or SQL generated.*
