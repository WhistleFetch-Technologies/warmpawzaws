# Forensic UI Trace: Diagnostics Flow

## Overview
Complete code trace of the diagnostics flow UI—components, imports, routing, and back/next navigation.

---

## Customer Flow

### 1. Entry Points
| Entry | Screen | Component | Back | Next |
|-------|--------|-----------|------|------|
| Home → Lab Test | `lab-diagnostics` | `DiagnosticsServicesLanding` | `handleBack` → home | lab-booking, diagnostics-reports, sample-collection-tracking |
| Vet Dashboard → Lab | `lab-diagnostics` | Same | Same | Same |

**Imports:** `CustomerHomeWrapper` (wrappers) imports `DiagnosticsServicesLanding` from `../DiagnosticsServicesLanding`.

### 2. Lab List & Selection
**Component:** `DiagnosticsServicesLanding.tsx`
- Search bar, filters (All/Home/Center), distance, sort (distance/rating/relevance)
- Expandable lab cards with tests, packages
- `handleSelectCenter()` → `onNavigate('lab-booking', { vendorId })`
- `handleBookTest()` → `onNavigate('lab-booking', { vendorId, testId })`
- Header: `ServiceDashboardHeader` with `onBack`, `showBackButton={true}`

### 3. Diagnostics Booking (Test selection, payment)
**Component:** `DiagnosticsBookingFlow.tsx` (via `diagnostics-booking` screen)
- **FIX:** Previously routed to `create-booking` (generic form). Now routes to `diagnostics-booking` which renders `DiagnosticsBookingFlow`.
- Test selection, search, category filter
- Home/center sample type, home collection fee
- `onBack` → lab-diagnostics
- `onSuccess` → my-bookings
- `onCancel` → lab-diagnostics

**Routing (CustomerHomeWrapper):**
```tsx
if (screen === 'lab-booking') {
  setSelectedVendorId(data?.vendorId);
  setVetServiceData({ vendorId, serviceType: 'diagnostics' });
  setPreviousScreen('lab-diagnostics');
  setCurrentScreen('diagnostics-booking');
}
```

### 4. Post-Booking: My Bookings & Detail
**Component:** `MyBookings` → `BookingDetailModal`
- `onNavigate` passed from CustomerHomeWrapper
- Diagnostics actions: "View Reports" → `onNavigate('diagnostics-reports', { bookingId })`
- "Track Sample Collection" → `onNavigate('sample-collection-tracking', { bookingId })`

### 5. Sample Collection Tracker
**Component:** `SampleCollectionTracker.tsx`
- API: `GET /diagnostics/sample-collection/booking/:bookingId`
- `onBack` → lab-diagnostics
- `onComplete` → lab-diagnostics + toast

### 6. Diagnostics Report Viewer
**Component:** `DiagnosticsReportViewer.tsx`
- API: `GET /diagnostics/reports/booking/:bookingId`
- `onBack` → lab-diagnostics
- `onShareWithVet` → toast
- `onNavigate` → pharmacy, vet, my-bookings, booking-details

---

## Vendor Flow

### 1. Diagnostics Orders Dashboard
**Component:** `DiagnosticsOrderDashboard.tsx`
- Rendered when `showDiagnosticsOrders` (Lab Orders button)
- `onBack` → `setShowDiagnosticsOrders(false)`
- Link: "Manage Test Catalog →" → `DiagnosticResults` (Test catalog)

### 2. Assign Collection Agent
- Modal: Adhoc Agent tab (name, phone, date, time) | Staff tab
- API: `POST /diagnostics/sample-collection/assign-adhoc`

### 3. Test Catalog (DiagnosticResults)
**Component:** `DiagnosticResults.tsx` / `UploadResults.tsx`
- Add/Edit test, Publish/Unpublish, Remove
- Back: `Link` to `/dashboard`, modal back arrow

### 4. Report Upload
**Component:** `DiagnosticsReportUpload.tsx` (in DiagnosticsOrderDashboard)
- Upload in booking view, mark completed

---

## Import Chain

```
CustomerApp
  └── CustomerHomeWrapper (wrappers)
        ├── DiagnosticsServicesLanding
        ├── DiagnosticsBookingFlow (specialized)
        ├── DiagnosticsReportViewer (diagnostics/)
        ├── SampleCollectionTracker (diagnostics/)
        └── MyBookings
              └── BookingDetailModal (receives onNavigate)
```

---

## Back/Next Verification

| Screen | Back Handler | Next/Success |
|--------|--------------|--------------|
| lab-diagnostics | handleBack → home | lab-booking → diagnostics-booking |
| diagnostics-booking | previousScreen \|\| lab-diagnostics | my-bookings |
| diagnostics-reports | lab-diagnostics | pharmacy, vet, etc. |
| sample-collection-tracking | lab-diagnostics | onComplete → lab-diagnostics |
| My Bookings (detail) | onClose | diagnostics-reports, sample-collection-tracking via onNavigate |

---

## Gaps Fixed (2026-01-30)

1. **lab-booking → create-booking:** Was showing generic CreateBookingPage. Now uses `diagnostics-booking` with `DiagnosticsBookingFlow`.
2. **MyBookings → BookingDetailModal:** `onNavigate` was not passed. Now passed so "View Reports" and "Track Sample Collection" navigate correctly.
3. **Screen type:** Added `diagnostics-booking` to ScreenType union.
