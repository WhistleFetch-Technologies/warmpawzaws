# Service Catalog Report

**Generated:** 2026-02-04 15:02:44 UTC
**Total services:** 278
**Active roles (platform):** 28 (from GET /admin/roles)

---

## 1. By role (applicable_roles) — active roles only

Only roles that exist as **active** in the platform (GET /admin/roles) are counted. Counts are role–service *attachments*, not unique services.

| Role | Count |
|------|------:|
| vet_clinic | 118 |
| trainer_solo | 26 |
| behaviorist_solo | 21 |
| trainer_center | 14 |
| groomer_center | 10 |
| walker | 10 |
| diagnostics_center | 8 |
| sitter | 7 |
| boarding | 7 |
| pet_boarder | 7 |
| vet_solo | 6 |
| nutritionist | 4 |
| groomer_solo | 3 |
| pharmacy | 3 |
| behaviorist_center | 3 |
| ambulance | 2 |
| event_organizer | 2 |
| insurance | 2 |

---

## 2. By role type (Solo vs Business)

Active roles only, grouped by type: **_solo** = Solo, **_center** / **_clinic** = Business (Center), else = Other.

| Type | Unique roles | Role names |
|------|--------------|------------|
| **Solo** | 4 | behaviorist_solo, groomer_solo, trainer_solo, vet_solo |
| **Business (Center)** | 5 | behaviorist_center, diagnostics_center, groomer_center, trainer_center, vet_clinic |
| **Other** | 9 | ambulance, boarding, event_organizer, insurance, nutritionist, pet_boarder, pharmacy, sitter, walker |

---

## 2b. Inactive/legacy roles still in catalog (excluded from counts above)

These role names appear in service_catalog.applicable_roles but are **not** in the active roles list (GET /admin/roles). They should be removed or the roles reactivated.

| Role | Attachments |
|------|------:|
| veterinarian | 124 |
| pet_trainer | 40 |
| pet_behaviorist | 24 |
| pet_groomer | 13 |
| pet_walker | 12 |
| dog_walker | 12 |
| pet_sitter | 8 |
| pet_daycare | 7 |
| pet_photographer | 6 |
| pet_cafe | 4 |
| diagnostics | 4 |
| pet_breeder | 4 |
| pet_sunset_services | 4 |
| pet_transport | 3 |
| pet_relocation | 2 |
| pet_event_organizer | 2 |
| pet_insurance | 2 |
| pet_nutritionist | 2 |
| pet_resort | 2 |
| pet_shelter | 2 |
| pet_boarding | 2 |
| pet_ambulance | 2 |
| pet_taxi | 2 |
| pet_adoption_center | 1 |



---

## 3. By service style

| Service style | Count |
|----------------|------:|
| at_center | 186 |
| at_home | 72 |
| tele | 20 |

---

## 4. Specialization attached

| | Count |
|---|------:|
| **Yes** (at least one specialization) | 278 |
| **No** (none) | 0 |

**Total** | 278 |

---

## 5. Summary

- **Total services:** 278
- **Active roles on platform:** 28 (from GET /admin/roles)
- **Active roles referenced in catalog:** 18 (only these should appear in catalog)
- **Unique service styles:** 3
- **With specialization:** 278 (100.0%)
- **Without specialization:** 0 (0.0%)
- **Inactive/legacy roles still in catalog:** 24 (see section 2b)
