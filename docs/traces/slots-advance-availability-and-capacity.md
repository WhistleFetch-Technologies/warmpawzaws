# How Vendor Advance Availability Affects Customer Web Slots

This doc explains how the **vendor schedule** (advance availability, lead time, max capacity) is used when the **customer web** fetches available slots, and how to fix “no slots” when the vendor has configured advance availability.

---

## 1. Where slots come from (customer web)

- **Endpoint:** `GET /customer/vendor/:vendorId/available-slots`
- **Query params:** `date` (required), `serviceStyle` (e.g. `at_center`, `at_home`, `tele`), `totalDuration`, `serviceIds` (optional)
- **Handler:** `backend/lambda/src/endpoints/service-discovery.ts` (available-slots handler)

The backend uses **only** advance availability for service booking (no basic operating-hours fallback):

1. **at_home / tele:** Tries **staff_availability_slots** first (per-staff slots). If none, falls through to **vendor_availability_v2**.
2. **All styles:** Uses **vendor_availability_v2** (advance schedule). Rows are matched by:
   - `vendor_id`
   - `day_of_week` (0 = Sunday … 6 = Saturday, same as JavaScript `Date.getDay()`)
   - **Service style:** either the requested style is in the `service_styles` array, **or** the row’s `service_style` / `service_type` equals the requested style (so legacy single-style rows still match).

If no rows in `vendor_availability_v2` match that vendor, day, and style, the API returns **no slots** (with a message that the vendor should set schedule in Advanced Availability).

---

## 2. Why “no slots” even when advance availability is set

Typical causes:

1. **Style mismatch**  
   - Customer sends `serviceStyle=at_center` (or `at_vendor`).  
   - Backend now normalises `at_vendor` → `at_center` and matches rows where:
     - `service_styles` contains `at_center`, or  
     - `service_style` / `service_type` = `at_center`.  
   - If the vendor saved only `service_styles = ['at_home']` and the customer asked for `at_center`, no row matches → no slots.

2. **Only `service_styles` was used before**  
   - Old logic: `$3 = ANY(COALESCE(service_styles, ARRAY[]::text[]))`.  
   - So if `service_styles` was NULL or `[]` and the row only had `service_type = 'at_center'`, the row was **not** matched.  
   - **Fix (done):** Also match when `COALESCE(service_style, service_type)::text = $3`, so legacy single-style rows are included.

3. **Day of week**  
   - Backend uses `requestedDate.getDay()` (0–6, Sun–Sat).  
   - Vendor UI must save the same convention (0 = Sunday, 6 = Saturday).  
   - Mismatch (e.g. 1 = Monday vs 0 = Monday) would show no slots for that day.

4. **Slot not “available”**  
   - Rows are filtered by `COALESCE(is_available, is_enabled, true) = true`.  
   - If the vendor disables a slot or the column is false, that row is excluded.

5. **Holidays / breaks**  
   - Slots overlapping vendor holidays or breaks are excluded before being returned.

---

## 3. How advance availability is configured (vendor)

- **Vendor UI:** Advance schedule is saved via **Advanced Availability** (e.g. `POST /vendor/:vendorId/availability`).
- **Table:** `vendor_availability_v2`  
  - One row per (vendor, day_of_week, time window).  
  - Each row can have:
    - **service_styles:** array, e.g. `['at_center']`, `['at_home']`, `['at_center','at_home']`
    - **service_style / service_type:** legacy single style (e.g. `at_center`)
    - **time_window_start / time_window_end** (or start_time / end_time)
    - **slot_duration_minutes** (e.g. 30)
    - **lead_time_by_style** (JSON, e.g. `{ "at_center": 15, "at_home": 45 }`)
    - **max_capacity** (see below)
    - **is_available / is_enabled**

For the **customer web** to show slots, there must be at least one row for that vendor, that weekday, and that service style (via array or legacy column).

---

## 4. How lead time affects slot availability

- **Meaning:** For each service style, “lead time” is the buffer (minutes) after a booking that the next booking cannot start (e.g. travel for at_home, prep for at_center).
- **Where:** `vendor_availability_v2.lead_time_by_style` (JSON), e.g. `{ "at_center": 15, "at_home": 45, "tele": 5 }`.  
  Fallback: `buffer_time` / `buffer_time_minutes` on the row, or admin `scheduling_policies.buffer_time`.
- **Use in slots API:**
  - For each candidate slot start time, the backend treats the slot as ending at `slotStart + totalDuration + bufferMinutes`.
  - It checks **existing bookings** for that vendor/date: each booking “blocks” from `booking_time` to `booking_time + duration_minutes + bufferMinutes`.
  - If this slot’s window overlaps any such block, the slot is **not** returned (or marked unavailable).
- **Effect:** Larger lead time = fewer slots (more gap after each booking). So lead time directly reduces the number of available slots the customer sees.

---

## 5. How max capacity affects slot availability

- **Meaning:** For a given **slot start time** (e.g. 10:00), “max capacity” is how many bookings can **start at that same time**.
- **Where:** `vendor_availability_v2.max_capacity` (integer). If NULL or 0, capacity is **not** enforced (slot can still be taken until overlap/lead-time logic says otherwise).
- **Use in slots API:**
  - For each candidate slot time (e.g. 10:00), the backend counts how many **existing bookings** for that vendor/date have `booking_time` = that time (e.g. 10:00).
  - If `count >= max_capacity`, that slot is marked **unavailable** (e.g. `available: false`, `booked: true`).
- **Effect:**
  - **max_capacity = 1:** Only one booking per slot time (e.g. one per 10:00).
  - **max_capacity = 2:** Two bookings can share the same start time (e.g. two groomers at 10:00).
  - **max_capacity NULL/0:** Capacity is ignored; availability is driven only by time windows, lead time, and overlap with existing bookings.

So **max capacity does not create extra time windows**; it only allows multiple bookings to **share the same start time** when the vendor has configured it.

---

## 6. End-to-end flow (customer slots)

1. Customer picks vendor, date, service style (e.g. at_center for grooming centre).
2. Frontend calls `GET /customer/vendor/:vendorId/available-slots?date=YYYY-MM-DD&serviceStyle=at_center&totalDuration=...`.
3. Backend:
   - Resolves `vendorId` (e.g. identity/staff → vendors.id).
   - Computes `day_of_week` from `date` (0–6).
   - Normalises `serviceStyle` (e.g. at_vendor → at_center).
   - Loads rows from `vendor_availability_v2` for that vendor, day, and style (array or legacy column).
   - For each row, generates slot start times using `time_window_start/end` and `slot_duration_minutes`.
   - Drops slots in the past (today) or in breaks/holidays.
   - For each slot, applies **lead time** (buffer) and marks unavailable if it overlaps existing bookings.
   - For each slot, applies **max capacity**: if the number of existing bookings at that start time ≥ `max_capacity`, marks unavailable.
4. Returns the list of slots (time, available/booked, optional metadata).

---

## 7. Fix applied (code)

- **File:** `backend/lambda/src/endpoints/service-discovery.ts` (available-slots handler).
- **Changes:**
  1. **Service style match:** Rows are now included if **either**  
     `service_styles` contains the requested style **or**  
     `COALESCE(service_style, service_type)::text` equals the requested style.  
     So advance availability configured with only the legacy column (or with empty `service_styles`) is still used.
  2. **at_vendor → at_center:** Requested `serviceStyle` is normalised so `at_vendor` is treated as `at_center` for both the DB match and lead-time lookup.
  3. **Lead time lookup:** When resolving `lead_time_by_style`, the backend checks both the normalised style and the original `serviceStyle` so at_vendor gets the same buffer as at_center.

After these changes, customer web slots respect:
- Advance availability (vendor_availability_v2) for the correct **service style** and **day**,
- **Lead time** (per-style or fallback) for overlap with existing bookings,
- **Max capacity** (when set) to limit how many bookings can share the same slot time.

---

## 8. Forensic validation (post-fix)

**Endpoint:** `GET /customer/vendor/:vendorId/available-slots?date=YYYY-MM-DD&serviceStyle=at_center|at_home|tele&totalDuration=30`

**Trace order:**

1. **Resolve vendor** – `resolveVendorById(vendorId)` so staff/identity IDs resolve to `vendors.id`.
2. **Parse date** – `dayOfWeek = requestedDate.getDay()` (0=Sun … 6=Sat).
3. **Normalize serviceStyle** – `at_vendor` → `at_center` for query and lead-time lookup.
4. **Holiday check** – If vendor has holiday/vacation on `date`, return `slots: []`.
5. **Staff path (at_home/tele only)** – If `staff_availability_slots` has rows for vendor+date, use those (per-staff, 30-min steps), then return. Otherwise fall through to va2.
6. **Query vendor_availability_v2** – Match `vendor_id`, `day_of_week`, and **either** `service_styles` contains style **or** `COALESCE(service_style, service_type) = style`. If query fails (e.g. missing column), fallback: same query with alternate column names; if that fails with “column does not exist”, retry with **service_styles-only** (no legacy column).
7. **Load breaks** – `vendor_breaks` for this vendor, day, and date (recurring or break_date).
8. **Load existing bookings** – `bookings` for vendor+date, status not cancelled/rejected/no_show; keep `booking_time` (normalized to HH:MM) and `duration_minutes`.
9. **For each va2 row:**
   - Window: `time_window_start/end` or `start_time/end_time`; `slot_duration_minutes` (e.g. 30).
   - **Lead time:** From `lead_time_by_style[normalizedServiceStyle]` or `[serviceStyle]`, else `buffer_time` / `buffer_time_minutes`, else scheduling policy.
   - **Max capacity:** From `row.max_capacity` (null/0 = not enforced).
   - Generate slot start times every `slotDuration` while `currentMinutes + slotDuration <= winEnd`.
10. **For each candidate slot start time:**
    - **0) Fit in window** – Skip if `currentMinutes + totalDuration > winEnd` (appointment must end before window end).
    - **1) Past window** – If today, skip if slot start &lt; minBookingTime (min notice from scheduling policy).
    - **2) Break** – Skip if slot [start, start+totalDuration] overlaps any break.
    - **3) Lead time / overlap** – Slot “block” = [start, start+totalDuration+bufferMinutes]. Booking “block” = [booking_time, booking_time+duration_minutes+bufferMinutes]. Skip if slot block overlaps any booking block.
    - **4) Max capacity** – Count existing bookings with same start time (normalized HH:MM). If count ≥ maxCapacity (and maxCapacity &gt; 0), mark slot `available: false`; else `available: true`.
    - Push slot with `time`, `available`, `slotDuration`, `bufferMinutes`, optional `serviceStyles`, `maxCapacity`.
11. **Response** – Sort by time, return `slots`, `date`, `vendorId`, `serviceStyle`, `availabilityMeta: { source: 'vendor_availability_v2' }`.

**Gaps fixed in this pass:**
- **totalDuration in window:** Slots are only offered when `currentMinutes + totalDuration <= winEnd` so the full appointment fits in the advance-availability window.
- **Legacy column fallback:** If DB has no `service_style`/`service_type`, the handler retries with a query that matches only on `service_styles` array.
