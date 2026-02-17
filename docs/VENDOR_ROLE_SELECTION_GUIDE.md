# Warmpawz — Vendor Role Selection Guide

**Purpose:** Use this guide when **choosing your role** during vendor onboarding. For each role you get: (1) who should register, (2) what capabilities you need to fulfill, and (3) what services, products, or other offerings you can deliver on the platform.

*Source: Codebase — `role-seeding.ts` (STANDARD_ROLE_DEFINITIONS, CANONICAL_ACTIVE_ROLE_NAMES), `vendor-services.ts` (ROLE_SERVICE_STYLES).*

---

## How to use this guide

- **Step 1:** In the app you will choose a **role** (e.g. Veterinarian, Pet Groomer, Pet Walker).
- **Step 2:** You may then choose **Solo** (individual) or **Business / Center** (organization) where the role supports both.
- **Step 3:** Use the section below for your chosen role to confirm you are the right person and can deliver what the platform expects.

**Service styles (what you can offer):**

| Style | Meaning |
|-------|--------|
| **At center** | Customer comes to your location (clinic, salon, center, cafe, etc.). |
| **At home** | You go to the customer’s location (home visit, walk from their address, etc.). |
| **Tele** | Video or online consultation (no physical visit). |
| **Delivery** | You deliver products (e.g. pharmacy, store) to the customer. |
| **Pickup** | Customer picks up products from your location. |
| **Outdoor** | Service delivered outdoors (e.g. photography, events). |

---

## 1. Veterinarian (Solo) — `vet_solo`

**Who should be the person**  
An **individual veterinarian** who works alone (no clinic or staff). You may do home visits and/or video consultations. You are not registering a clinic or hospital.

**Vendor type**  
**Solo** only (no “Business” option for this role).

**Capabilities you need to fulfill**  
Dashboard, profile, earnings, settlements, bank account, notifications, reports, bank verification, **prescriptions**, **medical_records**, bookings, **chat**, **tele_consultation**, **schedule**, **custom_services**, **vet_summary**, **patient_monitoring**.  
You do **not** have: staff, facility_management (center), packages (solo vet restriction in platform), ambulance_services, diagnostic_lab, multi_doctor_management.

**What you can offer (services / products / other)**  
- **At home** — Home visits (consultation, vaccination, basic care at customer’s address).  
- **Tele** — Video consultations (no at-center; solo vets do not offer in-clinic in the app).  
- **Prescriptions** — Issue and publish prescriptions linked to bookings.  
- **Consultation summary** — Vet summary (diagnosis, notes, medications) per consultation.  
- **Medical records** — View/add to patient history.  
- **Custom services** — Define your own service names, duration, and price.  
You cannot create **packages** (e.g. 5-session packs) as a solo vet in the app.

---

## 2. Veterinary Clinic — `vet_clinic`

**Who should be the person**  
A **veterinary clinic or hospital** (business). The person registering is typically the owner, manager, or authorised contact. The clinic has a physical location and may have multiple vets (staff management in app is currently decommissioned; you operate as one vendor).

**Vendor type**  
**Business / Center**.

**Capabilities you need to fulfill**  
All base capabilities plus: prescriptions, medical_records, bookings, chat, staff (config), tele_consultation, emergency, facility_management, schedule, custom_services, **packages**, vet_summary, patient_monitoring, **multi_doctor_management**, **ambulance_services**, **diagnostic_lab**, **emergency_protocols**.

**What you can offer (services / products / other)**  
- **At center** — In-clinic consultations, procedures, OPD.  
- **At home** — Home visits by your team.  
- **Tele** — Video consultations.  
- **Packages** — Session packs, combos, subscriptions (e.g. 5 consultations, vaccination pack).  
- **Prescriptions & vet summary** — Same as solo vet; linked to bookings.  
- **Diagnostics** — Lab tests, sample collection (at home or at center) where configured.  
- **Ambulance / emergency** — If you offer and configure ambulance and emergency protocols.

---

## 3. Pet Groomer (Solo) — `groomer_solo`

**Who should be the person**  
An **individual groomer** who works alone, usually mobile (going to the customer’s home). You do not register a salon or center.

**Vendor type**  
**Solo**.

**Capabilities you need to fulfill**  
Base capabilities, bookings, **gallery**, chat, facility_management, schedule, **custom_services**, **packages** (solo groomer can have session packages in some configs). No staff, no tele (grooming is not offered as video).

**What you can offer (services / products / other)**  
- **At home** — Mobile grooming at customer’s address (only style for groomer_solo in code).  
- **Custom services** — Define grooming services (e.g. bath, trim, full groom) with price and duration.  
- **Gallery** — Upload before/after or portfolio images.  
- **Packages** — Session packages (e.g. 4 grooms) where the platform allows for this role.

---

## 4. Pet Grooming Salon — `groomer_center`

**Who should be the person**  
A **grooming salon or center** (business) with a physical location. Owner or manager registers the business.

**Vendor type**  
**Business / Center**.

**Capabilities you need to fulfill**  
Base capabilities, bookings, gallery, chat, staff, facility_management, schedule, custom_services, **packages**.

**What you can offer (services / products / other)**  
- **At center** — Grooming at your salon.  
- **At home** — Mobile grooming (optional).  
- **Custom services & packages** — Multiple services and session or combo packages.  
- **Gallery** — Portfolio.  
No **tele** (video) for grooming.

---

## 5. Pet Trainer (Solo) — `trainer_solo`

**Who should be the person**  
An **individual pet trainer** who works alone. You may train at the customer’s home or online; you do not register a training center.

**Vendor type**  
**Solo**.

**Capabilities you need to fulfill**  
Base capabilities, bookings, **progress_tracking**, chat, facility_management, schedule, custom_services, **packages**.

**What you can offer (services / products / other)**  
- **At home** — Training sessions at customer’s location.  
- **Tele** — Online / video training sessions (no at_center for solo in code).  
- **Custom services** — Define session types, duration, price.  
- **Packages** — Session packs (e.g. 5-session package).  
- **Progress tracking** — Record and show training progress.

---

## 6. Pet Training Center — `trainer_center`

**Who should be the person**  
A **training center or academy** (business) with a physical facility. Owner or manager registers.

**Vendor type**  
**Business / Center**.

**Capabilities you need to fulfill**  
Base capabilities, bookings, progress_tracking, chat, staff, facility_management, schedule, custom_services, packages.

**What you can offer (services / products / other)**  
- **At center** — Sessions at your facility.  
- **At home** — Home visits.  
- **Tele** — Online training.  
- **Custom services & packages** — Multiple programs and session packs.  
- **Progress tracking** — Per pet/client.

---

## 7. Behaviorist (Solo) — `behaviorist_solo`

**Who should be the person**  
An **individual behaviourist** (pet behaviour consultant) working alone. You may offer home assessments and/or video consultations.

**Vendor type**  
**Solo**.

**Capabilities you need to fulfill**  
Base capabilities, bookings, progress_tracking, chat, facility_management, schedule, custom_services, packages, **tele_consultation**.

**What you can offer (services / products / other)**  
- **At home** — Behaviour assessments and sessions at customer’s location.  
- **Tele** — Video consultations (no at_center for solo).  
- **Custom services & packages** — E.g. behaviour plans, multi-session packs.  
- **Progress tracking** — Behaviour plans over time.

---

## 8. Behaviorist Center — `behaviorist_center`

**Who should be the person**  
A **behaviourist practice or center** (business) with a physical location.

**Vendor type**  
**Business / Center**.

**Capabilities you need to fulfill**  
Base capabilities, bookings, progress_tracking, chat, staff, facility_management, schedule, custom_services, packages, tele_consultation.

**What you can offer (services / products / other)**  
- **At center** — In-person sessions at your facility.  
- **At home** — Home visits.  
- **Tele** — Video consultations.  
- **Custom services & packages** — Behaviour plans, session packs.  
- **Progress tracking** — Per client/pet.

---

## 9. Pet Boarding / Kennel — `boarding`

**Who should be the person**  
A **boarding facility or kennel** (business). Owner or manager. Guests stay at your facility.

**Vendor type**  
**Business / Center** (at_center only).

**Capabilities you need to fulfill**  
Base capabilities, bookings, **cctv_access**, **photo_updates**, chat, staff, facility_management, schedule, custom_services, **packages**, **rooms**, **nightly_pricing**, **occupancy_tracking**.

**What you can offer (services / products / other)**  
- **At center** — Boarding stays at your facility (no at-home or tele for this role).  
- **Rooms** — Manage room types and availability.  
- **Nightly pricing** — Set rates per night.  
- **Packages** — E.g. weekly stay packages.  
- **Photo updates** — Send photos to pet parents.  
- **CCTV** — If you offer viewing (capability present in code).  
- **Occupancy tracking** — Manage capacity.

---

## 10. Pet Walker — `walker`

**Who should be the person**  
An **individual or small team** that walks dogs (and optionally other pets) from the customer’s location. Usually **solo** in practice; no physical “center.”

**Vendor type**  
Typically **Solo** (platform allows business but service is at_home only).

**Capabilities you need to fulfill**  
Base capabilities, **gps_tracking**, **photo_updates**, bookings, facility_management, schedule, **custom_services**, chat. No packages capability in base definition; no staff required for solo.

**What you can offer (services / products / other)**  
- **At home** only — Walks start from customer’s address (no at-center, no tele).  
- **Custom services** — E.g. 30-min walk, 60-min walk, group walk.  
- **GPS tracking** — Customer can see walk route/live location.  
- **Photo updates** — Post-walk photos.  
- **Start/End OTP** — Session verification (start and end OTP for walk).

---

## 11. Pet Sitter — `sitter`

**Who should be the person**  
An **individual pet sitter** who looks after pets at the customer’s home (or possibly at your place if you offer that outside the app). Usually solo.

**Vendor type**  
**Solo** (at_home only).

**Capabilities you need to fulfill**  
Base capabilities, bookings, photo_updates, chat, facility_management, schedule, custom_services. No packages in base definition; no staff.

**What you can offer (services / products / other)**  
- **At home** only — Sitting visits or stays at customer’s location.  
- **Custom services** — E.g. drop-in visit, overnight stay.  
- **Photo updates** — Send updates to pet parents.  
No at-center or tele for this role.

---

## 12. Pet Shelter / NGO — `adoption_center`

**Who should be the person**  
A **shelter, rescue, or adoption NGO** (organization). Person registering is typically the manager or authorised contact.

**Vendor type**  
**Business / Center**.

**Capabilities you need to fulfill**  
Base capabilities, **adoption**, **donation**, **pet_profiles**, **events**, staff, facility_management, schedule, chat. No pricing control in definition (donation/adoption focus).

**What you can offer (services / products / other)**  
- **At center** — Adoptions, visits, events at your facility.  
- **Adoption** — List adoptable pets (pet_profiles).  
- **Donation** — Accept donations.  
- **Events** — Adoption drives, awareness events.

---

## 13. Pet Cafe — `cafe`

**Who should be the person**  
A **pet-friendly cafe** (business) with a physical location. Owner or manager.

**Vendor type**  
**Business / Center**.

**Capabilities you need to fulfill**  
Base capabilities, bookings, **menu**, **events**, staff, facility_management, schedule, custom_services, packages, **cafe_tables**, **pax_management**, chat.

**What you can offer (services / products / other)**  
- **At center** — Dine-in, bookings, table reservation.  
- **Menu** — Food and drinks (and pet menu if applicable).  
- **Cafe tables** — Table management and **pax_management** (party size).  
- **Events** — Special events, reservations.  
- **Packages** — E.g. membership or meal packs.

---

## 14. Pet Photographer — `photographer`

**Who should be the person**  
An **individual or studio** offering pet photography. Can be solo or business.

**Vendor type**  
**Solo** or **Business** (both supported).

**Capabilities you need to fulfill**  
Base capabilities, bookings, **gallery**, **portfolio**, staff (if business), facility_management, schedule, custom_services, packages, chat.

**What you can offer (services / products / other)**  
- **At center** — Studio sessions.  
- **At home** — Home or location shoots.  
- **Outdoor** — Outdoor shoots (service style in code).  
- **Gallery & portfolio** — Showcase work.  
- **Custom services & packages** — E.g. 1-hour shoot, print packs.

---

## 15. Pet Pharmacy — `pharmacy`

**Who should be the person**  
A **pet pharmacy or dispensary** (business). Owner or manager. You dispense and/or deliver medicines.

**Vendor type**  
**Business** (seller + healthcare_provider).

**Capabilities you need to fulfill**  
Base capabilities, **catalog**, **inventory**, **prescriptions**, **delivery**, staff, facility_management, schedule, **prescription_verification**, **controlled_substances**, **expiry_management**, **order_dispatch**, **availability_check**, **invoice_generation**, **order_broadcast**.

**What you can offer (services / products / other)**  
- **Delivery** — Deliver orders to customer address.  
- **Pickup** — Customer picks up from your store.  
- **Catalog & inventory** — Products, stock.  
- **Prescription verification** — Verify and fulfill prescriptions.  
- **Order broadcast** — Receive and accept orders (e.g. from prescription flow).  
- **Controlled substances & expiry** — Compliance and stock management.

---

## 16. Pet Store / Retailer — `seller`

**Who should be the person**  
A **pet store or retailer** (business) selling products. Owner or manager.

**Vendor type**  
**Business** (seller).

**Capabilities you need to fulfill**  
Base capabilities, **catalog**, **inventory**, **orders**, **delivery**, staff, facility_management, schedule.

**What you can offer (services / products / other)**  
- **Delivery** — Home delivery.  
- **Pickup** — Store pickup.  
- **Catalog & inventory** — Products, stock, orders.

---

## 17. Pet Ambulance — `ambulance`

**Who should be the person**  
An **emergency pet ambulance or transport service** (usually a business, but can be solo operator). You go to the customer’s location.

**Vendor type**  
**Solo** or **Business** (primarily solo in definition).

**Capabilities you need to fulfill**  
Base capabilities, bookings, **gps_tracking**, **live_location**, **emergency**, facility_management, schedule, chat, **emergency_protocols**, custom_services.

**What you can offer (services / products / other)**  
- **At home** only — Emergency pick-up and transport from customer location.  
- **GPS / live location** — Customer or clinic can track.  
- **Emergency protocols** — Configure and follow emergency procedures.  
- **Custom services** — E.g. emergency transport, scheduled transport.

---

## 18. Pet Insurance Provider — `insurance`

**Who should be the person**  
An **insurance provider or agent** offering pet insurance. Business or authorised representative.

**Vendor type**  
**Business / Center**.

**Capabilities you need to fulfill**  
Base capabilities, chat, staff, facility_management, schedule, **policy_management**, **claims_management**, **insurance_plans**.

**What you can offer (services / products / other)**  
- **Online** — Policies and claims online.  
- **At center** — In-person policy sales or support if applicable.  
- **Insurance plans** — List and manage plans.  
- **Policies & claims** — Issue policies, process claims.

---

## 19. Pet Nutritionist — `nutritionist`

**Who should be the person**  
An **individual nutritionist** (diet and wellness for pets). You may work from home, at a clinic, or online.

**Vendor type**  
**Solo** (nutritionist) or **Business** (nutritionist_center).

**Capabilities you need to fulfill**  
Base capabilities, bookings, chat, staff (if center), **tele_consultation**, **video_calling**, facility_management, schedule, custom_services, packages, **meal_plans**, **diet_charts**, **prescriptions**, **delivery**, **progress_tracking**.

**What you can offer (services / products / other)**  
- **At center** — In-person diet consultations.  
- **Tele** — Video consultations.  
- **At home** — Home visits.  
- **Delivery** — Diet plans, supplements, or food delivery if configured.  
- **Meal plans & diet charts** — Create and share.  
- **Prescriptions** — E.g. diet prescriptions.  
- **Packages** — Consultation packs.  
- **Progress tracking** — Track client progress.

---

## 20. Nutritionist (Center) — `nutritionist_center`

**Who should be the person**  
A **nutrition or wellness center** (business) offering pet diet and wellness services.

**Vendor type**  
**Business / Center**.

**Capabilities you need to fulfill**  
Same as nutritionist; includes staff, facility_management, packages, meal_plans, diet_charts, prescriptions, delivery, progress_tracking, tele_consultation, video_calling.

**What you can offer (services / products / other)**  
Same as Pet Nutritionist; plus in-center consultations and full package and delivery options.

---

## 21. Pet Relocation — `relocation`

**Who should be the person**  
A **pet relocation or transport service** (e.g. interstate/international). Business or solo operator.

**Vendor type**  
**Solo** or **Business** (pet_taxi style: at_home).

**Capabilities you need to fulfill**  
Base capabilities, bookings, gps_tracking, emergency, facility_management, schedule, custom_services, **distance_pricing**, chat.

**What you can offer (services / products / other)**  
- **At home** — Pick-up from customer location (and delivery to destination).  
- **Custom services** — E.g. domestic relocation, international.  
- **Distance pricing** — Price by distance.  
- **GPS** — Track transport.

---

## 22. Pet Resort — `resort`

**Who should be the person**  
A **pet resort** (business) — boarding plus premium facilities (pool, play area, etc.). Owner or manager.

**Vendor type**  
**Business / Center**.

**Capabilities you need to fulfill**  
Base capabilities, bookings, cctv_access, photo_updates, chat, staff, facility_management, schedule, custom_services, packages, **rooms**, **nightly_pricing**, **occupancy_tracking**.

**What you can offer (services / products / other)**  
- **At center** only — Stays at your resort.  
- **Rooms** — Room types and availability.  
- **Nightly pricing & occupancy** — Rates and capacity.  
- **Packages** — Stays, add-ons.  
- **Photo updates & CCTV** — As configured.

---

## 23. Pet Holiday Planner — `holiday`

**Who should be the person**  
A **pet holiday or travel planner** (business or solo). You organise trips, tours, or holiday packages for pets and owners.

**Vendor type**  
**Business / Center** (service_provider).

**Capabilities you need to fulfill**  
Base capabilities, bookings, chat, staff, facility_management, schedule, custom_services, packages.

**What you can offer (services / products / other)**  
- **At center** — In-person planning, pick-up.  
- **At home** — Planning at customer’s place.  
- **Online** — Bookings and consultations online.  
- **Packages** — Holiday packages, tours.

---

## 24. Pet Sunset Services — `sunset`

**Who should be the person**  
A **business or practitioner** offering end-of-life or memorial services for pets (e.g. cremation, memorial, counselling).

**Vendor type**  
**Business / Center**.

**Capabilities you need to fulfill**  
Base capabilities, bookings, **memorial**, **counseling**, staff, facility_management, schedule, custom_services, packages, chat.

**What you can offer (services / products / other)**  
- **At center** — Memorial services, counselling at your facility.  
- **At home** — Home visit for farewell or collection.  
- **Memorial & counselling** — Memorial products and grief support.  
- **Packages** — Service packages.

---

## 25. Pet Breeder — `breeder`

**Who should be the person**  
A **registered or professional breeder** (business or individual). You sell or rehome puppies/kittens with proper documentation.

**Vendor type**  
**Solo** or **Business** (seller + service_provider).

**Capabilities you need to fulfill**  
Base capabilities, **catalog**, **pet_profiles**, bookings, chat, facility_management, schedule, custom_services, **gallery**.

**What you can offer (services / products / other)**  
- **At center** — Visits to your facility to meet pets.  
- **At home** — You visit or buyer visits your place.  
- **Catalog / pet_profiles** — List litters, lineage, availability.  
- **Gallery** — Photos and updates.

---

## 26. Diagnostics Center — `diagnostics_center`

**Who should be the person**  
A **diagnostic lab or center** (business) offering pet lab tests, sample collection at home or at center.

**Vendor type**  
**Business / Center** (healthcare_provider).

**Capabilities you need to fulfill**  
Base capabilities, bookings, **diagnostics**, **diagnostic_lab**, **medical_records**, gps_tracking, live_location, chat, staff, facility_management, schedule, custom_services.

**What you can offer (services / products / other)**  
- **At home** — Home sample collection.  
- **At center** — Lab visits, sample drop-off.  
- **Diagnostics** — Lab tests, results, reports.  
- **Medical records** — Link results to patient history.

---

## 27. Event Organizer — `event_organizer`

**Who should be the person**  
An **event organiser** (business or NGO) running pet-related events (e.g. adoption drives, meet-ups, workshops).

**Vendor type**  
**Business / Center** (service_provider, ngo, organization).

**Capabilities you need to fulfill**  
Base capabilities, **events**, bookings, staff, facility_management, schedule, chat, custom_services, packages.

**What you can offer (services / products / other)**  
- **At center** — Events at your venue.  
- **Outdoor** — Outdoor events.  
- **Events** — Create and manage events, registrations.  
- **Packages** — Event packs, tickets.

---

## Quick reference: Role → vendor type & service styles

| Role | Vendor type | Service styles (what you can offer) |
|------|-------------|--------------------------------------|
| Vet Solo | Solo | At home, Tele |
| Vet Clinic | Business | At center, At home, Tele |
| Groomer Solo | Solo | At home |
| Groomer Center | Business | At center, At home |
| Trainer Solo | Solo | At home, Tele |
| Trainer Center | Business | At center, At home, Tele |
| Behaviorist Solo | Solo | At home, Tele |
| Behaviorist Center | Business | At center, At home, Tele |
| Boarding | Business | At center |
| Walker | Solo / Business | At home |
| Sitter | Solo | At home |
| Adoption Center | Business | At center |
| Cafe | Business | At center |
| Photographer | Solo / Business | At center, At home, Outdoor |
| Pharmacy | Business | Delivery, Pickup |
| Seller | Business | Delivery, Pickup |
| Ambulance | Solo / Business | At home |
| Insurance | Business | Online, At center |
| Nutritionist | Solo | At center, At home, Tele, Delivery |
| Nutritionist Center | Business | At center, At home, Tele, Delivery |
| Relocation | Solo / Business | At home |
| Resort | Business | At center |
| Holiday | Business | At center, At home, Online |
| Sunset | Business | At center, At home |
| Breeder | Solo / Business | At center, At home |
| Diagnostics Center | Business | At home, At center |
| Event Organizer | Business | At center, Outdoor |

---

*This guide is derived from the current role and capability definitions in the codebase. For the latest list of roles and options in the app, follow the onboarding flow and refer to in-app help.*
