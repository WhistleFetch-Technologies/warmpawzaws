# Warmpawz Appointments — Branch Implementation Record

**Branch:** `feature/book-an-appointment`  
**Base:** `develop`  
**Status:** Phase A MVP (admin catalogue + customer discovery + flat-fee booking + admin dashboard)  
**Last updated:** 2026-07-28  

This document is the **complete implementation record** for everything shipped on `feature/book-an-appointment`: thought process, architecture, endpoints, DTOs, flags, migrations, UI flows, and operational notes.

---

## 1. Product model (what we built)

### 1.1 Business rules (Phase A)

| Rule | Implementation |
|------|----------------|
| Admin curates vendors | `warmpawz_appointments_vendor_catalog` table + admin catalogue UI |
| Flat appointment fee per vendor | `appointment_fee` on catalogue row; server authority at checkout |
| No list/catalogue prices for customers | Discovery DTOs omit `priceMin`/`priceMax`; `warmpawzAppointments: true` on cards |
| Customer books via standard flow | Category → style → vendor list → **profile** → Book Appointment → Service → Details → Summary → Payment |
| Payment uses existing Razorpay | `UniversalPaymentPage` unchanged for gateway; booking create + verify unchanged post-payment |
| Booking tagged for reporting | `bookings.commerce_mode = 'warmpawz_appointments'` |
| Admin sees orders | `/admin/warmpawz-appointments/dashboard` + `/bookings` |

### 1.2 Thought process

1. **Reuse discovery, don’t fork it** — Instead of a parallel vendor search stack, gate existing `discover-services` and `services/by-style` with a catalogue SQL join when `WARMPAWZ_APPOINTMENTS_ENABLED=true`.
2. **Synthetic service id** — Customer slot APIs and checkout use `serviceId: warmpawz_appointments`; backend preflight resolves a real `vendor_services` row + catalogue fee before insert.
3. **Freeze commerce at booking** — `commerce_mode` on `bookings` (migration `1081`) distinguishes WAPPT from marketplace; admin dashboard filters on this (with catalogue fee fallback for legacy rows).
4. **Profile-only CTA** — List cards show **View Services** only; **Book Appointment** lives on vendor profile footer (matches “catalogue browsing, commit on profile”).
5. **Category-aware booking UX** — Vet WAPPT routes to `VetBookingRouter` (4-step standard UI); grooming/training/sitting use `GroomingBookingRouter` with `appointmentsMode` (category-aware headers, slot load, fee).

### 1.3 Out of scope (Phase B/C — documented, not built here)

- Commerce Switch programme router replacing `appointmentsMode` flags
- Two-phase pay / final bill / Merchant Programme billing
- See `docs/WARMPAWZ_APPOINTMENTS_JOINT_PLAN.md` and `docs/ARCHITECTURE_ANALYSIS_MERCHANT_PROGRAMME.md`

---

## 2. Feature flags & environment

### 2.1 Backend (Lambda)

| Env var | Purpose |
|---------|---------|
| `WARMPAWZ_APPOINTMENTS_ENABLED` | Customer discovery filter, fee API, booking preflight, catalogue join |
| `WARMPAWZ_APPOINTMENTS_ADMIN_ENABLED` | Admin catalogue + dashboard routes |

**Enable on dev Lambda:**

```bash
node scripts/set-dev-wappt-env.js
# or set both vars on warmpawz-dev-api-handler manually
```

**Guards:** `requireWarmpawzAppointmentsEnabled` / `requireWarmpawzAppointmentsAdminEnabled` in  
`backend/lambda/src/endpoints/warmpawz-appointments/admin/shared/wappt-admin-route-guards.ts`  
→ returns HTTP 503 `FEATURE_DISABLED` when flag off.

### 2.2 Customer web

| Source | Key |
|--------|-----|
| Build-time | `NEXT_PUBLIC_WARMPAWZ_APPOINTMENTS_ENABLED=true` |
| Runtime | `window.__WARMPAWZ_RUNTIME_CONFIG__.warmpawzAppointmentsEnabled` |

**Helper:** `apps/customer-web/lib/warmpawz-appointments-customer.ts` → `isWarmpawzAppointmentsCustomerEnabled()`

### 2.3 Admin web

| Source | Key |
|--------|-----|
| Build-time | `NEXT_PUBLIC_WARMPAWZ_APPOINTMENTS_ADMIN_ENABLED=true` |
| Runtime | `window.__WARMPAWZ_RUNTIME_CONFIG__.warmpawzAppointmentsAdminEnabled` |

**Helper:** `apps/admin-web/lib/warmpawz-appointments-admin-feature.ts`  
**Nav:** sidebar item `warmpawz-appointments-catalogue` gated in `UnifiedAdminSidebar.tsx`

---

## 3. Database migrations

| File | Purpose |
|------|---------|
| `1081_add_bookings_commerce_mode.sql` | `bookings.commerce_mode`, `bookings.commerce_version`, index |
| `1083_warmpawz_appointments_schema.sql` | `warmpawz_appointments_vendor_catalog` table + constraints |
| `1084_warmpawz_appointments_admin_rbac.sql` | Admin permissions for catalogue + dashboard |
| `1085_wappt_backfill_commerce_mode.sql` | Backfill `commerce_mode='warmpawz_appointments'` where vendor in published catalogue and `base_price` matches `appointment_fee` |

### 3.1 Catalogue table schema

```sql
warmpawz_appointments_vendor_catalog (
  id UUID PK,
  vendor_id UUID UNIQUE → vendors(id),
  appointment_fee NUMERIC(12,2) NOT NULL,
  publish_status TEXT CHECK ('draft' | 'published'),
  published_at TIMESTAMPTZ,
  created_by UUID,
  created_at, updated_at
)
```

### 3.2 Migration order on shared RDS

```bash
ENVIRONMENT=dev node scripts/run-migration-rds-node.js 1081_add_bookings_commerce_mode.sql
ENVIRONMENT=dev node scripts/run-migration-rds-node.js 1083_warmpawz_appointments_schema.sql
ENVIRONMENT=dev node scripts/run-migration-rds-node.js 1084_warmpawz_appointments_admin_rbac.sql
# After first WAPPT bookings exist without commerce_mode:
ENVIRONMENT=dev node scripts/run-migration-rds-node.js 1085_wappt_backfill_commerce_mode.sql
```

**Ops note:** Dev was missing `1081` initially; admin dashboard returned empty until column existed. Dashboard repo now logs explicit migration hint if column missing.

---

## 4. Backend API — registration

Registered in `backend/lambda/src/handler/index.ts`:

```typescript
registerCustomerWarmpawzAppointmentsEndpoints(app);      // dedicated WAPPT customer routes
registerWarmpawzAppointmentsCatalogueAdminRoutes(app); // admin catalogue CRUD
registerWarmpawzAppointmentsDashboardAdmin(app);         // admin metrics + bookings list
```

Existing discovery routes **updated in place** (not new paths):

- `GET /customer/discover-services`
- `GET /customer/services/by-style`
- `GET /customer/discovery/count`
- `POST /bookings/create` (bookings-enhanced)

---

## 5. Backend API — endpoints reference

### 5.1 Customer — dedicated Warmpawz Appointments module

`backend/lambda/src/endpoints/customer/warmpawz-appointments/`

| Method | Path | Handler | Service | Response |
|--------|------|---------|---------|----------|
| GET | `/customer/warmpawz-appointments/discovery/by-style` | `discovery_by_style_get.handler` | Alias to by-style with catalogue options | Same as `services/by-style` |
| GET | `/customer/warmpawz-appointments/vendors/:vendorId/fee` | `vendor_fee_get.handler` | `vendor_fee_get.service` | `{ success, vendorId, appointmentFee, currency }` |

**Fee repo SQL:** joins catalogue + `wapptCatalogueCustomerVisibleSql` (published + vendor approved/active).

### 5.2 Customer — discovery (modified behaviour)

When `WARMPAWZ_APPOINTMENTS_ENABLED=true`, these paths apply catalogue filter:

| Path | Change |
|------|--------|
| `GET /customer/discover-services` | `wapptCatalogueOnly`, `omitPricing`, `markWarmpawzAppointments` via `resolveWarmpawzCatalogueDiscoveryOptions()` |
| `GET /customer/services/by-style` | Same options in `services-by-style.service.ts` |
| `GET /customer/discovery/count` | Count respects catalogue join |

**Key files:**

- `discovery/services/wappt-catalogue-discovery.service.ts` — flag + options resolver
- `discovery/services/shared/wappt-catalogue-vendor-join.ts` — SQL join fragment
- `discovery/repos/wappt-catalogue.repo.ts` — `dbIsVendorWapptCataloguePublished`
- `discovery/services/vendor-services/wappt-pricing.ts` — omit service prices on profile for catalogue vendors
- `utils/discovery-list-enrich.ts` — sets `warmpawzAppointments: true`, skips price fields when `omitPricing`
- `utils/appointment-vendor-card-dto.ts` — slim card DTO (no pricing)
- `utils/appointment-list-response.ts` — appointments list response shape

**Discovery card fields (WAPPT):**

```typescript
{
  // ...standard vendor card fields...
  warmpawzAppointments: true,
  // priceMin, priceMax omitted
}
```

### 5.3 Customer — booking create (modified)

**Path:** `POST /bookings/create`  
**File:** `backend/lambda/src/endpoints/booking/endpoints/bookings-enhanced.booking.ts`

**WAPPT detection** (`wappt-booking-preflight.ts`):

```typescript
bookingMode === 'warmpawz_appointments'
  OR serviceId === 'warmpawz_appointments' (case-insensitive)
```

**Preflight** (`resolveWarmpawzAppointmentsBookingPreflight`):

1. Load `appointment_fee` from published catalogue row (vendor visible)
2. Resolve first published `vendor_services` row for `serviceStyle`
3. Override `body.serviceId`, `body.amount`, `body.totalAmount`
4. Set `body.bookingMode = 'warmpawz_appointments'`

**On insert:**

```typescript
bookingCommerceMode = 'warmpawz_appointments'
bookingData.commerce_mode = bookingCommerceMode
bookingData.commerce_version = 1
```

**API contract** (`packages/api-contracts/src/bookings.ts`):

- `serviceId` accepts UUID **or** `warmpawz_appointments`
- `bookingMode?: 'warmpawz_appointments'`

**Post-payment:** unchanged develop behaviour — vendor notification, customer My Bookings, OTP, etc.

### 5.4 Admin — catalogue

**Base:** `/admin/warmpawz-appointments/catalogue`  
**Module:** `backend/lambda/src/endpoints/warmpawz-appointments/admin/catalogue/`

| Method | Path | Permission | Handler |
|--------|------|------------|---------|
| GET | `/catalogue` | `catalogue.view` | List + filter + pagination |
| GET | `/catalogue/service-categories` | `catalogue.view` | Category options |
| GET | `/catalogue/vendor-candidates` | `catalogue.view` | Eligible vendors not yet in catalogue |
| GET | `/catalogue/:catalogueId` | `catalogue.view` | Detail + audit summary |
| POST | `/catalogue` | `catalogue.create` | Add vendor to catalogue |
| PUT | `/catalogue/:catalogueId/fee` | `catalogue.fee.write` | Update appointment fee |
| POST | `/catalogue/:catalogueId/publish` | `catalogue.publish` | Publish |
| POST | `/catalogue/:catalogueId/unpublish` | `catalogue.unpublish` | Unpublish |
| DELETE | `/catalogue/:catalogueId` | `catalogue.delete` | Remove row |
| POST | `/catalogue/bulk/publish` | `catalogue.bulk` | Bulk publish |
| POST | `/catalogue/bulk/unpublish` | `catalogue.bulk` | Bulk unpublish |
| POST | `/catalogue/bulk/delete` | `catalogue.bulk` | Bulk delete |
| POST | `/catalogue/bulk-fee` | `catalogue.fee.write` | Bulk fee update |

**Layering:**

```
routes/catalogue-admin.routes.ts
  → handlers/*.handler.ts (thin)
  → services/vendor-catalog-admin.service.ts (business logic)
  → repositories/vendor-catalog.repository.ts (SQL)
  → repositories/catalogue-audit.repository.ts (audit trail)
```

**Admin DTOs** (`admin/catalogue/dto/`):

- `catalogue.requests.ts` — create, fee update, bulk ops, list filters
- `catalogue.responses.ts` — `CatalogueListItem`, `CatalogueDetail`, `VendorCandidateDTO`, `PaginationResponse`, `BulkOperationResultItem`
- `catalogue.errors.ts` — `CatalogueErrorCode`, `FEATURE_DISABLED`, validation errors

**Merchant enrichment** (`shared/merchant/`):

- `merchant-readiness.service.ts` — readiness score for admin table
- `merchant-warmpawz-appointments-status.resolver.ts` — Draft | Published | Hidden
- `merchant-platform-status.resolver.ts`, `merchant-service-category.resolver.ts`, etc.

**RBAC permissions** (`admin/catalogue/authorization/permissions.ts`):

- `admin.warmpawz_appointments`
- `admin.warmpawz_appointments.catalogue.view|create|delete|publish|unpublish|bulk|fee.write`

### 5.5 Admin — dashboard

**Base:** `/admin/warmpawz-appointments`

| Method | Path | Response |
|--------|------|----------|
| GET | `/dashboard` | `{ publishedVendorCount, averageAppointmentFee, totalRevenue }` |
| GET | `/bookings?page=&pageSize=` | `{ rows: WapptAdminBookingRow[], total }` |

**Repository:** `repositories/wappt-dashboard.repository.ts`

**Booking filter logic:**

```sql
commerce_mode = 'warmpawz_appointments'
OR (
  vendor in published catalogue
  AND ABS(base_price - appointment_fee) < 0.02
)
```

**Row shape:**

```typescript
{
  bookingId, customerName, customerPhone,
  merchantDisplayName, bookingDate, bookingTime,
  baseFeePaid, createdAt
}
```

---

## 6. Customer web implementation

### 6.1 Shared helpers

**File:** `apps/customer-web/lib/warmpawz-appointments-customer.ts`

| Export | Purpose |
|--------|---------|
| `isWarmpawzAppointmentsCustomerEnabled()` | Feature gate |
| `isWarmpawzAppointmentsVendor(row)` | `row.warmpawzAppointments === true` |
| `WAPPT_APPOINTMENT_SERVICE_ID` | `'warmpawz_appointments'` |
| `WAPPT_BOOKING_MODE` | `'warmpawz_appointments'` |
| `isWarmpawzAppointmentsPaymentRequest()` | Payment page WAPPT bypass |
| `resolveWarmpawzBookingScreen(category)` | `vet-booking` \| `training-booking` \| `sitting-booking` \| `grooming-booking` |
| `getWarmpawzBookingHeaderInfo()` | Category/style-aware step titles |
| `getWarmpawzAppointmentServiceLabel()` | Summary line item label |
| `buildWarmpawzAppointmentsBookingNav()` | Shell navigation payload |

### 6.2 Hub routers (category entry)

| Component | WAPPT behaviour |
|-----------|-----------------|
| `VetServiceRouter.tsx` | Hub tile → style list with `appointmentsMode` when flag + API `warmpawzAppointments` |
| `GroomingServiceRouter.tsx` | Same pattern |
| `TrainingServiceRouter.tsx` | Same |
| `PetSitterServiceRouter.tsx` | Same |

**Nav helpers:** `wappt-hub-booking-nav.ts`, `wappt-discovery-ui.ts`

### 6.3 Vendor list components

| Component | WAPPT changes |
|-----------|---------------|
| `ClinicListView.tsx` | No prices on cards; **View Services** only (no list Book Appointment) |
| `UniversalServicesByStyle.tsx` | `appointmentsMode` feed; collapsed card **View Services** only |
| `BoardingVendorExpandableCard.tsx` | `appointmentsMode` prop; no list Book Appointment |
| `VetServicesByStyle.tsx` | Profile: menu-only services (no per-service prices); **Book Appointment** footer CTA |

### 6.4 Booking routers

| Router | WAPPT path |
|--------|------------|
| `VetBookingRouter.tsx` | **Primary vet flow** — `appointmentsMode`: fee fetch, slots with `warmpawz_appointments`, 4-step UI, `bookingMode` on payment |
| `GroomingBookingRouter.tsx` | Grooming/training/sitting fallback — category-aware headers, skip grooming-only service fetch, flat fee summary |

**Shell:** `CustomerHomeWrapper.tsx`

- Passes `appointmentsMode`, `serviceType` to booking screens
- Redirects vet WAPPT from `grooming-booking` → `vet-booking`

### 6.5 Payment

**File:** `UniversalPaymentPage.tsx`

When `isWarmpawzAppointmentsPaymentRequest({ bookingMode, serviceId })`:

- Skip early `serviceId` → UUID resolution
- Skip sync vendor-services lookup (root cause of `warmpawz_appointments not found` error)
- Skip UUID validation before `POST /bookings/create`
- Pass `serviceId: 'warmpawz_appointments'` + `bookingMode: 'warmpawz_appointments'` in booking payload

Backend preflight resolves real service + fee.

### 6.6 Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useAppointmentsByStyleFeed` | `hooks/useAppointmentsByStyleFeed.ts` | Cursor-paginated discovery for appointments hubs |
| `useDiscoveryVendorFeed` | (existing) | Underlying feed; WAPPT uses discover-services with catalogue filter |

### 6.7 Customer flow (end-to-end)

```
Home / Services hub
  → Category (vet, grooming, training, sitting)
  → Style (clinic, home, center, …)
  → Vendor list (no prices, View Services)
  → Vendor profile (service menu, no prices)
  → Book Appointment (profile footer)
  → [Service] → Details (date, slot, pet) → Summary (flat fee ₹X)
  → UniversalPaymentPage → Razorpay
  → POST /bookings/create (preflight → commerce_mode)
  → My Bookings + vendor notify + admin dashboard row
```

---

## 7. Admin web implementation

### 7.1 Routes

| Path | Component |
|------|-----------|
| `/warmpawz-appointments` | `WapptDashboardPage` — metrics + orders table |
| `/warmpawz-appointments/catalogue` | `CatalogueDashboardPage` — vendor catalogue CRUD |

Wrapped in `WarmpawzAppointmentsFeatureGate` + `WarmpawzAppointmentsShell`.

### 7.2 API client libs

| File | Purpose |
|------|---------|
| `warmpawz-appointments-catalogue-admin.ts` | Catalogue CRUD client + types |
| `warmpawz-appointments-dashboard-admin.ts` | Dashboard metrics + bookings list |
| `warmpawz-appointments-merchant-types.ts` | `WarmpawzAppointmentsStatus`, `PlatformStatus`, readiness types |

### 7.3 React Query hooks

| Hook | File | Keys |
|------|------|------|
| `useCatalogue*` | `hooks/warmpawz-appointments/useCatalogue.ts` | `['warmpawz-appointments-catalogue', …]` |
| `useWapptDashboardMetrics` | `hooks/warmpawz-appointments/useDashboard.ts` | `['warmpawz-appointments-dashboard', 'metrics']` |
| `useWapptBookingsList` | same | `['warmpawz-appointments-dashboard', 'bookings', page, pageSize]` |

### 7.4 Catalogue UI components

`components/admin/warmpawz-appointments/catalogue/`:

- `CatalogueDashboardPage`, `CatalogueTable`, `CatalogueFilterBar`
- `BulkFeeModal`, `ConfirmDialog`, `Pagination`
- `WarmpawzAppointmentsStatusBadge`, `ReadinessIndicator`, `EligibilityWarnings`

---

## 8. Deploy & ops

### 8.1 Deploy scripts touched

| Script | Change |
|--------|--------|
| `scripts/deploy-customer-web.sh` | CloudFront invalidation uses `'/*'` (fixes stale webpack chunk / `Unexpected token '<'` on Windows Git Bash) |
| `scripts/deploy-admin-web.sh` | WAPPT admin runtime flag injection (if configured in deploy) |
| `scripts/set-dev-wappt-env.js` | **New** — sets Lambda WAPPT flags on dev handler |

### 8.2 Verification script

```bash
cd backend/lambda
npm run verify:wappt-customer-flow
```

**File:** `backend/lambda/scripts/wappt-customer-flow-verify.js`

Checks per category/style:

- `discover-services` — vendors present, `warmpawzAppointments` flag, no list pricing
- `warmpawz-appointments/discovery/by-style` alias
- `discovery/count`
- Vendor fee endpoint
- Available slots with `serviceIds=warmpawz_appointments`

---

## 9. Commit history (branch)

| Commit | Summary |
|--------|---------|
| `917ba7777` | Merchant Programme architecture analysis doc |
| `1a1f5ad03` | MVP implementation plan doc |
| `330ef0fd7` | Joint plan (Phases A/B/C) |
| `620e32957` | Phase A admin catalogue module + migrations 1083/1084 + RBAC |
| `7ef87c5ce` | E2E customer booking, admin dashboard, catalogue discovery API |
| `d5ca2373a` | Promotion type build fix |
| `691993365` | Unify by-style discovery with catalogue filter + 4-layer WAPPT services |
| `a08950684` | Wire catalogue filter to discover-services + all hub UIs |
| `3af610ccc` | Trust API `warmpawzAppointments` flag for hub pricing UI |
| `cff4da4e3` | Vet clinic profile flat-fee booking, menu-only services |
| `f861a33ec` | Category-aware GroomingBookingRouter + verify script |
| `7cbb4fc18` | Route vet WAPPT → VetBookingRouter standard 4-step UI |
| `f3dfa7d30` | WAPPT payment bypass, admin dashboard fix, commerce_mode backfill migration, CF invalidation |

**Diff vs develop:** ~167 files, +11,719 / −273 lines.

---

## 10. Known issues & fixes applied during implementation

| Issue | Root cause | Fix |
|-------|------------|-----|
| Payment error: `warmpawz_appointments not found in vendor services` | `UniversalPaymentPage` tried to resolve slug to UUID before API call | WAPPT bypass in payment page; backend preflight handles resolution |
| `Unexpected token '<'` on customer web after deploy | CloudFront served stale `index.html` referencing deleted webpack chunks; invalidation path failed on Windows | `deploy-customer-web.sh` uses `/*` invalidation |
| Admin dashboard empty | `bookings.commerce_mode` column missing on dev RDS; dashboard caught error → empty list | Applied migration 1081; backfill 1085; broadened dashboard SQL |
| Vet flow showed “Book Grooming” / 2-step UI | Vet WAPPT routed through `GroomingBookingRouter` | `resolveWarmpawzBookingScreen('vet')` → `VetBookingRouter` with `appointmentsMode` |
| Book Appointment on list cards | UX requirement: profile-only CTA | Removed from `ClinicListView`, `UniversalServicesByStyle`, `BoardingVendorExpandableCard` |

---

## 11. Testing checklist

### Customer (dev)

- [ ] `NEXT_PUBLIC_WARMPAWZ_APPOINTMENTS_ENABLED=true` or runtime config
- [ ] Vet → Clinic Visit → Bindushree M → profile → Book Appointment → pay ₹99+tax
- [ ] Booking appears in My Bookings
- [ ] Vendor receives notification (existing develop path)

### Admin (dev)

- [ ] `WARMPAWZ_APPOINTMENTS_ADMIN_ENABLED=true` on Lambda + admin web
- [ ] Catalogue: publish vendor, set fee
- [ ] Dashboard: metrics + appointment orders row after payment
- [ ] Migrations 1081, 1083, 1084 applied; 1085 if backfill needed

### Automated

```bash
cd backend/lambda && npm run verify:wappt-customer-flow
# Expect 25/25 on dev when catalogue vendors exist
```

---

## 12. File index (quick reference)

### Backend — new module root

```
backend/lambda/src/endpoints/warmpawz-appointments/
  admin/catalogue/     # CRUD, DTOs, handlers, services, repos
  admin/dashboard/     # metrics + bookings list
  repositories/        # wappt-dashboard, vendor-catalog, audit
  shared/              # wappt-booking-preflight, catalogue-eligibility-sql, merchant/*

backend/lambda/src/endpoints/customer/warmpawz-appointments/
  routes/, handlers/, services/, repos/   # fee + by-style alias

backend/lambda/src/endpoints/customer/discovery/
  services/wappt-catalogue-discovery.service.ts
  repos/wappt-catalogue.repo.ts
  services/shared/wappt-catalogue-vendor-join.ts
  services/vendor-services/wappt-pricing.ts
```

### Customer web — key files

```
apps/customer-web/lib/warmpawz-appointments-customer.ts
apps/customer-web/hooks/useAppointmentsByStyleFeed.ts
apps/customer-web/components/customer/vet/VetBookingRouter.tsx
apps/customer-web/components/customer/grooming/GroomingBookingRouter.tsx
apps/customer-web/components/customer/payment/UniversalPaymentPage.tsx
apps/customer-web/components/customer/wrappers/CustomerHomeWrapper.tsx
```

### Admin web — key files

```
apps/admin-web/app/warmpawz-appointments/
apps/admin-web/components/admin/warmpawz-appointments/
apps/admin-web/hooks/warmpawz-appointments/
apps/admin-web/lib/warmpawz-appointments-*.ts
```

---

## 13. PR merge prerequisites

1. Migrations `1081`, `1083`, `1084` on dev RDS (required); `1085` if historical WAPPT bookings exist without `commerce_mode`
2. Lambda env: `WARMPAWZ_APPOINTMENTS_ENABLED=true`, `WARMPAWZ_APPOINTMENTS_ADMIN_ENABLED=true`
3. Deploy backend → customer-web → admin-web (API before UI if contract changed)
4. CloudFront full invalidation after customer-web deploy
5. `npm run verify:wappt-customer-flow` green on target API

---

*This document reflects `feature/book-an-appointment` as of commit `f3dfa7d30`. Update when merging additional phases.*
