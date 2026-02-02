# Phase 2: Missing Roles & Capabilities (Review)

## Context

From the **extensive vet/diagnostics service list** and current **roles**, these are roles that are either missing or need to be confirmed for Phase 2. Use this to decide whether to add new roles or extend existing ones.

---

## 1. Roles Currently in Use (from codebase)

- **Vet:** veterinarian, vet_solo, vet_clinic  
- **Grooming:** pet_groomer, groomer_solo, groomer_center  
- **Training:** pet_trainer, trainer_solo, trainer_center  
- **Walking:** walker, pet_walker  
- **Boarding / sitting:** pet_boarder, pet_daycare, pet_sitter, sitter  
- **Diagnostics:** diagnostics_center  
- **Emergency / transport:** ambulance, pet_ambulance, pet_transport, relocation  
- **Pharmacy:** pharmacy, pet_pharmacy  
- **Nutrition:** pet_nutritionist, nutritionist, nutritionist_center  
- **Behavior:** pet_behaviorist (referenced in roleMappings; ensure role exists)  
- **Other:** pet_photographer, pet_cafe, pet_adoption_center, pet_event_organizer, pet_insurance, pet_resort, pet_breeder, seller / pet_products_store, ecommerce_seller  

---

## 2. Gaps vs. Service List

| Capability / Service type | Current role(s) | Suggestion |
|---------------------------|-----------------|------------|
| **Behaviorist** (behavior only, not general training) | pet_behaviorist in mappings; role may be same as trainer | Confirm `pet_behaviorist` (or behaviourist) exists in `roles`; if not, add in Phase 2. |
| **Lab / diagnostics only** (no vet clinic) | diagnostics_center | OK. Ensure service_catalog and specialization_master use diagnostics_center where appropriate. |
| **Ambulance / emergency transport** | ambulance, pet_ambulance | OK. |
| **Euthanasia / end-of-life** | Usually vet_clinic / veterinarian | No separate role; keep under vet. |
| **Documentation / certificates** (health, fitness, travel) | veterinarian, vet_clinic | No separate role; keep under vet. |
| **In-clinic only (wound dressing, IV, injections, microchip, nail/ear)** | veterinarian, vet_clinic | No separate role; keep under vet. |

So the main **possible missing role** to add in Phase 2 is a dedicated **behaviorist** if we want it to be distinct from trainer (e.g. different onboarding or catalog). Everything else in the list can be covered by existing roles (vet, diagnostics_center, ambulance, etc.) with the right **categories**, **specializations**, and **service_catalog** entries.

---

## 3. Recommended Phase 2 Actions

1. **Confirm `pet_behaviorist`**  
   - If missing: add role (e.g. `pet_behaviorist` or `behaviourist`) with config aligned to behavior-only services (at_home, tele).

2. **Do not add** separate roles for:  
   - Euthanasia, documentation, in-clinic procedures (keep under veterinarian / vet_clinic).  
   - “Lab only” (use diagnostics_center).

3. **Extend data, not roles:**  
   - Add/update **specialization_master** entries for any new specializations (e.g. end_of_life_care, documentation).  
   - Add/update **service_catalog** with the full vet/diagnostics list, **realistic prices**, **service_style**, **applicable_roles**, and **specialization_ids**.  
   - Run migration 524 so all environments have `service_catalog.specialization_ids` before seeding.

4. **Seeding order:**  
   - Run migration 524.  
   - Modify existing seed (048 / seed-complete-service-catalog.js): update existing rows, then insert only **missing** services so we don’t duplicate.

---

**Last updated:** 2026-02-02
