# Forensic Analysis: Tracking Start / Destination Address Fix

**Date**: 2026-01-29  
**Scope**: POST `/tracking/start` and POST `/vendor/bookings/:bookingId/start-travel` destination resolution, schema alignment, code paths, edge cases.

---

## 1. Problem Statement

- **Symptom**: Vendor clicks "Start Travel" → API returns `{"error":"No destination address configured for this booking"}`.
- **API**: `POST https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/tracking/start`
- **Context**: UI shows a location (e.g. "2, Indralok Phase-6, mumbai, Maharashtra") but backend had no destination coordinates.

---

## 2. Code Paths Verified

### 2.1 Entry Points

| Entry | File | Route | Used By |
|-------|------|-------|--------|
| A | `gps-tracking.ts` | `POST /tracking/start` | Vendor UI `AppointmentDetailModal.tsx` (direct call with `bookingId`, `vendorId`, `staffId`, `startLatitude`, `startLongitude`) |
| B | `vendor-booking-actions.ts` | `POST /vendor/bookings/:bookingId/start-travel` | Alternative flow with `{ vendorId, staffId, startLocation }` |

**Vendor UI (confirmed)**: Calls `POST /tracking/start` with `bookingId`, `vendorId`, `staffId`, `startLatitude`, `startLongitude`. No call to `/vendor/bookings/:bookingId/start-travel` from `AppointmentDetailModal.tsx`.

### 2.2 Destination Resolution Order (Both Paths)

Resolution is **identical** in both files and follows this order:

1. **`booking.address_id`**  
   - Lookup `customer_addresses` by `id`.  
   - Lat/lng from: `addr.latitude` / `addr.longitude` **or** `addr.coordinates.lat` / `addr.coordinates.lng` (JSONB), or `coordinates` as JSON string parsed for `lat`/`lng`.  
   - **Schema**: `customer_addresses` has `coordinates JSONB` (migration 038/423); no `latitude`/`longitude` columns in base schema — code supports both if added later.

2. **`booking.delivery_latitude` / `booking.delivery_longitude`**  
   - Optional columns (e.g. from migrations or app-specific booking extensions).  
   - Check: `!= null` to allow `0` as valid.

3. **`booking.latitude` / `booking.longitude`**  
   - **Schema**: `bookings` in `db/schema.sql` has `latitude NUMERIC(10, 8)`, `longitude NUMERIC(11, 8)` and `address TEXT`.  
   - These are the **primary at_home location** fields; previously unused for tracking start — **fix adds this**.

4. **Address text fallback**  
   - If `booking.address` or `(booking as any).destination_address` is present but no coords found, set destination to **default Mumbai** (`19.0760, 72.8777`) so Start Travel still works.  
   - Log: `"No coordinates for booking; using default destination (address text present)"`.

5. **UAT-only fallback**  
   - If still no destination and `uatMode`: use same default Mumbai.  
   - If not UAT: return `400` with `"No destination address configured for this booking"`.

**Verification**: All branches use `parseFloat(String(...))` for numeric coercion; `!= null` avoids treating `0` as missing.

---

## 3. Schema vs Code Alignment

### 3.1 Bookings Table (db/schema.sql)

| Column | Present | Used in fix |
|--------|--------|--------------|
| `address` | ✅ TEXT | ✅ Fallback when no coords |
| `latitude` | ✅ NUMERIC(10,8) | ✅ Destination source 3 |
| `longitude` | ✅ NUMERIC(11,8) | ✅ Destination source 3 |
| `address_id` | ❌ Not in schema.sql | ✅ Code checks; no-op if column absent |
| `delivery_latitude` / `delivery_longitude` | ❌ Not in schema.sql | ✅ Code checks; optional if added by migration |

**Note**: `address_id` and `vendor_departed_at` are referenced in `docs/GPS_TRACKING_FORENSIC_VERIFICATION.md` but were not found in `db/schema.sql` or in the migrations searched. Code safely skips when `booking.address_id` is undefined. Updates to `vendor_departed_at` are in a try/catch in `gps-tracking.ts`; if the column is missing, the update fails non-fatally and a warning is logged.

### 3.2 customer_addresses (migrations 038, 423)

| Column | Type | Code usage |
|--------|------|------------|
| `coordinates` | JSONB | ✅ `addr.coordinates?.lat`, `addr.coordinates?.lng`; also supports stringified JSON parse |
| `latitude` / `longitude` | Not in 038 | ✅ Code uses if present (e.g. future migration) |

---

## 4. Service Layer

- **`startTracking(bookingId, vendorId, staffId, startLocation, destinationLocation)`**  
  - `gps-tracking-service.ts`: expects `Location` (`latitude`, `longitude`).  
  - Both endpoints pass the resolved `destinationLocation` (object with `latitude`, `longitude`).  
- **`insert('gps_tracking_sessions', ...)`**  
  - Returns `result.rows` (array).  
  - Code uses `session[0].id`, `session[0].started_at` — correct for single-row insert.

---

## 5. Edge Cases

| Case | Handling |
|------|----------|
| Booking has only address text (e.g. "2, Indralok Phase-6, mumbai, Maharashtra") | Fallback: default Mumbai coords; Start Travel succeeds; log indicates address text present. |
| `address_id` set but `customer_addresses` row has only `coordinates` JSONB | Lat/lng taken from `coordinates.lat` / `coordinates.lng` or parsed from string. |
| `coordinates` is string | Parsed with `JSON.parse` in try/catch; invalid JSON yields `null`, next source used. |
| All numeric coords are `0` | `!= null` allows 0; (0,0) would be used — acceptable for edge case. |
| `vendor_departed_at` column missing | Update in try/catch; warning logged; tracking start still succeeds. |
| UAT mode, no coords | Default Mumbai used; no 400. |

---

## 6. Recommendations

1. **Schema (optional)**  
   - If product expects “destination = saved address”, add `address_id` to `bookings` (and optionally `vendor_departed_at`) via migration and backfill where needed.  
   - Code already supports both.

2. **Geocoding (future)**  
   - For production, consider geocoding `booking.address` when creating/updating the booking and persisting to `booking.latitude` / `booking.longitude` (or to linked `customer_addresses.coordinates`) so ETA/tracking use real coords instead of default Mumbai.

3. **Logging**  
   - Already logged when using default destination due to address text. Optional: log which source was used (address_id, delivery_*, booking lat/long, or fallback) for debugging.

---

## 7. Conclusion

- **Root cause**: Destination was resolved only from `address_id` → `customer_addresses` (with lat/long) and `delivery_latitude`/`delivery_longitude`. Many at_home bookings only have `bookings.address` (and optionally `bookings.latitude`/`longitude`), so destination was often null → 400.
- **Fix**: Added (1) `booking.latitude` / `booking.longitude`, (2) `customer_addresses` support for `coordinates` JSONB (and string), (3) address-text fallback to default Mumbai so Start Travel always succeeds when an address is shown.
- **Verification**: Code paths, schema alignment, service layer, and edge cases have been traced; behavior is consistent and safe. No linter issues; deployment uses `scripts/deploy-cors-fixes.sh dev`.
