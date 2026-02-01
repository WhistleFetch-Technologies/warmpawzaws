# Customer Web – Navigation & Placeholder Audit

**Date:** 2026-01-31  
**Scope:** End-to-end audit so notification/widget actions land on correct screens (not the Pet Marketplace placeholder).

## Root cause

- **Placeholder:** Any unhandled `currentScreen` in `CustomerHomeWrapper` falls through to  
  `return <ComingSoon serviceName="pet-marketplace" onBack={handleBack} />`.
- **Notification flow:** "Upcoming & Active" widget (UnifiedAppointmentTracker) was calling  
  `onNavigate('booking-details', { bookingId })` and `onOpenChat(bookingId)`, but:
  1. Home’s `onNavigate` did **not** handle `'booking-details'` → fell through to `handleNavigateToService('booking-details')` → `coming-soon` → **pet-marketplace**.
  2. **Chat** used `onViewBooking(bookingId)` → My Bookings list instead of opening chat with vendor.
  3. **View Details** never set `selectedBookingId` and went to booking-details, which requires both `selectedBookingId` and `selectedPetId`; unhandled flow led to placeholder.

## Fixes applied

### 1. Wrapper: handle `booking-details` and `my-bookings` with `bookingId`  
**File:** `apps/customer-web/components/customer/wrappers/CustomerHomeWrapper.tsx`

- In the **home** screen `onNavigate` callback:
  - **`'booking-details'`** with `data?.bookingId`:  
    `setSelectedBookingId(data.bookingId)` and `setCurrentScreen('my-bookings')`.  
    My Bookings already uses `initialBookingId={selectedBookingId}` to open that booking’s detail modal.
  - **`'my-bookings'`** with `data?.bookingId`: same behavior for consistency.

Result: **View Details** from the widget (and any caller of `onNavigate('booking-details', { bookingId })`) now opens My Bookings with that booking’s detail modal, not the placeholder.

### 2. Chat from tracker & vendor-on-the-way: open chat modal  
**File:** `apps/customer-web/components/customer/CustomerHomeComplete.tsx`

- **UnifiedAppointmentTracker `onOpenChat`:**  
  Fetches `/customer/bookings/:bookingId`, then calls  
  `setChatFromNotification({ isOpen: true, bookingId, vendorName, vendorPhoto })` so the existing chat-from-notification UI opens.  
  On fetch error, falls back to `onViewBooking(bookingId)` or `onNavigate('my-bookings', { bookingId })`.
- **VendorOnTheWayPopup `onChat`:**  
  Same pattern (fetch booking → open chat modal), using popup’s `vendorName`/`vendorPhoto` when available.

Result: **Chat** from “Upcoming & Active” and “Vendor on the way” opens the chat window with the vendor instead of My Bookings or placeholder.

### 3. Invalid Date in UnifiedAppointmentTracker  
**File:** `apps/customer-web/components/customer/booking/UnifiedAppointmentTracker.tsx`

- Time display for tele items: only render “at HH:MM” when `new Date(item.bookingTime)` is valid (`!Number.isNaN(d.getTime())`).  
  Avoids “Invalid Date” when `bookingTime` is missing or malformed.

## Handler map (relevant to notifications/widgets)

| Source                    | Action        | Handler / destination                                      |
|---------------------------|---------------|-------------------------------------------------------------|
| UnifiedAppointmentTracker | Chat          | Fetch booking → `setChatFromNotification` → chat modal     |
| UnifiedAppointmentTracker | View Details  | `onNavigate('booking-details', { bookingId })` → wrapper → my-bookings + detail modal |
| UnifiedAppointmentTracker | Join Call     | `onNavigate('video-call', { bookingId, meetingId })` → ChimeVideoCall |
| VendorOnTheWayPopup       | Chat          | Same as tracker (fetch → chat modal)                       |
| VendorOnTheWayPopup       | Track         | `onNavigate('gps-tracking', { bookingId })` → TrackingPageClient |
| VendorOnTheWayPopup       | Join Call     | `onNavigate('video-call', { bookingId, meetingId })`        |
| TeleConsultationReminder  | Chat          | Already used `setChatFromNotification`                      |
| TeleConsultationReminder  | Start Call    | `onNavigate('video-call', …)`                               |

## Back / next behavior

- **Back** from My Bookings: `handleBack()` → `currentScreen = 'home'` (unchanged).
- **Back** from chat modal: `setChatFromNotification(null)` (unchanged).
- No change to existing bottom nav or other flows; only notification/widget → destination mapping was fixed.

## What still lands on placeholder

Only screens that are **not** in the wrapper’s `if (currentScreen === '...')` chain still hit the final `ComingSoon serviceName="pet-marketplace"`.  
After this audit, `booking-details` and `my-bookings` with `bookingId` are handled from the home `onNavigate`; no notification or widget action should route to the pet-marketplace placeholder when used as intended.
