# Route Conflict Report
**API ID:** z0b3obweb6 | **Region:** ap-south-1  
**Generated:** 2026-05-22  
**Sources:** docs/migration/java-routes.csv × docs/migration/dev-api-gateway-baseline.txt × live `aws apigatewayv2 get-routes` × `terraform state list`

## Legend

| Status | Meaning |
|--------|---------|
| **NEW** | Not in baseline; terraform apply will CREATE |
| **MATCH** | Exists in baseline AND already points to the correct Java integration AND Terraform owns it; no change |
| **MOVE** | Exists in baseline AND Terraform owns it BUT points to wrong integration; Terraform will UPDATE |
| **CONFLICT** | Exists in baseline BUT Terraform state does NOT own it; will throw ConflictException on apply — **must import first** |

**Terraform state checked:** `infra/envs/dev` — only two routes currently owned:
```
module.api_gateway.aws_apigatewayv2_route.booking_java["ANY /booking/{proxy+}"]
module.api_gateway.aws_apigatewayv2_route.booking_java["ANY /bookings/{proxy+}"]
```
Neither of those route keys appears in the new Java route-key lists, so they are unaffected.

---

## ⚠️ CONFLICT Routes — Run These Imports Before `terraform apply`

These 6 routes exist in the live API Gateway but are **not owned by Terraform state**. Applying without importing will fail with `ConflictException`.

### Customer service (target: hv286ua) — 4 CONFLICTs

These already point to the correct integration (`hv286ua`) — after import Terraform will see no diff (no traffic shift).

```bash
cd infra/envs/dev

terraform import \
  'module.api_gateway.aws_apigatewayv2_route.customer_java["GET /customer/profile"]' \
  z0b3obweb6/7iyw2r5

terraform import \
  'module.api_gateway.aws_apigatewayv2_route.customer_java["POST /customer/profile"]' \
  z0b3obweb6/ezkfnt0

terraform import \
  'module.api_gateway.aws_apigatewayv2_route.customer_java["GET /customer/by-phone"]' \
  z0b3obweb6/o3hglib

terraform import \
  'module.api_gateway.aws_apigatewayv2_route.customer_java["GET /customer/pets"]' \
  z0b3obweb6/toz04pl
```

### Booking service (target: bsttuan) — 2 CONFLICTs

These currently point to `jrsc8v3` (Lambda). After import Terraform will **update** them to `bsttuan` — **real traffic shift**.

```bash
terraform import \
  'module.api_gateway.aws_apigatewayv2_route.booking_java["POST /bookings/generate-otp"]' \
  z0b3obweb6/zw7epu6

terraform import \
  'module.api_gateway.aws_apigatewayv2_route.booking_java["POST /bookings/verify-otp"]' \
  z0b3obweb6/x8fwb6r
```

---

## Customer Route Keys (A) — 55 total

| # | Route Key | Baseline | Baseline Integration | Status |
|---|-----------|----------|---------------------|--------|
| 1 | `ANY /customer/addresses/{addressId}` | — | — | **NEW** |
| 2 | `ANY /customer/{customerId}` | — | — | **NEW** |
| 3 | `ANY /customer/{customerRef}/addresses/{addressId}` | — | — | **NEW** |
| 4 | `ANY /customers/addresses/{addressId}` | — | — | **NEW** |
| 5 | `ANY /customers/{customerId}` | — | — | **NEW** |
| 6 | `ANY /customers/{customerRef}/addresses/{addressId}` | — | — | **NEW** |
| 7 | `ANY /pets/{petId}` | — | — | **NEW** |
| 8 | `DELETE /customer/{segment}/pets/{petId}` | — | — | **NEW** |
| 9 | `DELETE /customers/pets/{petId}` | — | — | **NEW** |
| 10 | `GET /customer/addresses` | — | — | **NEW** |
| 11 | `GET /customer/by-phone` | ✓ RouteId `o3hglib` | hv286ua (correct) | **CONFLICT** ← import cmd above |
| 12 | `GET /customer/pets` | ✓ RouteId `toz04pl` | hv286ua (correct) | **CONFLICT** ← import cmd above |
| 13 | ~~`GET /customer/pets/{petId}`~~ | — | — | **REMOVED** (ambiguity-1 resolution: duplicate template; keep only `GET /customer/pets/{phone}`) |
| 14 | `GET /customer/pets/{phone}` | — | — | **NEW** |
| 15 | `GET /customer/profile` | ✓ RouteId `7iyw2r5` | hv286ua (correct) | **CONFLICT** ← import cmd above |
| 16 | `GET /customer/profile/unified/{phone}` | — | — | **NEW** |
| 17 | `GET /customer/profile/{identifier}` | — | — | **NEW** |
| 18 | `GET /customer/{customerId}/addresses` | — | — | **NEW** |
| 19 | `GET /customer/{customerId}/pets` | — | — | **NEW** |
| 20 | `GET /customer/{phone}/pets/{petId}` | — | — | **NEW** |
| 21 | ~~`GET /customer/{phone}/pets/{petId}/bookings`~~ → `GET /customer/by-phone/{phone}/pets/{petId}/bookings` | — | — | **NEW** (renamed; ambiguity-2 resolution: phone-keyed bridge moved to `/by-phone/` prefix) |
| 22 | `GET /customer/{phone}/preferences` | — | — | **NEW** |
| 23 | `GET /customers/addresses` | — | — | **NEW** |
| 24 | `GET /customers/by-phone` | — | — | **NEW** |
| 25 | `GET /customers/profile` | — | — | **NEW** |
| 26 | `GET /customers/profile/unified/{phone}` | — | — | **NEW** |
| 27 | `GET /customers/profile/{identifier}` | — | — | **NEW** |
| 28 | `GET /customers/{customerId}/addresses` | — | — | **NEW** |
| 29 | `GET /customers/{customerId}/preferences` | — | — | **NEW** |
| 30 | `GET /customers/{customerId}/profile-completion` | — | — | **NEW** |
| 31 | `GET /pets/customer/{customerId}` | — | — | **NEW** |
| 32 | `POST /customer` | — | — | **NEW** |
| 33 | `POST /customer/addresses` | — | — | **NEW** |
| 34 | `POST /customer/customers` | — | — | **NEW** |
| 35 | `POST /customer/pets` | — | — | **NEW** |
| 36 | `POST /customer/profile` | ✓ RouteId `ezkfnt0` | hv286ua (correct) | **CONFLICT** ← import cmd above |
| 37 | `POST /customer/{customerId}/addresses` | — | — | **NEW** |
| 38 | `POST /customer/{customerId}/pets` | — | — | **NEW** |
| 39 | `POST /customer/{phone}/preferences` | — | — | **NEW** |
| 40 | `POST /customers` | — | — | **NEW** |
| 41 | `POST /customers/addresses` | — | — | **NEW** |
| 42 | `POST /customers/customers` | — | — | **NEW** |
| 43 | `POST /customers/profile` | — | — | **NEW** |
| 44 | `POST /customers/{customerId}/addresses` | — | — | **NEW** |
| 45 | `POST /customers/{customerId}/complete/address` | — | — | **NEW** |
| 46 | `POST /customers/{customerId}/complete/basic` | — | — | **NEW** |
| 47 | `POST /customers/{customerId}/complete/pet` | — | — | **NEW** |
| 48 | `POST /customers/{customerId}/complete/preferences` | — | — | **NEW** |
| 49 | `POST /customers/{customerId}/pets` | — | — | **NEW** |
| 50 | `POST /customers/{customerId}/preferences` | — | — | **NEW** |
| 51 | `POST /pets` | — | — | **NEW** |
| 52 | `PUT /customer/profile/{identifier}` | — | — | **NEW** |
| 53 | `PUT /customer/{segment}/pets/{petId}` | — | — | **NEW** |
| 54 | `PUT /customers/pets/{petId}` | — | — | **NEW** |
| 55 | `PUT /customers/profile/{identifier}` | — | — | **NEW** |

**Customer summary:** NEW 50 · MATCH 0 · MOVE 0 · CONFLICT 4 · REMOVED 1 — 54 active route keys (was 55; `GET /customer/pets/{petId}` removed per ambiguity-1 resolution; `GET /customer/{phone}/pets/{petId}/bookings` renamed to `GET /customer/by-phone/{phone}/pets/{petId}/bookings` per ambiguity-2 resolution)

---

## Booking Route Keys (B) — 41 total

| # | Route Key | Baseline | Baseline Integration | Status |
|---|-----------|----------|---------------------|--------|
| 1 | `GET /booking/{bookingId}` | — | — | **NEW** |
| 2 | `GET /booking/{bookingId}/history` | — | — | **NEW** |
| 3 | `GET /bookings/available-slots` | — | — | **NEW** |
| 4 | `GET /bookings/{bookingId}` | — | — | **NEW** |
| 5 | `GET /bookings/{bookingId}/history` | — | — | **NEW** |
| 6 | `GET /customer/bookings/{bookingId}` | — | — | **NEW** |
| 7 | `GET /customer/{customerId}/bookings` | — | — | **NEW** |
| 8 | `GET /customer/{customerId}/bookings/follow-up-eligible` | — | — | **NEW** |
| 9 | `GET /customer/{customerId}/bookings/{bookingId}` | — | — | **NEW** |
| 10 | `GET /customer/{customerId}/pets/{petId}/bookings` | — | — | **NEW** ⚠️ |
| 11 | `GET /vendor/available-slots` | — | — | **NEW** |
| 12 | `GET /vendor/bookings/{bookingId}/details` | — | — | **NEW** |
| 13 | `GET /vendor/bookings/{vendorId}` | — | — | **NEW** |
| 14 | `GET /vendor/reschedule-policy` | — | — | **NEW** |
| 15 | `GET /vendor/{vendorId}/bookings` | — | — | **NEW** |
| 16 | `GET /vendor/{vendorId}/bookings/today` | — | — | **NEW** |
| 17 | `POST /booking/create` | — | — | **NEW** |
| 18 | `POST /booking/customer/bookings/refund-preview` | — | — | **NEW** |
| 19 | `POST /booking/{bookingId}/calculate-refund` | — | — | **NEW** |
| 20 | `POST /booking/{bookingId}/cancel` | — | — | **NEW** |
| 21 | `POST /booking/{bookingId}/cancel-with-refund` | — | — | **NEW** |
| 22 | `POST /booking/{bookingId}/reschedule` | — | — | **NEW** |
| 23 | `POST /bookings/create` | — | — | **NEW** |
| 24 | `POST /bookings/customer/bookings/refund-preview` | — | — | **NEW** |
| 25 | `POST /bookings/generate-otp` | ✓ RouteId `zw7epu6` | jrsc8v3 (Lambda — wrong) | **CONFLICT** ← import cmd above (→ MOVE after import) |
| 26 | `POST /bookings/verify-otp` | ✓ RouteId `x8fwb6r` | jrsc8v3 (Lambda — wrong) | **CONFLICT** ← import cmd above (→ MOVE after import) |
| 27 | `POST /bookings/{bookingId}/calculate-refund` | — | — | **NEW** |
| 28 | `POST /bookings/{bookingId}/cancel` | — | — | **NEW** |
| 29 | `POST /bookings/{bookingId}/cancel-with-refund` | — | — | **NEW** |
| 30 | `POST /bookings/{bookingId}/reschedule` | — | — | **NEW** |
| 31 | `POST /customer/booking/create` | — | — | **NEW** |
| 32 | `POST /customer/bookings/create` | — | — | **NEW** |
| 33 | `POST /followup/create` | — | — | **NEW** |
| 34 | `POST /vendor/bookings/{bookingId}/accept` | — | — | **NEW** |
| 35 | `POST /vendor/bookings/{bookingId}/cancel` | — | — | **NEW** |
| 36 | `POST /vendor/bookings/{bookingId}/confirm` | — | — | **NEW** |
| 37 | `POST /vendor/bookings/{bookingId}/decline` | — | — | **NEW** |
| 38 | `POST /vendor/bookings/{bookingId}/reject` | — | — | **NEW** |
| 39 | `PUT /booking/{bookingId}/status` | — | — | **NEW** |
| 40 | `PUT /bookings/{bookingId}/status` | — | — | **NEW** |
| 41 | `PUT /vendor/bookings/{bookingId}/status` | — | — | **NEW** |

**Booking summary:** NEW 39 · MATCH 0 · MOVE 0 · CONFLICT 2

---

## ✅ Routing Ambiguity Warnings — RESOLVED

Both ambiguities have been resolved per `docs/migration/ambiguity-resolution.md` (Step 2.5).

| # | Resolution |
|---|------------|
| 1 | `GET /customer/pets/{petId}` **removed** from customer fragment. Winner: `GET /customer/pets/{phone}` → customer-service Lambda handler at `GET /customer/pets/:phone` which already handles both UUID and phone inputs at runtime. |
| 2 | `GET /customer/{phone}/pets/{petId}/bookings` **renamed** to `GET /customer/by-phone/{phone}/pets/{petId}/bookings` in customer fragment. Winner at the original path template: `GET /customer/{customerId}/pets/{petId}/bookings` → booking-service (UUID-keyed, paginated, JWT-secured). Bridge endpoint preserved under distinct `/by-phone/` prefix. |

---

## Baseline Routes NOT Referenced by Either Fragment (existing routes untouched by this migration)

These will remain in API Gateway unchanged after apply. Listed for awareness only.

| RouteKey | RouteId | Integration | Notes |
|----------|---------|-------------|-------|
| `ANY /` | 36y0gne | jrsc8v3 | Lambda catch-all root |
| `ANY /{proxy+}` | iqhn09n | jrsc8v3 | Lambda main catch-all |
| `ANY /booking/{proxy+}` | 056bt4q | bsttuan | TF-owned catch-all; will coexist with new explicit booking routes |
| `ANY /bookings/{proxy+}` | 1llyqra | bsttuan | TF-owned catch-all; will coexist with new explicit booking routes |
| `ANY /customer` | ljhar8c | jrsc8v3 | Exact `/customer` (no trailing) — different from `POST /customer` |
| `ANY /customer/{proxy+}` | 4dqqojb | jrsc8v3 | Catch-all; new explicit customer routes will take precedence |
| `ANY /customers` | i5cqnue | hv286ua | Exact `/customers` — different from `POST /customers` in fragment |
| `ANY /customers/{proxy+}` | nkx7zwf | hv286ua | Catch-all; new explicit customers routes will take precedence |
| `ANY /pets` | duv94bo | hv286ua | Exact `/pets` — different from `POST /pets` in fragment |
| `ANY /pets/{proxy+}` | juf5bo9 | hv286ua | Catch-all; new `ANY /pets/{petId}` will take precedence |
| `DELETE /customer/{customerId}` | ckkkq0f | jrsc8v3 | Will be shadowed by new `ANY /customer/{customerId}` but still exists in state — clean up separately |
| `GET /customer/{customerId}` | qpcqtkq | hv286ua | Will be shadowed by new `ANY /customer/{customerId}` but still exists in state — clean up separately |
| `PUT /customer/{customerId}` | xar81cq | hv286ua | Will be shadowed by new `ANY /customer/{customerId}` but still exists in state — clean up separately |
| `GET /customer/profile` | 7iyw2r5 | hv286ua | Imported into TF by conflict remediation above |
| `POST /customer/profile` | ezkfnt0 | hv286ua | Imported into TF by conflict remediation above |
| `GET /customer/by-phone` | o3hglib | hv286ua | Imported into TF by conflict remediation above |
| `GET /customer/pets` | toz04pl | hv286ua | Imported into TF by conflict remediation above |
| `POST /bookings/generate-otp` | zw7epu6 | jrsc8v3 | Imported + MOVED to bsttuan by conflict remediation above |
| `POST /bookings/verify-otp` | x8fwb6r | jrsc8v3 | Imported + MOVED to bsttuan by conflict remediation above |
| `GET /customer/bookings` | naq48dc | jrsc8v3 | Not in Java routes CSV — Lambda-only route; no change |
| `GET /customer/announcements` | 307tp96 | jrsc8v3 | Not in Java routes CSV |
| `GET /customer/banners` | 7vmdx4b | jrsc8v3 | Not in Java routes CSV |
| `GET /customer/payment-methods` | 8e9siy6 | jrsc8v3 | Not in Java routes CSV |
| `POST /customer/change-password` | 94p12gf | jrsc8v3 | Not in Java routes CSV |
| `POST /customer/set-password` | cuzdf2f | jrsc8v3 | Not in Java routes CSV |
| `POST /customer/delivery-fee/calculate` | drkhkfk | jrsc8v3 | Not in Java routes CSV |
| `GET /customer/refund-policy` | dyeuasb | jrsc8v3 | Not in Java routes CSV |
| `GET /customer/delivery-fee-policy` | faxw0o9 | jrsc8v3 | Not in Java routes CSV |
| `GET /customer/articles` | gl6yd13 | jrsc8v3 | Not in Java routes CSV |
| `GET /customer/notifications` | gu8np2r | jrsc8v3 | Not in Java routes CSV |
| `POST /customer/profile/set-password` | ibt5nu6 | jrsc8v3 | Not in Java routes CSV |
| `GET /customer/wallet` | jkpdxqb | jrsc8v3 | Not in Java routes CSV |
| `GET /customer/password-status` | jsfkv5o | jrsc8v3 | Not in Java routes CSV |
| `GET /customer/profile/password-status` | k1s5zh2 | jrsc8v3 | Not in Java routes CSV |
| `GET /customer/discover-services` | 4weahpi | jrsc8v3 | Not in Java routes CSV |
| `GET /customer/search-suggestions` | 5c4lian | jrsc8v3 | Not in Java routes CSV |
| `GET /customer/featured-vendors` | wnry9g8 | jrsc8v3 | Not in Java routes CSV |
| `GET /customer/adoption-stats` | ywsaodt | jrsc8v3 | Not in Java routes CSV |
| `GET /health` | nptgcrh | jrsc8v3 | Not in Java routes CSV |
| `ANY /v3/api-docs` | 8iuo9wi | 9pkprho | Swagger/docs — untouched |
| `ANY /v3/api-docs.yaml` | 6fvjqef | 9pkprho | Swagger/docs — untouched |
| `ANY /v3/api-docs/{proxy+}` | 036ip6t | 9pkprho | Swagger/docs — untouched |
| `ANY /swagger-ui` | oud3be9 | 9pkprho | Swagger UI — untouched |
| `ANY /swagger-ui.html` | lmvvt0d | 9pkprho | Swagger UI — untouched |
| `ANY /swagger-ui/{proxy+}` | bq57owe | 9pkprho | Swagger UI — untouched |
| `ANY /_customer-canary/{proxy+}` | lqxd90u | 9pkprho | Canary — untouched |
| `ANY /_customer-canary-v3/{proxy+}` | ot96jk3 | 9pkprho | Canary — untouched |
| `ANY /logistics/meal/dispatch` | 07xji49 | 9pkprho | Logistics — untouched |
| `ANY /logistics/pidge/{proxy+}` | xbaq03p | 9pkprho | Logistics — untouched |
| `ANY /logistics/pidge/order/partial-delivery` | fmn134l | 9pkprho | Logistics — untouched |
| `ANY /webhooks/pidge` | aes4wlg | 9pkprho | Webhooks — untouched |
| `ANY /webhooks/pidge/rider-task` | n2fke6k | 9pkprho | Webhooks — untouched |
| `ANY /webhooks/pidge/ticket` | wc3a3y1 | 9pkprho | Webhooks — untouched |

---

## Integration 1dvi6tb (old AWS_PROXY)

`1dvi6tb` → `AWS_PROXY` → `warmpawz-api-dev-api` (old Lambda)

**Zero routes in the current API Gateway reference `1dvi6tb`.** It is safe to note for cleanup; do not delete during this migration pass.
