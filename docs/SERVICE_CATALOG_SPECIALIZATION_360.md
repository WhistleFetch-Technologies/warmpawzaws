# Service Catalog, Specializations & 360° Flow

## 1. Overview

This document describes how **categories**, **specializations**, **service catalog**, and **vendor profiles** connect end-to-end (360°), and how **service styles** and **roles** are configured.

**Implementation flow (migrations & deployment):**  
- **Deployment architecture:** AWS Serverless (RDS, Cognito, S3, Lambda, CloudFront).  
- **DB migrations:** Use **Node scripts in `scripts/`** (e.g. `run-migration-rds-node.js`).  
- **Deployment:** Use **scripts in `scripts/`** (e.g. `deploy-all.sh`, `deploy-admin-web.sh`).  

See **`docs/IMPLEMENTATION_FLOW.md`** for full instructions.

---

## 2. Service Styles (Defined)

Service style = **where** the service is delivered. Used for discovery (at clinic vs at home vs tele).

| Style       | Value       | Description | Typical roles |
|------------|-------------|-------------|----------------|
| At Center  | `at_center` | Customer visits vendor’s location (clinic, salon, center) | vet_clinic, groomer_center, trainer_center, diagnostics_center |
| At Home    | `at_home`   | Vendor visits customer (home visit, mobile) | vet_solo, groomer_solo, walker, ambulance |
| Tele       | `tele`      | Remote (video/phone) | vet_solo, vet_clinic, trainer_solo, nutritionist, behaviorist |
| All        | `all`       | Service can be offered in any of the above (catalog only; vendor still picks one style per offering) | Optional for catalog |

**Rules (from VENDOR_TYPES_AND_ROLES_GUIDE):**

- **Solo** vendors: cannot offer `at_center`; only `at_home` and `tele`.
- **Business** vendors: can offer `at_center`, `at_home`, `tele` (per role config).
- Role `config.serviceStyles` (or `config.serviceStyles.selected`) defines which styles a role can use.

---

## 3. Roles and Categories (Current)

| Category / Domain   | Roles (examples) | Service styles (typical) |
|---------------------|------------------|---------------------------|
| Veterinary          | veterinarian, vet_solo, vet_clinic | at_center, at_home, tele |
| Grooming            | pet_groomer, groomer_solo, groomer_center | at_center, at_home |
| Training             | pet_trainer, trainer_solo, trainer_center | at_center, at_home, tele |
| Walking              | walker, pet_walker | at_home |
| Diagnostics / Lab   | diagnostics_center, vet_clinic | at_center, at_home (sample collection) |
| Emergency / Ambulance | ambulance, pet_ambulance | at_home |
| Pharmacy             | pharmacy, pet_pharmacy | at_center, at_home (delivery) |
| Nutrition / Wellness | pet_nutritionist, nutritionist, nutritionist_center | tele, at_home |
| Behavior             | pet_behaviorist, trainer_solo, trainer_center | at_home, tele |
| Boarding / Daycare   | pet_boarder, pet_daycare, pet_sitter | at_center, at_home |

`service_catalog.applicable_roles` and `specialization_master.applicable_roles` use these role names (or IDs) so only the right roles see the right services and specializations.

---

## 4. 360° Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ADMIN: Categories tab                                                    │
│  service_categories (e.g. veterinary, grooming, diagnostic)              │
│       │                                                                  │
│       ▼                                                                  │
│  specialization_master (e.g. general_health, surgery, dental)             │
│  - category_id → service_categories                                       │
│  - applicable_roles → which roles can select this specialization         │
│  - show_in_problem_grid → "What's your pet's need?" (customer home)       │
│  - show_in_vendor_profile → Vendor profile specialization selector       │
│  - show_in_services_dashboard → Service landing "What do you need?"      │
│  - icon_name, icon_color → same icon everywhere (customer + vendor)       │
│  - allowed_service_styles → filter booking flow to allowed styles only    │
└─────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  ADMIN: Service catalog                                                 │
│  service_catalog                                                         │
│  - category_id, sub_category_id                                          │
│  - applicable_roles → which roles can offer this service                 │
│  - service_style → at_center | at_home | tele | all                       │
│  - specialization_ids[] → links to specialization_master (multi-select)   │
└─────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  VENDOR: Profile & onboarding                                            │
│  vendor_specializations (vendor picks from specialization_master        │
│  by role → GET /vendor/specializations/:roleId)                          │
│  Vendors enable catalog services → vendor_services                       │
└─────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  CUSTOMER: Problem grid & discovery                                      │
│  Problem grid = specializations (from specialization_master)           │
│  Customer picks problem → match vendors by vendor_specializations         │
│  Services shown = service_catalog filtered by role + style                 │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Category** drives which **specializations** exist and where they appear (admin, vendor profile, problem grid).
- **Service catalog** entries are linked to **categories** and optionally to **specializations** via `specialization_ids`.
- **Vendor profile** stores chosen **specializations**; discovery uses these to match “problem” (specialization) to vendors and then to **services** (catalog → vendor_services).

---

## 5. Linking Services to Specializations

- **Table:** `service_catalog.specialization_ids` (TEXT[]).
- **Purpose:** One service can be tagged with multiple specializations (e.g. “General Consultation” → general_health, medicine; “Dental Check-up” → dentistry).
- **Admin UI:** Create/Edit Service has a **Specializations (optional)** multi-select; options are loaded by `categoryId` from `GET /admin/specializations?categoryId=...`.
- **Backend:** POST/PUT accept `specialization_ids` or `specializationIds`; GET responses include `specialization_ids` / `specializationIds`.

This links catalog services back to the same specializations used on vendor profiles and the problem grid, so the 360° flow stays consistent.

---

## 6. Where Things Are Configured

| What | Where |
|------|--------|
| Service styles | DB: `service_catalog.service_style`; role: `roles.config.serviceStyles`. Doc: VENDOR_TYPES_AND_ROLES_GUIDE.md. |
| Roles | `roles` table; seeding in migrations (e.g. 047, 140, 250, 521). |
| Categories | `service_categories` (e.g. migration 048). |
| Specializations | `specialization_master`; admin CRUD + seed (e.g. seed-specialization-master.js). |
| Service ↔ specializations | `service_catalog.specialization_ids`; admin Service Catalog create/edit. |
| Vendor ↔ specializations | `vendor_specializations`; vendor profile / onboarding. |

---

## 7. Vet & Diagnostics Service List (Reference)

The extensive vet/diagnostics list you provided (consultations, preventive care, medical treatment, surgical, dental, emergency, dermatology, reproductive, pediatric/geriatric, euthanasia, documentation, in-clinic, lab/diagnostics) should be:

1. **Mapped to categories** (e.g. veterinary, diagnostic, emergency).
2. **Mapped to specializations** where applicable (e.g. general_health, surgery, dentistry, emergency, dermatology).
3. **Assigned `applicable_roles`** (e.g. veterinarian, vet_clinic, diagnostics_center, ambulance).
4. **Assigned `service_style`** (at_center / at_home / tele) and optional **realistic base_price** and duration.
5. **Linked via `specialization_ids`** so discovery and vendor profile stay aligned.

Use the existing 048 seed and seed-complete-service-catalog.js as the base; **modify existing rows** for names/prices/roles/specializations first, then **add only missing** services so we don’t duplicate.

---

---

## 8. Applying Schema Changes (e.g. specialization_ids)

**India metro seed:** `scripts/seed-service-catalog-india-metro.js` enhances vet, walker, trainer, behaviorist, groomer with specialization_ids and India metro pricing; adds walker packages, trainer tele + 5-session pack, behaviorist sessions. Run: `ENVIRONMENT=dev node scripts/seed-service-catalog-india-metro.js` (prerequisites: migration 524, specialization_master seeded).

- **Migration 524** adds `service_catalog.specialization_ids`.  
- Run it with the **Node script** against RDS (see `docs/IMPLEMENTATION_FLOW.md`):

  ```bash
  ENVIRONMENT=dev node scripts/run-migration-rds-node.js 524_service_catalog_specialization_ids.sql
  ```

- Then deploy backend (and admin-web if UI changed) using scripts in `scripts/`.

---

**Last updated:** 2026-02-02
