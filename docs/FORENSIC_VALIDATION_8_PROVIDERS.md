# Forensic Validation: 8 Launched Service Providers

End-to-end flow validation for: **Vet, Groomer, Trainer, Walker, Nutritionist, Behaviorist, Pharmacy, Diagnostics Center**.

---

## 1. Entry Points & handleNavigateToService

| Provider        | Screen(s)        | handleNavigateToService key(s)     | Status |
|-----------------|------------------|-----------------------------------|--------|
| Vet             | `vet`            | `vet`, `veterinarian`             | OK     |
| Groomer         | `grooming`       | `grooming`                        | OK     |
| Trainer         | `training`       | `training`                        | OK     |
| Walker          | `walker`         | `walker`                          | OK     |
| Nutritionist    | `nutritionist`   | `nutritionist`                   | OK     |
| Behaviorist     | `behaviorist`    | `behaviorist`, `behavioral`       | OK (added) |
| Pharmacy        | `pharmacy`       | `pharmacy`, `pharmacy_store`      | OK     |
| Diagnostics     | `lab-diagnostics`| `diagnostics`, `lab-diagnostics`, `lab` | OK |

---

## 2. Problem Grid & roleMap (View All → ProblemGridSelector)

When user taps "View All" from a provider dashboard, `currentServiceType` is set and `problem_grid` uses `roleMap` to pass `roleId` / `roleName` to `ProblemGridSelector`.

| currentServiceType | roleId        | roleName     | Back → screen   |
|--------------------|---------------|--------------|-----------------|
| groomer            | groomer       | Groomer      | grooming        |
| trainer            | trainer       | Trainer      | training        |
| veterinarian       | veterinarian  | Veterinarian | vet             |
| walker             | walker        | Walker       | walker          |
| boarding           | boarding      | Boarding     | boarding        |
| adoption           | adoption      | Adoption     | adoption        |
| sunset             | sunset        | Sunset Care  | sunset          |
| nutritionist       | nutritionist  | Nutritionist | nutritionist    |
| pet_nutritionist   | nutritionist  | Nutritionist | nutritionist    |
| behaviorist        | behaviorist   | Behaviorist  | behaviorist     |
| general (home)      | all           | All Services | home            |

**Backend `/public/problems?roleId=<roleId>`**: Returns problems with `allowedServiceStyles`. Default problems exist for: vet, groomer, trainer, walker, behavioral, **behaviorist** (added), boarding, nutritionist.

---

## 3. Problem Grid Flow (What's your pet's needs? + symptom search)

- **Home "What's your pet's needs?"**: `ProblemGridNavigation` → onProblemSelect → `onNavigate('services_by_problem', { problemId, problemTitle, roleId, problem })` → wrapper sets `selectedProblem` (with `allowedServiceStyles`) → `problem_grid_flow`.
- **Symptom search**: Search bar calls `/public/search/symptoms?q=...` → results type `symptom` → onResultSelect → `onNavigate('services_by_problem', { problemId, problemTitle, roleId, problem })` → same `problem_grid_flow`.
- **ProblemGridFlowRouter**: Uses `initialProblem.allowedServiceStyles` (from `selectedProblem.allowedServiceStyles`) so only allowed styles are shown. Fetches providers via **GET /customer/services/by-problem?problemId=&serviceStyle=**.

**By-problem params**: `problemId`, `serviceStyle` (at_home | at_center | tele). Backend infers/expands roleIds from mappings or from `problemToRoleMap` (e.g. separation_anxiety → trainer + behaviorist_solo/center; barking/destructive/fear_phobia → behaviorist_solo/center). Vendor list filtered by role + service_style + optional subcategory/specialization.

---

## 4. Provider-specific flows (dashboard → style → discovery → booking)

| Provider     | Dashboard / Landing        | Style selection / Problem grid      | Discovery / List              | Booking screen          |
|-------------|----------------------------|--------------------------------------|-------------------------------|-------------------------|
| **Vet**     | VetServiceRouter           | VetServicesByStyle / problem_grid    | VetServicesByStyle, ClinicListView, TeleConsultationRouter, HomeVisitRouter | vet-booking (VetBookingRouter) |
| **Groomer** | GroomingServiceRouter      | grooming_home, grooming_center, problem_grid | GroomingServicesByStyle etc.  | create-booking          |
| **Trainer** | TrainingServiceRouter      | training_home, training_center, problem_grid | TrainingServiceRouter lists  | training-booking        |
| **Walker**  | WalkerDashboard            | problem_grid (walker = at_home only typically) | WalkerDashboard / by-problem | walker-booking          |
| **Nutritionist** | NutritionistServicesLanding | nutritionist-tele, problem_grid   | NutritionistTeleRouter etc.   | nutritionist-booking    |
| **Behaviorist** | ProblemGridSelector(roleId=behaviorist) | problem_grid only → problem_grid_flow | by-problem                   | create-booking (generic) |
| **Pharmacy**| PharmacyServicesLanding   | N/A (order flow / shop)              | pharmacy_order_flow, pharmacy_store | pharmacy_order_flow, pharmacy_checkout |
| **Diagnostics** | DiagnosticsServicesLanding | N/A (lab tests / reports)       | diagnostics-booking, diagnostics-reports | diagnostics-booking    |

---

## 5. Vendor discovery alignment

- **Service dashboard** and **vendor discovery** must use the same **role** and **service style**.
- **Vet**: roleId `veterinarian` (or vet_solo/vet_clinic in DB); styles at_home, at_center, tele.
- **Groomer**: roleId `groomer`; styles at_home, at_center (no tele typically).
- **Trainer**: roleId `trainer`; styles at_home, at_center, tele.
- **Walker**: roleId `walker`; style at_home (and tele if configured).
- **Nutritionist**: roleId `nutritionist` / `pet_nutritionist`; styles tele, at_home, at_center per role config.
- **Behaviorist**: roleId `behaviorist`; backend expands to `behaviorist_solo`, `behaviorist_center` in by-problem; styles from role config or default at_home, at_center, tele.
- **Pharmacy**: Not problem-grid; order flow / ecommerce.
- **Diagnostics**: roleId `diagnostics_center` (or similar); lab booking flow.

**By-problem API**: Uses `problem_grid_mappings` when present; else infers roleIds from `problemToRoleMap` and expands with `problemRoleToVendorRoleNames` (e.g. behaviorist → behaviorist_solo, behaviorist_center). Filters vendors by `role_id` (via roles table join) and `service_style`.

---

## 6. Stitching checks

1. **What's your pet's needs?** → problem click → `selectedProblem` includes `allowedServiceStyles` → ProblemGridFlowRouter shows only those styles → by-problem called with same `problemId` + chosen `serviceStyle` → vendor list matches role + style.
2. **Symptom search** → symptom result → same `services_by_problem` payload with `problem.allowedServiceStyles` → same flow.
3. **Dashboard "View All"** (e.g. Vet → View All) → `problem_grid` with `currentServiceType = veterinarian` → ProblemGridSelector(roleId=veterinarian) → problem select → `problem_grid_flow` with `allowedServiceStyles` from `/public/problems?roleId=veterinarian`.

---

## 7. Gaps fixed in this pass

1. **Behaviorist**: No dashboard in wrapper; no default problems for roleId `behaviorist`.
   - **Fix**: Added `handleNavigateToService('behaviorist'|'behavioral')` → `behaviorist` screen; added `behaviorist` screen rendering `ProblemGridSelector(roleId="behaviorist", roleName="Behaviorist")`; added `roleMap['behaviorist']` and back navigation; added `getDefaultProblemsForRole('behaviorist')` in backend; added behavioral problemIds to `problemToRoleMap` (barking, destructive, fear_phobia); added Behaviorist to home quick services and search navigation map.
2. **roleMap**: Missing nutritionist and behaviorist for back-from-problem-grid.
   - **Fix**: Added nutritionist, pet_nutritionist, behaviorist to roleMap and onBack handling.
3. **Search**: behavioral/behaviorist and diagnostics not mapping to correct screen.
   - **Fix**: Added behavioral → behaviorist, behaviorist → behaviorist, diagnostics/lab-diagnostics/lab → lab-diagnostics in CustomerHomeComplete serviceNavigationMap.

---

## 8. Micro-test checklist (click-by-click)

For each provider, verify:

1. **Home → Provider tile** → lands on correct dashboard/screen.
2. **Dashboard → View All (if any)** → ProblemGridSelector with correct roleId and problem list.
3. **Problem select** → problem_grid_flow with only allowed service styles shown.
4. **Service style select** → provider list loads (by-problem); list matches role and style.
5. **Provider select** → booking screen with correct vendor/service/price.
6. **Back** from problem grid → returns to that provider’s dashboard (or home if opened from home).
7. **Universal search** with provider/symptom term → correct screen or symptom-driven booking flow.
8. **What's your pet's needs?** → category → problem → style → discovery → booking with filters applied.

Pharmacy and Diagnostics: verify landing → order/reports flows and that no problem-grid path is required.
