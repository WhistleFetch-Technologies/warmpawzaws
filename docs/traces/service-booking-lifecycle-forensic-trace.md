# Service Booking Lifecycle – Forensic Trace (Code Only)

Strict code trace of what is checked at every stage: policies, settings, GST, schedule. No MD file references; validation is against actual code paths.

---

## Stage 1: Discovery (customer web → backend)

| What | Where (code) | What is checked |
|------|--------------|------------------|
| Load vendors by category/style | `GroomingServiceRouter.tsx`, `VetServiceRouter.tsx`, etc. | `GET /customer/discover-services?category=...&latitude=...&longitude=...` or `GET /customer/services/by-style?style=...&category=...` or `GET /customer/vendors/search?roleId=...&limit=50`. Backend: `service-discovery.ts` – no policy/schedule check at discovery; only role, publish_status, location radius from discovery_rules (rule engine). |
| Scheduling policy / operating hours (vendor) | Customer web (e.g. `GroomingBookingRouter.tsx`) | **Intentionally removed.** Replaced by advance scheduling by vendor (vendor_availability_v2, vendor_holidays, vendor_breaks). Slots and create-booking use rule book + advance schedule only; no separate scheduling-policy or operating-hours endpoints. |

**Summary:** Discovery uses **rule book** (discovery_rules) for radius, max results, sort. Vendor-specific scheduling-policy and operating-hours endpoints are **not** used; advance scheduling (vendor_availability_v2, holidays, breaks) is the source of truth.

---

## Stage 2: Slots (customer web → backend)

| What | Where (code) | What is checked |
|------|--------------|------------------|
| Fetch slots | Customer routers call `GET /customer/vendor/:vendorId/available-slots?date=...&serviceStyle=...&totalDuration=...` | `service-discovery.ts` ~1306 (available-slots handler). |
| Scheduling policy (global) | `service-discovery.ts` ~1338–1348 | `SELECT policy_type, policy_config FROM scheduling_policies WHERE is_active = true`; uses `buffer_time` policy → `minBufferTime` / `minNoticeMinutes` (default 30). Used to compute `minBookingTime`; slots before that (today only) are skipped. |
| Advance availability | Same handler ~1545–1625 | `vendor_availability_v2`: match by `vendor_id`, `day_of_week`, and (service_styles array **or** legacy service_style/service_type). Rows with `is_available/is_enabled` true only. |
| Holidays | ~1349–1393 | `vendor_holidays_enhanced`, `vendor_holidays`, and `vendor.metadata.vacation_mode`; if holiday/vacation on date → return empty slots. |
| Breaks | ~1627–1639 | `vendor_breaks`: recurring by day_of_week or break_date; slots overlapping breaks skipped. |
| Lead time / buffer | ~1643–1649, 1681–1690 | Per-row `lead_time_by_style[serviceStyle]` or `buffer_time`/`buffer_time_minutes`; slot “block” = start + totalDuration + bufferMinutes; overlap with existing bookings (booking_time + duration_minutes + buffer) → slot skipped. |
| Max capacity | ~1650, 1698–1704 | `row.max_capacity`; count existing bookings at same start time (HH:MM); if count ≥ maxCapacity → slot marked unavailable. |
| totalDuration in window | ~1666–1671 (added in fix) | Slot offered only if `currentMinutes + totalDuration <= winEnd`. |

**Summary:** Slots use **global** `scheduling_policies` (buffer_time → min notice). Vendor **advance schedule** (vendor_availability_v2), holidays, breaks, lead time, and max capacity are all applied. Vendor-level scheduling-policy/operating-hours are **replaced by advance scheduling**; no separate endpoints.

---

## Stage 3: Create booking (customer web → backend)

| What | Where (code) | What is checked |
|------|--------------|------------------|
| Request body | `UniversalPaymentPage.tsx` / `VetBookingRouter.tsx` etc. | Payload: customerId, vendorId, serviceId, bookingDate, bookingTime, serviceType, amount, address (at_home), petId, notes, selectedServices, etc. |
| Schema | `bookings-enhanced.ts` ~154–163 | `CreateBookingRequestSchema.safeParse(body)` (from `@warmpawz/api-contracts/bookings`). |
| customerId | ~132–150 | If missing, resolve from `customerPhone` via `customers` table; else 400. |
| Idempotency | ~214–223 | `checkIdempotencyKey(idempotencyKey)`; if exists return cached response. |
| Date/time (min notice, max advance) | ~225–231 | `getDiscoveryRules('all', 'booking')` → `booking_min_notice_hours` (default 1). `validateBookingDate(bookingDate, bookingTime, minNoticeHours)`: booking must be ≥ minNoticeHours in future; must be ≤ `MAX_ADVANCE_BOOKING_DAYS` (60); time format HH:MM. Rule source: `rule-engine.ts` + DB `discovery_rules`. |
| Service exists | ~233–372 | Lookup in vendor_services (by service_id, vendor_id, publish_status, is_enabled); fallbacks by id, diagnostics. 404 if not found. |
| Service availability | ~451–476 | `validateServiceAvailability(serviceId, roleId, customerId)` – dashboard/role availability. |
| Slot collision | ~478–497 | Inside transaction: `SELECT ... WHERE vendor_id, booking_date, booking_time, staff_id ... FOR UPDATE NOWAIT`; if row exists → throw `SLOT_CONFLICT`. |
| Subscription (zero payment) | ~552–580 | `customer_subscriptions`: active, unlimited, category/vendor match, limit not exceeded → finalAmount = 0, usage incremented. |
| Address (at_home) | Schema + handler | CreateBookingRequestSchema has address optional; handler does not re-validate “address required for at_home”. |
| GST / tax at create | — | **Not applied at create.** Booking record stores `amount`/`total_amount` from request. Tax is applied on payment/checkout (customer web). |
| Platform fee at create | — | **Not applied in create handler.** No platform_fee in insert; payment flow computes fees. |

**Summary:** Create booking validates schema, customerId, idempotency, **rule-engine booking_min_notice_hours** and **validateBookingDate** (min notice + max 60 days), service existence and availability, and **slot collision** (FOR UPDATE NOWAIT). It does **not** re-read scheduling_policies or vendor_availability_v2; it does not apply GST or platform fee.

---

## Stage 4: Payment / checkout (customer web)

| What | Where (code) | What is checked |
|------|--------------|------------------|
| Platform fees | `UniversalPaymentPage.tsx` ~541–588 | `GET /config/fees?serviceStyle=...&amount=...&type=...`. Backend: `config-policies.ts` GET /config/fees returns `{ success, serviceType, fees }` with `fees.platformFeePercentage`, `convenienceFee`, etc. **It does not return calculated `platformFee`.** Customer web uses `feesRes.platformFee` (undefined) → falls back to catch block: 2% platform fee, max 200; convenience 10 for booking. |
| GST / tax | `UniversalPaymentPage.tsx` ~612–660 | `POST /tax/calculate` with items (serviceId, amount, category, serviceStyle), vendorId, customerId. Backend: `tax-management.ts` ~714: resolves customer/vendor state from DB if not sent; maps service → vendor_services/service_catalog → tax_category_id, hsn_code_id; same state → CGST+SGST, else IGST; returns totalCGST, totalSGST, totalIGST, totalTax, taxRate. |
| Refund policy (display) | `MyBookings.tsx` ~293 | `GET /customer/refund-policy` (refund-policy-engine.ts) for cancel modal; not used at booking creation. |
| Booking amount sent to create | `UniversalPaymentPage.tsx` ~1063–1082 | `amount: taxBreakdown.total` (subtotal + tax + platform fees from frontend). So **GST and platform fee are included in the amount** sent to POST /bookings/create. |

**Summary:** GST comes from `/tax/calculate` (state-based CGST/SGST/IGST). Platform fee comes from frontend default (2%, cap 200) because GET /config/fees does not return a calculated platformFee. Refund policy is only for cancel flow.

---

## Stage 5: Cancel booking (backend)

| What | Where (code) | What is checked |
|------|--------------|------------------|
| Status allowed | `bookings-enhanced.ts` CancelBookingHandler ~1739–1747 | Only `pending` or `confirmed` can be cancelled. |
| Not in past | ~1752–1759 | `booking_date`/`booking_time` must be in future. |
| Refund calculation | ~1802–1852 | If payment_status paid and total_amount > 0: (1) `getRefundTierForCancellation(booking, cancelledBy)` from `cancellation-policy-service.ts` – uses `vendor_refund_tiers` (cancelled_by, hours_before_service, service_location, vendor_types). (2) If no tier: fallback to `booking_cancellation_rules` (vendor_id, service_id) for full/partial/no refund hours and percentage; else default 24h→100%, 12h→50%, 6h→25%, else 0%. (3) `refundAmount = (totalAmount * refundPercentage) / 100`. |
| Refund method | ~1864–1933 | `refundMethod`: wallet → credit customer wallet; original → insert into `refunds` (pending). |

**Summary:** Cancel checks status, future booking, then refund from **vendor_refund_tiers** or **booking_cancellation_rules**; no separate “refund policy” endpoint used in cancel handler.

---

## Stage 6: Refund preview (customer web)

| What | Where (code) | What is checked |
|------|--------------|------------------|
| Refund preview | `MyBookings.tsx` (optional) or `POST /bookings/:id/refund-preview` | Backend: `bookings-enhanced.ts` GetRefundPreviewHandler ~1589–1698: reads `booking_cancellation_rules` (vendor_id, service_id); `full_refund_before_hours`, `partial_refund_before_hours`, `partial_refund_percentage`, `cancellation_cutoff_hours`; if rule has `cancellation_windows` (JSONB), uses windows (hoursBefore, refundPercentage, cancellationFee, penaltyPercentage); else legacy hours/percentage. Computes refund amount, cancellation fee, penalty. |

---

## Stage 7: Vendor complete (OTP, earnings)

| What | Where (code) | What is checked |
|------|--------------|------------------|
| Complete | `vendor-booking-actions.ts` POST /vendor/bookings/:bookingId/complete | Body: vendorId, otp. Validates booking exists, vendor_id matches, status not already completed. Tele: complete without OTP. Else: OTP required, must match booking.otp_code. On success: status=completed, completed_at; creates vendor_earnings (commission from razorpay helper), updates vendor pending_payout/total_earnings. |
| GST on earnings | — | Not recalculated at complete; earnings use booking total and commission rate. |

---

## Rule book enforcement (discovery_rules + platform defaults)

The **rule book** is implemented by `rule-engine.ts` (`getDiscoveryRules`) merging **platform defaults** with DB table **discovery_rules**. It applies by **role**, **flow** (`applies_to_flow`), and optionally **service_style** / **service_type**. Resolution order: platform defaults → role `all` (no style) → role `all` + style → specific role (no style) → specific role + style.

### Platform defaults (home services and all roles)

Defined in `backend/lambda/src/lib/rule-engine.ts` (PLATFORM_DEFAULTS):

| Rule key | Default | Used when |
|----------|---------|-----------|
| discovery_radius_km | 50 | Discovery **clinic (at_center)** and **home (at_home)** default; radar; meal search |
| discovery_radius_km_tele | 0 | Discovery **tele**; 0 = no distance limit (no travel). Configurable in rule book. |
| discovery_max_results | 50 | Discovery listing cap |
| discovery_sort_default | relevance | By-style and discover sort |
| discovery_location_source | mobile_then_base | Location source for discovery |
| hyperlocal_max_distance_km | 10 | Hyperlocal flows |
| order_accept_max_distance_km | 15 | Order acceptance |
| broadcast_radius_km_initial | 5 | Pharmacy broadcast (initial radius) |
| broadcast_radius_km_steps | [5, 10, 20] | Pharmacy radius expansion steps |
| follow_up_days | 7 | Booking history / follow-up |
| chat_available_days_post_appointment | 7 | Chat after appointment |
| chat_available_before_appointment_minutes | 5 | Chat before appointment |
| review_eligible_days | 7 | Reviews |
| booking_min_notice_hours | 1 | Create booking + reschedule date validation |
| appointment_reminder_minutes_before | 5 | Reminders |
| video_call_grace_period_minutes | 5 | Video call |
| cancellation_cutoff_hours | 12 | Cancellation |

Admin can override per role/flow/style via `discovery_rules` (see `discovery-rules-admin.ts`: GET/POST/PUT `/admin/discovery-rules`, GET `/admin/discovery-rules/keys`).

### 1) Vendor discovery – clinic (at_center) radius from customer location

**Where:** `service-discovery.ts` (GET /customer/services/by-style, serviceStyle === 'at_center') ~3197–3207, 3419–3424.

**Logic:** Rule book only (no vendor-defined radius; clinic location is fixed). `getDiscoveryRules(roleId || category || 'all', 'discover', serviceStyle, category)` → `discovery_radius_km` (default 50). Distance filter: `effectiveMaxKm = maxDistance ?? (customerLat && customerLng ? radius : null)`; vendors with `distance <= effectiveMaxKm` are returned. All configurable in rule book via `discovery_rules` (role_id, applies_to_flow=discover, service_style=at_center, rule_key=discovery_radius_km).

### 2) Vendor discovery – home (at_home): vendor-defined radius + rule-book default

**Where:** `service-discovery.ts` (discover-services, serviceStyle === 'at_home') ~585–595, 698–716.

**Logic:** Vendor-defined radius applies **only for home** (travel dependency). For each vendor:

`effectiveRadiusKm = vendor.service_radius ?? service_radius_km_min_home ?? ruleRadiusKm ?? 50`

- **vendor.service_radius** – Vendor-level radius (vendors table) if set; **only used when style is at_home**.
- **service_radius_km_min_home** – Min of `vendor_services.service_radius_km` for that vendor where **service_style = 'at_home' only** (subquery ~591–594). Tele services are excluded.
- **ruleRadiusKm** – From rule book: `getDiscoveryRules(..., 'discover', 'at_home', category)` → `discovery_radius_km` (default 50). Configurable in rule book per role/flow/service_style=at_home.
- **50** – Hard fallback if rule engine fails.

So **if vendor has not defined service radius** for home (no vendors.service_radius, no vendor_services.service_radius_km for at_home), the **default is the rule book value** (default 50 km). All of these are configurable in the rule book (`discovery_rules` + GET /admin/discovery-rules/keys).

### 3) Vendor discovery – tele: rule-book only; no vendor radius; 0 = no limit

**Where:** `service-discovery.ts` (discover-services, serviceStyle === 'tele') ~698–716.

**Logic:** **No vendor-defined radius** (no travel). Rule book only. Effective radius = `discovery_radius_km_tele ?? discovery_radius_km ?? 0`. Platform default **discovery_radius_km_tele = 0** → **no distance limit**. If admin sets a positive value (e.g. 100), vendors beyond that km from customer are filtered out. Configurable in rule book: rule_key `discovery_radius_km_tele` (label: "Discovery radius for tele (km); 0 = no limit").

### Pharmacy broadcast rules

**Where:** `pharmacy-orders.ts` ~228–232 (create pharmacy order / start broadcast).

**Flow:** `applies_to_flow = 'pharmacy_broadcast'`, role `'pharmacy'`.

- **broadcast_radius_km_initial** – From `getDiscoveryRules('pharmacy', 'pharmacy_broadcast')` → default 5 km. Used as initial broadcast radius and for delivery-fee estimate.
- **broadcast_radius_km_steps** – From `getRuleNumberArray('pharmacy', 'broadcast_radius_km_steps', 'pharmacy_broadcast')` → default [5, 10, 20]. Used for radius expansion; max radius = last step (e.g. 20 km).

So pharmacy **broadcast** behaviour (initial radius, expansion steps, max radius) is fully driven by the rule book when not overridden in DB.

### Vendor discovery from customer location (where rules apply)

| API / flow | File:location | Rule book usage |
|------------|----------------|-----------------|
| GET /customer/discover-services (at_home) | service-discovery.ts ~542–548, 698–716, 831 | getDiscoveryRules(..., **'discover'**, 'at_home', category). **At_home only:** vendor.service_radius ?? service_radius_km_min_home (at_home only) ?? ruleRadiusKm ?? 50. discovery_max_results, discovery_sort_default. Then slice(0, ruleMaxResults). |
| GET /customer/discover-services (tele) | service-discovery.ts ~542–548, 698–716, 831 | getDiscoveryRules(..., **'discover'**, 'tele', category). **Tele:** no vendor radius. discovery_radius_km_tele (default 0 = no limit) ?? discovery_radius_km. If &gt; 0, filter by distance. discovery_max_results, discovery_sort_default. |
| GET /customer/services/by-style (at_center) | service-discovery.ts ~3197–3207, 3419–3424 | getDiscoveryRules(roleId \|\| category \|\| 'all', **'discover'**, serviceStyle, category). defaultRadiusKm (50), maxResults (50), sortBy from rules. **Distance filter:** effectiveMaxKm = maxDistance ?? (lat/lng ? radius : null); filter vendors by distance ≤ effectiveMaxKm. |
| GET /customer/vendors/radar (providers within radius) | service-discovery.ts ~2234–2236 | getDiscoveryRules(roleId \|\| 'all', **'discover'**). discovery_radius_km ?? 10 as defaultRadiusKm; radius from query or default. |
| GET /customer/vendor/:vendorId/available-slots | service-discovery.ts ~1339–1348 | **Not rule engine.** Uses scheduling_policies (buffer_time) for min notice; vendor_availability_v2, holidays, breaks, lead time, max capacity. |
| POST /bookings/create, POST /bookings/:id/reschedule | bookings-enhanced.ts ~227–228, 2013–2014 | getDiscoveryRules(**'all'**, **'booking'**). booking_min_notice_hours (default 1) for validateBookingDate. |
| Pharmacy order create (broadcast) | pharmacy-orders.ts ~228–232 | getDiscoveryRules(**'pharmacy'**, **'pharmacy_broadcast'**). broadcast_radius_km_initial, getRuleNumberArray for broadcast_radius_km_steps. |
| Meal search | specialized-services.ts ~1448–1450; meal-plans.ts ~213–216 | getDiscoveryRules('pet_nutritionist', **'meal_search'**). discovery_radius_km (default 10), discovery_max_results (50). |
| Reviews | reviews.ts, customer-enhanced.ts ~168, 1193 | getDiscoveryRules('all', **'reviews'**). review_eligible_days (7). |
| Chat | chat.ts, vendor-bookings.ts ~318, 78 | getDiscoveryRules(roleName, **'chat'**). chat_available_days_post_appointment (7). |
| Appointment reminders | appointment-reminders.ts ~128 | getDiscoveryRules('all', **'booking'**). appointment_reminder_minutes_before (5). |
| Video call | video-call-enhanced.ts ~116 | getDiscoveryRules('all', **'video_call'**). video_call_grace_period_minutes (5). |
| Customer booking history (follow-up) | customer-booking-history.ts ~487 | getDiscoveryRules('all', **'booking'**). follow_up_days (7). |

So **vendor discovery from customer location** uses the rule book for radius, max results, and sort in discover-services (at_home/tele), by-style (at_center), radar, and meal search. Slots use **vendor-level** advance schedule (va2, holidays, breaks) plus **global** scheduling_policies (buffer_time); create/reschedule use rule book **booking_min_notice_hours** only.

### Vendor availability (limited) vs rule book (wider)

- **Vendor has only limited rules:** e.g. vendor_availability_v2 (days/times, service_styles, lead_time, max_capacity); **vendor.service_radius** and **vendor_services.service_radius_km** only for **at_home** (travel). No vendor radius for tele or clinic.
- **Rule book supplies the rest:** discovery_radius_km (clinic default, home default when vendor not set), discovery_radius_km_tele (0 = no limit), discovery_max_results, discovery_sort_default, booking_min_notice_hours, pharmacy broadcast_radius_km_initial/steps, review/chat/follow-up/reminder/video windows. All discovery radius rules are configurable in the rule book (discovery_rules table + GET /admin/discovery-rules/keys).

---

## What is NOT checked (remaining gaps)

1. **Platform fee at create** – Backend create does not compute or store platform_fee; customer web sends `amount` (already including tax + fee). Platform fee is not stored in bookings table by create handler.
2. **GET /config/fees** – Returns fee config (percentages, caps) but **not** calculated `platformFee` for the given amount. Customer web falls back to local default (2%, max 200).
3. **Refund policy (refund-policy-engine)** – Used for **display** (e.g. MyBookings). Cancel handler uses **vendor_refund_tiers** and **booking_cancellation_rules**, not the refund-policy-engine response.

---

## Reference: Key files (code only)

- **Slots:** `backend/lambda/src/endpoints/service-discovery.ts` (available-slots handler ~1306–1745).
- **Create booking:** `backend/lambda/src/endpoints/bookings-enhanced.ts` (CreateBookingHandlerEnhanced ~128–846; validateBookingDate ~82–113; slot lock ~478–497).
- **Rule engine (booking min notice):** `backend/lambda/src/lib/rule-engine.ts` (getDiscoveryRules; PLATFORM_DEFAULTS.booking_min_notice_hours = 1).
- **Scheduling policies (slots):** `service-discovery.ts` ~1339–1347 (scheduling_policies.buffer_time); `backend/lambda/src/utils/scheduling-policy-enforcer.ts` (getSchedulingPolicies, getPolicyByType).
- **Tax:** `backend/lambda/src/endpoints/tax-management.ts` (POST /tax/calculate ~714).
- **Fees:** `backend/lambda/src/endpoints/config-policies.ts` (GET /config/fees ~264); `backend/lambda/src/endpoints/fee-config.ts` (GET /config/fees with calculation – may not be registered if config-policies is first).
- **Cancel / refund:** `bookings-enhanced.ts` CancelBookingHandler ~1718–1972; `backend/lambda/src/lib/services/cancellation-policy-service.ts` (getRefundTierForCancellation, computeRefundFromTier).
- **Refund preview:** `bookings-enhanced.ts` GetRefundPreviewHandler ~1589–1698.
- **Customer web slots UI:** `apps/customer-web/components/customer/grooming/GroomingBookingRouter.tsx` (loadSchedulingPolicy ~288, loadVendorOperatingHours ~306, validateSlotAgainstPolicy ~327, validateSlotAgainstOperatingHours ~360).
- **Customer web payment:** `apps/customer-web/components/customer/payment/UniversalPaymentPage.tsx` (loadPlatformFees ~541, calculateTax ~612).

---

## Summary table

| Stage | Policy/Settings | GST | Schedule |
|-------|-----------------|-----|----------|
| Discovery | Discovery rules (radius, max results); no scheduling | No | No |
| Slots | scheduling_policies (buffer_time → min notice); vendor_availability_v2, holidays, breaks, lead time, max capacity | No | Yes (va2, holidays, breaks) |
| Create booking | Rule engine booking_min_notice_hours; validateBookingDate (min notice, max 60 days); idempotency; service availability; slot lock | No | Min notice + slot collision only |
| Payment (customer web) | Platform fee from default (config/fees does not return calculated fee); tax from /tax/calculate | Yes (CGST/SGST/IGST) | No |
| Cancel | vendor_refund_tiers or booking_cancellation_rules | No | No |
| Refund preview | booking_cancellation_rules + cancellation_windows | No | No |
| Vendor complete | OTP (non-tele); vendor_id match | No | No |

**Missing in code:** config/fees returning calculated platformFee for the given amount. (Scheduling-policy and operating-hours are **replaced by advance scheduling**; not gaps.)
