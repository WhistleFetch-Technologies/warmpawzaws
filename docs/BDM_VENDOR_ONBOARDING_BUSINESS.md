# BDM Vendor Onboarding Guide — Business / Center

**Purpose:** For Business Development Managers (BDM) to onboard **business** vendors (clinics, salons, centers, organizations) onto the Warmpawz platform.  
**Source:** Code forensics — backend `vendor-onboarding`, `role-seeding`, `vendor-services`, `service-discovery`, `admin`/`admin-comprehensive`; frontend `VendorApp`, `VendorCapabilityDashboard`, `capability-routes`, `route-map`.

**Vendor types in scope:** Vet (Clinic), Groomer (Salon/Center), Trainer (Center), Walker (Business), Behaviourist (Center), Nutritionist (Center).

---

## 1. Onboarding steps (aligned with platform flow)

Same sequence as solo; the only difference is **Vendor type: Business** at step 3.

| Step | Platform status | Screen / action | BDM talking point |
|------|-----------------|------------------|-------------------|
| 1 | **INIT** | Enter phone → OTP verify | “You’ll sign in with your business mobile number; we send a one-time code.” |
| 2 | **INIT → ROLE_PENDING** | **Role selection** (`/onboarding/role-selection`) | “Choose your business type: Veterinary Clinic, Grooming Salon, Training Center, Walker (business), Behaviourist (center), or Nutritionist (center).” |
| 3 | **ROLE_PENDING → FORM_PENDING** | **Vendor type: Business** (`/onboarding/vendor-type`) | “You’ll choose **Business / Center** — organization with optional staff and physical location.” |
| 4 | **FORM_PENDING** | **Dynamic onboarding form** (`/onboarding/form`) | “Fill in business name, contact person, address, and any role-specific/KYC fields (e.g. business registration, GST).” |
| 5 | **UNDER_REVIEW** | Application submitted → Admin review | “We review your business details; you’ll see an ‘Under review’ screen.” |
| 6 | **APPROVED** | Approved screen → Setup | “Once approved, you’ll complete profile, bank, schedule, **staff** (if applicable), and services to go live.” |
| 7 | **ACTIVATED** | Dashboard | “You get access to the vendor dashboard; you can manage staff, facility, and multiple service styles.” |

**Backend reference:** Same as Solo — `vendor-onboarding.ts` `getNextStep()`; `SelectVendorTypeHandler` accepts `vendor_type: 'business'` when role supports it.  
**Admin reference:** `admin.ts` / `admin-comprehensive.ts` — `vendor_type` derived from role name (e.g. `LIKE '%_solo'` → solo, else business); `business_name` used for display.

---

## 2. How the platform helps business vendors (value to their business)

- **Discovery:** Customers search by category and **service style** (at-center, at-home, tele). Business vendors appear for **at_center** when they offer it; they can also offer at_home and tele where the role allows.  
  *Code:* `service-discovery.ts` — at_center returns business vendors; role mapping for vet_clinic, groomer_center, pet_trainer, etc.
- **Bookings:** Central booking view (today/upcoming) by service type; business can have multiple staff and locations.  
  *Code:* `VendorDashboard` — dashboard and bookings; capability `bookings`.
- **Staff management:** Business-only capability — add and manage team (doctors, groomers, trainers, walkers, etc.).  
  *Code:* `capability-routes.ts` — `staff.requiresBusiness: true`; `VendorCapabilityDashboard` shows staff when `vendor_type !== 'solo'`.
- **Earnings & payouts:** Same as solo — earnings, settlements, bank account.  
  *Code:* `BASE_CAPABILITIES` in `role-seeding.ts`; finance routes in `capability-routes.ts`.
- **Facility management:** Manage location, amenities, operating hours.  
  *Code:* `role-seeding.ts` — `facility_management` for clinic/groomer/trainer/etc.; `capability-routes.ts` — facility_management route.
- **Service and pricing control:** Custom services and packages; full control over price and duration where role allows.  
  *Code:* `role-seeding.ts` — `pricingControl`, capabilities; `vendor-services.ts` — business roles get broader `allowedServiceStyles` (e.g. at_center + at_home + tele).
- **Communication:** In-app chat with customers.  
  *Code:* `chat` in capabilities for all roles.
- **Trust:** Business name, address, and (where applicable) amenities/specializations shown in discovery and profile.

---

## 3. Unique features & functionality to emphasise (by vendor type — Business only)

### 3.1 Vet — Clinic / Business — role: `vet_clinic`, `veterinary_clinic`

- **Service styles (business):** **At center**, **Tele**, **At home** (all three).  
  *Code:* `vendor-services.ts` — `veterinary_clinic`, `vet_clinic`: `['at_center', 'tele', 'at_home']`.
- **Emphasise:**  
  - **Clinic visits** — customers book in-clinic appointments (at_center).  
  - **Tele-consultation** — video consults.  
  - **Home visits** — optional home visits.  
  - **Multi-doctor management** — assign doctors to slots.  
  - **Prescriptions, medical records, patient monitoring** — full vet capabilities.  
  - **Ambulance services, diagnostic lab, emergency protocols** — clinic-specific capabilities.  
  *Code:* `role-seeding.ts` — `veterinary_clinic`: multi_doctor_management, ambulance_services, diagnostic_lab, emergency_protocols; plus prescriptions, medical_records, vet_summary, patient_monitoring.

---

### 3.2 Groomer — Salon / Center — role: `groomer_center`, `pet_groomer`, `grooming_salon`

- **Service styles (business):** **At center** + **At home** (no tele for grooming).  
  *Code:* `vendor-services.ts` — `pet_groomer`, `groomer_center`: `['at_center', 'at_home']`.
- **Emphasise:**  
  - **Salon/center bookings** — customers come to your location.  
  - **Mobile grooming** — optional at-home services.  
  - **Gallery** — showcase work.  
  - **Staff** — multiple groomers; manage team and assignments.  
  - **Custom services & packages** — set packages and pricing.  
  *Code:* `role-seeding.ts` — `pet_groomer`: gallery, staff, facility_management, custom_services, packages.

---

### 3.3 Trainer — Center — role: `trainer_center`, `pet_trainer`

- **Service styles (business):** **At home**, **At center**, **Tele** (all three).  
  *Code:* `vendor-services.ts` — `pet_trainer`, `trainer_center`: `['at_home', 'at_center', 'tele']`.
- **Emphasise:**  
  - **Center sessions** — clients come to your training facility.  
  - **Home visits & tele** — flexible delivery.  
  - **Progress tracking** — track client/pet progress.  
  - **Staff** — multiple trainers.  
  - **Packages** — session packs and programs.  
  *Code:* `role-seeding.ts` — `pet_trainer`: progress_tracking, staff, packages; capability-routes — training_programs, progress_tracking.

---

### 3.4 Walker — Business — role: `dog_walker`, `pet_walker`

- **Service styles:** **At home** only (walk/visit from customer’s location).  
  *Code:* `vendor-services.ts` — `pet_walker`, `dog_walker`: `['at_home']`.
- **Emphasise (business):**  
  - **GPS tracking** — customers see walk route; builds trust.  
  - **Photo updates** — post-walk photos.  
  - **Staff** — manage multiple walkers and assign walks.  
  - **Custom services** — define walk types and pricing.  
  *Code:* `role-seeding.ts` — `pet_walker`: gps_tracking, photo_updates, facility_management, custom_services; staff shown only for business.

---

### 3.5 Behaviourist — Center / Business — role: `pet_behaviourist`, `pet_behaviorist`

- **Service styles (business):** **At home**, **At center**, **Tele** (all three).  
  *Code:* `vendor-services.ts` — `pet_behaviorist`: `['at_home', 'at_center', 'tele']`.
- **Emphasise (business):**  
  - **Center consultations** — clients come to your facility.  
  - **Tele / video** — remote behaviour consults.  
  - **Home visits** — in-person assessments.  
  - **Progress tracking** — behaviour plans over time.  
  - **Staff** — multiple behaviourists.  
  - **Packages** — multi-session plans.  
  *Code:* `role-seeding.ts` — `pet_behaviorist`: progress_tracking, tele_consultation, packages, staff.

---

### 3.6 Nutritionist — Center / Business — role: `pet_nutritionist`, `nutritionist_center`

- **Service styles (business):** **At center**, **Tele**, **At home**; `nutritionist_center` also has all three.  
  *Code:* `vendor-services.ts` — `nutritionist`, `pet_nutritionist`: `['at_center', 'tele', 'at_home']`; `nutritionist_center`: `['at_center', 'at_home', 'tele']`.
- **Emphasise (business):**  
  - **Clinic/center consultations** — in-person diet consults.  
  - **Tele / video** — online consults.  
  - **Meal plans & diet charts** — dedicated capabilities.  
  - **Prescriptions & delivery** — diet prescriptions and delivery linkage.  
  - **Staff** — multiple nutritionists.  
  *Code:* `role-seeding.ts` — `nutritionist`: meal_plans, diet_charts, prescriptions, delivery, progress_tracking, tele_consultation, video_calling, staff.

---

## 4. Business-specific platform rules (from code)

- **Staff capability:** Only shown when `vendor_type !== 'solo'`.  
  *Code:* `VendorCapabilityDashboard.tsx` — `cap.name === 'staff' && vendor?.vendor_type === 'solo'` → exclude.
- **At-center:** Business roles can offer **at_center**; solo roles cannot (solo vet/groomer/trainer are at_home and/or tele only).  
  *Code:* `vendor-services.ts` — ROLE_SERVICE_STYLES; service-discovery — at_center returns non–solo roles.
- **Vendor type in admin:** Derived from role name — `LIKE '%_solo'` → solo, else business; list shows `businessName`, `vendorType`.  
  *Code:* `admin.ts` — CASE WHEN r.name LIKE '%_solo' ... THEN 'solo' ELSE 'business'; `admin-comprehensive.ts` — same logic, `vendorType`, staff count for business.

---

## 5. BDM checklist — Business onboarding

- [ ] Explain: Phone → OTP → Role (Clinic / Salon / Center / Business) → **Business** → Form → Review → Approval → Setup (including **staff** and **facility**) → Dashboard.
- [ ] Set expectation: “You’ll choose **Business / Center**; you can add staff and list your physical location.”
- [ ] For each type, stress **at_center** where applicable (clinic, salon, training center, behaviourist center, nutritionist center) and optional at_home/tele.
- [ ] Mention: discovery by category and service style, one place for bookings/earnings/schedule, **staff management**, **facility management**, chat.
- [ ] Clarify role-specific extras: multi-doctor, ambulance, diagnostic lab (vet clinic); gallery (groomer); progress tracking (trainer, behaviourist); GPS/photo (walker); meal plans/diet charts/delivery (nutritionist).

---

*Document generated from codebase forensics only; no assumptions or external MD files used.*
