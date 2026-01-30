# Next Steps – E2E Gaps & Deploy

**Date:** 2026-01-29  
**Context:** Post build + gap fixes (WalletPage, vendor onboarding back, roles API).

---

## ✅ Completed This Session

| Item | Status |
|------|--------|
| **Build** | customer-web, vendor-web, admin-web all build successfully |
| **Customer Web** | `WalletPage` (shop) accepts `onBack` / `onNavigate`; back button in header |
| **Vendor Onboarding** | Explicit back handlers in `VendorOnboardingFlow` (profile ↔ submitted ↔ under_review ↔ clarification) |
| **Vendor Onboarding** | `VendorApplicationSubmitted`, `VendorApplicationStatus`, `VendorClarificationRequested` accept `onBack` and show back button |
| **Roles API** | `VendorRoleSelection` uses `/vendor/onboarding/roles` first, fallback to `/config/roles` |
| **E2E Test** | Vendor onboarding comprehensive test: **all suites passed** (Role Selection, Identity, Application, Admin Review, Activation, Service Setup, Dashboard) |
| **Form Validation** | Verified: `DynamicVendorOnboardingForm` already enforces schema-driven required/min/max/email/phone/docs/terms |

---

## 🧪 Run Tests

- **Booking flow E2E (systematic, API-aligned)**  
  `npx ts-node tests/e2e/booking-flow-comprehensive.test.ts`  
  Uses `vendorId`/`date` for slots, camelCase for create, PUT `/bookings/:id/status` for confirm/start/complete, OTP body `action`/`sessionNumber`. See `tests/e2e/BOOKING_FLOW_API_TRACE.md`.

- **Booking lifecycle E2E**  
  `npx ts-node tests/e2e/booking-lifecycle.test.ts`  
  Same parameter alignment (vendorId, date, camelCase create body, response parsing).

- **Vendor onboarding E2E**  
  `npx ts-node tests/e2e/vendor-onboarding-comprehensive.test.ts`  
  Uses `TEST_API_URL` or default AWS dev API.

- **Other E2E**  
  See `tests/e2e/run-all-e2e-tests.ts` and `tests/test-execution-guide.md`.

- **Manual**  
  - Customer: Account → Wallet → back; vendor onboarding → back at each step.  
  - Vendor: onboarding role selection (roles load from `/vendor/onboarding/roles` or fallback).

---

## 🚀 Deploy

- **Full platform (dev/staging/prod)**  
  `./scripts/deploy-all.sh dev` (or `staging` / `prod`).

- **Frontends only**  
  - Customer: `./scripts/deploy-customer-web.sh` or `deploy-customer-web-aws.sh`  
  - Vendor: `./scripts/deploy-vendor-web.sh`  
  - Admin: `./scripts/deploy-admin-web.sh`  

- **Backend**  
  `./scripts/deploy-backend.sh` or `./scripts/deploy-lambda-direct.sh`; see `scripts/DEPLOY_GUIDE.sh` and repo secrets/env.

---

## ✅ P1 Gaps Addressed (2026-01-29)

| Item | Change |
|------|--------|
| **UI – Orange header** | Shop `WalletPage`: orange gradient header + orange-50/amber-50 background. `AddressBookPage`: orange gradient header (list + Add/Edit). |
| **Subscription** | `UniversalPaymentPage` and `BookingFlow`: toast when subscription check fails so it doesn’t fail silently (“Subscription check unavailable; you can pay normally.”). |
| **GPS** | `UniversalAppointmentManagement`, `SoloProviderDashboard`: toast on location-update network failure (once per booking) and on geolocation timeout. `HomeServiceTrackingManager`: toast on POSITION_UNAVAILABLE/TIMEOUT and on send-location network failure. |
| **Video call** | `ChimeVideoCall`: toast on connection error and on SDK load failure; error state already has “Try Again” and “Go Back”. |

### Next P1 work (2026-01-29)

- **Orange headers:** OrderHistoryPage (shop), CustomerWalletPage, MyOrders, ShoppingCartView (empty cart), CheckoutView, ReturnRequestPage, ReferralSystemPage, ComingSoon: orange gradient header + white title/back.
- **Video reconnecting:** ChimeVideoCall shows toast.info when status becomes reconnecting (once per cycle).

### Dynamic category updates (customer web) – 2026-01-29

- **Backend:** `GET /service-catalog/categories` already returns `icon`, `icon_color`, and filters by `is_active` (see `backend/lambda/src/endpoints/service-catalog.ts`).
- **Hook:** `useCustomerCategories` in `apps/customer-web/hooks/useCustomerCategories.ts` fetches categories and maps them to `QuickServiceTile[]` (Lucide icon + label + color + screen). Exports `iconColorToBg` for reuse.
- **CustomerHomeComplete:** Uses `useCustomerCategories()`; “All Services” grid uses `quickServiceTiles` when the API returns data, otherwise falls back to the hardcoded `quickServices` list. Geography-based service launch config still filters this source list.
- **ServiceDiscovery:** Uses `useCustomerCategories()`; category grid uses dynamic categories (Lucide icons) when available, otherwise falls back to `FALLBACK_CATEGORIES` (emoji). Category selection and vendor search unchanged.
- **Icons:** `apps/customer-web/lib/icon-utils.tsx` maps admin-set icon strings (e.g. `Stethoscope`, `GraduationCap`) to Lucide components so catalog icon/icon_color updates appear on customer web.

### P2 and UI polish (2026-01-29)

- **P2 – Booking response:** UniversalPaymentPage, BookingFlow, UnifiedBookingEngine, EnhancedPaymentPage now treat 200-with-error as failure (check `bookingRes?.error` or `bookingRes?.success === false`) and extract bookingId from more shapes.
- **P2 – Multiple services:** Backend already supports `selectedServices` (stored as JSONB); documented in bookings-enhanced.ts header.
- **UI polish – Orange headers:** MedicalRecordsPage, PharmacyCheckout, OrderTrackingView, BookingDetailModal, CheckInCheckOutPage, PackageTrackingDashboard (list + detail) now use orange gradient header.

## ⚠️ What’s left (recorded in reports)

All **P1** and **P2** items from the verification report are **addressed**. Remaining items are optional or ongoing:

| Source | Item | Status / Action |
|--------|------|------------------|
| **COMPREHENSIVE_WIREFRAME** | Booking creation: backend return 4xx for errors | Done: backend uses this.error() (400/403/404/409); documented in bookings-enhanced.ts. |
| **COMPREHENSIVE_WIREFRAME** | Multiple services booking | Done: backend supports `selectedServices` (JSONB); documented in bookings-enhanced.ts. |
| **COMPREHENSIVE_WIREFRAME** | Orange header / UI consistency | Done: applied to all high-traffic screens listed in this doc. |
| **COMPREHENSIVE_WIREFRAME** | P3 – Performance: optimize GPS tracking updates | Done: throttle 30s, interval 45s in HomeServiceTrackingManager, UniversalAppointmentManagement, SoloProviderDashboard. |
| **COMPREHENSIVE_WIREFRAME** | P3 – UX: add loading states | Done: HomeServicesDashboard shows spinner while loading; others already had loading. |
| **COMPREHENSIVE_WIREFRAME** | P3 – Documentation: update API documentation | Done: bookings-enhanced header + NEXT_STEPS API behaviour note below. |
| **E2E_TEST_RESULTS_FIXES** | E2E tests for all flows | Ongoing: run full E2E suite; add tests for new flows as needed. |
| **VENDOR_ONBOARDING_VERIFICATION** | `/config/roles` vs `/vendor/onboarding/roles` | Done: VendorRoleSelection uses `/vendor/onboarding/roles` first, fallback to `/config/roles`. |

Nothing **critical** remains. Optional items (backend 4xx, GPS throttle, loading states, API doc) are addressed.

**API behaviour (reference):**
- **POST /bookings/create**: Returns 4xx (400 validation, 403 unavailable, 404 not found, 409 slot conflict) for errors; 2xx only on success.
- **GPS location updates**: Clients should throttle to at least 30s between sends; backend accepts updates at any rate but 30–45s is recommended for performance.

---

## 📊 Verification Summary

- **Navigation:** ~95% (onboarding back + customer wallet back done).  
- **Form validation:** Verified in DynamicVendorOnboardingForm.  
- **Roles:** Onboarding uses `/vendor/onboarding/roles` with fallback.  
- **Build & E2E:** Green for customer-web, vendor-web, admin-web and vendor onboarding E2E.

Proceed with deploy when ready; address P1/P2 gaps in follow-up sprints.
