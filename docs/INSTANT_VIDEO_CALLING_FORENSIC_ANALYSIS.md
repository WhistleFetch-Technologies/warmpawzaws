# Instant Video Calling – Forensic Analysis & Target Design

**Date:** 2026-02-14  
**Scope:** Staff removal, instant vs scheduled tele alignment, Vet-only instant, availability from advance schedule, payment → notify → join (no OTP).

---

## 1. Requirements Summary

| # | Requirement | Notes |
|---|-------------|--------|
| 1 | **Remove staff concept** | All references to staff in instant/video/tele flows should be removed; vendor-only (center or solo). |
| 2 | **Instant availability** | From **Advanced Availability** (center or solo): slot must have **tele consulting enabled** for that window. **Instant does not check buffer time** (only “is current time inside a tele-enabled slot?”). |
| 3 | **Flow: Payment → Notify both → Join** | Same as scheduled tele: after payment, notify **both** vendor and customer to join (using existing “calling mechanism” vendor→customer). **Do not mix** instant with current queue/accept flow. |
| 4 | **Scheduled vs Instant** | **Scheduled:** User picks a date/time slot from calendar. **Instant:** User sees “available vendors right now” (system-generated from availability); after payment, system triggers join for both; call + chat window open automatically on both sides. |
| 5 | **No OTP** to complete appointment | Tele (instant or scheduled) does not require OTP verification to complete; vendor can mark appointment completed; if vet, prescription etc. can be uploaded post-call. |
| 6 | **Instant only for Vet** | Instant video calling is **only for Vet**. For other roles (grooming, nutritionist, trainer, etc.) only **scheduled** tele should be offered. |

---

## 2. Current State (As-Is)

### 2.1 Staff usage

- **instant-tele-queue.ts**  
  - Heavily staff-centric: `staff_tele_availability`, `staff_services` (tele in `service_styles`), `staff_id` in `tele_queue`, `PUT/GET /staff/:staffId/tele-availability`, `GET/POST /staff/:staffId/tele-queue`, accept/skip by `staffId`.  
  - Solo vendors are supported as a **second path** (e.g. `staffId` prefixed with `vendor_` and `vendor_id` in `tele_queue`), but the primary model is staff.
- **service-discovery.ts (slots)**  
  - For `at_home` / `tele`, **staff path first**: `staff_availability_slots` + `staff`; if no staff slots, falls back to `vendor_availability_v2`. So tele slots today can come from staff slots.
- **video-call / video-call-enhanced**  
  - References `staff` (e.g. participantType `staff`, join/notify by vendor/staff); some flows still use `staff_id` on booking.
- **bookings-enhanced / vendor-bookings**  
  - Many places still have `staff_id` on bookings (optional but used for assignment).
- **handler/index.ts**  
  - `registerStaffEndpoints` is already commented out (“Staff decommissioned”).

**Conclusion:** Removing “staff” fully is a **large refactor**. For **instant video calling only**, the minimal scope is: **instant-tele-queue** and any **customer/vendor UI** that drives instant tele. Broader staff removal (bookings, discovery, video-call) can be a separate phase.

### 2.2 Availability today

- **Scheduled tele slots**  
  - From **vendor_availability_v2**: rows with `service_styles` containing `tele` (or legacy `service_style`/`service_type` = tele), per day + time window + slot_duration.  
  - **Buffer/lead time** is applied: each slot is blocked by `totalDuration + bufferMinutes` after a booking, so fewer slots.
- **Instant “available now”**  
  - **Not** derived from vendor_availability_v2.  
  - Comes from **staff_tele_availability** (staff toggles “Available Now”) or, for solo, from “has published tele in vendor_services”.  
  - No check that “current time is inside an advance-availability tele slot”.

**Gap:** Instant does **not** use “Advanced Availability with tele enabled for this moment”. It uses a separate “go live”/solo-publish model.

### 2.3 Current instant flow

1. Customer: Mode (instant) → Service → Pet → (optional payment step in some flows) → **Join queue** (pick provider from “available now” list).
2. Backend: Inserts into **tele_queue** (staff_id or vendor_id).
3. Provider: Sees queue, **accepts** → backend creates **booking** (status e.g. pending_payment) and can create meeting/notification.
4. Customer: Gets notification, opens video (and possibly chat).

**Differences from your desired flow:**

- No “availability = advance availability with tele enabled at this time”.
- No “payment first, then single system-generated call to both”; today it’s “join queue → provider accepts → then booking/notify”.
- Queue/accept is provider-driven, not “after payment notify both and auto-join”.

### 2.4 Scheduled tele flow (reference)

- Customer picks **vendor + date + time slot** (from available-slots with `serviceStyle=tele`).
- Payment (e.g. UniversalPaymentPage) → booking created (confirmed/pending).
- Closer to time: **video call reminder** (e.g. 5 min before); **calling mechanism** (vendor→customer or vice versa) and **join**; **chat** can open.
- OTP: Used for **at_home/at_center** start/complete in `otp-enhanced.ts`; tele can be configured to skip OTP or not required for “complete” in some flows.

### 2.5 OTP and “mark completed”

- **otp-enhanced.ts:** OTP is for `bookings/:id/generate-otp` and `verify-otp` (e.g. start/complete **session**). Used for physical visits (at_home, at_center).
- **Video/tele:** Completion is typically “vendor marks done” or “call ended”; no strict OTP gate in video-call endpoint for “completing” the appointment. So “no OTP for tele” is **already mostly true**; we just need to ensure no code path **requires** OTP for tele complete.
- **Prescription:** Post–video consultation prescription upload is in prescriptions/medical flows (vendor uploads after call).

### 2.6 Where instant is offered today

- **Vet:** `TeleConsultationRouter.tsx` (customer) – Instant vs Scheduled.
- **Nutritionist:** `NutritionistTeleRouter.tsx` – same (Instant vs Scheduled).

So today instant is **not** Vet-only; it’s also offered for nutritionist. To make instant **Vet-only**, we need to remove instant option from nutritionist (and any other non-vet tele routers) and keep it only in vet tele flow.

---

## 3. Target Design (To-Be)

### 3.1 Availability for instant (no staff)

- **Source of truth:** **vendor_availability_v2** only (center or solo).
- **Rule:** Vendor is “available for instant tele **right now**” if:
  - There exists a row for this vendor, **today’s day_of_week**, with **tele** in `service_styles` (or legacy `service_style`/`service_type` = tele).
  - **Current time** (server or requested time) falls **inside** at least one time window (`time_window_start`–`time_window_end` or `start_time`–`end_time`).
  - **Do not** apply buffer/lead time for instant (no “slot end = start + duration + buffer” blocking). So we only check: “Is *now* inside a tele-enabled window?”.
- **Optional:** Exclude times where existing **tele** bookings already fill capacity (if you want to cap concurrent instant sessions per vendor). First version can ignore this and rely on “vendor marks completed” to free capacity.

### 3.2 Flow: Payment → Notify both → Join (no queue/accept)

1. Customer selects **Instant** (Vet only).
2. **List “available vendors right now”** from step 3.1 (vendor_availability_v2 + current time in tele window; no staff).
3. Customer selects **service** (e.g. General Consultation), **pet**, then **payment**.
4. **After payment success:**  
   - Create **booking** (vendor_id, customer_id, pet_id, service_type=tele, instant=true, status=confirmed, payment_status=paid).  
   - Create **video call meeting** (same as scheduled: create meeting, store in video_call_sessions).  
   - **Notify both** vendor and customer (same “calling” mechanism as scheduled tele): e.g. “Incoming instant video call” / “Join call” with deep link to video + chat.  
   - **No queue, no “accept” step** – system-generated call to both; both join; chat opens automatically on both sides (existing UI behavior where applicable).
5. **In-call:** No OTP to start or complete; vendor can **mark appointment completed**; if vet, **prescription** can be uploaded after (existing prescription flow).

### 3.3 Instant = Vet only

- **Customer:** Show “Instant” option only in **Vet** tele flow (e.g. `TeleConsultationRouter` for vet). In **Nutritionist** (and any other) tele flow, show only **Scheduled**.
- **Backend:** “Available now” endpoint (or new one) filters by **roleId/category = vet** (or equivalent) so only vet vendors are returned for instant.

### 3.4 Staff removal (instant + tele UI)

- **Backend:**  
  - Replace instant-tele **queue** model with **“available now” from vendor_availability_v2** (no staff_tele_availability, no staff_id in queue).  
  - Either refactor `instant-tele-queue.ts` to vendor-only + availability-from-va2, or add a new **vendor-only** “instant tele” module and deprecate the old queue.  
  - All instant endpoints that take `staffId` or return staff should use **vendorId** only.
- **Customer:**  
  - Instant flow uses only vendor (no staff selection, no “provider” from staff list).  
  - Remove any staff-specific labels or IDs in instant screens.
- **Vendor:**  
  - No “Available Now” toggle for staff; availability is purely from Advance Availability (tele-enabled slots).  
  - Optional: “I’m available for instant” could become a **vendor-level** toggle that *in addition* checks “current time in tele slot” (so they can go “off” without changing schedule).

---

## 4. Gap & Challenge Matrix

| # | Item | Current | Target | Feasibility | Effort |
|---|------|---------|--------|-------------|--------|
| 1 | Staff removal in instant flow | Queue + staff_tele_availability + staff_id everywhere | Vendor-only; availability from vendor_availability_v2 | Yes | High: rewrite instant-tele-queue or new module |
| 2 | “Available now” from advance availability | From staff_tele_availability / solo publish | From vendor_availability_v2: “tele” in slot + current time in window; no buffer | Yes | Medium: new query + API |
| 3 | Payment before “join” | Optional / after queue in some flows | Always: payment → create booking → notify both → join | Yes | Medium: reorder steps, ensure payment validation |
| 4 | Notify both (like scheduled) | Queue accept → then notify | After payment: create booking + meeting, notify vendor & customer (same as scheduled tele) | Yes | Medium: reuse scheduled tele notify/join/calling |
| 5 | No queue / no accept | Queue + accept today | No queue; system-generated call to both | Yes | High: remove queue, direct booking + notify |
| 6 | No OTP for tele complete | OTP used for at_home/at_center; tele often not gated by OTP | Explicit: no OTP required for tele; vendor marks completed | Yes | Low: confirm tele paths don’t require OTP |
| 7 | Instant only for Vet | Instant offered for Vet + Nutritionist | Instant only in Vet tele flow; backend filter by vet | Yes | Low–Medium: UI + backend filter |
| 8 | Chat + call open both sides | Partially present | Same as scheduled: call + chat open automatically both sides | Yes | Low: reuse existing behavior |
| 9 | Prescription post-call | Exists for vet | Vendor marks completed; upload prescription (existing) | Yes | Low |
| 10 | Buffer not applied for instant | N/A (instant doesn’t use va2 today) | Explicit: when computing “available now”, do not add buffer to window | Yes | Low (in new “available now” logic) |

---

## 5. Recommended Implementation Order

1. **Instant = Vet only**  
   - Backend: restrict “available now” (or new endpoint) to role/category = vet.  
   - Customer: remove Instant from `NutritionistTeleRouter` (and any other non-vet tele); keep only in vet `TeleConsultationRouter`.

2. **“Available now” from vendor_availability_v2**  
   - New endpoint (or change existing): input = roleId (vet), optional category.  
   - Query vendor_availability_v2: vendor has tele in service_styles for today’s day_of_week, and **current time** is inside a time window. **Do not** apply buffer/lead time.  
   - Return list of vendors (no staff).  
   - Optionally: exclude vendors that have no published tele service in vendor_services.

3. **Payment → Booking → Notify both**  
   - Instant flow: Service + Pet → **Payment** (mandatory) → on success create booking (tele, instant, confirmed, paid) + create video meeting.  
   - Reuse scheduled-tele “calling” and notifications to notify **both** vendor and customer to join (same deep links / join flow).  
   - No queue insert; no accept step.

4. **Remove queue/accept and staff from instant**  
   - Deprecate or refactor: join-queue, staff accept, staff_tele_availability for instant.  
   - All instant APIs and UI use **vendor only**.

5. **OTP and completion**  
   - Confirm no tele path requires OTP for “complete”; vendor marks completed; prescription upload remains as today.

---

## 6. Where We Are vs Where We Need to Be

| Area | Where we are | Where we need to be |
|------|----------------|---------------------|
| **Staff** | Still core of instant (queue, availability, accept) | No staff; vendor-only; availability from vendor_availability_v2 |
| **Availability** | staff_tele_availability + solo vendor_services | vendor_availability_v2 with tele at current time; no buffer for instant |
| **Instant flow** | Join queue → provider accepts → booking/notify | Payment → create booking + meeting → notify both → join (no queue) |
| **Scheduled vs instant** | Same notify/join idea for scheduled; instant uses queue | Same “call + chat” for both; only difference = how slot is chosen (scheduled vs “now”) |
| **OTP** | Not required for tele in many paths | Explicitly no OTP for tele completion |
| **Instant scope** | Vet + Nutritionist | Vet only |
| **Prescription** | Supported post-call | No change |

---

## 7. Conclusion

- **Feasibility:** The target design is **achievable**: availability from advance availability (tele at current time, no buffer), payment-first, notify-both, no queue, Vet-only instant, no OTP for tele.
- **Main challenges:**  
  - **Staff removal** in instant flow and possibly in slots discovery (tele) is a sizable refactor.  
  - **Replacing queue/accept** with “payment → booking → notify both” requires a clear cutover and possibly a new small “instant tele” backend module that reuses scheduled-tele video/notify/join.
- **Other gaps:**  
  - Ensure “calling mechanism” (vendor→customer) and “chat opens automatically” are the same for both scheduled and instant.  
  - Document that buffer/lead time is **not** used for “available now” (only for scheduled slot blocking).  
  - Optional: capacity limit for instant (e.g. max N concurrent tele bookings per vendor) if product needs it later.

This document can be used as the single source of truth for implementation and for validating each step (forensic checks) as you refactor.

---

## 8. Forensic validation checklist (post-implementation)

**Implemented:** 2026-02-14 — Vet-only instant from va2, payment → booking → notify both, no queue.

| # | Check | How to validate |
|---|--------|------------------|
| 1 | **Available-now is vet-only** | `GET /customer/tele/available-now` returns only vendors with vet role; no staff. |
| 2 | **Available-now uses va2** | Backend filters by `vendor_availability_v2` (day_of_week, tele in service_styles, current time in window). |
| 3 | **No booking before payment** | For instant: create-order uses `type: booking_prepaid`, no bookingId; payment row has `booking_id` null until instant-after-payment. |
| 4 | **Payment guard** | `POST /customer/tele/instant-after-payment` verifies Razorpay signature and requires `payment_status = 'completed'`; only then creates booking and updates `payments.booking_id`. |
| 5 | **Both notified** | instant-after-payment inserts notifications for vendor and customer with `action_url: /video/{bookingId}`. |
| 6 | **Customer flow** | Customer: Available now → select vet → select service → select pet → payment → confirmation → "Connecting to vet" → Join video call. |
| 7 | **Nutritionist: scheduled only** | NutritionistTeleRouter shows only "Scheduled Consultation"; no Instant option. |
| 8 | **Video join** | Customer and vendor join via same video-call flow (bookingId); meeting created on first join. |
| 9 | **No OTP for tele** | Tele completion does not require OTP; vendor marks completed; prescription upload after call as before. |

### Systematic testing

- **Node (forensic E2E):**  
  `node scripts/forensic-instant-tele-v2-e2e.js`  
  Uses `TEST_API_URL` (default: production). Fails if instant-tele-v2 endpoints return wrong shape or wrong status.  
  If the API is not yet deployed with instant-tele-v2 routes, run with `ALLOW_404_AS_SKIP=1` to treat 404 as skip and exit 0.

- **Playwright (API contract):**  
  `cd tests/playwright && npx playwright test contract-tests/instant-tele-v2-api.spec.ts --project=contract-tests`  
  Covers: GET available-now (200 + shape or 404), GET vendor tele services, POST instant-after-payment (400/404 for bad/missing params).
