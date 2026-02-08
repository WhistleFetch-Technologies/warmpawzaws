# Implementation Validation: Problem Grid + Slots + vendor_availability_v2

**Date:** 2026-02-08  
**Scope:** Problem grid pipeline, discovery, booking flow, slots APIs, vendor_availability_v2-only availability.

---

## 1. Problem Grid – Single Source of Truth

| Check | Location | Status |
|-------|----------|--------|
| ProblemGridSelector uses `/public/problems?roleId=` | `apps/customer-web/components/customer/ProblemGridSelector.tsx` | ✅ |
| useProblemGridByRole uses `/public/problems?roleId=` (not `/public/problem-grid/:roleId`) | `apps/customer-web/components/customer/useProblemGridByRole.tsx` | ✅ |
| /public/problems returns problem_grid_mappings IDs | `backend/lambda/src/endpoints/problem-grid.ts` | ✅ |
| by-problem accepts problemId (problem_grid_mappings) or specialization_id when no mapping | `backend/lambda/src/endpoints/problem-grid.ts` GET /customer/services/by-problem | ✅ |

---

## 2. Discovery – By-Problem and Provider Shape

| Check | Location | Status |
|-------|----------|--------|
| ProblemGridFlowRouter calls only `/customer/services/by-problem` (no /search/providers) | `apps/customer-web/components/customer/ProblemGridFlowRouter.tsx` | ✅ |
| by-problem returns `providers` array with ServiceProvider shape (id, photo, rating, reviewCount, specializations, priceFormatted, serviceId, serviceName) | `backend/lambda/src/endpoints/problem-grid.ts` | ✅ |
| by-problem enforces publish_status (published/auto_published) | problem-grid.ts | ✅ |
| by-problem normalizes legacy styles (at_vendor, online) for filter | problem-grid.ts styleToDbValues | ✅ |
| by-problem enriches vendor_specializations per vendor | problem-grid.ts specMap | ✅ |

---

## 3. Booking Flow – Service ID and Slots

| Check | Location | Status |
|-------|----------|--------|
| /services/:serviceId falls back to vendor_services when not in service_catalog | `backend/lambda/src/endpoints/service-catalog.ts` | ✅ |
| BookingFlow normalizes service_style: online/video_consultation→tele, at_vendor→at_center | `apps/customer-web/components/customer/BookingFlow.tsx` loadTimeSlots | ✅ |
| BookingFlow calls `/customer/vendor/${service.vendor_id}/available-slots` with date, serviceStyle, totalDuration | BookingFlow.tsx | ✅ |

---

## 4. Slots APIs – vendor_availability_v2 Only

| Check | Location | Status |
|-------|----------|--------|
| GET /customer/vendor/:vendorId/available-slots uses only vendor_availability_v2 | `backend/lambda/src/endpoints/service-discovery.ts` | ✅ |
| Main slots API normalizes style: at_vendor→at_center, tele→['tele','online','video_consultation'] | service-discovery.ts ~1606–1611 | ✅ |
| GET /bookings/available-slots uses only vendor_availability_v2 (vendor_schedules removed) | `backend/lambda/src/endpoints/followup-reschedule.ts` | ✅ |
| GET /bookings/available-slots resolves vendor via resolveVendorById before va2 query | followup-reschedule.ts | ✅ |
| GET /bookings/available-slots normalizes serviceStyle and acceptableStyles | followup-reschedule.ts | ✅ |
| GET /vendor/available-slots (reschedule) uses styleArray for at_center/at_vendor and tele/online | followup-reschedule.ts | ✅ |
| Discover-services “available today” uses only vendor_availability_v2 (vendor_schedule_slots removed) | service-discovery.ts | ✅ |
| Admin vendor list has_availability uses only vendor_availability_v2 | `backend/lambda/src/endpoints/admin-comprehensive.ts` | ✅ |

---

## 5. Vendor Specializations Sync

| Check | Location | Status |
|-------|----------|--------|
| Facility update syncs vendor_specializations | service-discovery.ts PUT /vendor/facility/:vendorId | ✅ |
| Vendor profile update syncs vendor_specializations | `backend/lambda/src/endpoints/vendor-profile.ts` | ✅ |

---

## 6. Legacy Availability Removed

| Check | Status |
|-------|--------|
| No code path reads from vendor_schedules for slots | ✅ (only comments reference removal) |
| No code path reads from vendor_schedule_slots for “available today” | ✅ |

---

## 7. Build and Lint

| Check | Status |
|-------|--------|
| Backend Lambda `npm run build` | ✅ Passes |
| Lint on modified files | ✅ No errors |

---

## 8. E2E / Manual Validation (when API is available)

Run against a deployed API:

```bash
# Available slots (main API + styles)
TEST_API_URL=<your-api-url> node scripts/forensic-available-slots-e2e.js

# Reschedule slots
TEST_API_URL=<your-api-url> node scripts/forensic-reschedule-slots-e2e.js
```

**Problem grid flow (manual):**

1. Customer web → Home → “Find Vet” (or other role) → Problem grid.
2. Select a problem → choose style (At Home / At Clinic / Video).
3. Confirm provider list loads (from by-problem).
4. Select a provider → BookingFlow opens → pick date → confirm slots load.
5. If vendor uses only vendor_availability_v2, slots should appear (no dependency on vendor_schedules).

---

## Bug Fixed During Validation

- **followup-reschedule.ts GET /bookings/available-slots:** `vendor` was used in `if (vendor)` but never assigned after removing the legacy block. Fixed by adding `const vendor = await resolveVendorById(vendorId);` before `if (vendor)`.
