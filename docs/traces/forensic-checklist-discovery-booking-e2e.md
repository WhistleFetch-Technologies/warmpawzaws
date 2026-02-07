# Forensic Checklist: Discovery + Service Booking E2E (Customer Web & Admin)

Code-only checklist. All flows from customer login to vendor earnings; rule book, schedule, policies applied.

---

## 1. Discovery (Rule Book Enforcement)

| Flow | Backend | Rule book | Customer web |
|------|---------|-----------|--------------|
| **discover-services (at_home)** | service-discovery.ts ~536–858 | getDiscoveryRules(..., 'discover', 'at_home', category). discovery_radius_km, discovery_max_results, discovery_sort_default. **Per-vendor:** vendor.service_radius ?? service_radius_km_min_home (at_home only) ?? rule ?? 50. | GroomingServicesByStyle, WalkerService, TrainingServiceRouter: discover-services with serviceStyle=at_home + locationParams (latitude, longitude from profile or geolocation). |
| **discover-services (tele)** | Same ~536–858 | getDiscoveryRules(..., 'discover', 'tele', category). **No vendor radius.** discovery_radius_km_tele (default 0 = no limit) ?? discovery_radius_km. discovery_max_results, discovery_sort_default. | VetServiceRouter, UniversalServicesByStyle: discover-services with serviceStyle=tele + locationParams. |
| **discover-services (at_center / no style)** | Same ~860–1290 | getDiscoveryRules(category \|\| roleId \|\| 'all', 'discover', serviceStyle, category). **Distance filter** when lat/lng present: distance <= discoverRadiusKm. **Limit** discoverMaxResults. **Sort** effectiveSortBy (discovery_sort_default). | GroomingServiceRouter: discover-services?category=grooming + locationParams; fallback by-style?style=at_center. |
| **by-style (at_center)** | service-discovery.ts ~3197–3464 | getDiscoveryRules(..., 'discover', serviceStyle, category). discovery_radius_km, discovery_max_results, sortBy. effectiveMaxKm = maxDistance ?? radius; filter by distance. | GroomingServiceRouter, UniversalServicesByStyle: by-style?style=at_center&category=... + locationParams. |
| **radar/providers** | service-discovery.ts ~2245–2294 | getDiscoveryRules(roleId \|\| 'all', 'discover'). discovery_radius_km (default 10), **discovery_max_results** (limit). | Optional; used if customer web calls radar. |

---

## 2. Slots (Schedule + Policies)

| What | Backend | Customer web |
|------|---------|--------------|
| **available-slots** | service-discovery.ts ~1320+. scheduling_policies (buffer_time → min notice); **vendor_availability_v2** matched by **acceptable styles**: at_center → ['at_center','at_vendor'], tele → ['tele','online','video_consultation'], at_home → ['at_home']; day_of_week; holidays, breaks; lead time; max capacity; totalDuration in window. | GroomingBookingRouter, VetBookingRouter, WalkerBookingRouter, etc.: GET /customer/vendor/:vendorId/available-slots?date=...&serviceStyle=...&totalDuration=... (date YYYY-MM-DD, serviceStyle from flow). |
| **No scheduling-policy/operating-hours API** | Replaced by advance scheduling (va2, holidays, breaks). | GroomingBookingRouter no longer calls these endpoints; slots come from available-slots only (no 404s). |

---

## 3. Create Booking (Rule Book + Collision)

| What | Backend | Customer web |
|------|---------|--------------|
| **POST /bookings/create** | bookings-enhanced.ts. getDiscoveryRules('all', 'booking') → booking_min_notice_hours (default 1). validateBookingDate(bookingDate, bookingTime, minNoticeHours); MAX_ADVANCE_BOOKING_DAYS = 60. Slot collision FOR UPDATE NOWAIT. Service lookup, validateServiceAvailability. | UniversalPaymentPage, VetBookingRouter, UniversalBookingRouter, GroomingBookingRouter, WalkerBookingRouter, TrainingBookingRouter, SunsetBookingRouter, NutritionistBookingRouter, etc.: POST /bookings/create with customerId, vendorId, serviceId, bookingDate, bookingTime, serviceType, amount, address (at_home). |
| **Idempotency** | checkIdempotencyKey; storeIdempotencyKey on success. | Optional idempotencyKey in body. |
| **Subscription** | customer_subscriptions → finalAmount = 0 when eligible. | Amount from payment flow (tax + platform fee). |

---

## 4. Payment (Customer Web)

| What | Backend | Customer web |
|------|---------|--------------|
| **Tax** | POST /tax/calculate (tax-management.ts). vendor_services/service_catalog → tax_category_id, hsn_code_id; customer/vendor state → CGST/SGST/IGST. | UniversalPaymentPage: calculateTax → POST /tax/calculate; amount sent to create includes tax. |
| **Platform fee** | GET /config/fees (config-policies.ts) returns fee settings (percentages, caps), not calculated platformFee. | UniversalPaymentPage: fallback 2% platform fee, max 200; convenience 10. |

---

## 5. Cancel & Refund

| What | Backend | Customer web |
|------|---------|--------------|
| **Cancel** | bookings-enhanced.ts CancelBookingHandler. vendor_refund_tiers or booking_cancellation_rules; refund %; wallet vs original. | MyBookings: POST /bookings/:id/cancel. |
| **Refund preview** | GetRefundPreviewHandler: booking_cancellation_rules + cancellation_windows. | MyBookings: optional refund preview before cancel. |

---

## 6. Vendor Complete → Earnings

| What | Backend | Customer web / Admin |
|------|---------|----------------------|
| **POST /vendor/bookings/:id/complete** | vendor-booking-actions.ts. Tele: complete without OTP; non-tele: OTP required. On success: status=completed; **insert vendor_earnings** (amount, commission); update vendors.pending_payout, total_earnings; sendToSettlementQueue. | **Vendor web** calls this (OTP flow). Customer web does not complete; customer sees status after vendor completes. |
| **Earnings visibility** | vendor-dashboard-enhanced.ts: GET earnings from vendor_earnings. admin-advanced.ts: vendor financials from vendor_earnings. settlements.ts: payout from vendor_earnings. | **Admin:** earnings/revenue from vendor_earnings. **Vendor web:** earnings from vendor dashboard API. |

---

## 7. Admin (Rule Book + Bookings)

| What | Backend | Admin web |
|------|---------|-----------|
| **Rule book** | GET/POST/PUT /admin/discovery-rules; GET /admin/discovery-rules/keys. discovery_rules table; rule_key includes discovery_radius_km, discovery_radius_km_tele, discovery_max_results, etc. | Admin UI: Platform Settings → Rule Book (list/edit rules by role, flow, service_style). |
| **Bookings / schedule** | GET /admin/bookings, GET /admin/vendors/:id/bookings, etc. | Admin lists bookings; no change required for rule book. |

---

## 8. Slot visibility (advance availability on customer web)

**Issue:** Slots were not showing for many service bookings even when the vendor had set advance availability and was within radius.

**Cause:** The available-slots API matched vendor_availability_v2 by a single `serviceStyle` value. Vendors often save availability as **at_vendor** (clinic) or **online** (tele). The API was querying for `at_center` or `tele` only, so rows with `service_style`/`service_type` = 'at_vendor' or 'online' did not match.

**Fix (backend):** In `service-discovery.ts` available-slots handler we now use **acceptable style lists** and match with array overlap / ANY:
- **at_center** → match `['at_center', 'at_vendor']` (array overlap or single column = ANY)
- **tele** → match `['tele', 'online', 'video_consultation']`
- **at_home** → match `['at_home']`

Query: `(COALESCE(service_styles, ARRAY[]::text[]) && $3::text[]) OR COALESCE(service_style, service_type)::text = ANY($3::text[])`. Same logic applied to the fallback and service_styles-only queries.

**Frontend:** All booking routers already call `/customer/vendor/:vendorId/available-slots` with `date` (YYYY-MM-DD) and `serviceStyle`; GroomingBookingRouter and some others also send `totalDuration` and `serviceIds`. No frontend change required for visibility; backend fix is sufficient.

---

## 9. Gaps Fixed (This Pass)

- **Discovery at_center/no-style:** Rule book distance filter and max_results + default sort when lat/lng provided.
- **Radar:** Rule book discovery_max_results for LIMIT.
- **At_home:** Vendor radius only from at_home (service_radius_km_min_home); tele no vendor radius; discovery_radius_km_tele default 0 = no limit.
- **Rule book key:** discovery_radius_km_tele added to PLATFORM_DEFAULTS and /admin/discovery-rules/keys.
- **Slot visibility:** va2 matched by acceptable styles (at_center/at_vendor, tele/online/video_consultation) so advance availability shows on customer web.

---

## 10. Vendor Web (Selective – Callout)

- **No discovery changes.** Vendor web does not perform customer discovery.
- **Complete booking + earnings:** Backend vendor-booking-actions.ts and vendor-bookings.ts already create vendor_earnings on complete (all styles). Vendor web only calls POST /vendor/bookings/:id/complete; no code change required for earnings.
- **If vendor web has its own “scheduling policy” or “operating hours” edit UI:** That feeds vendor_availability_v2 and vendor_holidays; no rule-book change needed on vendor web.

---

## 11. DB Migration

- **None required** for discovery_radius_km_tele. It is a rule_key value in discovery_rules; table already supports any rule_key. Admin can add rules via API.

---

## 12. Deploy Order

1. **Backend (Lambda):** `./scripts/deploy-lambda-direct.sh`
2. **Customer web:** `./scripts/deploy-customer-web.sh`
3. **Admin web:** `./scripts/deploy-admin-web.sh`

(Vendor web: no changes this pass; deploy only if other changes.)
