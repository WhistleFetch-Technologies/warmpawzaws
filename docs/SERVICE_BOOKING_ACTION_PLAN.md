# Service Booking – Forensic Audit Validation & Action Plan

**Date:** 2026-02-06  
**Scope:** Customer web service discovery and booking for Vet, Trainers, Groomers, Lab (Diagnostics), Nutritionist, and Walkers.

---

## 1. Audit Claims Validated (Code-Based)

| Claim | Status | Location / Notes |
|-------|--------|------------------|
| Fallback `/customer/vendors?category=X` does not exist; only `/customer/vendors/search` exists | **Validated** | VetServiceRouter, GroomingServiceRouter, TrainingServiceRouter used non-existent endpoint. **Fixed:** fallback now uses `/customer/vendors/search?roleId=...`. |
| Tele discovery uses at_home rules instead of tele-specific rules | **Validated** | `service-discovery.ts` called `getDiscoveryRules(..., 'at_home', ...)` for both at_home and tele. **Fixed:** uses `ruleStyle = serviceStyle === 'tele' ? 'tele' : 'at_home'`. |
| Publish mismatch: discover includes draft/auto_published, vendor/:id/services only published | **Validated** | Discovery could show vendors with no published services; UI then filtered them out. **Fixed:** discovery only includes vendors with at least one `publish_status = 'published'` service. |
| /customer/vendor/:id and /customer/vendor/:id/services use direct vendors lookup; no resolveVendorById | **Validated** | **Fixed:** both endpoints and `/customer/vendor/:id/available-slots` now use `resolveVendorById`; vendor_profile resolves staff id → vendor. |
| at_center by-style does not apply rule-book radius when maxDistance not passed | **Validated** | **Fixed:** when lat/lng present, `effectiveMaxKm = maxDistance ?? radius` so rule default radius is applied. |
| Vendor style values at_vendor / online in DB; backend filters only at_center / tele | **Validated** | **Fixed:** by-style at_center uses `acceptableStyles = ['at_center','at_vendor']`, tele uses `['tele','online']` in `= ANY($1::text[])`. |
| /customer/services requires v.latitude and v.longitude; vendors without coords excluded | **Validated** | No change in this pass; Diagnostics fallback uses this endpoint. Consider relaxing for diagnostics or adding a discovery endpoint that does not require coords. |
| WalkerService fallback uses /customer/vendors/search | **Correct** | WalkerService already used vendors/search; no change needed. |
| BookingFlow uses correct path for slots | **Correct** | BookingFlow uses `/customer/vendor/${id}/available-slots`; no change. |
| SmartTimeSlotSelection expects slots at top level | **Correct** | API returns `{ slots: [...] }` at top level; UI uses `data?.slots`; no change. |

---

## 2. Fixes Implemented

### 2.1 Customer Web (apps/customer-web)

- **VetServiceRouter.tsx**  
  Fallback changed from `GET /customer/vendors?category=vet` to `GET /customer/vendors/search?roleId=veterinarian&limit=50`, with handling for `results` array.

- **GroomingServiceRouter.tsx**  
  Fallback changed from `GET /customer/vendors?category=grooming` to `GET /customer/vendors/search?roleId=pet_groomer&limit=50`, with `results` handling.

- **TrainingServiceRouter.tsx**  
  Fallback changed from `GET /customer/vendors?category=training` to `GET /customer/vendors/search?roleId=pet_trainer&limit=50`, with `results` handling.

### 2.2 Backend (backend/lambda/src)

- **service-discovery.ts**
  - **resolveVendorById** used for:
    - `GET /customer/vendor/:vendorId/available-slots` – all DB queries use `resolvedVendorId`.
    - `GET /customer/vendor/:vendorId/services` – resolve then query by `resolvedVendorId`.
    - `GET /customer/vendor/:vendorId` – resolve then use `resolvedVendorId` for services, reviews, staff.
  - **discover-services (at_home/tele):**
    - Rule style: `ruleStyle = serviceStyle === 'tele' ? 'tele' : 'at_home'` so tele uses tele rules.
    - Exists clause: only vendors with at least one `publish_status = 'published'` service (aligned with vendor services endpoint).
  - **by-style (at_center):**
    - `acceptableStyles`: at_center → `['at_center','at_vendor']`, tele → `['tele','online']`; main query and inner vendor_services query use `= ANY($1::text[])`.
    - Distance: when lat/lng present, use `effectiveMaxKm = maxDistance ?? radius` so rule-book radius applies even when UI does not send maxDistance.

- **vendor-profile.ts**
  - **resolveVendorById:** added staff-id resolution: if not found in vendors or vendor_identity, lookup `staff` by id and return vendor by `staff.vendor_id` so customer flows that pass staff id still resolve to a vendor.

---

## 3. Endpoint & Flow Summary (Customer Web)

| Flow | Discovery entry | Fallback | Vendor/services & slots |
|------|------------------|----------|---------------------------|
| Vet | discover-services (category=vet), by-style (tele) | vendors/search?roleId=veterinarian | /customer/vendor/:id, :id/services, :id/available-slots |
| Grooming | discover-services (category=grooming), by-style (at_center) | vendors/search?roleId=pet_groomer | same |
| Training | discover-services (category=training), by-style (at_home) | vendors/search?roleId=pet_trainer | same |
| Walker | discover-services (category=walker, serviceStyle=at_home), vendors/search | already correct | same |
| Diagnostics | /customer/diagnostics/vendors-with-tests | /customer/services?roleId=diagnostics_center (requires lat/lng) | same |
| Nutritionist | Via UniversalServicesByStyle / discover-services / by-style | N/A | /customer/vendor/:id/services, :id/available-slots |

All vendor/profile, services, and slots endpoints now resolve `vendorId` via `resolveVendorById` (vendors.id, vendor_identity.id, or staff.id).

---

## 3.1 Schedule: Advanced Only, Dynamic Payload (Post–Legacy Removal)

**Context:** The legacy scheduler is removed on the vendor side. Only **advanced schedule** (vendor_availability_v2) is available: multiple slots per day, service_styles allowed per window, buffer time, and future enhancements.

**Backend (customer available-slots):**

- **Legacy fallback removed.**  
  Customer slot API no longer falls back to `vendor_availability_slots`. If vendor_availability_v2 has no rows for the requested day/style, the API returns `slots: []` and a message that the vendor should set Advanced Availability.

- **Dynamic payload.**  
  Slot API uses DB values from vendor_availability_v2 and returns a forward-compatible shape:
  - **Query:** Uses `COALESCE(slot_duration_minutes, 30)`, `COALESCE(buffer_time, buffer_time_minutes, 15)` so vendor-configured values override defaults.
  - **Per slot:** Each slot object includes `time`, `available`, `booked`, plus optional `slotDuration`, `bufferMinutes`, `serviceStyles`, `maxCapacity` from the schedule row so clients can adapt to future fields without contract changes.
  - **Top level:** Response includes `availabilityMeta: { source: 'vendor_availability_v2', slotDurationDefault, bufferMinutesDefault }` so clients can rely on defaults when per-slot fields are missing.

**Customer web:**

- **Grooming TimeSlotSelector.tsx**  
  Now calls `GET /customer/vendor/:vendorId/available-slots` (customer path) with `date`, `serviceStyle`, `totalDuration`, and normalizes slots from either object shape `{ time, available, ... }` or legacy string array for compatibility.

**Going forward:**  
Vendor UI and backend may add more fields to vendor_availability_v2 (e.g. location_data, capacity rules). The customer slot response is designed so new fields can be passed through in the slot payload or in `availabilityMeta` without breaking existing clients.

### 3.2 Lead time per service style (replacing single buffer)

- **Backend (vendor_availability_v2):**  
  - Added `lead_time_by_style` JSONB (e.g. `{ "at_home": 45, "at_center": 15, "tele": 5 }`).  
  - At-home = travel time to customer (e.g. 45 min); at_center = prep; tele = setup.  
  - Single `buffer_time` is deprecated for new slots; existing rows still use it as fallback.

- **Vendor GET/POST availability:**  
  - GET returns `allowedServiceStyles` from role (solo vs business) so the slot-creation UI shows only allowed styles.  
  - GET returns per-slot `leadTimeByStyle`.  
  - POST accepts `leadTimeByStyle` per slot and saves to `lead_time_by_style`.

- **Vendor UI (AdvancedAvailabilityManager):**  
  - Only role-allowed service styles are shown in the slot-creation window (from vendor profile or GET availability).  
  - Replaced single “Buffer (min)” with “Lead time (min) per style” — one input per selected style (At Home: travel, At Center: prep, Tele: setup).  
  - Optional “Service radius (km)” for at_home slots (stored in slot `locationData.serviceRadiusKm`).  
  - Applies to both solo and business vendors.

---

## 4. Remaining Recommendations (Not Implemented This Pass)

1. **UI brand frame**  
   Consistently use `ServiceDashboardHeader` (or a single “brand frame” component) across all role/style dashboards and list views so the orange frame and shell are uniform.

2. **Profile photo field**  
   Align customer discovery and vendor profile on one field for profile image (e.g. `profile_photo_url` vs `profile_image` vs `metadata.facility_photos`) so photos show when vendors have uploaded them.

3. **/customer/services and coordinates**  
   Ease or document the requirement for `latitude` and `longitude` for discovery (e.g. for diagnostics) or add an alternative discovery path that does not require coords.

4. **Vendor status**  
   Align status gating across endpoints: e.g. `/customer/services` uses `status = 'approved'` only; discover-services uses `approved` or `active`. Decide one rule and apply consistently.

5. **Availability path**  
   Ensure all booking UIs use the canonical slots endpoint: `GET /customer/vendor/:vendorId/available-slots` (and do not call non-existent paths like `/vendors/:id/availability`). **Done:** Grooming TimeSlotSelector now uses customer path; legacy scheduler fallback removed; slot response is dynamic for future enhancements.

---

## 5. How to Verify

- **Vet / Grooming / Training:** With discover-services and by-style returning empty, fallback should still return vendors via `GET /customer/vendors/search?roleId=...`.
- **Vendor by identity/staff id:** Call `GET /customer/vendor/:vendorId` and `GET /customer/vendor/:vendorId/services` with a `vendorId` that is a `vendor_identity.id` or `staff.id`; response should be 200 with resolved vendor data.
- **Tele rules:** Configure discovery_rules for style `tele`; call discover-services with `serviceStyle=tele` and confirm radius/sort match tele rules.
- **At-center radius:** Call by-style with `style=at_center` and lat/lng; vendors beyond rule default radius should be excluded even without `maxDistance`.
- **Published-only discovery:** Vendors that have only draft/auto_published services should not appear in discover-services; after opening a vendor, services list should match.

---

## 6. Files Touched

- `apps/customer-web/components/customer/VetServiceRouter.tsx`
- `apps/customer-web/components/customer/GroomingServiceRouter.tsx`
- `apps/customer-web/components/customer/TrainingServiceRouter.tsx`
- `apps/customer-web/components/customer/grooming/TimeSlotSelector.tsx` — use customer available-slots; handle dynamic slot payload.
- `backend/lambda/src/endpoints/service-discovery.ts` — resolveVendorById; discovery/by-style fixes; **legacy vendor_availability_slots fallback removed**; va2 query uses COALESCE for slot_duration/buffer; **dynamic slot payload** (slotDuration, bufferMinutes, serviceStyles, availabilityMeta).
- `backend/lambda/src/endpoints/vendor-profile.ts`
- `docs/SERVICE_BOOKING_ACTION_PLAN.md` (this file)
