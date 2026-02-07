# Service Discovery: Flows, Roles, and Filters Reference

This document lists each customer-facing flow, the discovery API used, query params, roles included, service-style and other filters, and what data is populated (counts and lists).

---

## Quick reference: Flow → API, category, service style, roles, and what is populated

| # | Flow (Tile / Screen) | Primary API | category | serviceStyle | roleId (if set) | Roles included | What is populated |
|---|----------------------|-------------|----------|--------------|-----------------|----------------|--------------------|
| 1 | Vet Care | discover-services, by-style | vet | at_center / at_home / tele | veterinarian (home) | vet_solo, vet_clinic, veterinarian, vet | vendors, providers, total |
| 2 | Grooming | discover-services, by-style | grooming | at_center, at_home | pet_groomer (home) | groomer_solo, groomer_center, pet_groomer | vendors, providers, total |
| 3 | Trainer / Training | discover-services, by-style | training | at_center, at_home, tele | pet_trainer (home) | trainer_solo, trainer_center, pet_trainer | vendors, providers, total |
| 4 | Dog Walker | discover-services | walker | at_home | walker | walker, walker_solo, pet_walker, dog_walker | vendors, providers, total |
| 5 | Boarding | discover-services | boarding | — | pet_boarding | boarding, pet_boarder, pet_boarding | vendors, providers, total |
| 6 | Adoption | discover-services | adoption | — | ngo | adoption_center, pet_shelter | vendors, providers, total |
| 7 | Pet Shop | discover-services | shop | — | — | seller, pet_products_store | vendors, providers, total |
| 8 | Pharmacy | discover-services | pharmacy | — | — | pharmacy, pet_pharmacy | vendors, providers, total |
| 9 | Lab Test / Diagnostics | vendors-with-tests, services | lab-diagnostics / diagnostics | at_center, at_home | diagnostics_center | diagnostics_center, diagnostics_provider, diagnostics_solo, **vet_clinic** (with diagnostics capability) | vendors (with published tests), total |
| 10 | Nutritionist | discover-services | nutrition / nutritionist | at_center, at_home, tele | pet_nutritionist | nutritionist, nutritionist_center, pet_nutritionist | vendors, providers, total |
| 11 | Pet Cafes | discover-services | cafe | — | pet_cafe | cafe, pet_cafe | vendors, providers, total |
| 12 | Photography | discover-services | photography | — | pet_photographer | photographer, pet_photographer | vendors, providers, total |
| 13 | Insurance | discover-services | insurance | — | pet_insurance | insurance, pet_insurance | vendors, providers, total |
| 14 | Ambulance | discover-services | ambulance | — | — | ambulance, pet_ambulance | vendors, providers, total |
| 15 | Breeder | discover-services | breeder | — | — | breeder, pet_breeder | vendors, providers, total |
| 16 | Relocation | discover-services | relocation | — | pet_relocation | relocation, pet_taxi, pet_transport | vendors, providers, total |
| 17 | Pet Resort | discover-services | resort | — | pet_resort | resort, pet_resort | vendors, providers, total |
| 18 | Pet Holiday | discover-services | holiday | — | pet_holiday | holiday | vendors, providers, total |
| 19 | Sunset Care | discover-services | sunset | — | pet_sunset_services | sunset, pet_sunset_services | vendors, providers, total |
| 20 | Home service (universal) | discover-services | vet/grooming/training/walker/… | at_home | config.roleId or category | Per category (see table above) | providers list, count |

**Backend filters applied (summary):**

- **discover-services**
  - **at_home / tele:** Vendors in target roles; approved/active; has published or enabled vendor_services (walker: any enabled; others: published/draft); exclude business_name containing clinic/hospital/center/centre/salon/“ business”; limit 50.
  - **at_center:** Vendors in target roles; approved/active; **exclude solo** (r.name NOT LIKE '%_solo', vendor_type != 'solo'); must have vendor_services with service_style = at_center, enabled, published.
  - **No serviceStyle:** Vendors in target roles; approved/active; no service_style filter.
- **services/by-style**
  - **at_center:** Non-solo vendors; vendor_services with style = requested style, enabled, published; category → categoryRoles.
  - **at_home / tele:** Staff + vendors; category/roleId → targetRoles; same role set as discover-services for that category.

**What is populated:** Response always includes `vendors` and/or `providers` array and `total` (length). Enriched fields: services, rating, nextAvailability, consultationFee, distance (when lat/lng sent).

---

## Backend discovery endpoints

| Endpoint | Purpose | When used |
|----------|---------|-----------|
| `GET /customer/discover-services` | Main discovery: vendors/providers by category and optional service style | Landing lists, home tiles, by-style flows (primary or fallback) |
| `GET /customer/services/by-style` | Providers filtered by `style` + `category`; returns clinic profiles with services for at_center, staff/solo for at_home/tele | Vet/Grooming/Training “by style” (Clinic / Home / Tele) |
| `GET /customer/discovery/meta` | Roles and categories that have discoverable vendors; used for filters | CustomerServicesPage, dashboard filters |

---

## Flow → API, params, roles, filters, and what is populated

### 1. Vet Care (screen: `vet`)

| Item | Detail |
|------|--------|
| **Tile** | Vet Care, categoryId: `vet` |
| **Landing (VetServiceRouter)** | 1) `GET /customer/discover-services?category=vet` (no serviceStyle) → 2) fallback `GET /customer/services/by-style?style=tele&category=vet` |
| **By style (VetServicesByStyle)** | Primary: `GET /customer/services/by-style?style={serviceStyle}&category=vet`. Fallback: `GET /customer/discover-services?category=vet&serviceStyle={serviceStyle}` |
| **Clinic list (ClinicListView)** | `GET /customer/discover-services?category=vet&serviceStyle=at_center` |
| **Home visit (HomeVisitRouter)** | UniversalServicesByStyle / discover-services: `category=vet`, `serviceStyle=at_home`, `roleId=veterinarian` |
| **Roles included** | `vet_solo`, `vet_clinic`, `veterinarian`, `vet` |
| **Service styles** | `at_center` (clinics), `at_home`, `tele` |
| **Backend filters** | at_center: `r.name NOT LIKE '%_solo'`, `vendor_type != 'solo'`, `vendor_services.service_style = 'at_center'`. at_home/tele: target roles, vendors with published/enabled service (any style for walker-like; else published). Excludes business_name containing clinic/hospital/center/centre/salon. |
| **Populated** | `vendors` / `providers` array, `total` (length). Enriched: services, rating, nextAvailability, consultationFee. |

---

### 2. Grooming (screen: `grooming`)

| Item | Detail |
|------|--------|
| **Tile** | Grooming, categoryId: `grooming` |
| **Landing (GroomingServiceRouter)** | 1) `GET /customer/discover-services?category=grooming` → 2) `GET /customer/services/by-style?style=at_center&category=grooming` |
| **By style (GroomingServicesByStyle)** | Primary: `GET /customer/discover-services?category=grooming&serviceStyle={serviceStyle}` → Fallback: `GET /customer/services/by-style?style={serviceStyle}&category=grooming`. Third fallback: `roleId=pet_groomer` |
| **Home (GroomingHomeVisitRouter)** | UniversalServiceProviderList: `category=grooming`, `serviceStyle=at_home`, `roleId=pet_groomer` |
| **Roles included** | `groomer_solo`, `groomer_center`, `grooming_solo`, `pet_groomer`, `groomer`, `grooming_salon` |
| **Service styles** | `at_center`, `at_home` |
| **Backend filters** | Same as vet: at_center = non-solo + at_center services; at_home/tele = role filter + published/enabled services. |
| **Populated** | `vendors` / `providers`, `total`. By-style returns `providers` with `services` array. |

---

### 3. Trainer / Training (screen: `training`)

| Item | Detail |
|------|--------|
| **Tile** | Trainer, categoryId: `training` |
| **Landing (TrainingServiceRouter)** | 1) `GET /customer/discover-services?category=training` → 2) `GET /customer/services/by-style?style=at_home&category=training` |
| **By style (UniversalServicesByStyle)** | at_center: `by-style?style=at_center&category=training`. at_home/tele: `discover-services?category=training&serviceStyle={style}` |
| **Home (TrainerHomeVisitRouter)** | `category=training`, `roleId=pet_trainer`, `serviceStyle=at_home` |
| **Roles included** | `trainer_solo`, `trainer_center`, `training_solo`, `pet_trainer`, `trainer`, `solo` |
| **Service styles** | `at_center`, `at_home`, `tele` |
| **Backend filters** | Same pattern as vet/grooming. |
| **Populated** | `vendors` / `providers`, `total`; by-style: `providers` with `services`. |

---

### 4. Dog Walker (screen: `walker`)

| Item | Detail |
|------|--------|
| **Tile** | Dog Walker, categoryId: `walker` |
| **Landing (WalkerService)** | Primary: `GET /customer/discover-services?category=walker&serviceStyle=at_home&roleId=walker`. Fallback: same without roleId. Fallback search: `roleId=pet_walker`, `serviceStyle=at_home` |
| **Roles included** | `walker`, `walker_solo`, `pet_walker`, `dog_walker` |
| **Service styles** | `at_home` only (walkers; no at_center in config) |
| **Backend filters** | at_home branch: target roles, EXISTS enabled vendor_services (walker: any enabled; others published/draft). Excludes clinic/hospital/center/centre/salon/business name. |
| **Populated** | `vendors` / `providers`, `total` (solo providers list). |

---

### 5. Boarding (screen: `boarding`)

| Item | Detail |
|------|--------|
| **Tile** | Boarding, categoryId: `boarding` |
| **Landing (BoardingServiceRouter)** | `GET /customer/discover-services?category=boarding&roleId=pet_boarding` |
| **Roles included** | `boarding`, `pet_boarder`, `pet_daycare`, `pet_boarding` |
| **Service styles** | Typically `at_center` (facility). |
| **Backend filters** | If no serviceStyle: all approved/active vendors in target roles. If at_center: non-solo + at_center vendor_services. |
| **Populated** | `vendors` / `providers`, `total`. |

---

### 6. Adoption (screen: `adoption`)

| Item | Detail |
|------|--------|
| **Tile** | Adoption, categoryId: `adoption` |
| **Landing (AdoptionServiceRouter)** | `GET /customer/discover-services?category=adoption&roleId=ngo` |
| **Roles included** | `adoption_center`, `pet_shelter`, `pet_adoption_center` |
| **Service styles** | — |
| **Backend filters** | Target roles, approved/active, published/enabled services as per branch. |
| **Populated** | `vendors` / `providers`, `total`. |

---

### 7. Pet Shop (screen: `shop`)

| Item | Detail |
|------|--------|
| **Tile** | Pet Shop, categoryId: `shop` |
| **Roles included** | `seller`, `pet_products_store` |
| **Service styles** | Discovery supports category; by-style may use delivery/pickup where configured. |
| **Backend filters** | resolveTargetRolesForDiscovery(category=shop) → target roles; same vendor/service filters. |
| **Populated** | `vendors` / `providers`, `total` when flow calls discover-services or by-style with category=shop. |

---

### 8. Pharmacy (screen: `pharmacy`)

| Item | Detail |
|------|--------|
| **Tile** | Pharmacy, categoryId: `pharmacy` |
| **Roles included** | `pharmacy`, `pet_pharmacy` |
| **Service styles** | — |
| **Backend filters** | Target roles, approved/active vendors. |
| **Populated** | Same as above when discovery is used for pharmacy. |

---

### 9. Lab Test / Diagnostics (screen: `lab-diagnostics`)

| Item | Detail |
|------|--------|
| **Tile** | Lab Test, categoryId: `lab-diagnostics` |
| **Landing (DiagnosticsServicesLanding)** | Uses `GET /customer/diagnostics/vendors-with-tests?…` (specialized). Fallback: `GET /customer/services?roleId=diagnostics_center` |
| **Category normalization** | Backend maps `lab-diagnostics` → diagnostics for role resolution. |
| **Roles included** | `diagnostics_center`, `diagnostics_provider`, `diagnostics_solo`, and **vet_clinic / veterinary_clinic / vet** when the vendor has diagnostics capability (diagnostics, diagnostic_results, or test_catalog) and at least one **published** test (`is_available = true`). |
| **Service styles** | `at_center`, `at_home` (home collection) via params. |
| **Backend filters** | vendors-with-tests: only vendors with ≥1 published diagnostic test; role = diagnostics_center/diagnostic_center OR (vet_clinic/veterinary_clinic/vet + diagnostics permission). |
| **Populated** | Specialized: vendors with published tests (labs + vet clinics with lab tests enabled); fallback: services list. |

---

### 10. Nutritionist (screen: `nutritionist`)

| Item | Detail |
|------|--------|
| **Tile** | Nutritionist, categoryId: `nutritionist` |
| **Landing (NutritionistServicesLanding)** | `GET /customer/discover-services?category=nutrition&roleId=pet_nutritionist` |
| **Home service list** | category=nutritionist or nutrition, serviceStyle=at_home, roleId from config. |
| **Roles included** | `nutritionist`, `nutritionist_solo`, `nutritionist_center`, `pet_nutritionist` |
| **Service styles** | `at_center`, `at_home`, `tele` |
| **Backend filters** | Same as other categories. |
| **Populated** | `vendors` / `providers`, `total`. |

---

### 11. Pet Cafes (screen: `cafes`)

| Item | Detail |
|------|--------|
| **Tile** | Pet Cafes, categoryId: `cafes` |
| **Landing (PetCafeServicesLanding)** | `GET /customer/discover-services?category=cafe&roleId=pet_cafe` |
| **Roles included** | `cafe`, `pet_cafe` (backend category key `cafes` and `cafe` both map to these roles) |
| **Service styles** | — |
| **Backend filters** | Target roles, approved/active. |
| **Populated** | `vendors` / `providers`, `total`. |

---

### 12. Photography (screen: `photography`)

| Item | Detail |
|------|--------|
| **Tile** | Photography, categoryId: `photography` |
| **Landing (PhotographyServicesLanding)** | `GET /customer/discover-services?category=photography&roleId=pet_photographer` |
| **Roles included** | `photographer`, `pet_photographer` |
| **Backend filters** | Target roles. |
| **Populated** | `vendors` / `providers`, `total`. |

---

### 13. Insurance (screen: `insurance`)

| Item | Detail |
|------|--------|
| **Tile** | Insurance, categoryId: `insurance` |
| **Landing (InsuranceServicesLanding)** | `GET /customer/discover-services?category=insurance&roleId=pet_insurance` |
| **Roles included** | `insurance`, `pet_insurance` |
| **Backend filters** | Target roles. |
| **Populated** | `vendors` / `providers`, `total`. |

---

### 14. Ambulance (screen: `ambulance`)

| Item | Detail |
|------|--------|
| **Tile** | Ambulance, categoryId: `ambulance` |
| **Roles included** | `ambulance`, `pet_ambulance` |
| **Backend filters** | Target roles. |
| **Populated** | Same when discovery used. |

---

### 15. Breeder (screen: `breeder`)

| Item | Detail |
|------|--------|
| **Tile** | Breeder, categoryId: `breeder` |
| **Roles included** | `breeder`, `pet_breeder` |
| **Backend filters** | Target roles. |
| **Populated** | Same when discovery used. |

---

### 16. Relocation (screen: `relocation`)

| Item | Detail |
|------|--------|
| **Tile** | Relocation, categoryId: `relocation` |
| **Landing (RelocationServicesLanding)** | `GET /customer/discover-services?category=relocation&roleId=pet_relocation` |
| **Roles included** | `relocation`, `pet_taxi`, `pet_transport`, `pet_relocation` |
| **Backend filters** | Target roles. |
| **Populated** | `vendors` / `providers`, `total`. |

---

### 17. Pet Resort (screen: `resort`)

| Item | Detail |
|------|--------|
| **Tile** | Pet Resort, categoryId: `resort` |
| **Landing (ResortServicesLanding)** | `GET /customer/discover-services?category=resort&roleId=pet_resort` |
| **Roles included** | `resort`, `pet_resort` |
| **Backend filters** | Target roles. |
| **Populated** | Same. |

---

### 18. Pet Holiday (screen: `holiday`)

| Item | Detail |
|------|--------|
| **Tile** | Pet Holiday, categoryId: `holiday` |
| **Landing (PetHolidayServicesLanding)** | `GET /customer/discover-services?category=holiday&roleId=pet_holiday` |
| **Roles included** | `holiday` |
| **Backend filters** | Target roles. |
| **Populated** | Same. |

---

### 19. Sunset Care (screen: `sunset`)

| Item | Detail |
|------|--------|
| **Tile** | Sunset Care, categoryId: `sunset` |
| **Landing (SunsetServiceRouter)** | `GET /customer/discover-services?category=sunset&roleId=pet_sunset_services` |
| **Roles included** | `sunset`, `pet_sunset_services` |
| **Backend filters** | Target roles. |
| **Populated** | Same. |

---

### 20. Home service (universal: walker / grooming / training / veterinary / behaviourist / sitter / diagnostics)

| Item | Detail |
|------|--------|
| **Entry** | HomeServiceProviderListView: serviceType = walker, grooming, training, vet, behaviourist, sitting, diagnostics, nutrition. |
| **API** | Primary: `GET /customer/discover-services?category={category}&serviceStyle=at_home&roleId={config.roleId \|\| category}`. Fallback: `GET /customer/services?roleId={config.roleId}&serviceStyle=at_home` |
| **Category map** | vet→vet, grooming→grooming, training→training, walker→walker, behaviourist→behaviourist, sitting/sitter→sitting, diagnostics→diagnostics, nutrition→nutritionist. |
| **Roles** | Per category (see CATEGORY_ROLE_NAMES in service-discovery.ts). |
| **Service styles** | `at_home` only for this list. |
| **Backend filters** | at_home/tele branch: target roles, vendors with published/enabled vendor_services, solo-friendly; excludes clinic/hospital/center/centre/salon in name. |
| **Populated** | `providers` / `vendors` list; UI shows provider count and list. |

---

## Backend filters summary

### discover-services

- **Vendor base:** `(v.status = 'approved' OR v.status = 'active')`, `v.is_active = true`.
- **When `serviceStyle = at_home` or `tele`:**
  - Target roles from `resolveTargetRolesForDiscovery(category, roleId)` (DB discoverable roles in that category, else CATEGORY_ROLE_NAMES).
  - Restrict: `r.name` in target roles (or normalized name).
  - Walker: EXISTS any enabled vendor_services. Others: EXISTS enabled and (published/auto_published/draft or publish_status NULL).
  - Exclude business_name containing: clinic, hospital, center, centre, salon, " business".
  - Optional: latitude/longitude for distance; limit 50.
- **When `serviceStyle = at_center`:**
  - Exclude solo: `r.name NOT LIKE '%_solo'`, `vendor_type != 'solo'`.
  - EXISTS vendor_services with `service_style = 'at_center'`, enabled, (published or NULL).
  - Same target roles from category/roleId.
- **When no serviceStyle:** All approved/active vendors in target roles (no style filter on vendor_services).

### services/by-style

- **at_center:** Vendors with `vendor_type != 'solo'`, `r.name NOT LIKE '%_solo'`, and vendor_services with `service_style = {style}`, enabled, published; category → categoryRoles.
- **at_home / tele:** Staff (individual providers) and/or vendors; category and roleId → targetRoles; same role list as discover-services for that category.

### What is populated

- **discover-services:** `{ success: true, vendors: [...], providers: [...], total: N }`. Each item: id, business_name, phone, city, state, latitude, longitude, role_name, role_display_name, services (for at_center branch), rating, nextAvailability, consultationFee, etc.
- **services/by-style:** `{ success: true, style, providers: [...], total: N }`. Each provider: providerId, vendorId, name, services (array with price, duration, etc.), distance, rating, reviewCount.

---

## Role → category (getCategoryFromRole) quick reference

| Role(s) | Category |
|---------|----------|
| vet_solo, vet_clinic, veterinarian, vet | vet |
| groomer_solo, groomer_center, pet_groomer, grooming_salon, groomer | grooming |
| trainer_solo, trainer_center, pet_trainer, training_solo, trainer, solo | training |
| walker, walker_solo, pet_walker, dog_walker | walker |
| boarding, pet_boarder, pet_daycare, pet_boarding | boarding |
| nutritionist, nutritionist_center, nutritionist_solo, pet_nutritionist | nutrition |
| adoption_center, pet_shelter, pet_adoption_center, ngo, shelter | adoption |
| seller, pet_products_store, pet_store | shop |
| diagnostics_center, diagnostics_provider, diagnostics_solo | diagnostics |
| pharmacy, pet_pharmacy | pharmacy |
| cafe, pet_cafe | cafes |
| photographer, pet_photographer | photography |
| insurance, pet_insurance | insurance |
| ambulance, pet_ambulance | ambulance |
| breeder, pet_breeder | breeder |
| relocation, pet_taxi, pet_transport, pet_relocation | relocation |
| resort, pet_resort | resort |
| holiday | holiday |
| sunset, pet_sunset_services | sunset |
| event_organizer, pet_event_organizer | events |
| behaviourist, pet_behaviourist, behaviourist_solo | behaviourist |
| pet_sitter, sitter, sitter_solo | sitting |

---

*Generated from customer-web flows and backend/lambda/src/endpoints/service-discovery.ts. Keep in sync when adding new tiles or changing discovery rules.*
