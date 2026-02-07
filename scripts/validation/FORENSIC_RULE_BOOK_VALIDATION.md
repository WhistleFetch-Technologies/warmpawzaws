# Forensic Validation: Rule Book Application

**Date:** 2026-02-06  
**Deployment:** Lambda + Customer Web deployed via `deploy-lambda-direct.sh` + `deploy-customer-web.sh`  
**API:** `https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com`

---

## Deployment Status

| Component | Status | Script |
|-----------|--------|--------|
| Lambda (Backend) | ✅ Deployed | `./scripts/deploy-lambda-direct.sh` |
| Customer Web | ✅ Deployed | `./scripts/deploy-customer-web.sh` |

---

## Forensic E2E Results

| Script | Result |
|--------|--------|
| `forensic-discovery-e2e.js` | ✅ 16 passed, 0 failed |
| `forensic-available-slots-e2e.js` | ✅ 13 passed, 0 failed |

---

## Rule Book vs Implementation Mapping

### Rule 1: Clinic/Center booking flow
**Requirement:** Only vendor with business and services enabled with at_center style and packages at_center styles … no solo … Service complete with OTP

**Implementation:**
- `service-discovery.ts` (lines 876–896): When `serviceStyle=at_center`:
  - `r.name NOT LIKE '%_solo'` and `v.vendor_type != 'solo'` — solo excluded
  - `EXISTS (vendor_services vs WHERE vs.service_style = 'at_center')` — only at_center services
- `packages.ts` (lines 98–106): at_center packages filter by clinic/salon/vet/groomer roles
- OTP: booking completion flow (separate endpoint)

**Validation:** ✅ at_center + category=vet → 12 providers (business only)

---

### Rule 2: Home Service booking flow
**Requirement:** Only solo with style at_home only and packages if any at_home styles only. Advance schedule management (breaks, holidays, slots). Availability: home and tele only.

**Implementation:**
- `service-discovery.ts` (lines 2170–2171): When `serviceStyle=at_home`:
  - `v.vendor_type = 'solo' OR r.name LIKE '%_solo'` — solo only
  - `EXISTS (vendor_services vs WHERE vs.service_style = 'at_home')` — at_home services only
- `vendor_availability_v2` + `getVendorIdsForAvailabilityLookup` — slots by vendor_id OR vendor_identity_id
- Staff-based slots for at_home/tele via `staff_availability_slots`
- Breaks/holidays: `vendor_breaks`, `vendor_holidays_enhanced`

**Validation:** ✅ at_home + category=vet → 8 providers (solo)

---

### Rule 3: Tele Service booking flow
**Requirement:** Only solo with style at_home only and packages if any tele styles only. Advance schedule. Availability: home and tele only.

**Implementation:**
- Same as Rule 2; `serviceStyle=tele`:
  - Solo only, `vs.service_style = 'tele'`
  - `getDiscoveryRules(..., 'tele')` — tele-specific radius (0 = no distance limit)
- Staff slots + `vendor_availability_v2` with `service_styles` including `tele`

**Validation:** ✅ tele + category=vet → 7 providers (solo)

---

### Rule 4: Live GPS Tracker for home style
**Requirement:** Vendor can start service, customer notified via pop with live tracking UI, ETA. Service complete with OTP.

**Implementation:** `tracking/[bookingId]`, GPS tracking endpoints, OTP on completion (booking flow).

---

### Rule 5: Tele consulting (video)
**Requirement:** Video consulting start option, reminder + chat 5 min before, pop-up to join chat then video (AWS Chime). No OTP.

**Implementation:** `/video/[bookingId]`, chat activation, Chime integration (customer + vendor web).

---

### Rule 6: Prescription, medical records, start/stop session, router map, OTP
**Requirement:** Vets: prescription/medical records. Trainer/walker: start/stop session, router map (walker). OTP for completion.

**Implementation:** Prescription/medical records APIs, session start/stop, walker route tracking, OTP in booking completion.

---

### Rule 7: Package tracking
**Requirement:** Vets and grooming at center: package tracked. Walker and trainer: packages with sessions pre-loaded.

**Implementation:** `packages.ts` filters by service_style (at_center, at_home). Package booking endpoints with session tracking.

---

### Rule 8: Lab test (Diagnostics Center)
**Requirement:** Custom lab report offering, free home sample collection, packages, T&C, notify customer for collection, publish report in booking, update medical records.

**Implementation:** Diagnostics services, lab report APIs, medical records integration.

---

### Rule 9: Advance schedule management
**Requirement:** For both business and solo.

**Implementation:**
- `vendor_availability_v2` — slots with `service_styles`, breaks, holidays
- `getVendorIdsForAvailabilityLookup` — finds slots stored by vendor_id or vendor_identity_id
- POST/PUT `/vendor/:vendorId/schedule`, `/vendor/:vendorId/availability` — resolution via `resolveVendorById`

**Validation:** ✅ Slots API returns 200 for all vendor/style combinations

---

### Rule 10: Rule book configuration
**Requirement:** Discovery and distance/geographic operations use rule book (platform settings, admin).

**Implementation:**
- `rule-engine.ts`: `getDiscoveryRules(roleId, flow, serviceStyle, serviceType)` from `discovery_rules` table
- Used for: `discovery_radius_km`, `discovery_radius_km_tele` (0 = no limit for tele), `discovery_max_results`, etc.
- Admin: platform-settings / rule book configuration

---

## Summary

| Rule | Discovery/Vendor Filter | Schedule/Slots | Other |
|------|------------------------|----------------|-------|
| 1 | ✅ at_center → business only | ✅ | OTP on completion |
| 2 | ✅ at_home → solo only | ✅ vendor_identity_id resolution | Breaks, holidays |
| 3 | ✅ tele → solo only | ✅ | Tele radius = 0 |
| 4–8 | — | — | GPS, video, prescriptions, packages, lab |
| 9 | — | ✅ Advance schedule both types | — |
| 10 | ✅ Rule book used | — | Admin config |

**Key Fix Deployed:** Slots and availability now resolve via `vendor_id` OR `vendor_identity_id` so new vendors with schedules saved under identity id are discoverable and return slots.
