# Route Ambiguity Resolution

**Date:** 2026-05-22  
**Status:** Draft — awaiting Step 2.5 edits before Step 3 can run  
**Input:** `docs/migration/route-conflict-report.md`

---

## Ambiguity 1 — `GET /customer/pets/{var}`

### Java handlers (both in `CustomerPetController.java`)

| | `getPetsByPhone` | `getCustomerPetById` |
|---|---|---|
| Line | 147 | 164 |
| `@GetMapping` | `/customer/pets/{phone:\d{10,15}}` + `/customer/pets` | `/customer/pets/{petId:<UUID_PATTERN>}` |
| Path-var constraint | `\d{10,15}` — 10 to 15 digit string | Full UUID regex |
| Extra validation | `requireValidPhone()` strips non-digits, checks length 10–15 | None (Spring rejects non-UUID at binding) |
| Return type | `CommonResponse<List<PetResponse>>` — list of pets | `CommonResponse<PetResponse>` — single pet |

Spring disambiguates these internally via regex-constrained path variables. **There is no runtime conflict in the Java layer.**

### Lambda parity (`customer-enhanced.ts`)

| Lambda route | Line | What it does |
|---|---|---|
| `GET /customer/pets` | 593 | Phone as `?phone=` query param → returns list |
| `GET /customer/pets/:phone` | 761 | Path param: if `isValidUUID(param)` → single-pet lookup; else → pet list by phone |

The Lambda already handles **both** use-cases in a single route via runtime `isValidUUID` branching.

### customer-web call sites

| Variant | Call count | Files |
|---|---|---|
| UUID (single pet) | 3 | `lib/fetch-customer-pet.ts:38`, `boarding/BoardingBookingRouter.tsx:965`, `wrappers/CustomerHomeWrapper.tsx:692` |
| Phone (list) | 4 | `lib/customer-service-list-urls.ts:28`, `meal-subscription/SubscriptionCheckoutContainer.tsx:201`, `payment/UniversalPaymentPage.tsx:632`, `nutrition/MealOrderCheckout.tsx:99` |

### Decision

**Winner route_key:** `GET /customer/pets/{var}`  
**Loser route_key:** `GET /customer/pets/{petId}` as a *separate* API Gateway route_key  

The Lambda handler at `GET /customer/pets/:phone` already handles both UUID and phone inputs at runtime. The API Gateway template must expose exactly **one** route_key — `GET /customer/pets/{var}` — pointing at this Lambda handler. Any second route_key for this path must be removed from the template.

**Java change required:** None. Spring regex constraints (`\d{10,15}` vs UUID pattern) already disambiguate the two methods within the service; no `@GetMapping` value needs editing.

**customer-web change required:** None. All seven call sites already send either a UUID or a phone string to `/customer/pets/${var}` — no URL changes needed.

**API Gateway template change:** Remove the duplicate `GET /customer/pets/{petId}` route_key entry; keep only `GET /customer/pets/{var}`.

---

## Ambiguity 2 — `GET /customer/{var}/pets/{petId}/bookings`

### Java handlers (two separate services)

| | `getPetBookingsByPhone` | `getBookingsByPet` |
|---|---|---|
| Service | `customer-service` | `booking-service` |
| File | `CustomerPetController.java:234` | `CustomerBookingController.java:83` |
| `@GetMapping` | `/customer/{phone}/pets/{petId}/bookings` | `/customer/{customerId}/pets/{petId}/bookings` |
| `{var}` type | `String` — validated by `requireValidPhone()` | `UUID` — Spring auto-binds |
| Auth | None (phone is caller-supplied) | `JwtPrincipalUtil.requireSelf(jwt, customerId)` — JWT-gated |
| Return type | `CommonResponse<Map<String,Object>>` with keys `bookings`, `stats`, `message` | `CommonResponse<PaginatedResult<BookingResponse>>` — paginated, full DTO |
| Data owner | **No** — proxies to booking-service via `BookingServiceClient`. When `bookingServiceEnabled=false` returns an empty stub. | **Yes** — queries booking-service DB directly |
| What it returns (extra) | Stub shape; no pagination | Full `BookingResponse` list with pagination metadata |

### customer-web call sites

| File | Line | URL template | `{var}` value |
|---|---|---|---|
| `PetProfile.tsx` | 98 | `/customer/${pathSeg}/pets/${petId}/bookings` | `getResolvedCustomerId() ?? phone` — UUID when available, phone as fallback |
| `CustomerPetDetails.tsx` | 236 | `/customer/${phone}/pets/${petId}/bookings` | Always phone |
| `PetProfileDashboard.tsx` | 128 | `/customer/${pathSeg}/pets/${petId}/bookings` | `getResolvedCustomerId() ?? phone` — UUID when available, phone as fallback |

**vendor-web:** No call sites found.

### Decision

Bookings belong to the booking-service. The customer-service handler is a **bridge** (phone → UUID lookup → delegate). A bridge that changes shape and silently returns empty data when `bookingServiceEnabled=false` is the wrong layer to own this route.

**Winner route_key:** `GET /customer/{customerId}/pets/{petId}/bookings` → **booking-service** (UUID-keyed, paginated, JWT-secured, data-owning)

**Loser route_key:** `GET /customer/{phone}/pets/{petId}/bookings` → customer-service (phone-keyed proxy)

**What changes:**

**Java (customer-service):**  
`CustomerPetController.java:234` — rename `@GetMapping` value:
```
// Before
@GetMapping("/customer/{phone}/pets/{petId}/bookings")

// After
@GetMapping("/customer/by-phone/{phone}/pets/{petId}/bookings")
```
This removes the ambiguous overlap while preserving the bridge endpoint for any internal caller that genuinely only has a phone number. The bridge's proxy behaviour (`bookingServiceClient.getPetBookings`) is unchanged.

**customer-web — three files to update:**

1. `apps/customer-web/components/customer/CustomerPetDetails.tsx:236`  
   This file always uses phone. Change:
   ```
   // Before
   `/customer/${phone}/pets/${petId}/bookings`

   // After
   `/customer/by-phone/${phone}/pets/${petId}/bookings`
   ```

2. `apps/customer-web/components/customer/PetProfile.tsx:98`  
   `pathSeg` is UUID when `getResolvedCustomerId()` resolves, otherwise phone. Only the phone-fallback arm needs updating:
   ```
   // Before
   `/customer/${pathSeg}/pets/${petId}/bookings`

   // After  (split the UUID and phone cases)
   isValidUUID(pathSeg)
     ? `/customer/${pathSeg}/pets/${petId}/bookings`          // booking-service — UUID path, no change
     : `/customer/by-phone/${pathSeg}/pets/${petId}/bookings` // customer-service — renamed phone path
   ```

3. `apps/customer-web/components/customer/PetProfileDashboard.tsx:128`  
   Same fix as `PetProfile.tsx:98` — same `pathSeg` pattern, same split required.

---

## TODO list for Step 2.5

These edits must be completed and deployed **before Step 3** (API Gateway template update) to avoid 404s in production.

1. **[customer-service Java]** `CustomerPetController.java:234` — Change `@GetMapping` from  
   `/customer/{phone}/pets/{petId}/bookings`  
   → `/customer/by-phone/{phone}/pets/{petId}/bookings`

2. **[customer-web]** `apps/customer-web/components/customer/CustomerPetDetails.tsx:236` — Change fetch URL from  
   `` `/customer/${phone}/pets/${petId}/bookings` ``  
   → `` `/customer/by-phone/${phone}/pets/${petId}/bookings` ``

3. **[customer-web]** `apps/customer-web/components/customer/PetProfile.tsx:98` — Split the single URL template into a UUID branch (unchanged) and a phone fallback branch that uses the renamed `/customer/by-phone/{phone}/pets/{petId}/bookings` path.

4. **[customer-web]** `apps/customer-web/components/customer/PetProfileDashboard.tsx:128` — Same split as item 3 above.

5. **[API Gateway template]** Remove any duplicate `GET /customer/pets/{petId}` route_key; keep only `GET /customer/pets/{var}` pointing at the Lambda `customer-enhanced.ts` handler.

6. **[API Gateway template]** Replace `GET /customer/{phone}/pets/{petId}/bookings` route_key with  
   `GET /customer/by-phone/{phone}/pets/{petId}/bookings` → customer-service  
   and confirm `GET /customer/{customerId}/pets/{petId}/bookings` → booking-service exists as its own route_key.

> Items 1–4 are code changes. Items 5–6 are infrastructure changes. Deploy items 1–4 first to all environments; then apply items 5–6.
