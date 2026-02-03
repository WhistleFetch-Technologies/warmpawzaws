# BDM Vendor Onboarding Guide — Solo Providers

**Purpose:** For Business Development Managers (BDM) to onboard **solo** vendors (individual practitioners) onto the Warmpawz platform.  
**Source:** Code forensics — backend `vendor-onboarding`, `role-seeding`, `vendor-services`, `service-discovery`; frontend `VendorApp`, `VendorCapabilityDashboard`, `capability-routes`, `route-map`.

**Vendor types in scope:** Vet, Groomer, Trainer, Walker, Behaviourist, Nutritionist (solo only).

---

## 1. Onboarding steps (aligned with platform flow)

The platform enforces this sequence. BDM should explain it so the vendor knows what to expect.

| Step | Platform status | Screen / action | BDM talking point |
|------|-----------------|------------------|-------------------|
| 1 | **INIT** | Enter phone → OTP verify | “You’ll sign in with your mobile number; we send a one-time code.” |
| 2 | **INIT → ROLE_PENDING** | **Role selection** (`/onboarding/role-selection`) | “Choose your profession: Vet, Groomer, Trainer, Walker, Behaviourist, or Nutritionist.” |
| 3 | **ROLE_PENDING → FORM_PENDING** | **Vendor type: Solo** (`/onboarding/vendor-type`) | “You’ll choose **Solo Provider** — individual practitioner, no staff. The app may auto-select this when your role supports only solo.” |
| 4 | **FORM_PENDING** | **Dynamic onboarding form** (`/onboarding/form`) | “Fill in business/contact details, address, and any role-specific/KYC fields. All steps are in one form.” |
| 5 | **UNDER_REVIEW** | Application submitted → Admin review | “We review your details; you’ll see an ‘Under review’ screen.” |
| 6 | **APPROVED** | Approved screen → Setup | “Once approved, you’ll complete profile, bank, schedule, and services to go live.” |
| 7 | **ACTIVATED** | Dashboard | “You get access to your vendor dashboard and can start taking bookings.” |

**Backend reference:** `vendor-onboarding.ts` — `GetOnboardingStatusHandler`, `getNextStep()` (INIT → role-selection; ROLE_PENDING → vendor-type; FORM_PENDING → form; APPROVED → approved; ACTIVATED → dashboard).  
**Frontend reference:** `apps/vendor-web/app/onboarding/route-map.ts` — `allowedStatuses` per route; `VendorApp.tsx` — `handleRoleSelect` and vendor type resolution from role config.

---

## 2. How the platform helps solo vendors (value to their business)

- **Discovery:** Customers search by category (vet, grooming, training, walker, nutritionist, behaviourist). Solo providers appear in **discover-services** and **search** when they offer the right service style (e.g. `at_home`, `tele`).  
  *Code:* `service-discovery.ts` (category/roleId mapping); customer-web `ServiceDiscovery`, `HomeServiceProviderListView`, `WalkerService`, search page category list.
- **Bookings:** Vendors manage appointments in one place (today/upcoming, by service style).  
  *Code:* `VendorDashboard` / `VendorDashboardScreen` — bookings from dashboard API; capability `bookings`.
- **Earnings & payouts:** Dashboard shows earnings; settlements and bank-account management are available.  
  *Code:* `role-seeding.ts` — `BASE_CAPABILITIES`: `earnings`, `settlements`, `bank_account`; `capability-routes.ts` — finance routes.
- **Schedule & availability:** Solo sets own availability; no staff management.  
  *Code:* `VendorCapabilityDashboard` — staff capability hidden when `vendor_type === 'solo'`; `schedule` capability for all.
- **Service and pricing control:** All listed roles have `canControlPrice` and `canControlDuration`; custom services and (where applicable) packages.  
  *Code:* `role-seeding.ts` — `pricingControl` and capabilities per role; `vendor-services.ts` — role-based `allowedServiceStyles`.
- **Communication:** In-app chat with customers.  
  *Code:* `role-seeding.ts` — `chat` in capabilities for all six types.
- **Trust:** Profile, (where applicable) gallery/portfolio, and post-approval setup (profile, bank, services) signal legitimacy to pet parents.

---

## 3. Unique features & functionality to emphasise (by vendor type — Solo only)

### 3.1 Vet (Solo) — role: `vet_solo`

- **Service styles (solo):** **At home** + **Tele** only (no at-center; that’s for clinic).  
  *Code:* `vendor-services.ts` — `vet_solo: ['at_home', 'tele']`.
- **Emphasise:**  
  - **Tele-consultation** — video consultations from home.  
  - **Home visits** — pet parents can book you at their location.  
  - **Prescriptions, medical records, patient monitoring** — same core capabilities as vet role; prescriptions and records in dashboard.  
  *Code:* `role-seeding.ts` — `veterinarian`: prescriptions, medical_records, tele_consultation, vet_summary, patient_monitoring.

---

### 3.2 Groomer (Solo) — role: `groomer_solo`

- **Service styles (solo):** **At home** only (no at-center, no tele).  
  *Code:* `vendor-services.ts` — `groomer_solo: ['at_home']`.
- **Emphasise:**  
  - **Mobile grooming** — you go to the customer; no salon needed.  
  - **Gallery** — showcase before/after and style to attract clients.  
  - **Custom services & packages** — set your own services and pricing.  
  *Code:* `role-seeding.ts` — `pet_groomer`: gallery, custom_services, packages.

---

### 3.3 Trainer (Solo) — role: `trainer_solo`

- **Service styles (solo):** **At home** + **Tele** (no at-center).  
  *Code:* `vendor-services.ts` — `trainer_solo: ['at_home', 'tele']`.
- **Emphasise:**  
  - **Home sessions + online** — in-person at client’s place and remote sessions.  
  - **Progress tracking** — record and show training progress (capability in role).  
  - **Packages** — sell session packs.  
  *Code:* `role-seeding.ts` — `pet_trainer`: progress_tracking, packages; capability-routes — progress_tracking, training_programs.

---

### 3.4 Walker (Solo) — role: `walker`, `walker_solo`, `pet_walker` (discovery)

- **Service styles:** **At home** only (walk/visit from customer’s location).  
  *Code:* `vendor-services.ts` — `pet_walker`, `walker`, `dog_walker`: `['at_home']`.
- **Emphasise:**  
  - **GPS tracking** — customers can see walk route/live location; builds trust.  
  - **Photo updates** — send post-walk photos.  
  - **Simple offering** — custom services only (no packages in walker role).  
  *Code:* `role-seeding.ts` — `pet_walker`: gps_tracking, photo_updates, custom_services (no packages).

---

### 3.5 Behaviourist (Solo) — role: `behaviourist_solo`, `pet_behaviourist` (discovery)

- **Service styles:** **At home**, **at center**, **tele** (all three in backend for behaviourist).  
  *Code:* `vendor-services.ts` — `pet_behaviorist`: `['at_home', 'at_center', 'tele']`; service-discovery uses `behaviourist_solo`, `pet_behaviourist`.
- **Emphasise (solo):**  
  - **Tele / video consultation** — remote behaviour consults.  
  - **Home visits** — in-person assessments at client’s place.  
  - **Progress tracking** — track behaviour plans over time.  
  - **Packages** — multi-session plans.  
  *Code:* `role-seeding.ts` — `pet_behaviorist`: progress_tracking, tele_consultation, packages.

---

### 3.6 Nutritionist (Solo) — role: `nutritionist_solo`, `nutritionist` (discovery)

- **Service styles:** **At center**, **tele**, **at home** (backend supports all).  
  *Code:* `vendor-services.ts` — `nutritionist`, `pet_nutritionist`: `['at_center', 'tele', 'at_home']`.
- **Emphasise (solo):**  
  - **Tele / video consultation** — diet consults online.  
  - **Meal plans & diet charts** — dedicated capabilities.  
  - **Prescriptions** — e.g. diet prescriptions.  
  - **Delivery** — link to food/delivery if applicable.  
  *Code:* `role-seeding.ts` — `nutritionist`: meal_plans, diet_charts, prescriptions, delivery, progress_tracking, tele_consultation, video_calling.

---

## 4. Solo-specific platform rules (from code)

- **No staff management:** Staff capability is hidden for `vendor_type === 'solo'`.  
  *Code:* `VendorCapabilityDashboard.tsx` — filter `cap.name === 'staff' && vendor?.vendor_type === 'solo'` → false.
- **Service styles:** Solo roles are restricted (e.g. no `at_center` for vet_solo, groomer_solo, trainer_solo). Allowed styles come from `ROLE_SERVICE_STYLES` / role config in `vendor-services.ts`.
- **Vendor type selection:** Backend validates `vendor_type` against role’s `config.vendorTypes`; solo-only roles only support `solo`.  
  *Code:* `vendor-onboarding.ts` — SelectVendorTypeHandler checks `supportedTypes.includes(vendor_type)`.

---

## 5. BDM checklist — Solo onboarding

- [ ] Explain: Phone → OTP → Role (Vet / Groomer / Trainer / Walker / Behaviourist / Nutritionist) → **Solo** → Form → Review → Approval → Setup → Dashboard.
- [ ] Set expectation: “You’ll choose **Solo Provider**; no staff or clinic listing.”
- [ ] For each type, stress the **unique** points above (tele, home, GPS, gallery, progress tracking, diet/meal plans, etc.).
- [ ] Mention: discovery by category, one place for bookings/earnings/schedule, chat, and (where applicable) prescriptions/records/tracking.
- [ ] Clarify service styles: what they can offer (e.g. groomer_solo = at_home only; vet_solo = at_home + tele).

---

*Document generated from codebase forensics only; no assumptions or external MD files used.*
