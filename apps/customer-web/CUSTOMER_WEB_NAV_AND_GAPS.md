# Customer Web: Back Navigation & Booking Flow Gaps

## Completed (this pass)

### 1. Back arrow = previous screen (history-based)
- **CustomerHomeWrapper** uses a `navigationHistory` stack; `handleBack` pops the stack so the back arrow always returns to the **previous screen/step**.
- All booking and sub-flows now use `onBack={handleBack}` (or `handleBack` in callbacks) instead of `onBack={() => navigateToScreen('x')}`, so back is consistent across:
  - Vet (vet → vet-booking → vet-doctor-details, vet-clinic-list → vet-clinic-profile → vet-clinic-booking)
  - Walker, resort, cafe, breeder, ambulance
  - Diagnostics (lab-diagnostics → diagnostics-reports, sample-collection-tracking)
  - Shop, cart, checkout, order_detail, order_tracking
  - Pharmacy store/checkout/order status, pharmacy_order_flow
  - Appointments, appointment-details, appointment-reschedule
  - Create-booking, adoption_questionnaire
  - Pet details, pet-profile-dashboard
  - Return-request, medical-records
- **goToHome()** added for “Back to Home” / “Done” actions (e.g. order success) so the stack is reset to `['home']` instead of pushing another home.

### 2. Home service selection → full booking flow
- **HomeServiceSelectionEnhanced** was not receiving **onNavigate**; selecting a home service did nothing.
- **Fix:** `onNavigate` is now passed from CustomerHomeWrapper. When the user selects a home service (`homeService: true`), the app navigates to **universal-home-booking** and renders **UniversalHomeServiceRouter** (provider list → profile → slots → pet → address → pay).
- Service type mapping: `vet` → `veterinary`, `walking` → `walker`, `sitting` → `sitter`; others unchanged.
- **Create-booking** screen now uses `onBack={handleBack}` so back from create-booking returns to the previous screen (e.g. services or home-service-selection).

### 3. New screen: universal-home-booking
- **ScreenType** `universal-home-booking` added.
- **UniversalHomeServiceRouter** is used for the full home service flow when the user comes from home-service-selection with `homeService: true`.
- State: `selectedHomeServiceType` and clearing in `handleBack` / `goToHome`.

---

## Entry points and back behavior (summary)

| Entry point | Flow | Back behavior |
|------------|------|----------------|
| Home → Services | services → create-booking / other service screens | Back pops to previous (services or home). |
| Home → Home service | home-service-selection → universal-home-booking (provider list → … → confirmation) | Back pops to previous step/screen. |
| Home → Vet | vet → vet-booking / vet-clinic-* / vet-doctor-details | Back pops. |
| Home → Grooming / Training / etc. | landing → (coming-soon or specific flow) | Back pops. |
| Home → Pharmacy | pharmacy → pharmacy_order_flow / pharmacy_store / pharmacy_checkout | Back pops. |
| Home → Lab diagnostics | lab-diagnostics → create-booking / diagnostics-reports / sample-collection-tracking | Back pops. |
| My Bookings / Booking detail | my-bookings → booking-details (modal or screen) | Back pops. |
| Reorder medicine (from booking) | my-bookings → pharmacy_order_flow → pharmacy_order_status | Back pops (and clears prescription order data when leaving flow). |

---

## Known gaps / incomplete flows

### UI / navigation
- **IntegratedServicesHub** – Rendered without `onBack`; if the app shows a global back button it will still call wrapper `handleBack`. Confirm whether the hub has its own back control.
- **MultiPetBookingPage, PackageBookingPage** – No `onBack` in props; they are rendered without an explicit back handler. If the shell has a global back, it works; otherwise add `onBack` for consistency.
- **CustomerWalletPage** – No `onBack` prop; same as above.

### API / contracts
- **Home services list:** `GET /customer/${phone}/home-services` – Confirm contract (e.g. `{ services: [...] }`) and that backend exists.
- **UniversalHomeServiceRouter** relies on: `GET /customer-by-phone/${phone}`, `GET /vendor/${vendorId}`, plus slots and booking create endpoints – Verify all exist and match usage.
- **CreateBookingPage** – Uses `serviceId` / `vendorId`; when opened from home-service-selection we now use **universal-home-booking** instead, but the generic create-booking path still uses these. Ensure backend supports both UUID `serviceId` and slug/serviceType where used.

### Other (from prior context)
- **Vendor Earnings & Settlement** – 500 and `map` undefined; needs defensive checks and correct API response shape.
- **Vendor tier upgrade** – 400 “Invalid tier”; align frontend tier names with backend (e.g. Bronze, Silver, Gold, Platinum).
- **Customer login page** – Pending design (e.g. country code +91, curved design, referral code).
- **Platform settings / rule engine** – Confirm used for GST, refund, wallet on payment page (manual/E2E check).

---

## Files touched

- `apps/customer-web/components/customer/CustomerHomeWrapper.tsx`
  - History-based `handleBack`; `goToHome`; all `onBack` use `handleBack` where appropriate.
  - Home-service-selection `onNavigate` and `universal-home-booking` with `UniversalHomeServiceRouter`.
  - Create-booking `onBack={handleBack}`.
  - Clear `selectedHomeServiceType` in `handleBack` and `goToHome`.
