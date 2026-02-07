# E2E Wireframe Verification – Final Report (Code-Only)

**Scope:** Forensic verification of wireframe implementation across vendor onboarding, customer center/home/tele flows, vendor dashboard, pharmacy, and rules. Only code was inspected (no MD files). Issues found were fixed in code.

---

## 1. Vendor Onboarding Flow

### 1.1 Entry → Mobile → OTP

| Step | Frontend | Backend | Status |
|------|----------|---------|--------|
| Enter mobile | `VendorAuth.tsx` – `phoneNumber`, `countryCode` | — | OK |
| Send OTP | `POST /auth/send-otp` `{ phone, role: 'vendor' }` | `auth.ts` L681, `auth-enhanced.ts` L787 | OK |
| Verify OTP | `POST /auth/verify-otp` | `auth.ts` L688, `auth-enhanced.ts` L800 | OK |
| Session + onboarding_status | `storeSession`, `localStorage` vendorApplicationStatus | verify-otp returns profile, onboarding_status | OK |

### 1.2 Choose Role (Dynamic from API)

| Step | Frontend | Backend | Status |
|------|----------|---------|--------|
| Load roles | `VendorRoleSelection.tsx` – `GET /config/roles` | `roles.ts` L799 `GET /config/roles` | OK |
| Display categories | Grouped by category (healthcare, grooming, etc.) | Response `roles[]` with `isActive` | OK |
| Select role | `onRoleSelect(role)` → `handleRoleSelect` | `POST /vendor/onboarding/select-role` `{ phone, role_id }` | OK |
| Vendor type | From role config (solo/business) | `POST /vendor/onboarding/select-vendor-type` | OK |

### 1.3 Dynamic Designer Form

| Step | Frontend | Backend | Status |
|------|----------|---------|--------|
| Load form schema | `DynamicVendorOnboardingForm.tsx` – `GET /vendor/onboarding/form-schema?roleId=` (or form-schema-fixed) | `vendor-onboarding.ts` L1729, `vendor-onboarding-fixes.ts` L194 | OK |
| Policies | `GET /vendor/policies` | — | OK |
| Submit | `POST /vendor/onboarding/submit-application` payload: `phone`, `application_payload`, `uploaded_documents` | `vendor-onboarding.ts` L1732, `vendor-onboarding-enhanced.ts` L1131 | OK |

### 1.4 Admin: Approve / Request Clarification / Reject

| Action | Frontend | Backend | Status |
|--------|----------|---------|--------|
| Approve | `ApplicationDetailModal.tsx` – `POST /admin/vendor/onboarding/:appId/review` `{ action: 'APPROVE', admin_id, comments }` then fallback `POST /admin/vendor/application/:appId/approve` | `vendor-onboarding.ts` L1806, `admin.ts` L637 | OK |
| Reject | Same modal – `action: 'REJECT'`, `rejection_reason`; fallback `POST .../reject` | `admin.ts` L852 | OK |
| Request clarification | `action: 'REQUEST_CLARIFICATION'`, `comments`; fallback `POST .../request-clarification` | `admin.ts` L891 | OK |

### 1.5 Vendor Post-Admin States

| State | Screen | Back button / Next | Status |
|-------|--------|--------------------|--------|
| Approved | **Fixed:** Now shows `VendorApprovedSetup` (“You’re approved”) with “Get Started” | `onComplete()` → `setStatus('active')`, `localStorage` ACTIVATED | **FIX APPLIED** |
| Get Started | `VendorApprovedSetup` – `POST /vendor/onboarding/activate` `{ phone, action: 'activate_dashboard_access' }` | `vendor-onboarding.ts` L1811, `vendor-onboarding-enhanced.ts` L1150 | OK |
| Clarification | `VendorClarificationRequested` – shows `clarificationNotes`, “Correct & Resubmit” | **Fixed:** `handleCorrectAndResubmit` sets `selectedRole` from `vendorData` so form loads with same role | **FIX APPLIED** |
| Reject | `VendorApplicationRejected` – “Correct & Resubmit” → form; “Start Fresh” → `handleStartFresh` → role selection | OK |

### 1.6 Dashboard and Capabilities

| Step | Frontend | Backend | Status |
|------|----------|---------|--------|
| After “Get Started” / active | `VendorLandingPage` with `vendorId`, `phone` | — | OK |
| Dynamic capabilities | `VendorCapabilityDashboard`, `useVendorCapabilities` – `GET /config/roles/:roleId` | `roles.ts` L966 | OK |
| Profile / availability / bank | ProfileManager, AdvancedAvailabilityManager, finance/bank routes | Corresponding endpoints in vendor-profile, vendor-schedule, vendor-bank-accounts | OK |

---

## 2. Vendor Discovery Rules (Backend)

| Rule | Implementation | File | Status |
|------|----------------|------|--------|
| Center: business only, at_center, no solo | `service-discovery.ts`: for `serviceStyle=at_center` exclude `%_solo`, `vendor_type != 'solo'`, only vendors with at_center services | L651–666, L1006–1012 | OK |
| Home: solo only, at_home | `vendor_type = 'solo'` (or role name solo), exclude clinic/hospital/center/salon; `vs.service_style = 'at_home'` | L404–448, L1638–1646 | OK |
| Tele: solo only | Same as home with `service_style = 'tele'` | L406, L1644 | OK |

---

## 3. Customer – Center Flow (Vet, Groomer, Trainer)

| Step | Frontend | Backend | Status |
|------|----------|---------|--------|
| Service → At Center | `VetServiceRouter`, `GroomingServiceRouter`, `TrainingServiceRouter` → style selection → list | — | OK |
| List providers | `GET /customer/discover-services?category=…&serviceStyle=at_center` (e.g. ClinicListView, VendorListingByStyle) | service-discovery.ts at_center branch | OK |
| Profile (photo, metrics, specialisation, distance, amenities, reviews) | UniversalServiceProviderList, UniversalProviderProfile, VetCenterProfileView | discover-services returns enriched fields | OK |
| Slots | `GET /customer/vendor/:vendorId/available-slots?date=…&serviceStyle=at_center` | service-discovery.ts, vendor-schedule | OK |
| Pet → Pay | UniversalPaymentPage, PaymentPage | — | OK |
| Booking create | `POST /bookings/create` (camelCase: bookingDate, bookingTime, customerId, vendorId, serviceId, serviceType) | bookings-enhanced.ts | OK |
| My Bookings | `MyBookings.tsx` – vendor name + “Hospital”/“Salon”/“Centre”, OTP on card (otpCode/completionOTP/startOTP), Directions, Call, Review | GET bookings from customer API | OK |
| Booking detail | `BookingDetailModal` – prescription/medical **only for vet, diagnostics, nutritionist** (hidden for grooming, training, walker, behaviourist, sitter) | GET /prescriptions/booking/:id, GET /bookings/:id/medical-records | **FIX APPLIED** |
| Rating popup | `RateServiceModal`, `RatingReviewPopup` from My Bookings / CustomerHomeComplete | — | OK |

---

## 4. Customer – Home Services (Solo Only, GPS, OTP)

| Step | Frontend | Backend | Status |
|------|----------|---------|--------|
| List (solo only) | HomeServiceProviderListView, UniversalHomeServiceRouter – `GET /customer/discover-services?serviceStyle=at_home` | service-discovery at_home/tele branch (solo only) | OK |
| Consultation price, next slot | UniversalServiceProviderList maps `price`/`consultationFee`, `nextAvailableSlot` | discover-services returns min_price, nextAvailableSlot | OK |
| Slots, pet, address | UniversalHomeServiceRouter, slot + pet + address steps | available-slots, addresses API | OK |
| Booking create | Same `POST /bookings/create` with `serviceType: 'at_home'` | OK |
| My Bookings | OTP on card, “Track Live Location” for at_home confirmed/in_progress | OK |
| Vendor “Start for home” | HomeServiceTrackingManager – `POST /vendor/bookings/:id/start-travel`, `POST /vendor/bookings/:id/location-update` | vendor-booking-actions.ts, gps-tracking | OK |
| Customer popup + track | CustomerHomeComplete, useActiveGpsTracking – `GET /tracking/customer/phone/:phone/active`; VendorOnTheWayPopup; LiveTrackingWidget – `GET /tracking/booking/:bookingId` | gps-tracking.ts | OK |
| Complete with OTP | Vendor: verify-otp; customer sees OTP on card | `POST /vendor/bookings/:bookingId/verify-otp` | OK |

---

## 5. Tele / Video (Schedule + Instant, 5‑min Reminder, Chime)

| Step | Frontend | Backend | Status |
|------|----------|---------|--------|
| List (solo) | TeleConsultationRouter, discover-services `serviceStyle=tele` | Same solo branch with tele | OK |
| 5‑min reminder | CustomerHomeComplete – `GET /customer/:phone/bookings/upcoming-calls?minutes=5`; TeleConsultationReminderNotification | customer-phone-convenience.ts | OK |
| Chat from notification | ChatInterfaceFromNotification, incomingCall state | notifications | OK |
| Video | VideoPageClient, ChimeVideoCall – create/join meeting | video-call.ts, video-call-enhanced | OK |
| No OTP for tele | Completion via prescription / end call | — | OK |

---

## 6. Pharmacy (5 → 10 → 20 km, Invoice, Pay, Track, OTP)

| Step | Frontend | Backend | Status |
|------|----------|---------|--------|
| Order from prescription / dashboard | PharmacyOrderFlow, order create | pharmacy-broadcast.ts | OK |
| 5/10/20 km broadcast | PharmacyOrderStatus, PharmacyBroadcastMap poll broadcast-status | pharmacy-broadcast-expansion-processor job every 2 min | OK |
| Pharmacy accept, performa invoice | PharmacyOrderDashboard, vendor accept | pharmacy-broadcast, pharmacy-orders | OK |
| Customer approve amount, pay | Payment flow, platform fee / delivery | finance, logistics rules | OK |
| Track (Zomato-like) | Order status + tracking UI | delivery-tracking, logistics | OK |
| OTP completion | Delivery OTP verify | delivery-otp.ts, delivery-tracking | OK |

---

## 7. Diagnostics (Labs, Packages, Home/Center, Upload Report, Share to Vet)

| Step | Frontend | Backend | Status |
|------|----------|---------|--------|
| Lab test list, packages | DiagnosticsBookingFlow, discover-services / diagnostics | diagnostics-reports.ts, service-discovery | OK |
| Home collection / center | Service style selection, booking | diagnostics-reports | OK |
| Vendor upload report | DiagnosticsReportUpload – `POST /diagnostics/reports/upload` or medical-records | diagnostics-reports.ts, medical-records | OK |
| Customer: medical records / booking | BookingDetailModal (vet/diagnostics/nutritionist only), DiagnosticsReportViewer | GET /medical-records/booking/:id, prescriptions/booking/:id | OK |
| Share to vet | Share flow / appointment list popup | Share endpoint + notifications | OK |

---

## 8. Problem Grid (Service Styles + Stitch to Main Flow)

| Step | Frontend | Backend | Status |
|------|----------|---------|--------|
| Problem selection | ProblemGridFlowRouter, VendorDiscoveryByProblem | problem-grid.ts | OK |
| Service styles by problem | Filter by role allowed list (e.g. grooming: home/center; vet: all three; walker: home) | problem-grid, service-discovery | OK |
| Stitch to main flow | Same UniversalHomeServiceRouter / center routers with problem filter | discover-services category/query | OK |

---

## 9. Rules (Platform Settings, GST, Refund, Wallet, Payment Page)

| Rule | Frontend | Backend | Status |
|------|----------|---------|--------|
| Platform settings / rule engine | Admin platform-settings; `getDiscoveryRules` in service-discovery | rule-engine.ts, platform-policies, admin settings | OK |
| GST / tax | UniversalPaymentPage, tax calculation | tax-calculation-service, finance | OK |
| Refund / cancel policy | CancelBookingModal, refund-preview, bookings/:id/cancel | refund-policy-engine, refunds.ts, bookings-enhanced | OK |
| Wallet | Payment page wallet balance | wallet endpoints | OK |
| Universal payment page | UniversalPaymentPage used by home, vet, grooming, training, walker flows | — | OK |
| Vendor vs platform discount | Vendor discount on service; platform discount at payment | discount-calculation-service | OK |

---

## 10. Fixes Applied in This Pass

1. **Vendor onboarding – “You’re approved” + Get Started**  
   - **File:** `apps/vendor-web/components/vendor/VendorApp.tsx`  
   - **Change:** When `onboardingStatus === 'APPROVED'`, set `status = 'approved'` (not `'active'`). Render `VendorApprovedSetup` for `status === 'approved'` with `onComplete` that sets `status = 'active'` and `localStorage` ACTIVATED.  
   - **Result:** After admin approval, vendor sees “You’re approved” and must click “Get Started” before dashboard.

2. **Clarification resubmit – form loads with same role**  
   - **File:** `apps/vendor-web/components/vendor/VendorApp.tsx`  
   - **Change:** In `handleCorrectAndResubmit`, set `selectedRole` from `vendorData?.roleId || vendorData?.role_id` before `setShowOnboarding(true)`.  
   - **Result:** “Correct & Resubmit” opens the dynamic form for the same role with pre-filled data.

3. **Prescription / medical records only for vet, diagnostics, nutritionist**  
   - **File:** `apps/customer-web/components/customer/BookingDetailModal.tsx`  
   - **Change:** Added `showPrescriptionAndMedicalRecords(serviceType)`. “Prescription History” and “Medical records” sections render only when this is true (vet, veterinarian, diagnostics, nutritionist, pet_nutritionist).  
   - **Result:** Grooming, training, walker, behaviourist, sitter no longer show prescription or medical records in booking detail.

---

## 11. API Contract Summary (Frontend ↔ Backend)

| Frontend call | Backend route | Contract |
|---------------|---------------|----------|
| POST /auth/send-otp | auth.ts, auth-enhanced | body: `{ phone, role }` |
| POST /auth/verify-otp | auth.ts, auth-enhanced | body: `{ phone, otp }` → session, profile, onboarding_status |
| GET /config/roles | roles.ts | query: none → `{ roles[] }` |
| GET /vendor/onboarding/form-schema | vendor-onboarding, vendor-onboarding-fixes | query: `roleId` → form sections/fields |
| POST /vendor/onboarding/submit-application | vendor-onboarding, vendor-onboarding-enhanced | body: `{ phone, application_payload, uploaded_documents }` |
| GET /vendor/application/status/:id | vendor-onboarding, vendor-onboarding-fixes | param: vendorId or applicationId → application status |
| POST /admin/vendor/onboarding/:id/review | vendor-onboarding | body: `{ action, admin_id, comments?, rejection_reason? }` |
| POST /vendor/onboarding/activate | vendor-onboarding | body: `{ phone, action }` |
| GET /customer/discover-services | service-discovery.ts | query: category, serviceStyle, latitude, longitude, etc. |
| POST /bookings/create | bookings-enhanced | body: camelCase CreateBookingRequestSchema |
| GET /tracking/booking/:bookingId | gps-tracking.ts | response: `{ success, tracking, message }` |
| POST /vendor/bookings/:id/start-travel | vendor-booking-actions | creates session, notifies customer |
| GET /prescriptions/booking/:id | prescriptions / medical-records | — |
| GET /bookings/:id/medical-records | medical-records | — |

---

## 12. Deploy-Ready Checklist

- [x] Vendor onboarding: OTP → role → dynamic form → submit → admin approve/clarify/reject → “You’re approved” → Get Started → dashboard.
- [x] Clarification: comment shown, “Correct & Resubmit” opens form with same role.
- [x] Reject: “Start Fresh” goes back to role selection.
- [x] Discovery: at_center = business only; at_home/tele = solo only (backend).
- [x] My Bookings: vendor name suffix (Hospital/Salon/Centre), OTP on card, Directions, Call, Review (center), Track (home).
- [x] Booking detail: prescription/medical only for vet, diagnostics, nutritionist.
- [x] Vendor dashboard: prescription/medical tabs conditional on role/capabilities (existing code).
- [ ] **Manual/E2E:** Full center booking from list → profile → slots → pet → pay → My Bookings → detail → rating.
- [ ] **Manual/E2E:** Full home booking → vendor start travel → customer popup → track → OTP complete.
- [ ] **Manual/E2E:** Tele 5‑min reminder → chat → video → prescription.
- [ ] **Manual/E2E:** Pharmacy order → broadcast 5/10/20 km → accept → invoice → pay → track → OTP.
- [ ] **Manual/E2E:** Platform settings / rule engine used for policies (GST, refund, wallet) on payment page.

---

**Report generated from code-only verification. No markdown documentation was used as input.**
