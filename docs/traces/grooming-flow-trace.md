# Grooming Flow – Step-by-Step Code Trace

End-to-end trace of the **grooming** service booking flow in the codebase, from entry to completion (and cancel). All references are file paths and line numbers.

---

## 1. Entry and routing

| Step | Where | What happens |
|------|--------|--------------|
| User taps Grooming | `apps/customer-web/components/customer/wrappers/CustomerHomeWrapper.tsx` | Bottom nav or dashboard sets `currentScreen === 'grooming'` (e.g. line 386: `else if (service === 'grooming') setCurrentScreen('grooming')`). |
| Grooming landing | Same file, **990–1034** | When `currentScreen === 'grooming'`, `GroomingServiceRouter` is rendered with `phone`, `onBack`, `onViewBooking`, and `onNavigate`. The `onNavigate` callback handles: `grooming_center`, `grooming_home`, `create-booking`, `problem_grid`, etc. |

**Entry component:** `GroomingServiceRouter`  
**File:** `apps/customer-web/components/customer/GroomingServiceRouter.tsx`

---

## 2. Discovery (list groomers with location)

| Step | File:Line | What happens |
|------|-----------|--------------|
| Load grooming data | `GroomingServiceRouter.tsx` **66–90** | `loadGroomingData()` runs on mount. Gets location: (1) `GET /customer/profile?phone=...` for `latitude`/`longitude`; (2) if missing, `navigator.geolocation.getCurrentPosition`. Builds `locationParams`: `&latitude=...&longitude=...`. |
| Try 1 – discover-services | **97–113** | `GET /customer/discover-services?category=grooming${locationParams}`. Response normalized from `data`, `data.vendors`, `data.providers`, etc. into `groomerServices`. |
| Try 2 – by-style | **118–127** | If no results: `GET /customer/services/by-style?style=at_center&category=grooming${locationParams}`. |
| Try 3 – vendors/search | **130–139** | If still empty: `GET /customer/vendors/search?roleId=pet_groomer&limit=50${locationParams}`. |
| Build vendor list | **144–166** | From `groomerServices`, build a `vendorMap` by `vendorId`/`vendor_id`/`id`/`providerId`; set `featuredGroomers` and `stats`. |
| Previous groomer | **183–219** | Optional: `GET /customer/${phone}/previous-providers?serviceType=grooming` or `GET /customer/${phone}/packages?serviceType=grooming` for “Previous groomer” card. |

**Backend:**  
- `GET /customer/discover-services`: `backend/lambda/src/endpoints/service-discovery.ts` ~520 (query params: `category`, `latitude`, `longitude`).  
- `GET /customer/services/by-style`: same file ~3131 (`style`, `category`, `latitude`, `longitude`).  
- `GET /customer/vendors/search`: same file ~1948 (`roleId`, `limit`, `latitude`, `longitude`).

---

## 3. Style choice (Centre vs At Home)

| Step | File:Line | What happens |
|------|-----------|--------------|
| User picks style | `GroomingServiceRouter.tsx` **219–241, 438–452** | Two tiles: “Grooming Centre” (`grooming_center`) and “At Home Grooming” (`grooming_home`). On click: `onNavigate('grooming_center')` or `onNavigate('grooming_home')`. |
| Wrapper handles style | `CustomerHomeWrapper.tsx` **1013–1019** | `grooming_center` → `setCurrentScreen('grooming_center')`; `grooming_home` → `setCurrentScreen('grooming_home')`. |
| Render by-style screen | **1656–1686** | For `grooming_center`: render `GroomingServicesByStyle` with `serviceStyle="at_center"`, `onNavigate={groomingCenterNavigate}`. For `grooming_home`: same with `serviceStyle="at_home"`, `onNavigate={groomingHomeNavigate}`. |

**Component:** `GroomingServicesByStyle`  
**File:** `apps/customer-web/components/customer/grooming/GroomingServicesByStyle.tsx`

---

## 4. Provider list by style (salons / at-home groomers)

| Step | File:Line | What happens |
|------|-----------|--------------|
| Load providers | `GroomingServicesByStyle.tsx` **125–188** | `loadServicesByStyle()`: optional `locationParams` from localStorage; then `GET /customer/discover-services?category=grooming&serviceStyle=${serviceStyle}${locationParams}`. Map response to `Provider[]` (vendorId, services, etc.). |
| Fallback | **328** | If needed, `GET /customer/discover-services?category=grooming&roleId=pet_groomer&serviceStyle=${serviceStyle}${locationParams}`. |
| User selects salon/groomer | **490–503, 576–617** | From list: `handleSelectService(provider, service)` builds `bookingData` (vendorId, vendorName, serviceStyle, service, serviceId, selectedServices, price, duration) and calls `onNavigate('create-booking', bookingData)`. From profile: `handleBookServices()` builds same shape and `onNavigate('create-booking', bookingData)`. |

---

## 5. Navigate to booking and set booking context

| Step | File:Line | What happens |
|------|-----------|--------------|
| Center navigate | `CustomerHomeWrapper.tsx` **1614–1633** | `groomingCenterNavigate('grooming-booking' | 'create-booking', data)` sets `vetServiceData`: vendorId, serviceType: `'grooming'`, serviceStyle: `'at_center'`, groomer, service, serviceId, selectedServices, vendorName, price, duration. Then `setCurrentScreen('grooming-booking')`. |
| Home navigate | **1635–1654** | Same with serviceStyle: `'at_home'`. |
| Render booking router | **1770–1791** | When `currentScreen === 'grooming-booking'`, render `GroomingBookingRouter` with `phone`, `vendorId={vetServiceData?.vendorId}`, `groomer`, `serviceId`, `serviceName`, `serviceStyle`, `selectedServices`, `vendorName`, `price`, `duration`, `onBack`, `onNavigate`, `onViewBooking`. |

**Component:** `GroomingBookingRouter`  
**File:** `apps/customer-web/components/customer/grooming/GroomingBookingRouter.tsx`

---

## 6. Booking steps (service → datetime → pet → address → payment)

| Step | File:Line | What happens |
|------|-----------|--------------|
| Load vendor services | `GroomingBookingRouter.tsx` **439–444** | If `vendorId`: `GET /customer/vendor/${vendorId}/services?category=grooming` → `serviceOptions`. |
| Load packages | **548–552** | `GET /packages/check-for-booking?customerId=...&vendorId=...&serviceType=...` for package eligibility. |
| Load addresses | **478–486, 527–541** | For address step: `GET /customer/addresses?phone=...` → `addresses`; user can add address (e.g. AddAddressModal flow). |
| Load slots | **374–383** | When `selectedDate` and `vendorId` and `selectedServiceIds.size > 0`: `GET /customer/vendor/${vendorId}/available-slots?date=${date}&serviceStyle=${selectedServiceType}&totalDuration=${totalDuration}&serviceIds=${serviceIds}`. |
| Scheduling policy | **287–304** | Optional: `GET /customer/vendor/${vendorId}/scheduling-policy`. |
| Operating hours | **306–324** | Optional: `GET /customer/vendor/${vendorId}/operating-hours`. |
| Confirm → Payment | **669–702** | `handleConfirmBooking()`: if package session, `POST /package-sessions`; else `handleProceedToPayment()` which sets `showPaymentPage = true`. |

**Backend:**  
- Slots: `backend/lambda/src/endpoints/service-discovery.ts` ~1306 (`GET /customer/vendor/:vendorId/available-slots`; `vendorId` resolved via `resolveVendorById`).

---

## 7. Payment and create booking (UniversalPaymentPage)

| Step | File:Line | What happens |
|------|-----------|--------------|
| Show payment page | `GroomingBookingRouter.tsx` **839–872** | When `step === 'payment' && showPaymentPage`, full-screen `UniversalPaymentPage` with: type `booking`, `serviceId`, `serviceName`, `serviceStyle` (at_home / at_center), `vendorId`, `bookingDate`, `bookingTime`, `petId`, `petName`, `address`, `addressId`, `showAddressSelection={selectedServiceType === 'at_home'}`, `baseAmount`, `duration`, `customerPhone`, `customerId`, `selectedServices`, `onSuccess`. |
| Resolve serviceId | `UniversalPaymentPage.tsx` (in same app) | If `serviceId` is not a UUID, loads `GET /customer/vendor/${vendorId}/services` and resolves to vendor service UUID. |
| Resolve customerId | Same file | If no `customerId`, `GET /customer/by-phone?phone=...` or profile → `resolvedCustomerId`. |
| Build address for at_home | Same file | For `serviceStyle === 'at_home'`, from `selectedAddress` or `address`: build `addressValue` (string), and optionally `addressCity`, `addressState`, `addressPincode`, `addressLat`, `addressLng`. |
| Create booking payload | Same file | `bookingPayload`: customerId, vendorId, serviceId, bookingDate, bookingTime, serviceType, amount, petId, petName, customerPhone, customerName, address, city, state, pincode, latitude, longitude, notes, selectedServices. |
| POST create | Same file | Tries `POST /bookings/create`, `/booking/create`, `/customer/booking/create`, `/customer/bookings/create` with `bookingPayload`. |
| After payment success | Same file | Calls `generateBookingOTP(bookingId, customerId)` for non-tele; then `onSuccess(bookingId, orderId, otpCode)`. |

**Backend:**  
- Create: `backend/lambda/src/endpoints/bookings-enhanced.ts` ~2175 (body validated with `CreateBookingRequestSchema` from `@warmpawz/api-contracts/bookings`).  
- OTP: `registerBookingOTPEndpoint` in same file: `POST /bookings/generate-otp` body `{ bookingId, serviceStyle, customerId }`.

---

## 8. Post-booking (confirmation and view booking)

| Step | File:Line | What happens |
|------|-----------|--------------|
| Payment success | `GroomingBookingRouter.tsx` **651–657** | `handlePaymentSuccess(newBookingId, orderId, otpCode)` sets `bookingId`, closes payment overlay, sets `step = 'confirmation'`. |
| View booking | `CustomerHomeWrapper.tsx` **1784–1788** | `onNavigate` from `GroomingBookingRouter`: if `screen === 'booking-details' | 'booking-confirmation'`, calls `handleViewBooking(data?.bookingId)`. |
| My Bookings / cancel | `MyBookings.tsx` | Customer list: e.g. `GET /customer/bookings?phone=...` (or equivalent). Refund policy: `GET /customer/refund-policy`. Cancel: `POST /bookings/${bookingId}/cancel` with `reason`, `refundMethod`; response handled as `result.data ?? result` and `payload.refund ?? result.refund`. |

**Backend:**  
- Refund policy: `backend/lambda/src/endpoints/refund-policy-engine.ts` ~355 (`GET /customer/refund-policy`; registered before `/customer/:customerId` in handler).

---

## 9. Vendor side (fulfilment and complete)

| Step | File:Line | What happens |
|------|-----------|--------------|
| Vendor home-service tracking | `apps/vendor-web/components/vendor/tracking/HomeServiceTrackingManager.tsx` | Used for at_home grooming (and other home services). Receives `vendorId`, `bookingId`, `bookingData`. |
| Complete session | Same file, **419–425** | `POST /vendor/bookings/${bookingId}/complete` with body `{ vendorId, otp: otp || null, notes: ... }`. |

**Backend:**  
- Complete: `backend/lambda/src/endpoints/vendor-booking-actions.ts` ~456 (`POST /vendor/bookings/:bookingId/complete`; expects `vendorId`, `otp`; optional `notes`).

---

## 10. Flow diagram (grooming)

```
CustomerHomeWrapper (currentScreen)
       │
       ├─ currentScreen === 'grooming'
       │       → GroomingServiceRouter
       │             │ loadGroomingData(): profile + geo → locationParams
       │             │ GET discover-services?category=grooming&latitude&longitude
       │             │ GET services/by-style?style=at_center&category=grooming (fallback)
       │             │ GET vendors/search?roleId=pet_groomer&limit=50 (fallback)
       │             │
       │             └─ User taps "Grooming Centre" or "At Home"
       │                    → onNavigate('grooming_center' | 'grooming_home')
       │
       ├─ currentScreen === 'grooming_center' | 'grooming_home'
       │       → GroomingServicesByStyle(serviceStyle=at_center|at_home)
       │             │ loadServicesByStyle(): GET discover-services?category=grooming&serviceStyle=...
       │             └─ User selects salon/groomer + service
       │                    → onNavigate('create-booking', bookingData)
       │
       ├─ groomingCenterNavigate / groomingHomeNavigate
       │       → setVetServiceData({ vendorId, serviceStyle, groomer, service, ... })
       │       → setCurrentScreen('grooming-booking')
       │
       ├─ currentScreen === 'grooming-booking'
       │       → GroomingBookingRouter(vendorId, groomer, serviceStyle, ...)
       │             │ GET vendor/${vendorId}/services?category=grooming
       │             │ GET vendor/${vendorId}/available-slots?date&serviceStyle&totalDuration&serviceIds
       │             │ Steps: service → datetime → pet → address (if at_home) → payment
       │             │ handleConfirmBooking() → handleProceedToPayment()
       │             │
       │             └─ UniversalPaymentPage
       │                   │ Resolve customerId; build address + lat/lng for at_home
       │                   │ POST /bookings/create (or aliases) with full payload
       │                   │ After payment: POST /bookings/generate-otp → onSuccess(bookingId, orderId, otp)
       │                   └─ handlePaymentSuccess() → step='confirmation'
       │
       └─ onNavigate('booking-details', { bookingId }) → handleViewBooking(bookingId)
```

---

## Summary table (grooming)

| Stage | Customer Web | API / Backend |
|-------|----------------|---------------|
| Entry | CustomerHomeWrapper → GroomingServiceRouter | — |
| Discovery | GroomingServiceRouter: profile + geo → locationParams | GET discover-services, by-style, vendors/search (category=grooming, latitude, longitude) |
| Style | GroomingServiceRouter → onNavigate(grooming_center | grooming_home) | — |
| Providers | GroomingServicesByStyle: discover-services by style | GET discover-services?category=grooming&serviceStyle=at_center|at_home |
| To booking | groomingCenterNavigate / groomingHomeNavigate set vetServiceData, screen=grooming-booking | — |
| Slots | GroomingBookingRouter: vendorId, date, serviceStyle, totalDuration, serviceIds | GET /customer/vendor/:vendorId/available-slots |
| Create | UniversalPaymentPage: customerId, vendorId, serviceId, address (+ city, state, pincode, lat, lng for at_home) | POST /bookings/create |
| OTP | UniversalPaymentPage after payment: bookingId, serviceStyle, customerId | POST /bookings/generate-otp |
| Complete | — | Vendor: POST /vendor/bookings/:bookingId/complete (vendorId, otp, notes) |
| Cancel / refund | MyBookings: refund-policy, cancel payload, result.data / payload.refund | GET /customer/refund-policy; POST /bookings/:id/cancel |

This trace is code-only; no product copy or UX wording is defined here beyond what is already in the codebase.
