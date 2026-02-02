# Forensic Testing Validation Checklist

**Purpose:** Manual and E2E test cases to validate the forensic trace (page sequence, handlers, contracts, UI theme).  
**Reference:** [FORENSIC_TRACE_IMPLEMENTATION_VALIDATION.md](./FORENSIC_TRACE_IMPLEMENTATION_VALIDATION.md)

---

## 1. Page Sequence (per flow)

| Flow | Steps to validate | Manual check | E2E (optional) |
|------|-------------------|--------------|-----------------|
| **Vet** | vet → vet-clinic-list → vet-clinic-profile → vet-booking → payment → confirmation | Navigate from home → Vet → select clinic → select service → details → summary → pay → confirm | Cypress/Playwright: assert screen IDs and URL/state at each step |
| **Walker** | walker → walker-booking → payment → confirmation | Home → Walker → select provider → details → summary → pay → confirm | Same |
| **Grooming** | grooming → grooming-booking → payment → confirmation | Home → Grooming → list → profile → service → details → summary → pay → confirm | Same |
| **Training** | training → training-booking → payment → confirmation | Home → Training → list → profile → service → details → summary → pay → confirm | Same |
| **Boarding** | boarding → boarding-booking → payment → confirmation | Home → Boarding → select facility → service → datetime → pet → [room] → pay → confirm | Same |
| **Home Services** | landing → provider_list → profile → service → pet → time → address → payment → confirmation | Home → Home Services → select type → list → profile → service → pet → time → address → pay → confirm | Same |

**Pass criteria:** No dead ends; back button returns to previous step; payment step shows full-screen payment UI; confirmation shows booking ID and “View details”.

---

## 2. Handlers (CustomerHomeWrapper)

| Handler | Where | Manual check |
|--------|--------|--------------|
| `onBack` | All routers | Back from each step returns to previous screen; from landing returns to customer home |
| `onNavigate(screen, data)` | All routers | Navigating to booking passes vendorId/serviceId/serviceType etc. into next screen |
| `onViewBooking(bookingId)` | After confirmation | “View details” opens booking detail (or bookings list) with correct booking |
| `onSuccess(bookingId)` | Payment | After successful payment, redirect to confirmation with bookingId |

**Pass criteria:** Data passed between screens is correct (e.g. vetServiceData.vendorId present in booking flow); no console errors from missing props.

---

## 3. UI Theme (Vet dashboard standard)

| Flow | Check | Pass criteria |
|------|--------|----------------|
| **Vet** | Header | ServiceDashboardHeader with orange gradient `#FF8C42`; StandardizedFooter on home |
| **Walker** | Header | ServiceDashboardHeader; skipHeader in wrapper (no double header) |
| **Grooming** | Header | ServiceDashboardHeader; skipHeader in wrapper |
| **Training** | Header | ServiceDashboardHeader; skipHeader in wrapper |
| **Boarding** | Dashboard + Booking | BoardingServiceRouter: ServiceDashboardHeader with orange gradient; BoardingBookingRouter: ServiceDashboardHeader; skipHeader for boarding screens |
| **Home Services** | Dashboard + List + Profile | HomeServicesDashboard: orange header; HomeServiceProviderListView: orange sticky header; HomeServiceProviderProfile: orange “Book” CTA; HomeServiceLanding: orange background |

**Pass criteria:** No green/purple/blue headers on Boarding or Home Services landing/list/profile; orange gradient matches Vet (`from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]` or equivalent).

---

## 4. Contracts (CreateBookingRequestSchema)

| Field | Boarding | Check |
|-------|----------|--------|
| `serviceType` | Must be `at_center` (not overnight/daycare option ID) | BoardingBookingRouter maps overnight/daycare → `at_center` before API call |
| `customerId` | Resolved from phone/session | Present in request |
| `vendorId`, `serviceId`, `bookingDate`, `bookingTime` | Required | Present and valid format |

**Pass criteria:** Create booking from Boarding flow succeeds; backend does not reject for invalid `serviceType`; response returns bookingId.

---

## 5. Step Reduction (optional follow-up)

Not required for “forensic testing complete”; document for future UX work:

| Flow | Opportunity | Doc reference |
|------|-------------|---------------|
| Home | Merge provider_list + provider_profile; merge pet + time | FORENSIC_TRACE §6.3 |
| Boarding | Merge datetime + pet into one step | FORENSIC_TRACE §6.3 |

---

## 6. Sign-off

| Area | Validated by | Date |
|------|--------------|------|
| Page sequence | | |
| Handlers | | |
| UI theme | | |
| Contracts (boarding serviceType) | | |

---

*Use this checklist after any change to customer-web booking flows or CustomerHomeWrapper to ensure forensic trace remains valid.*
