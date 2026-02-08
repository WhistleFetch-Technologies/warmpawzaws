# Discovery Audit Insight: Roles, Styles, Enrichment & Availability

**Purpose:** Map how many vendors are discovered per role and service style, enrichment status (photo, price, duration, specialization, nextAvailable, distance), and advanced availability (vendor dashboard) vs booking flow.

**Script:** `scripts/audit_discovery_roles.sh` (run with optional `API_BASE`, `LAT`, `LNG`).

---

## 1. How discovery is used in the booking flow

| Step | Endpoint / source | What it does |
|------|-------------------|--------------|
| Customer picks role (e.g. Vet, Groomer) | Problem grid or home tiles | Uses `GET /public/problems?roleId=...` or category; then style (at_home / at_center / tele). |
| List providers | **discover-services** or **by-style** | `GET /customer/discover-services?roleId=...&serviceStyle=...` or `GET /customer/services/by-style?style=...&roleId=...`. Returns vendor cards. |
| Customer picks a vendor | — | Navigate to vendor profile / service list. |
| List services | `GET /customer/vendor/:vendorId/services` | Returns services (and packages) for that vendor. |
| Pick slot | **available-slots** | `GET /customer/vendor/:vendorId/available-slots?date=...&serviceStyle=...&totalDuration=30`. Uses **vendor_availability_v2** (advanced availability from vendor dashboard). |
| Load service details | `GET /services/:serviceId` | Resolves from service_catalog or vendor_services for price/duration. |
| Book | Booking create API | Uses serviceId, vendorId, slot, etc. |

So: **discovery** (discover-services / by-style) → **vendor services** → **available-slots** (advanced availability) → **booking**.

---

## 2. Discovery counts (discover-services) – by role and style

From the audit script (live API):

| Role | at_home | at_center | tele |
|------|---------|-----------|------|
| **Vet** (veterinarian / vet_clinic / vet_solo) | 0 | **7** | 0 |
| **Groomer** (pet_groomer / groomer_center / groomer_solo) | 0 | **6** | 0 |
| **Trainer** (pet_trainer / trainer_center / trainer_solo) | 0 | **3** | 0 |
| **Walker** (walker / pet_walker / walker_solo) | 0 | 0 | 0 |
| **Nutritionist** (nutritionist / nutritionist_solo) | 0 | 0 | 0 |
| **Diagnostics** (diagnostics_center) | 0 | **2** | 0 |

- **discover-services** filters by **role + service style** and only returns vendors that have at least one **published** service in that style. So “at_center” = clinics/centers with at_center (or legacy at_vendor) services; “at_home” = solos with at_home; “tele” = solos with tele/online.
- Same vendors can appear under multiple role names (e.g. veterinarian, vet_clinic, vet_solo) because `resolveTargetRolesForDiscovery` maps them to the same category/role set.
- **By-style** (without strict role filter) returns more rows (e.g. 22 for at_center) because it lists all vendors that have that style, then the UI/context may filter by role.

**Summary:** Only **at_center** has discoverable vendors today. **at_home** and **tele** have 0 in discover-services for all roles (no vendors with only at_home/tele published services in the DB for the queried role set, or they are filtered out).

---

## 3. Enrichment status (first vendor per role/style)

| Enrichment | Meaning | Current status |
|------------|--------|----------------|
| **P (photo)** | photoUrl / vendorProfileImage present | **Vet:** true. **Groomer / Trainer / Diagnostics:** false for first item (no profile/facility photo or not selected). |
| **Pr (price)** | price / priceMin / base_price | **true** wherever count > 0 (from featuredOfferings or priceMin). |
| **D (duration)** | duration / durationMinutes / featuredOfferings[0].duration | **true** wherever count > 0. |
| **Sp (specialization)** | specializations array non-empty | **Vet, Groomer:** true. **Trainer, Diagnostics:** false for first item (vendor_specializations empty or not synced). |
| **N (nextAvailable)** | nextAvailable / nextAvailableSlot from vendor_availability_v2 | **false** for all sampled (no next slot computed or va2 not configured). |
| **Di (distance)** | distance / distanceKm | **false** (lat/lng not passed or vendor lat/lng missing). |

- **Service description:** Not on the vendor card; it’s on each service in `GET /customer/vendor/:id/services` (short/long description). So “description” enrichment is at **service** level, not discovery card level.
- **nextAvailable** depends on **vendor_availability_v2** (advanced availability). If vendors haven’t set slots in the dashboard, this stays false/empty.

---

## 4. Advanced availability (vendor dashboard) vs “showing available”

- **Source of truth for slots:** `vendor_availability_v2` (and staff-based logic for at_home/tele where applicable).
- **Endpoint:** `GET /customer/vendor/:vendorId/available-slots?date=YYYY-MM-DD&serviceStyle=...&totalDuration=30`.
- **Audit result:** For sampled vendors (first 2 per role/style with count > 0), **slots=0** for all. So for the sampled vendors/dates, either:
  - No rows in **vendor_availability_v2** for that vendor/date/style, or
  - Vendor is on holiday / vacation, or
  - Style/date combination yields no windows.

So **“when it’s showing available”:** The UI shows “available” when the vendor has **isAvailableToday** or similar from discovery (which only checks “has any va2 row for today’s day_of_week”). The **actual bookable slots** come from available-slots; if va2 isn’t configured for that vendor, slots stay 0 and booking may show “no slots” or fallback behavior.

**Recommendation:** In vendor dashboard, ensure “advanced availability” (vendor_availability_v2) is configured per service style (at_center / at_home / tele) and day; then re-run the audit’s availability sample to see non-zero slot counts.

---

## 5. By-style vs discover-services (counts)

- **discover-services:** Stricter (role + style + published service). Counts above: 7 vet, 6 groomer, 3 trainer, 2 diagnostics, 0 walker/nutritionist.
- **by-style:** Same style filter, role filter can be broader or different. For at_center you see 22 providers for many roles (same pool of at_center vendors, different role labels). So **by-style** can show more rows than discover-services for a given role because of how roles are resolved and how the vendor list is built.

---

## 6. Mapping to service booking flow

1. **Discovery** (discover-services or by-style) → list of vendor cards (with enrichment: photo, price, duration, specialization where present).
2. **Vendor services** (`GET /customer/vendor/:vendorId/services`) → services (and packages) with **full description, duration, price, specializationIds, isPackage**, etc.
3. **Slots** (`GET /customer/vendor/:vendorId/available-slots`) → only non-zero if **vendor_availability_v2** (advanced availability) is set in vendor dashboard.
4. **Service details** (`GET /services/:serviceId`) → used in booking flow; supports both catalog and vendor_services IDs.

So: **Discovery** is aligned with **service style** (at_home / at_center / tele). **Booking flow** uses the same style for **available-slots**; if advanced availability is not configured, slots stay 0 even if the vendor appears in discovery.

---

## 7. What to run next

- **Full audit (counts + enrichment + availability sample):**  
  `bash scripts/audit_discovery_roles.sh`
- **Override API or location:**  
  `API_BASE=... LAT=... LNG=... bash scripts/audit_discovery_roles.sh`
- **Per-vendor availability check:**  
  For a known vendor ID:  
  `curl -sS "$API_BASE/customer/vendor/<vendorId>/available-slots?date=$(date +%Y-%m-%d)&serviceStyle=at_center&totalDuration=30" | jq '.slots | length'`

To get “how many are discoverable” and “how many have slots” for a specific role/style, use the first table from the script (discover-services counts) and the “Advanced availability sample” section (slots per vendor). Enrichment (photo, price, duration, specialization, nextAvailable, distance) is summarized in the script’s enrichment column and in §3 above.
