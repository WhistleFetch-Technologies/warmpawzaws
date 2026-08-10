# Warmpawz — Guest Discovery, Location, Analytics, SEO, Offers, E-commerce SEO & Admin Customer Intelligence

## Final Implementation-Ready Plan (Revised)

| Field | Value |
|-------|-------|
| Document | `GUEST_DISCOVERY_LOCATION_SEO_IMPLEMENTATION_PLAN.md` |
| Branch context | `feature/warmpawz-pay-appointments-unified` |
| Status | **Final blueprint — implementation not started** |
| Scope | Documentation only |
| Last revised | 2026-08-10 (E-commerce Product / Category / Brand / Offer SEO added) |

**Label legend**

| Label | Meaning |
|-------|---------|
| `[CONFIRMED FROM CODE]` | Verified in repository |
| `[INFERRED]` | Consequence of confirmed code |
| `[RECOMMENDATION]` | Chosen approach for implementation |
| `[MANDATORY]` | Non-negotiable product/architecture decision in this revision |
| `[OPEN DECISION]` | Requires human approval before coding |

---

## Table of contents

1. [Executive Summary](#1-executive-summary)
2. [Business Requirements](#2-business-requirements)
3. [Current Architecture](#3-current-architecture)
4. [Target Architecture](#4-target-architecture)
5. [Identity Model](#5-identity-model)
6. [Location Architecture](#6-location-architecture)
7. [Foreground Location Lifecycle](#7-foreground-location-lifecycle)
8. [Guest Discovery](#8-guest-discovery)
9. [Marketplace Discovery](#9-marketplace-discovery)
10. [Warmpawz Pay Discovery](#10-warmpawz-pay-discovery)
11. [Public API Surface](#11-public-api-surface)
12. [Guest Booking Boundary](#12-guest-booking-boundary)
13. [Guest Booking Intent](#13-guest-booking-intent)
14. [Authentication & Journey Restoration](#14-authentication--journey-restoration)
15. [Analytics Architecture](#15-analytics-architecture)
16. [Anonymous → Authenticated Identity Association](#16-anonymous--authenticated-identity-association)
17. [Event Taxonomy](#17-event-taxonomy)
18. [Booking Funnel & Abandonment](#18-booking-funnel--abandonment)
19. [Promotion / Offer Architecture](#19-promotion--offer-architecture)
20. [Offer SEO Architecture](#20-offer-seo-architecture)
21. [SEO Content Architecture](#21-seo-content-architecture)
22. [SEO Route Collision Analysis](#22-seo-route-collision-analysis)
23. [SEO Rendering Strategy](#23-seo-rendering-strategy)
24. [Sitemap / Robots / Metadata](#24-sitemap--robots--metadata)
25. [Capacitor Android](#25-capacitor-android)
26. [Capacitor iOS](#26-capacitor-ios)
27. [Deep Linking](#27-deep-linking)
28. [Database Changes](#28-database-changes)
29. [API Contract Changes](#29-api-contract-changes)
30. [Security](#30-security)
31. [Feature Flags](#31-feature-flags)
32. [Dev → Staging → Production Rollout](#32-dev--staging--production-rollout)
33. [Testing Matrix](#33-testing-matrix)
34. [Acceptance Criteria](#34-acceptance-criteria)
35. [Rollback Strategy](#35-rollback-strategy)
36. [File-by-File Implementation Plan](#36-file-by-file-implementation-plan)
37. [Open Decisions](#37-open-decisions)
38. [Final Change Summary](#38-final-change-summary)
39. [Workstreams & Developer Ownership](#39-workstreams--developer-ownership)
40. [Admin Existing Capability Audit](#40-admin-existing-capability-audit)
41. [Admin Customer Intelligence & Geo Analytics](#41-admin-customer-intelligence--geo-analytics)
42. [Admin Online / Last-Active / Location State Model](#42-admin-online--last-active--location-state-model)
43. [Admin APIs, Performance & RBAC](#43-admin-apis-performance--rbac)
44. [Admin Acceptance Criteria](#44-admin-acceptance-criteria)
45. [Management Summary — Admin Intelligence](#45-management-summary--admin-intelligence)
46. [E-commerce Existing Capability Audit](#46-e-commerce-existing-capability-audit)
47. [E-commerce SEO & Product Discovery](#47-e-commerce-seo--product-discovery)
48. [E-commerce SEO Addition Summary](#48-e-commerce-seo-addition-summary)

---

## 1. Executive Summary

Warmpawz must move from **login-first** entry to **guest browse → location-aware discovery → login at booking/payment**, while adding **crawlable SEO** for location/category pages, **public offers**, and **e-commerce product/category discovery**, a trustworthy **anonymous → authenticated analytics** trail (services + shop), and an **Admin Customer Intelligence** surface (online-by-location, journey timeline, inactive 30+ day segment, interactive geo map) that **extends** existing Customer Administration + Allyticas — not a duplicate CRM.

**Mandatory rules in this revision**

1. **Foreground location only** — no background GPS. `[MANDATORY]`
2. **`actor_id` is always server-derived from validated JWT** — client-supplied `actor_id` ignored/rejected. `[MANDATORY]`
3. Explicit **`identity_authenticated`** association at login without a mandatory new DB table. `[MANDATORY]`
4. Funnel includes **`booking_abandoned`** with a defined rule. `[MANDATORY]`
5. SEO routes must be **collision-safe** with `app/[persona]/[[...vendorSlug]]`. `[MANDATORY]`
6. **`GUEST_BOOKING_ENABLED` is an independent flag.** `[MANDATORY]`
7. SEO includes **public promotions/offers**, server-validated at booking **and** ecommerce checkout. `[MANDATORY]`
8. **Admin online ≠ has location** — online = recent qualifying activity within a configurable window. `[MANDATORY]`
9. **Do not store precise GPS on every analytics event** for Admin maps — use a dedicated operational location state if needed. `[MANDATORY]`
10. **Prefer extend existing Admin Customer Administration + Product analytics** over a greenfield duplicate dashboard. `[MANDATORY]`
11. **E-commerce SEO extends `/shop` + existing catalogue / promotion / cart** — no second ecommerce engine, no second discount engine, no brand SEO inventing a brand CRM that does not exist. `[MANDATORY]`
12. **Server remains authoritative for product price, stock, and promotions** — SEO HTML is informational only. `[MANDATORY]`

**Do not:** redesign discovery SQL; remove global `requireAuth`; add background location; introduce a second analytics or discount engine; create DB guest carts in v1; load every customer into the Admin browser for maps; mass-generate city-specific product URLs; index private coupons or cart/checkout.

---

## 2. Business Requirements

### 2.1 Search engine discovery

Public pages (location/category, selected vendor/service, **public offers**, **public ecommerce products/categories**) crawlable by Google/Bing without JWT, phone, address, or GPS.

### 2.2 Guest browsing

Browse home, categories, search, vendors, services, offers, availability/slots where public, ecommerce cart, pricing — without login.

### 2.3 Login at booking boundary

```text
Guest → search/category → vendor → service → slot → intent → BOOK
  → LOGIN → restore → revalidate (slot/price/promo) → PAY → booking
```

### 2.4 Guest journey tracking

Anonymous events for path/search/views/slots/cart/checkout/login prompts; after login, associate journey with `customer.id` via server-derived `actor_id` + `identity_authenticated`.

### 2.5 Public offers SEO

Public, non-personalized promotions discoverable via search; live eligibility always resolved by existing discount engine at booking — never trust client/SEO copy for the discount amount.

### 2.6 Admin Customer Intelligence & Geo Analytics `[MANDATORY]`

Admin must understand:

1. Customers currently **online by location** (city → locality → individuals).  
2. Individual **behaviour/journey** timelines (including pre-login after identity stitching).  
3. Customers who **signed up but have not logged in for 30+ days**.  
4. **Geographic analysis** with zoomable map (clusters → markers → customer summary).  
5. **Last-active** vs **last-location** as separate concepts.  
6. Drill-down into permitted customer detail (identity, location, behaviour, commercial).

Observed vs inferred vs confirmed behaviour labels are mandatory in Admin UI.

---

## 3. Current Architecture

### 3.1 Customer web & deploy `[CONFIRMED FROM CODE]`

| Fact | Path |
|------|------|
| Next.js 14 App Router | `apps/customer-web` |
| Prod `output: 'export'` → `dist` | `next.config.js` |
| S3 + CloudFront | `scripts/deploy-customer-web.sh`, `prodscripts/PRODUCTION_CONFIG.md` |
| Capacitor remote URL | `capacitor.config.json` → `https://customer.warmpawz.com` |
| No Next middleware | — |

### 3.2 Auth & guest islands `[CONFIRMED FROM CODE]`

| Fact | Path |
|------|------|
| `/` → `/auth` without session | `app/page.tsx` |
| Guest vendor share | `/vendor/[id]` + `GET /public/vendor/:id/profile` |
| Persona deep links force auth | `BannerVendorDeepLinkClient` + `app/[persona]/[[...vendorSlug]]` |
| Auth reads `redirect`; share uses `next` | `auth/page.tsx` vs `vendor-profile-share.ts` |

### 3.3 Discovery `[CONFIRMED FROM CODE]`

| Fact | Path |
|------|------|
| Lat/lng primary; phone→`getCustomerCoordinates` fallback | `discover-services/parse.ts`, `customer-coordinates.ts` |
| Global `requireAuth`; `/public/*` open | `auth-middleware.ts` |
| Slots: `GET /customer/vendor/:vendorId/available-slots` (auth) | discovery routes |
| Pay nearby requires coords; hub catalogue ignores geo | warmpawz-pay services / `wpay-api.ts` |

### 3.4 Location / Capacitor `[CONFIRMED FROM CODE]`

| Fact | Path |
|------|------|
| `@capacitor/geolocation`; Capacitor vs `navigator` | `address-from-geolocation.ts` |
| Google reverse geocode (client); pincode geocode (server) | same + `lib/utils/geocode.ts` |
| Android fine/coarse; no background | `AndroidManifest.xml` |
| iOS WhenInUse | `Info.plist` |
| WebView geo bridge | `MainActivity.java` |
| No unified LocationContext | — |

### 3.5 Analytics `[CONFIRMED FROM CODE]`

| Fact | Path |
|------|------|
| Allyticas RDS | migration `725_…` |
| `session_key`, nullable `actor_id`, events by `occurred_at` | `analytics_sessions` / `analytics_events` |
| Ingest **trusts client `actor_id`** | `service-ingest.ts` lines using `body.actor_id` / `ev.actor_id` |
| Client may send `warmpawz_customer_id` as actor | `allyticas-ingest.ts` |
| Ingest not in public middleware list; client often sends no Bearer | middleware + ingest client → **prod unauth ingest likely fails** `[INFERRED]` |

### 3.6 Promotions `[CONFIRMED FROM CODE]`

| Fact | Path |
|------|------|
| Only customer route `/promotions` (client, auth APIs) | `app/promotions/page.tsx` |
| No `/offers/**` routes | — |
| APIs behind JWT | `/promotions/active`, apply/validate, etc. |
| Tables: `promotions`, `coupons`, `vendor_promotions`, `vendor_service_promotions`, `ecommerce_admin_promotions`, `commercial_discount_campaigns` (has **`slug`**, `audience` cities) | migrations `1046`, `213`, `204`, … |
| Pricing via unified discount resolver | `discount-engine/resolver/unified-discount-resolver.ts` |
| No promotion SEO pages/sitemap today | — |

### 3.7 Personas that own top-level paths `[CONFIRMED FROM CODE]`

`BANNER_DEEP_LINK_PERSONAS`: `vet`, `grooming`, `training`, `boarding`, `walker`, `nutritionist` — via `app/[persona]/[[...vendorSlug]]`.

---

## 4. Target Architecture

```text
Google / Bing
      |
      v
SEO WEB (customer.warmpawz.com)
  /locations/{city}/{category}
  /offers/{slug}
  /vendor/{id} (existing public profile path)
      |
      v
GUEST USER (no JWT)
      |
      +-- Foreground location OR manual location
      |
      v
LocationContext (lat/lng primary)
      |
      +----------+----------+
      |                     |
      v                     v
Marketplace            Warmpawz Pay nearby
/public/discover-*     /public/.../nearby
      |                     |
      +----------+----------+
                 |
                 v
        Vendor / Service / Slots / Offers
                 |
                 v
        Booking intent (local snapshot)
                 |
                 v
        BOOK  [GUEST_BOOKING_ENABLED]
                 |
                 v
              LOGIN
                 |
                 v
   identity_authenticated (server sets actor_id)
                 |
                 v
   Revalidate slot + price + promotion (server)
                 |
                 v
           Payment → Booking

Analytics: anonymous_id + session_id (+ server actor_id after login)
Capacitor: same URLs via WebView / App Links (no background GPS)
```

---

## 5. Identity Model

| ID | Storage | Lifetime | Set by |
|----|---------|----------|--------|
| `anonymous_id` | localStorage `warmpawz_anonymous_id` | Durable visitor | Client UUID once |
| `session_id` | sessionStorage `warmpawz_session_id` → Allyticas `session_key` | Tab/WebView session | Client |
| `actor_id` | RDS only | After login | **Server from JWT → customers.id** |

```text
anonymous_id
   ├── session_1 → events (actor_id null)
   ├── session_2 → events
   └── login → identity_authenticated → actor_id = customer.id
```

**Do not** store full path history in localStorage. History = Allyticas event stream.

**Ordering:** `[CONFIRMED FROM CODE]` `occurred_at` (+ optional `client_ts`). `[RECOMMENDATION]` Sufficient for v1; add sequence only if collisions proven.

---

## 6. Location Architecture

### 6.1 Single LocationContext `[MANDATORY]` / `[RECOMMENDATION]` shape

Shared by Marketplace, Warmpawz Pay, Search, Offers, vendor/service discovery.

**V1 minimum**

```typescript
{
  latitude: number | null;
  longitude: number | null;
  city?: string;
  pincode?: string;
  accuracyM?: number | null;
  timestamp: number;
  source: 'gps' | 'manual_pincode' | 'manual_city' | 'cached' | 'profile' | 'seo_city';
  permissionState: 'unknown' | 'prompt' | 'granted' | 'denied' | 'unavailable';
  approximate: boolean;
}
```

**Add only if needed:** `locality`, `state`, `resolvedAddress`.

Mount: `app/providers.tsx`. Persist: `localStorage` `warmpawz_location_v1` (migrate `customer_latitude`/`longitude`).

### 6.2 Priority (live guest)

1. Fresh GPS (foreground)  
2. Cache  
3. Manual pincode/city  
4. SEO city default (SEO landings only)  
5. Authed profile coords (optional after login)  

Never force login for location. No silent Mumbai default when `GUEST_LOCATION_ENABLED` `[RECOMMENDATION]` (today Mumbai exists in `geolocation-utils.ts` `[CONFIRMED FROM CODE]`).

### 6.3 Storage separation `[MANDATORY]`

| Layer | Allowed |
|-------|---------|
| Device localStorage | Precise lat/lng + city/pin + accuracy + source |
| Discovery/nearby APIs | Precise lat/lng |
| Analytics | **city, pincode, locality/coarse, source** — **not** raw GPS by default |

---

## 7. Foreground Location Lifecycle

### 7.1 Allowed vs prohibited `[MANDATORY]`

**ALLOWED**

```text
App active / foreground
  → permission
  → location samples
  → LocationContext
  → discovery refresh when thresholds met
```

**PROHIBITED**

```text
App closed / background continuous GPS
  → backend location streams
  → ACCESS_BACKGROUND_LOCATION
  → iOS background location mode
```

### 7.2 Refresh pipeline `[MANDATORY]`

```text
GPS sample (foreground only)
    ↓
compare with last discovery location
    ↓
movement ≥ LOCATION_MOVE_REFRESH_M
  OR age ≥ LOCATION_STALE_MS
    ↓
debounce LOCATION_REFRESH_DEBOUNCE_MS
    ↓
update LocationContext (+ reverse geocode if meaningful move)
    ↓
refresh discovery (Marketplace / Pay nearby / offer-eligible lists)
```

### 7.3 Configurable defaults `[RECOMMENDATION]` (not hard requirements)

| Constant | Default | Purpose |
|----------|---------|---------|
| `LOCATION_MOVE_REFRESH_M` | ~500 m | Avoid thrash; refresh neighborhood relevance |
| `LOCATION_STALE_MS` | ~10 min | Active-session freshness |
| `LOCATION_REFRESH_DEBOUNCE_MS` | ~30 s | Burst control |
| `LOCATION_MAX_ACCURACY_M` | ~150 m | Ignore poor fixes for refresh |

**App resume:** if stale/moved, one-shot refresh.  
**Background:** stop sampling; do not call discovery.  
**Reverse geocode:** Google (existing); refresh address/pin when move threshold met.

### 7.4 Native verdict

**NO NATIVE CHANGE REQUIRED** for foreground location.  
`[CONFIRMED FROM CODE]` Plugin + Android fine/coarse + iOS WhenInUse + MainActivity WebChromeClient already present.

---

## 8. Guest Discovery

```text
LocationContext.lat/lng → existing discovery services (guestMode) → results
```

Phone/address/pincode remain **authenticated** fallbacks on `/customer/*` only.

Guest UX needs: home/categories/search/vendor/service/offers + public slots (Milestone 2) without JWT.

---

## 9. Marketplace Discovery

Reuse: `discover-services`, `services/by-style`, vendors search / search as needed, public vendor profile.

FE: when `GUEST_DISCOVERY_ENABLED` and no JWT → call `/public/...` with lat/lng; never require phone.

---

## 10. Warmpawz Pay Discovery

| Surface | Current | Target |
|---------|---------|--------|
| Nearby | lat/lng or phone; auth | `/public/.../nearby` + lat/lng |
| Hub catalogue | no geo | unchanged unless product enables nearby ranking |

`[OPEN DECISION]` Switch Pay hub to nearby when LocationContext present (optional flag).

---

## 11. Public API Surface

**Principle:** thin `/public` route → existing service + `guestMode` → sanitize → rate limit.  
Do **not** strip global `requireAuth`.

### Minimum guest UX set `[RECOMMENDATION]`

| Public path | Reuses | Guest rules |
|-------------|--------|-------------|
| `GET /public/discover-services` | discover-services | lat/lng **required** |
| `GET /public/services/by-style` | by-style | lat/lng **required** |
| `GET /public/vendors/search` | vendors-search | lat/lng **required** for ranked distance |
| `GET /public/search` | `/search` handler | only if guest search needs it |
| `GET /public/vendor/:vendorId/profile` | **exists** | keep |
| `GET /public/vendor/:vendorId/available-slots` | available-slots | availability only; rate limit |
| `GET /public/warmpawz-pay/vendors/nearby` | Pay nearby | lat/lng **required** |
| `GET /public/offers` / `GET /public/offers/:slug` | **new read models** from published promotions/campaigns | no customer PII; no personalized pricing; may include safe ecommerce eligibility summaries |
| `GET /public/products` / `GET /public/products/:slug` | thin wrappers over storefront product list/detail | public catalogue only; UUID or slug; no private inventory internals |
| `GET /public/products/categories` | `GET /ecommerce/categories` read model | active categories with meaningful inventory only |
| `GET /public/brands/:slug` | **deferred** until brand storefront model exists | see §47.6 |
| `POST /analytics/v1/events` | existing | allowlisted; **server-derived actor_id** |

**Never public:** booking create, payment, `/promotions/apply*`, coupon apply for account, addresses, pets, phone cart, customer-specific ecommerce pricing, private stock ledgers, order ownership.

**Defer:** radar, problem-grid variants, autocomplete (unless UI blocked).

---

## 12. Guest Booking Boundary

| Allowed without login | Requires auth |
|-----------------------|---------------|
| Browse, search, discover, offers, vendor/service, public slots, select intent | Booking create, payment, account data, personalized promo resolution for checkout |
| Shop PLP/PDP, category browse, product search, public ecommerce offers, **add to cart** (`warmpawz_cart` localStorage) `[CONFIRMED FROM CODE]` | Ecommerce checkout / `POST /ecommerce/orders` (phone/customer required) |

Controlled by **`GUEST_BOOKING_ENABLED`** independently of discovery flags for **services**. Ecommerce guest cart already exists — do not gate browse/add-to-cart behind booking flag. Checkout login boundary remains. `[MANDATORY]`

When flag off: guest can discover; Book CTA still forces login earlier or shows “coming soon” soft gate — product choice `[OPEN DECISION]` for UX copy only.

---

## 13. Guest Booking Intent

Lightweight snapshot (not a multi-item service cart DB):

```text
vendorId, serviceId, serviceStyle, date, slotTime, offerSlug?, returnPath
```

| Safe to restore | Must revalidate server-side |
|-----------------|-----------------------------|
| Selection intent + returnPath | Slot availability |
| offerSlug as **hint** | Price / quote |
| | Vendor/service bookable |
| | **Promotion eligibility & amount** via unified discount resolver |
| | Payment amount |

Ecommerce `warmpawz_cart` remains separate (localStorage guest cart `[CONFIRMED FROM CODE]`). **No DB guest cart in v1** unless an existing implementation already requires one (it does not for browse/add). Server `/cart/:customerId` remains authenticated sync after login — **NONE REQUIRED** to invent a guest DB cart.

---

## 14. Authentication & Journey Restoration

### 14.1 Fix redirect `[CONFIRMED FROM CODE]` / `[MANDATORY]`

- `auth/page.tsx`: accept `redirect` **or** `next`; prefer `redirect`; allow only same-origin relative paths.  
- Emitters (`vendor-profile-share`, persona client): use `redirect=`.

### 14.2 Flow

```text
Guest BOOK → create snapshot → /auth?redirect=<safe path>
  → OTP/password → tokens
  → identity_authenticated (analytics)
  → redirect + hydrate snapshot
  → revalidate slot/price/promo
  → pay
```

---

## 15. Analytics Architecture

**Platform:** Allyticas only (`POST /analytics/v1/events` → RDS).

### 15.1 Mandatory actor_id rule `[MANDATORY]`

> **`actor_id` is always derived server-side from validated authentication context. Client-provided `actor_id` must be ignored or rejected.**

**Enforcement location `[RECOMMENDATION]`**

1. `product-analytics/routes.ts` ingest handler: read JWT from `Authorization` if present (via existing verify helpers / `c.get('userId')` after auth middleware adjustment).  
2. Resolve `customers.id` from JWT claims (same patterns as customer auth utils).  
3. Pass **serverActorId** into `ingestProductAnalyticsBatch`.  
4. **Ignore** `body.actor_id` and per-event `actor_id` from client.  
5. If no valid JWT → `actor_id = null` (guest).  
6. Optionally reject requests that send a non-null client `actor_id` while unauthenticated (400) — or silently ignore (prefer **ignore** for back-compat). `[OPEN DECISION]` strict vs ignore.

**Middleware:** allowlist `POST /analytics/v1/events` for unauthenticated ingest **but** still run optional JWT parse when header present (do not require auth).

**Client:** stop sending `actor_id` from `localStorage`; send `anonymous_id` in `session_patch.context` / `properties` only.

### 15.2 Ingest allowlist

`[CONFIRMED FROM CODE]` Currently not public → fix allowlist + rate limit (already 120/min).

---

## 16. Anonymous → Authenticated Identity Association

### 16.1 Existing schema sufficiency `[RECOMMENDATION]`

| Need | Support without new table? |
|------|----------------------------|
| Pre-login events | `actor_id` null + `session_key` |
| Post-login events | server sets `actor_id`; session COALESCE |
| Link anon → customer | Store `anonymous_id` in `analytics_sessions.context` + event properties; emit **`identity_authenticated`** |
| Query “what did customer do before login?” | Join sessions/events by `actor_id` after link event; also query `context.anonymous_id` |

**New identity-link table: NOT REQUIRED for v1** if `identity_authenticated` + context persistence are implemented.  
**OPTIONAL later** for warehouse performance.

### 16.2 `identity_authenticated` `[MANDATORY]`

Fire once after successful login (client enqueues Allyticas `custom` event; server still overwrites actor_id from JWT on that batch).

Conceptual payload:

```json
{
  "event_type": "custom",
  "event_name": "identity_authenticated",
  "properties": {
    "anonymous_id": "anon_123",
    "session_id": "sess_456"
  }
}
```

Server persists `actor_id = customer.id` on session/events for that authenticated batch. Historical pre-login rows stay `actor_id` null but share `session_key` / `anonymous_id`.

Do **not** rewrite all historical events.

---

## 17. Event Taxonomy

Reuse Allyticas `event_type` enums; map names via `custom` / `search` / `screen_view` as today.

| Event | Trigger | Required props (plus anon/session; actor server-side) |
|-------|---------|--------------------------------------------------------|
| `app_opened` | Cold start / providers | platform, source |
| `page_viewed` | Route change | path, screen_name |
| `search_performed` | Search submit | query, filters, result_count, city, pincode |
| `category_viewed` | Hub/category | category, style |
| `vendor_viewed` | Profile | vendor_id, source |
| `service_viewed` | Service select | service_id, vendor_id |
| `price_viewed` | Price displayed | service_id, price_bucket, currency |
| `slot_viewed` | Slots loaded | vendor_id, date |
| `slot_selected` | Slot tap | vendor_id, date, time |
| `booking_summary_viewed` | Summary/review step | vendor_id, service_id |
| `cart_item_added` / `removed` | Shop/intent (legacy names OK) | item_type, ids |
| `product_category_viewed` | Ecommerce category SEO/PLP | category_id, category_slug, source |
| `product_viewed` | Ecommerce PDP | product_id, product_slug, brand_text?, category_id, source |
| `product_variant_selected` | SKU / option change | product_id, product_sku_id, option_values |
| `product_search_performed` | Shop search | query, result_count, filters |
| `product_added_to_cart` | Add to `warmpawz_cart` | product_id, product_sku_id, qty |
| `product_removed_from_cart` | Remove from cart | product_id, product_sku_id |
| `cart_viewed` | `/cart` | item_count, value_hint optional |
| `checkout_started` | Checkout enter (service or shop) | funnel=`service\|ecommerce` |
| `payment_started` / `failed` / `completed` | Razorpay | error_code if fail; funnel |
| `purchase_completed` | Ecommerce order success | order_id, value_hint optional |
| `cart_abandoned` | See §18.4 | stage, item_count, … |
| `login_prompt_shown` | Soft gate | reason, stage, returnPath |
| `login_started` / `login_completed` | Auth UI | method |
| `identity_authenticated` | Post-login | anonymous_id (props); actor server |
| `booking_started` | Enter book flow / confirm intent | vendor_id, service_id, stage |
| `booking_abandoned` | See §18 | stage, vendor_id, service_id, … |
| `booking_failed` / `booking_completed` | Create API result | booking_id |

Also: `offer_viewed`, `offer_cta_clicked` for offer SEO pages (service **and** ecommerce landing CTAs) `[RECOMMENDATION]`.

Alias note: existing `cart_item_added` / `removed` may map 1:1 to `product_added_to_cart` / `product_removed_from_cart` — **do not** invent a second analytics system; prefer one canonical name per action in Allyticas.

**Analytics location:** city/pincode/source only.

---

## 18. Booking Funnel & Abandonment

### 18.1 Funnel stages

```text
booking_started
  → slot_selection | booking_summary | login | checkout | payment
  → booking_completed
  OR booking_abandoned / payment_failed / booking_failed
```

### 18.2 `booking_abandoned` rule `[MANDATORY]` / `[RECOMMENDATION]`

**Do not** fire merely on tab close without `booking_started`.

**Rule:**

```text
booking_started recorded
  AND user leaves booking flow (route leave / app background / navigate away from booking screens)
  AND no booking_completed / payment_completed within ABANDON_WINDOW_MS (configurable, e.g. 30–60 min)
  AND not already abandoned for this intent_id
→ emit booking_abandoned once
```

Implementation hooks: booking router unmount / `pagehide` / navigation away from booking screens; dedupe by `intent_id` in snapshot.

**Properties:** vendor_id, service_id, date/slot if any, stage (`slot_selection|booking_summary|login|checkout|payment`), value_hint optional, login_required boolean, failure_reason if known (`slot_unavailable` etc.).

### 18.3 Observed vs inferred vs confirmed

| Class | Example |
|-------|---------|
| OBSERVED | Left after `price_viewed`; `booking_abandoned` stage=`booking_summary` |
| INFERRED | “Possible price sensitivity” (analysis only) |
| CONFIRMED | Explicit survey answer “too expensive” |

Optional lightweight survey only on abandon after summary/checkout — not on every page.

### 18.4 `cart_abandoned` (ecommerce) `[RECOMMENDATION]`

Parallel to `booking_abandoned`. **Do not** fire merely because the user closes a browser tab.

**Rule:**

```text
checkout_started with funnel=ecommerce
  OR (product_added_to_cart AND cart non-empty AND user entered /checkout)
  AND user leaves checkout / payment screens
  AND no purchase_completed / payment_completed within CART_ABANDON_WINDOW_MS
     (configurable; default same band as ABANDON_WINDOW_MS, e.g. 30–60 min)
  AND not already abandoned for this cart_intent_id / checkout session
→ emit cart_abandoned once
```

**Do not** treat “viewed product and left” alone as abandonment. Prefer checkout-boundary abandon (reliable) over speculative browse abandon.

**Properties:** stage (`cart|checkout|login|payment`), item_count, product_ids sample (capped), value_hint optional, login_required boolean.

Admin journey badges: OBSERVED only for the event; do not label as “price sensitive” without survey.

---

## 19. Promotion / Offer Architecture

### 19.1 Classification `[CONFIRMED FROM CODE]` + SEO policy

| Promotion Type | Public? | SEO Indexable? | Requires Login? | Reason |
| -------------- | ------- | -------------- | --------------- | ------ |
| Platform promotion (`promotions`, published + active + in window) | Yes (marketing) | **Yes** if public landing built | Browse no; apply yes | Non-personalized platform offer |
| Platform coupon (`coupons`) | Landing yes; redeem may need login | **Yes** if public code/campaign landing appropriate | Redeem/account limits at apply | Public code pages OK; no PII |
| Vendor promotion (`vendor_*`) | Yes if vendor consented / published | **Yes** with vendor landing / offer slug | Browse no | Public vendor marketing |
| Vendor coupon | Same | Case-by-case | Apply auth | Prefer link from vendor page |
| Commercial campaign (`commercial_discount_campaigns` with `slug`, running) | Yes when status running + public surface | **Yes** — best slug source today | Browse no | Orchestration slug exists |
| Ecommerce admin promotion | Yes if published | **Yes** if ecom SEO in scope | — | Shop domain |
| Audience segment (new/returning/VIP only) | Landing careful | **No** (or generic page without claiming personalization) | Often yes to realize benefit | Avoid misleading SEO |
| Customer-specific / private | No | **No** | Yes | PII / private |
| Internal/admin/draft/expired as “active” | No | **No** as active; expired see §20 | — | |
| Spotlight/banners | Display | Optional CMS pages | No | Not discount engine entities |
| Notification campaigns | No | **No** | — | Messaging, not priced offers |

### 19.2 Server validation `[MANDATORY]`

Never trust URL / localStorage / SEO HTML / query params / client coupon state for discount amount.

**Service path**

```text
SEO Offer Page (informational)
  → Guest discovery (LocationContext)
  → Booking
  → unified-discount-resolver / existing calculate-booking & validate-code
  → actual discount
```

**Ecommerce path** (same engine family — `[CONFIRMED FROM CODE]` discount-engine ecommerce adapters + vendor-promotion-engine)

```text
SEO Offer Page (/offers/{slug}) OR Product/Category SEO page
  → Guest product browse
  → Add to cart (warmpawz_cart)
  → Checkout
  → LOGIN
  → Backend cart/order quote
  → Unified Discount Resolver / legacy ecommerce cart calculator
  → Validate: active, product/category/brand-ownership eligibility,
               customer eligibility, usage limits, stacking, dates,
               location if applicable
  → Final payable amount
```

Re-check: active, customer eligible, service/vendor **or** product/category/listing-ownership, date/location/usage/stacking/amount.

**Do not** create a second promotion engine or a second product↔offer mapping table if eligibility already lives on `applicable_products` / `applicable_categories` / campaign surfaces (`marketing` | `ecommerce`).

---

## 20. Offer SEO Architecture

### 20.1 URLs `[RECOMMENDATION]` (collision-safe)

| Type | Canonical URL |
|------|----------------|
| Platform / campaign offer | `/offers/{slug}` |
| Offer index | `/offers` |
| City + offer (only if campaign audience is city-scoped and unique content) | `/locations/{city}/offers/{slug}` |
| In-app coupons UI (existing) | `/promotions` — **noindex**, auth-oriented |

`[CONFIRMED FROM CODE]` Best existing slug field: `commercial_discount_campaigns.slug`. Platform `promotions` lack slug — may need slug generation strategy `[OPEN DECISION]`.

### 20.2 Crawler vs human

```text
Crawler: /offers/{slug} → HTML (title, description, validity, category, terms, CTA) — no JWT/GPS
Human (service): same URL → LocationContext → eligible nearby vendors/services → guest book → login → server promo resolve
Human (ecommerce): same URL → eligible public products/categories links → guest PDP/cart → checkout → login → server promo resolve
```

Live GPS must **not** change canonical URL.

Public offer read API may expose safe marketing fields such as:

```json
{
  "slug": "royal-canin-20-off",
  "title": "20% OFF Royal Canin",
  "description": "...",
  "validFrom": "...",
  "validUntil": "...",
  "category": "ecommerce",
  "eligibleProducts": [{ "slug": "...", "name": "...", "image": "..." }],
  "eligibleCategories": [{ "slug": "...", "name": "..." }]
}
```

Only public, allowlisted product/category summaries — **never** customer-specific eligibility or private coupon targeting.

### 20.3 Expiry `[RECOMMENDATION]`

| State | Behavior |
|-------|----------|
| ACTIVE | Indexable offer page; in sitemap |
| EXPIRED | Keep URL; render “Offer ended” + related active offers; `noindex` or soft message; **301 only if replaced by successor slug** |
| DRAFT/CANCELLED | 404 or noindex; not in sitemap |

Do not blindly delete URLs (SEO equity).

### 20.4 Web / mobile web / Capacitor

Same `/offers/{slug}` path everywhere; App/Universal Links open Capacitor WebView to same path.

### 20.5 Offer metadata

title, description, canonical, OG, validity dates, internal links to `/locations/{city}/{category}`, related vendors (public), sitemap when active.  
Structured data: use only valid types (e.g. Offer/Product carefully — **do not invent false Product schema**). Prefer WebPage + Offer if legally accurate `[OPEN DECISION]` with marketing/legal.

### 20.6 Offer sitemap

Generate from **public active** campaigns/promotions API or build job; regenerate on deploy / scheduled job when offers activate/expire — no manual sitemap edits per promo.

---

## 21. SEO Content Architecture

Indexable classes:

1. **Location/category** — `/locations/{city}/{category}`  
2. **Vendor** — existing `/vendor/{id}` (+ improve HTML/metadata); persona deep links remain app routes  
3. **Offers** — `/offers`, `/offers/{slug}` (service **and** public ecommerce campaigns)  
4. **Campaign/seasonal** — only with unique content  
5. **E-commerce product categories** — `/shop/c/{category-slug}` (see §47)  
6. **E-commerce product detail** — `/shop/p/{product-slug}` (see §47)  
7. **E-commerce brands** — **not indexable in v1** (no first-class storefront brand model; see §47.6)

Do not mass-generate thin pages. Cap allowlisted cities × service categories × active public offers × **public active products/categories with meaningful inventory**.

Full e-commerce SEO architecture: **§46–§48**.

---

## 22. SEO Route Collision Analysis

### 22.1 Current dynamic catch-all `[CONFIRMED FROM CODE]`

```text
app/[persona]/[[...vendorSlug]]/page.tsx
```

Personas: `vet`, `grooming`, `training`, `boarding`, `walker`, `nutritionist`.

Next.js: **static segment beats dynamic**; **two different dynamic names cannot both own `app/[param]`**.

### 22.2 Collision matrix

| URL | Current matcher | Proposed `/[city]/[category]` | Conflict? | Resolution |
|-----|-----------------|----------------------------------|-----------|------------|
| `/bangalore/vet` | `[persona]=bangalore`, `vendorSlug=['vet']` | `[city]/[category]` | **YES — UNSAFE** | Do **not** use `/[city]/[category]` |
| `/bangalore/grooming` | same catch-all | same | **YES** | Prefixed SEO namespace |
| `/vet/...` | `[persona]=vet` | N/A | Persona owns | Keep for deep links; SEO uses `/locations/...` |
| `/grooming/...` | `[persona]=grooming` | N/A | Persona owns | Keep |
| `/vendor/...` | `app/vendor/[vendorId]` | N/A | No | Keep public profile SEO improvements |
| `/search` | `app/search` | N/A | No | — |
| `/shop` | `app/shop` | N/A | No | Keep PLP; extend with SEO children |
| `/shop/{uuid}` | `app/shop/[productId]` | N/A | Exists (UUID PDP) | Keep for app deep links; **canonical SEO** under `/shop/p/{slug}` |
| `/shop/p/{slug}` | **none** (literal `p`) | proposed ecommerce SEO | **No** | SAFE under `/shop` |
| `/shop/c/{slug}` | **none** (literal `c`) | proposed category SEO | **No** | SAFE under `/shop` |
| `/shop/b/{slug}` | **none** | deferred brand SEO | **No** if added later | SAFE under `/shop` — **not v1** |
| `/products/{slug}` | **none** | alternative | Persona-safe (static `products`) but **duplicates shop surface** | **Rejected for v1** — prefer `/shop/...` |
| `/warmpawz-pay/...` | static | N/A | No | — |
| `/promotions` | `app/promotions` | N/A | Exists; auth UI | **noindex**; offers SEO under `/offers` |
| `/offers` | **none** | `/offers` | **No** | SAFE |
| `/offers/{slug}` | **none** | `/offers/[slug]` | **No** | SAFE |
| `/cart`, `/checkout` | existing | N/A | No | **noindex** — never SEO |
| `/locations/bangalore/vet` | would be static `locations` + dynamics | proposed | **No** | SAFE — `locations` literal beats `[persona]` |

### 22.3 Final SEO URL architecture `[MANDATORY]`

```text
SEO ROUTE COLLISION STATUS: SAFE
(only with prefixed architecture below — NOT with /[city]/[category])
```

**Recommended canonical patterns**

```text
/locations/{city}/{category}           e.g. /locations/bangalore/vet
/locations/{city}/{category}/{vendor}  optional later
/offers
/offers/{slug}
/locations/{city}/offers/{slug}        optional city-scoped offers
/vendor/{vendorId}                     existing
/shop                                  existing PLP
/shop/c/{category-slug}                ecommerce category SEO
/shop/p/{product-slug}                 ecommerce product SEO (canonical)
/shop/{productId}                      existing UUID PDP — redirect or rel=canonical → /shop/p/{slug}
```

**Rejected for v1:** `/[city]/[category]` (collides with `[persona]`); top-level `/products/{slug}` (unnecessary second catalogue root); city-mass product pages (`/products/bangalore/...`); indexable brand routes without a brand model.

Optional alternative: literal folders `app/bangalore/[category]` per city — works (static first segment) but scales poorly; prefer `/locations/...`.

---

## 23. SEO Rendering Strategy

`[CONFIRMED FROM CODE]` Prod = static export (`output: 'export'`); shop PDP `generateStaticParams` is placeholder-only today.

**Choice:** current export + **build-time generated HTML** for allowlisted `/locations/*`, `/offers/*`, and **`/shop/p/*` + `/shop/c/*`**.  
Defer full SSR/ISR rewrite. No separate SEO app.

```text
Build
  ↓
Generate allowlisted public pages (locations, offers, ecommerce products/categories)
  ↓
Static HTML + metadata + JSON-LD + internal links
  ↓
S3 → CloudFront → Google/Bing
Hydration
  ↓
React → live product/availability/delivery + LocationContext for services
```

SEO must **not** depend on: login, JWT, GPS, customer phone/address, or authenticated APIs at crawl time.  
Build must not fail if live API is down (snapshot / allowlist file / last-known public catalogue export).

---

## 24. Sitemap / Robots / Metadata

| Artifact | Rule |
|----------|------|
| `robots.txt` | Allow `/locations/`, `/offers/`, `/vendor/`, `/shop/` (indexable SEO paths); Disallow `/auth`, `/cart`, `/checkout`, `/payment`, `/bookings`, `/profile`, `/account`, `/promotions` (in-app), wishlist/private paths |
| `sitemap.xml` | Generated: locations allowlist + **active public offers** + selected vendors + **public ecommerce categories** + **public active products** (canonical `/shop/p/{slug}` only); refresh on deploy/schedule |
| Sitemap scale | If product count is large, use **sitemap index + chunked product sitemaps** (e.g. 5–10k URLs/file) — do not emit one massive file |
| Metadata | title, description, canonical, OG; product pages may include Product/Offer/BreadcrumbList JSON-LD only when accurate |
| noindex | account, cart, checkout, payment, private bookings, private products/drafts, duplicate SKU URLs, expired offers (or expired template), `/promotions`, customer-specific URLs |

**Never sitemap:** private/draft/deleted products, duplicate variants, private coupons, cart/checkout/account.

---

## 25. Capacitor Android

| Item | Verdict |
|------|---------|
| Geolocation plugin | Present |
| Fine/coarse | Present |
| Background location | **Do not add** |
| MainActivity WebChromeClient | Present — keep |
| Code change for GPS | **NONE REQUIRED** |
| App Links | OPTIONAL fill `assetlinks.json` SHA + path parity incl. `/offers`, `/locations`, `/shop/p/*`, `/shop/c/*` |

---

## 26. Capacitor iOS

| Item | Verdict |
|------|---------|
| WhenInUse usage string | Present |
| Background modes | **Do not add** |
| Code change for GPS | **NONE REQUIRED** |
| Universal Links | OPTIONAL real Team ID + AASA paths for `/offers`, `/locations`, `/vendor`, `/shop/p/*`, `/shop/c/*` |

---

## 27. Deep Linking

```text
SEO/share URL → browser
  and/or App Link / Universal Link → Capacitor → same path
```

Preserve: route, query, `anonymous_id`, LocationContext cache, **guest `warmpawz_cart`**, product slug, offer slug.  
Offer/product/category slugs must survive open. Single URL for web and app / Capacitor.

---

## 28. Database Changes

| Change | Class |
|--------|-------|
| Guest discovery / slots / location | **NOT REQUIRED** |
| Guest booking intent | **NOT REQUIRED** (client snapshot) |
| Allyticas reuse | **NOT REQUIRED** |
| identity-link table | **NOT REQUIRED** v1; **OPTIONAL** later |
| Promotion SEO slug on all `promotions` rows | **OPTIONAL** if campaigns.slug insufficient |
| Public offers read models | May be API-only over existing tables — **NOT REQUIRED** new tables if queries suffice |
| `products.slug` | **NEW COLUMN REQUIRED** for stable product SEO URLs (no slug today) `[CONFIRMED FROM CODE]` |
| `ecommerce_categories.slug` | **EXTEND EXISTING TABLE** — admin UI invents slug but does not persist `[CONFIRMED FROM CODE]` |
| First-class storefront `brands` table | **NOT REQUIRED for v1 SEO** — `products.brand` TEXT + `vendor_registered_brands` exist; brand landing pages deferred (§47.6) |
| Product variants as separate SEO rows | **NONE REQUIRED** — variants are `product_skus` under parent product |
| Guest cart DB | **NONE REQUIRED** — localStorage `warmpawz_cart` |
| `customers.last_login_at` | **EXISTS** — expose in Admin; **NOT REQUIRED** to add `[CONFIRMED FROM CODE]` |
| `customers.last_active_at` | **MISSING** — see §42 classification |
| `customers.latitude/longitude` | **EXISTS** as **profile/address** coords (`1005_…`) — **not** live presence GPS `[CONFIRMED FROM CODE]` |
| Operational presence/location state for Admin map | See §42 — likely **NEW TABLE or EXTEND** (not analytics_events) |
| Destructive user/booking changes | **FORBIDDEN** |

---

## 29. API Contract Changes

### 29.1 Analytics ingest

**CURRENT**

```http
POST /analytics/v1/events
Body includes optional actor_id (trusted) 
Auth effectively required by middleware; client often omits Bearer
```

**TARGET**

```http
POST /analytics/v1/events
Auth: optional
If Authorization valid → actor_id = server-resolved customer.id
Else → actor_id = null
Client actor_id: IGNORED
Body: session_key, anonymous_id in context/properties, events[]
Rate limit: keep
```

### 29.2 Discovery (examples)

**CURRENT** `GET /customer/discover-services?...&phone=` + Bearer  

**TARGET** `GET /public/discover-services?latitude&longitude&...` no auth; lat/lng required; sanitized  

Same pattern for by-style, vendors-search, Pay nearby, available-slots.

### 29.3 Offers public read `[RECOMMENDATION]`

```http
GET /public/offers
GET /public/offers/:slug
Auth: none (rate limited)
RBAC: public read
→ marketing fields: title, description, validity, category/surface, terms, slug, status
→ optional eligibleProducts / eligibleCategories (public summaries only)
→ NO personalized discount amount guaranteeing checkout price
→ NO customer PII
Pagination: list endpoint yes; detail by slug
Caching: CDN/short TTL OK for marketing snapshot
```

Apply/validate remain authenticated + resolver.

### 29.4 Ecommerce public catalogue read `[RECOMMENDATION]`

Conceptual paths (adapt to existing `/ecommerce/*` / `/products/*` conventions; prefer `/public` wrappers):

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/public/products` | none | Pagination; active/public only; search/category filters |
| GET | `/public/products/:slugOrId` | none | Resolve slug **or** UUID; public fields only |
| GET | `/public/products/categories` | none | Active categories; optional `with_products_only` |
| GET | `/public/brands/:slug` | — | **DEFERRED** — NONE until brand model |

**Response (product detail — public):** name, description, images, brand text, category, public price snapshot, availability snapshot, variant options (non-sensitive), related products, public offer badges.  
**Never:** customer-specific price, private promo values, warehouse internals, seller PII, cart ownership, order history.

**Caching:** short TTL / CDN for SEO hydration; **checkout always revalidates** live price/stock/promo.

### 29.5 Booking / payment / ecommerce order

**Unchanged authority** — always authenticated at order/payment boundary; server revalidates slot/price/promo **or** product/SKU/stock/delivery/promo.

---

## 30. Security

1. `actor_id` server-derived from validated JWT. `[MANDATORY]`  
2. Client cannot impersonate another customer in analytics.  
3. Public discovery: no customer PII.  
4. Public offer pages: no customer-specific promo data.  
5. Client location ≠ authorization.  
6. Booking/payment/ecommerce order server-authorized.  
7. Promotion eligibility server-validated (existing resolver — service **and** ecommerce).  
8. Slot availability revalidated before book; product price/stock revalidated before pay.  
9. Precise GPS not in analytics by default.  
10. Background location prohibited.  
11. Rate limit public GETs + analytics ingest.  
12. Open-redirect protection on `redirect` param.  
13. Public product APIs: no private inventory ledgers, cart ownership, or order PII.

---

## 31. Feature Flags

**Minimum set `[MANDATORY]` independence of booking**

| Flag | Purpose |
|------|---------|
| `GUEST_BROWSING_ENABLED` | Home/persona without login |
| `GUEST_LOCATION_ENABLED` | LocationContext gate / no silent Mumbai |
| `GUEST_DISCOVERY_ENABLED` | FE → `/public` discovery |
| `GUEST_ANALYTICS_ENABLED` | Anon analytics + identity_authenticated |
| **`GUEST_BOOKING_ENABLED`** | Book CTA → snapshot → login → pay path |
| `SEO_PUBLIC_PAGES_ENABLED` | `/locations/*`, `/offers/*` (service + public offer SEO) |
| **`ECOMMERCE_SEO_ENABLED`** | `/shop/p/*`, `/shop/c/*` crawlable HTML + ecommerce sitemap entries + public product read wrappers used by SEO |
| **`ADMIN_CUSTOMER_INTELLIGENCE_ENABLED`** | Admin CI tabs, geo map, journey, inactive segment |

**Flag recommendation `[RECOMMENDATION]`:** do **not** add three separate ecommerce SEO flags. Use one scoped **`ECOMMERCE_SEO_ENABLED`** independent of `GUEST_BOOKING_ENABLED`. Public ecommerce **offers** remain under existing `/offers` + `SEO_PUBLIC_PAGES_ENABLED` (offer publication), while product/category HTML generation is gated by `ECOMMERCE_SEO_ENABLED`. Existing `NEXT_PUBLIC_CUSTOMER_ECOMMERCE_ENABLED` continues to gate shop UX — SEO flag must not silently enable shop checkout.

**Optional:** `PUBLIC_SLOTS_ENABLED`, `WPAY_HUB_USE_NEARBY`.  
**Not recommended v1:** `ECOMMERCE_PUBLIC_PRODUCTS_ENABLED` + `ECOMMERCE_PUBLIC_OFFERS_ENABLED` as separate flags (redundant with above).

**Rollout order**

```text
GUEST_BROWSING → GUEST_LOCATION → GUEST_DISCOVERY → GUEST_ANALYTICS
  → GUEST_BOOKING → SEO_PUBLIC_PAGES → ECOMMERCE_SEO_ENABLED
  → ADMIN_CUSTOMER_INTELLIGENCE (after analytics + presence state)
```

---

## 32. Dev → Staging → Production Rollout

```text
DEV (all flags on) → STAGING (guest→pay test keys) → PROD (staged flags)
```

1. Backend: ingest actor derivation + public discovery/offers read + slots.  
2. FE foundation (M1) with browsing/discovery flags.  
3. Enable `GUEST_BOOKING_ENABLED` only after payment regression green.  
4. SEO pages last behind `SEO_PUBLIC_PAGES_ENABLED`.  
5. Admin CI behind `ADMIN_CUSTOMER_INTELLIGENCE_ENABLED` only after M1/M4 analytics identity + presence writes are live on staging.  

Never direct prod hotfixes without staging smoke.

---

## 33. Testing Matrix

**Guest:** first open, refresh, restart, permission allow/deny, manual location, cache.  

**Foreground location:** samples while active; ≥500m / stale refresh; debounce; **no** continuous track in background; resume refresh.  

**Analytics:** anon events; session; server actor_id; reject/ignore client actor_id; `identity_authenticated`; journey reconstruction; `booking_abandoned`; funnel.  

**Discovery:** Marketplace, Pay nearby, vendor, service, slots.  

**Booking:** intent, login, restore, slot/price/promo revalidate, payment, regression.  

**Offers:** public URL, crawler HTML, metadata, active/expired, guest browse, server eligibility, deep link; ecommerce offer → product links.  

**SEO:** collision safety (`/locations/...`, `/offers/...`, `/shop/p/...`, `/shop/c/...`), HTML, canonical, sitemap chunking, robots, noindex private/cart/checkout.  

**Ecommerce:** guest PDP/category browse; add to cart; checkout login; server revalidate price/stock/promo; `cart_abandoned` only per §18.4.  

**Mobile:** Android/iOS foreground permission, deep links for offers/locations/vendor/shop SEO paths.

**Admin CI:** online threshold; inactive 30+; journey stitch; map viewport/cluster; RBAC on precise location; no full-table geo dump.

---

## 34. Acceptance Criteria

### Guest

- Given no JWT and `GUEST_BROWSING_ENABLED`, When app opens, Then browse without login.  
- Given location allow, Then LocationContext GPS drives discovery.  
- Given deny, When manual pincode/city entered, Then discovery works without login.

### Foreground location

- Given app active, When GPS updates and move ≥ threshold (or stale), Then discovery may refresh after debounce.  
- Given app backgrounded, Then no continuous tracking / no discovery spam.  
- Given resume + stale location, Then one-shot refresh allowed.

### Analytics

- Given guest, Then events have anonymous_id + session_id and actor_id null.  
- Given forged client actor_id, Then server ignores; actor_id remains null without JWT.  
- Given login, Then server sets actor_id from JWT; `identity_authenticated` recorded.  
- Given prior guest session, Then journey reconstructable via anonymous_id/session_id.  
- Given booking_started then leave past window, Then single `booking_abandoned`.

### Discovery / booking / offers / SEO / mobile

As in §33 matrix; payment unchanged and server-authorized; crawler gets offer HTML without login/GPS; `/bangalore/vet` is **not** used as SEO pattern; `/locations/bangalore/vet` is.

### Product SEO

- Public `/shop/p/{slug}` returns crawlable HTML with title/description.  
- Canonical correct; discoverable via sitemap/internal links.  
- No login to view; hydrates live price/stock.  
- Variants do not create duplicate indexable URLs.

### Category SEO

- Public `/shop/c/{slug}` crawlable; products internally linked.  
- Thin/empty categories not indexed / not in sitemap.

### Ecommerce offer SEO

- Public ecommerce offer crawlable under `/offers/{slug}`; links to eligible products/categories.  
- Removed from sitemap when not public/active; expired does not claim active discount.  
- Private/customer-specific offers never indexable.

### Ecommerce commerce boundary

- Guest browse + add to cart where supported; checkout requires login.  
- Price, inventory, promotion revalidated server-side at order/payment.

### Ecommerce analytics

- product_viewed / add-to-cart / checkout / purchase tracked; `cart_abandoned` only per defined rule; pre-login journey stitchable after `identity_authenticated`.

### Admin Customer Intelligence

See **§44** (online, behaviour, inactive, geo, privacy) + ecommerce timeline events in §41.4 / §47.13.

---

## 35. Rollback Strategy

- Disable flags independently (`GUEST_BOOKING` first if payment risk; `ADMIN_CUSTOMER_INTELLIGENCE_ENABLED` for Admin CI).  
- Keep analytics actor derivation (security fix — do not rollback).  
- Public routes can stay with rate limits or env-disable registration.  
- SEO: `noindex` / flag off without deleting URLs.  
- Presence table: stop writes; Admin CI flag off (table can remain empty).  
- No destructive DB rollback for v1.

---

## 36. File-by-File Implementation Plan

### Backend

```text
File: backend/lambda/src/endpoints/product-analytics/service-ingest.ts
Current: Uses body.actor_id / ev.actor_id directly
Change: Accept serverActorId only; ignore client actor_id
Reason: Mandatory security
Dependencies: routes.ts JWT resolve
Risk: High (authZ analytics)
Tests: spoof actor_id rejected/ignored; JWT sets correct customer.id
Rollback: N/A for security — fix forward
```

```text
File: backend/lambda/src/endpoints/product-analytics/routes.ts
Current: Ingest trusts parsed body; comment says public
Change: Optional JWT parse; derive customer id; pass to ingest; keep rateLimit
Reason: Server-derived actor_id
Dependencies: jwt-verification / customer id helpers
Risk: Medium
Tests: with/without Bearer
Rollback: keep ignore-client behavior
```

```text
File: backend/lambda/src/middleware/auth-middleware.ts
Current: analytics not public
Change: Allowlist POST /analytics/v1/events; ensure /public/* remains; do not require auth for allowlisted ingest
Reason: Guest analytics
Dependencies: rateLimit on route
Risk: Medium (abuse)
Tests: unauth 200; spoof actor ignored
Rollback: remove allowlist (breaks guest analytics)
```

```text
File: discovery parse services (discover-services, by-style, search coords, pay nearby)
Current: phone fallback
Change: guestMode requires lat/lng
Reason: Identity≠location
Dependencies: public routes
Risk: Low
Tests: unit guestMode
Rollback: remove public routes
```

```text
File: public discovery/slots/pay-nearby/offers routes (CREATE under discovery + promotions modules)
Current: N/A / auth-only
Change: Thin public wrappers + sanitizers + rate limits
Reason: Guest UX + offer SEO data
Dependencies: discount tables read models; sanitize helpers
Risk: Medium–High (slots/offers)
Tests: PII scan; contract tests
Rollback: unregister / env flag
```

```text
File: discount-engine / booking-promotion-service (USE, don’t fork)
Current: Server eligibility
Change: Ensure booking path always re-resolves; public offer API is read-only marketing
Reason: No second engine
Risk: Low if reuse
Tests: calculate-booking parity
Rollback: N/A
```

### Frontend

```text
File: apps/customer-web/app/auth/page.tsx + vendor-profile-share.ts + BannerVendorDeepLinkClient.tsx
Current: next vs redirect bug; persona auth wall
Change: unify redirect; guest browse when flags on
Reason: Restore + guest entry
Risk: Medium–High
Tests: restore e2e
Rollback: flags off
```

```text
File: apps/customer-web/app/page.tsx + providers.tsx
Current: auth wall; no LocationProvider
Change: guest home; LocationProvider
Reason: M1 foundation
Risk: High
Tests: guest home smoke
Rollback: GUEST_BROWSING off
```

```text
File: context/LocationContext.tsx (CREATE) + LocationPermission refactor + ManualLocationSheet (CREATE)
Current: fragmented geo
Change: unified foreground lifecycle + thresholds
Reason: Shared location
Risk: Medium
Tests: unit thresholds; deny→manual
Rollback: flag off
```

```text
File: lib/anonymous-id.ts (CREATE) + allyticas-ingest.ts + analytics.ts
Current: client actor_id; sessionStorage session; ingest gaps
Change: anonymous_id; stop sending actor_id; identity_authenticated; booking_abandoned helpers; coarse location only
Reason: Analytics security + funnel
Risk: Medium
Tests: payload shape; no lat/lng in events
Rollback: GUEST_ANALYTICS off
```

```text
File: discovery/pay hooks + api-client 401 guest behavior
Current: /customer + phone; 401→logout
Change: /public when guest; no logout loop without Bearer
Risk: Medium
Tests: network assertions
Rollback: GUEST_DISCOVERY off
```

```text
File: guest-journey-snapshot.ts (CREATE) + booking routers + checkout
Current: memory state; mixed gates
Change: intent snapshot; gates behind GUEST_BOOKING_ENABLED; revalidate slot/price/promo
Risk: High
Tests: staging pay path
Rollback: GUEST_BOOKING off
```

```text
File: app/offers/page.tsx + app/offers/[slug]/page.tsx (CREATE)
File: app/locations/[city]/[category]/page.tsx (CREATE)
Current: no SEO offers/locations
Change: static-export HTML + metadata; client islands for live discovery
Reason: SEO + offers
Risk: Medium
Tests: curl HTML; collision URLs
Rollback: SEO flag / noindex
```

```text
File: app/shop/p/[slug]/page.tsx + app/shop/c/[slug]/page.tsx (CREATE)
File: shop/[productId] (EXISTING UUID PDP)
Current: client-only UUID PDP; placeholder generateStaticParams; no product metadata
Change: allowlisted static HTML for slug routes; UUID route canonical→slug; hydrate live catalogue
Reason: Ecommerce SEO under collision-safe /shop
Risk: Medium (catalogue scale / static export)
Tests: curl HTML; slug uniqueness; noindex drafts
Rollback: ECOMMERCE_SEO_ENABLED off / noindex
```

```text
File: app/promotions/page.tsx
Current: in-app offers list
Change: keep; ensure noindex; do not use as SEO canonical
Risk: Low
```

```text
File: sitemap / robots generation (CREATE under customer-web or build script)
Current: none
Change: include locations, offers, shop/p, shop/c; chunk product sitemaps; exclude cart/checkout
Reason: Search discovery
Risk: Medium (scale)
```

### Capacitor / Infra / DB

- Android/iOS location: **NONE**  
- Deep link well-known: **OPTIONAL**  
- Infra: existing deploy scripts only  
- DB migrations: **NONE** required for guest v1; **RECOMMENDED** `customer_presence_state` for Admin geo (M7)

### Admin Customer Intelligence (M7 — after analytics)

```text
File: apps/admin-web/components/admin/AdminCustomerManagement.tsx
Current: Existing customer hub tabs
Change: Add Online / Behaviour / Inactive / Geo tabs when ADMIN_CUSTOMER_INTELLIGENCE_ENABLED
Reason: Extend, do not duplicate
Risk: Medium
Tests: nav + tab smoke
Rollback: flag off
```

```text
File: backend/lambda/src/endpoints/admin/endpoints/admin-customer-endpoints.ts (+ CI routes)
Current: list/details/insights/activities; no journey/geo/online
Change: Extend details with last_login; add intelligence overview/online/inactive/geo/journey
Reason: Manager requirements
Risk: High (PII/perf)
Tests: viewport geo; inactive SQL; journey stitch
Rollback: flag / unregister routes
```

```text
File: db/migrations/{NNN}_customer_presence_state.sql (CREATE if approved)
Current: N/A
Change: customer_presence_state table + indexes
Reason: Online-by-location map without polluting analytics
Risk: Medium
Tests: upsert + online query
Rollback: stop writes; drop only if never prod-used
```

```text
File: apps/admin-web map component (CREATE) + Online/Journey/Inactive/Geo tabs (CREATE)
Current: No customer map
Change: First Admin map viz + CI UIs
Reason: Geo analysis requirement
Risk: Medium
Tests: cluster/zoom/RBAC
Rollback: hide tabs
```

---

## 37. Open Decisions

1. Strict 400 vs silent ignore when client sends `actor_id` unauthenticated.  
2. Public slots in Milestone 2 vs 2b (`PUBLIC_SLOTS_ENABLED`).  
3. Slug source for platform `promotions` without slug (derive vs migrate column vs campaigns-only SEO).  
4. City-scoped offer URLs yes/no (duplicate content policy).  
5. Offer JSON-LD type approval (legal/marketing).  
6. Pay hub nearby ranking.  
7. `ABANDON_WINDOW_MS` exact value.  
8. UX when `GUEST_DISCOVERY` on but `GUEST_BOOKING` off.  
9. RN `WarmpawzCustomer` out of scope? (recommend yes).  
10. OPTIONAL analytics_anonymous_links table later.  
11. **Admin:** Approve `customer_presence_state` migration vs derive-only online roster.  
12. **Admin:** Map shows authenticated customers only vs guests too.  
13. **Admin:** New RBAC `admin.customers.location` vs all `admin.customers`.  
14. **Admin:** ONLINE threshold (e.g. 5 min) and whether to add foreground heartbeat.  
15. **Admin:** Map SDK (Google Maps JS vs MapLibre).  
16. **Admin:** Retention for precise last-known location.  
17. **Ecommerce:** Approve `products.slug` + `ecommerce_categories.slug` migrations (additive).  
18. **Ecommerce:** UUID PDP permanent redirect vs soft canonical-only.  
19. **Ecommerce:** Product JSON-LD (Offer/Product) legal/marketing approval.  
20. **Ecommerce:** Whether brand storefront entity is ever warranted (post-v1).  
21. **Ecommerce:** `CART_ABANDON_WINDOW_MS` exact value (default align with booking).  
22. **Ecommerce:** Max products in build-time allowlist / sitemap chunk size.

---

## 38. Final Change Summary

```text
Files to modify:
  Backend: auth-middleware.ts; product-analytics/routes.ts; product-analytics/service-ingest.ts;
           discovery parse files; warmpawz-pay nearby; promotions public read;
           ecommerce product/category public read wrappers; slug resolve on product detail;
           admin-customer-endpoints.ts (extend list/detail); optional new CI handlers
  Frontend customer-web: auth, LocationContext, guest discovery/booking, SEO pages,
           shop slug routes + analytics ecommerce events, analytics client
  Frontend admin-web: AdminCustomerManagement.tsx; ActiveCustomersTab; CustomerDetailsModal;
           CustomerInsightsDashboard; admin-portal-nav.ts (optional child);
           NEW CI tabs + map component (journey includes ecommerce events)
  SEO/deep-link optional: well-known association files

Files to create:
  customer-web: LocationContext; anonymous-id; guest-journey-snapshot; ManualLocationSheet;
            public discovery/slots/pay/offers routes; /locations/*; /offers/*;
            /shop/p/[slug]; /shop/c/[slug]; robots; sitemap (+ product chunks)
  admin-web: OnlineCustomersTab; CustomerJourneyTimeline; InactiveCustomersSegment;
            CustomerGeoMap; customer intelligence API client hooks
  backend: public routes; presence upsert service; CI overview/online/inactive/geo/journey routes
  db: OPTIONAL/RECOMMENDED customer_presence_state (Admin geo);
      RECOMMENDED additive products.slug + ecommerce_categories.slug for ecommerce SEO

Files to delete:
  NONE

Backend changes: YES (guest public APIs + ecommerce public catalogue read + Admin CI + presence)
Frontend changes: YES (customer-web guest + shop SEO + admin-web CI)
Analytics changes: YES (server actor_id, identity_authenticated, booking_abandoned, cart_abandoned, product_* events; optional heartbeat)
Database changes: NONE required for guest discovery v1; RECOMMENDED presence table for Admin geo;
                  RECOMMENDED slug columns for ecommerce SEO (additive)
Capacitor Android changes: NONE (location); OPTIONAL App Links metadata (+ /shop SEO paths)
Capacitor iOS changes: NONE (location); OPTIONAL AASA metadata (+ /shop SEO paths)
Infrastructure changes: NONE (required)
SEO changes: YES (locations + offers + ecommerce under /shop)
Promotion changes: YES (public read/SEO only; ecommerce eligibility summaries; no second engine)
Admin changes: YES (extend Customer Administration; first map viz; ecommerce in journey)
Ecommerce engine changes: NONE REQUIRED (reuse catalogue + cart + discount-engine)

New packages: NONE for customer-web; Admin map SDK TBD (Google/MapLibre) — OPEN DECISION
New migrations: NONE required for guest discovery; RECOMMENDED presence + product/category slug columns
New feature flags:
  GUEST_BROWSING_ENABLED
  GUEST_LOCATION_ENABLED
  GUEST_DISCOVERY_ENABLED
  GUEST_ANALYTICS_ENABLED
  GUEST_BOOKING_ENABLED
  SEO_PUBLIC_PAGES_ENABLED
  ECOMMERCE_SEO_ENABLED
  ADMIN_CUSTOMER_INTELLIGENCE_ENABLED

Highest-risk changes:
  1) Server-side actor_id enforcement
  2) Guest home auth wall removal
  3) GUEST_BOOKING + payment/promo revalidation
  4) Public slots + public offers exposure
  5) SEO routing (mitigated by /locations + /offers + /shop/p|/shop/c)
  6) Admin precise location RBAC + presence table
  7) Online definition / foreground-only writes
  8) Ecommerce static-export scale + stale price/stock UX

Open decisions: see §37 and §45 and §48

Recommended implementation order:
  M1 Foundation (identity, LocationContext, guest home)
  M2 Guest discovery + public slots
  M3 Guest booking boundary + pay
  M4 Analytics funnel + booking_abandoned (+ ecommerce funnel events)
  M5 SEO /locations + /offers
  M5b Ecommerce SEO /shop/p + /shop/c (+ slugs + public catalogue read)
  M6 Deep links + device QA
  M7 Admin Customer Intelligence (after M1+M4 + presence state)
```

---

## 39. Workstreams & Developer Ownership

### 39.1 Workstreams

| # | Workstream | Depends on |
|---|------------|------------|
| 1 | Guest Entry & Location | — |
| 2 | Guest Discovery | 1 |
| 3 | Guest Booking & Authentication | 1–2 |
| 4 | Analytics & Journey Tracking | 1 (identity); benefits from 2–3 |
| 5 | **SEO + Offers + E-commerce SEO** | Public APIs from 2; promo read models; catalogue/slug readiness |
| 6 | Mobile & Deep Linking | Routes from 1–5 |
| 7 | **Admin Customer Intelligence & Geo Analytics** | **4 + 1 (presence/location state)** |

Workstream 5 explicitly includes:

```text
Service SEO (/locations)
E-commerce SEO (/shop/p, /shop/c)
Public Offer SEO (/offers) — service + ecommerce landings
Product / category discovery pages
Brand discovery where supported (deferred — none in v1)
E-commerce offer landing pages (via /offers, not a second offer system)
```

Do **not** create an eighth developer workstream for ecommerce SEO.

```text
Guest Entry & Location
        ↓
Guest Discovery
        ↓
Guest Booking
        ↓
Analytics & Journey Tracking
        ↓
Admin Customer Intelligence
```

SEO (5) and Mobile (6) can proceed in parallel once dependencies exist.

### 39.2 Three-developer split `[RECOMMENDATION]`

| Dev | Owns |
|-----|------|
| **Developer 1** | Guest Experience + Location + Capacitor |
| **Developer 2** | Backend + Discovery + Booking + Promotion validation |
| **Developer 3** | Analytics + SEO + Offers + **E-commerce SEO** + **Admin Customer Intelligence** (blocked until M1/M4 identity/events ready; ecommerce SEO also needs slug/catalogue public read from Dev2) |

---

## 40. Admin Existing Capability Audit

**Rule:** extend existing Admin; do not duplicate Customer Administration.

### 40.1 Feature audit

```text
Feature: Customer Administration hub
Existing file/path: apps/admin-web/app/customers/page.tsx → AdminCustomerManagement.tsx
Current capability: Overview / Active / Deactivated / Insights / Deactivation / Compliance; /admin/customers/stats
Can it be reused?: YES — primary shell
Can it be extended?: YES — Intelligence tabs
Missing capability: online, journey, geo map, last_login UI, last_active
Recommended change: Extend hub under admin.customers
```

```text
Feature: Active / deactivated lists
Existing file/path: ActiveCustomersTab.tsx, DeactivatedCustomersTab.tsx; GET /admin/customers/active|deactivated
Current capability: Search; city filter; details modal; deactivate; portal session
Can it be reused?: YES
Can it be extended?: YES — last_login / online columns; inactive filters
Missing capability: last_login not displayed; no geo
Recommended change: Extend DTOs + Inactive segment
```

```text
Feature: Customer details modal
Existing file/path: CustomerDetailsModal.tsx; GET /admin/customers/:id/details
Current capability: Profile lite
Can it be reused?: PARTIAL
Can it be extended?: YES → Customer 360
Missing capability: journey, bookings, payments, location, last_login
Recommended change: Expanded detail page/drawer
```

```text
Feature: Customer activity tracker
Existing file/path: CustomerActivityTracker.tsx; GET /admin/customers/activities
Current capability: Recent bookings/payments feed (7d), 30s poll
Can it be reused?: YES pattern
Can it be extended?: Limited
Missing capability: Allyticas journey; presence
Recommended change: Keep for ops; journey uses analytics_events
```

```text
Feature: Customer insights
Existing file/path: CustomerInsightsDashboard.tsx; GET /admin/customers/insights
Current capability: Aggregate booking/cancel/city trends
Can it be reused?: YES for Overview KPIs
Can it be extended?: YES — online/inactive/funnel KPIs
Missing capability: behavioural cohorts
Recommended change: Extend Overview
```

```text
Feature: Product analytics (Allyticas)
Existing file/path: apps/admin-web/app/product-analytics/page.tsx; product-analytics/routes.ts
Current capability: summary, events, funnel, flows, search, retention
Can it be reused?: YES — event store
Can it be extended?: YES — deep-link by actor_id from customer detail
Missing capability: customer 360; online; geo map
Recommended change: Reuse queries; CI is customer-centric UX
```

```text
Feature: Platform Analytics
Existing file/path: apps/admin-web/app/analytics/page.tsx
Current capability: KPIs, customer report cards, peak/funnel
Can it be reused?: YES cross-link
Missing capability: map / online roster
Recommended change: Link to CI; do not duplicate journey UI
```

```text
Feature: Support CRM context
Existing file/path: apps/admin-web/app/support + support/crm/*
Current capability: Ticket-linked identity
Can it be reused?: YES deep-link pattern
Recommended change: "Open Customer Intelligence" link
```

```text
Feature: Notification segments
Existing file/path: notification-engine; /admin/notifications/segments
Current capability: Push targeting by city/segment
Can it be reused?: YES later for inactive export
Recommended change: Optional after Inactive report
```

```text
Feature: Admin map visualization
Existing file/path: Maps API key / Places autocomplete only; no Leaflet/Mapbox in admin-web
Current capability: Address entry
Can it be reused?: Google key infra only
Missing capability: interactive customer map
Recommended change: NEW map component (first in admin-web)
```

```text
Feature: customers.last_login_at
Existing file/path: 001_initial_schema; auth-enhanced updates
Current capability: Column exists; Admin UI unused
Can it be reused?: YES for 30+ day segment
Recommended change: Expose in list/detail/inactive APIs
```

```text
Feature: customers.latitude/longitude
Existing file/path: 1005_customers_latitude_longitude.sql; profile write
Current capability: Profile/Places address — NOT live presence
Can it be reused?: Fallback pin only
Missing capability: last_location_at, live GPS, accuracy
Recommended change: Operational presence state (§42)
```

```text
Feature: Customer online / heartbeat
Existing file/path: None for customers
Current capability: N/A
Can it be reused?: NO
Recommended change: NEW presence pipeline (§42)
```

```text
Feature: RBAC
Existing file/path: admin.customers, admin.analytics; requireAdminAuth
Current capability: Coarse gates
Can it be reused?: YES baseline
Missing capability: precise location vs behaviour split
Recommended change: OPEN DECISION for admin.customers.location
```

---

## 41. Admin Customer Intelligence & Geo Analytics

### 41.1 Integration point `[RECOMMENDATION]`

Extend **Customer Administration** (`/customers`):

```text
Customer Administration
├── Overview (extend Insights + CI KPIs)
├── Active / Deactivated (existing)
├── Online Customers (NEW)
├── Customer Behaviour (NEW)
├── Inactive 30+ Days (NEW)
├── Geo Analysis (NEW map)
├── Insights / Fraud / Compliance (existing)
└── Customer Detail (expand modal)
```

Product analytics remains platform-wide; CI deep-links into it.

### 41.2 Overview KPIs (only if reliable)

Customers Online; Recently Active; Inactive 30+; Bookings Started/Abandoned/Completed; Payment Started/Failed — sourced from presence + Allyticas + bookings.

### 41.3 Online by location

```text
Online → City → Locality → Individuals
```

Filters: city, online, last-active window, platform. Click → detail.

**ONLINE** = qualifying activity within configurable window — **not** “has location”.

### 41.4 Journey timeline

Ordered Allyticas events (taxonomy §17) for actor_id + stitched anonymous sessions.  
Badges: OBSERVED / INFERRED / CONFIRMED. Pre-login visible after `identity_authenticated`.

Timeline must combine **Services + Ecommerce + Offers**, e.g.:

```text
CUSTOMER 123
09:01  offer_viewed (SEO /offers/…)
09:02  product_category_viewed
09:03  product_viewed (Royal Canin)
09:04  product_variant_selected
09:04  product_added_to_cart
09:07  checkout_started (ecommerce)
09:08  login_completed / identity_authenticated
09:09  promotion validated (server — may appear as checkout/payment props)
09:10  payment_completed / purchase_completed
```

or:

```text
product_viewed → product_added_to_cart → checkout_started → left → cart_abandoned
```

Do **not** create a second analytics system — Allyticas only.

### 41.5 Inactive 30+ days

```text
created_at exists
AND (last_login_at IS NULL OR last_login_at <= now() - 30 days)
```

`[CONFIRMED FROM CODE]` `last_login_at` exists. Filters: 30+/60+/90+/Never logged in.  
Keep **last login** ≠ **last activity**.

### 41.6 Geo map

Zoomed out clusters → zoom markers → select summary (status, last active, last location time, last action).  
Viewport queries only; RBAC on precise coords.

### 41.7 Customer detail

Identity, location (if permitted), behaviour timeline, commercial (bookings/payments/offers).

---

## 42. Admin Online / Last-Active / Location State Model

### 42.1 Status vocabulary `[MANDATORY]`

| Status | Definition |
|--------|------------|
| ONLINE | Qualifying activity ≥ now − ONLINE_THRESHOLD |
| RECENTLY ACTIVE | Within RECENT window but not ONLINE |
| OFFLINE | Outside RECENT window |
| LOCATION STALE | Coords older than LOCATION_STALE_ADMIN |
| LOCATION UNKNOWN | No operational coords |

### 42.2 Thresholds `[RECOMMENDATION]` (configurable)

| Constant | Default |
|----------|---------|
| ONLINE_THRESHOLD_MS | ~5 minutes |
| RECENTLY_ACTIVE_MS | ~24 hours |
| LOCATION_STALE_ADMIN_MS | ~30–60 minutes |

**Qualifying activity:** app_opened, page_viewed, search_performed, vendor_viewed, service_viewed, slot_viewed/selected, booking_started, checkout_started, payment_started, login_completed, product_viewed, product_added_to_cart, cart_viewed, purchase_completed (+ optional foreground heartbeat).

### 42.3 Heartbeat / lifecycle

Optional foreground `presence_heartbeat` every 2–3 min if page_view cadence insufficient.  
**Stop** on background / hidden tab. No Android/iOS background location.

### 42.4 Separate clocks

`last_active_at` ≠ `last_location_at` (both can differ).

### 42.5 Data model classification

| Need | Classification |
|------|----------------|
| Signup / last_login / bookings / payments / Allyticas events | **SUPPORTED BY EXISTING DATA** |
| Profile lat/lng | **EXISTING but wrong semantics for live map** |
| Performant online-by-location map | **REQUIRES NEW DATA MODEL** → `customer_presence_state` recommended |
| Online roster without pins | EXTEND/derive from `analytics_sessions.last_seen_at` possible |

**Do not** store precise GPS on every analytics event for Admin.

Recommended table sketch:

```text
customer_presence_state (
  customer_id PK,
  last_active_at,
  last_location_at NULL,
  latitude NULL, longitude NULL, accuracy_m NULL,
  city NULL, pincode NULL, locality NULL,
  platform NULL, updated_at
)
```

Indexes on `last_active_at`; viewport/geo strategy TBD.  
**OPEN DECISION:** authenticated-only on map (recommended) vs anonymous presence.

**Verdict:** NEW TABLE REQUIRED for Admin geo+online pins; NONE REQUIRED for guest discovery itself.

---

## 43. Admin APIs, Performance & RBAC

### 43.1 Conceptual APIs (adapt to existing `/admin/customers/*` style)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/admin/customers/intelligence/overview` | KPIs |
| GET | `/admin/customers/intelligence/online` | Online list / city rolls |
| GET | `/admin/customers/intelligence/inactive` | 30/60/90/never |
| GET | `/admin/customers/intelligence/geo` | bbox + zoom + filters |
| GET | `/admin/customers/:id/journey` | Timeline |
| GET | `/admin/customers/:id/intelligence` | Detail aggregate |

Auth: `requireAdminAuth` + RBAC; pagination; rate limits; audit precise location reads.

### 43.2 Performance `[MANDATORY]`

No full `analytics_events` scan per page load. Cache overview. Indexed presence for online. Geo = viewport + server clustering. Journey paginated.

### 43.3 Privacy / RBAC `[MANDATORY]`

Minimize PII; restrict precise lat/lng; audit sensitive access; retention policy for presence coords. Reuse `admin.customers` / `admin.analytics` unless management approves finer permissions.

---

## 44. Admin Acceptance Criteria

### Online

- Activity within threshold → ONLINE.  
- Past threshold → not ONLINE.  
- GPS without activity → not ONLINE.  
- Old `last_location_at` → LOCATION STALE independently.

### Behaviour

- Stitched pre-login + post-login ordered timeline.  
- `booking_abandoned` visible with stage.  
- Inferred never shown as fact.

### Inactive

- 30+ day / never-logged-in filters correct.  
- Last login vs last active separated.

### Geo

- Clusters then markers; filters work; viewport-limited; marker opens permitted detail.

### Privacy

- Unauthorized Admin cannot fetch precise coords; access auditable.

---

## 45. Management Summary — Admin Intelligence

1. **What exists:** Customer Admin hub, lists, insights, activity feed, product analytics, platform analytics, CRM context, notification segments, `last_login_at`, profile lat/lng.  
2. **Reusable:** `/customers` shell, `/admin/customers/*`, Allyticas store, insights KPIs, `last_login_at`, deep-links.  
3. **Must extend:** DTOs for last_login/status; Overview KPIs; detail→journey; inactive filters; RBAC.  
4. **Genuinely new:** Presence pipeline, geo map UI/API, CI tabs, journey timeline UX, recommended `customer_presence_state`.  
5. **New location model?** **YES recommended** for online-by-location map; **NOT** via analytics GPS on every event; profile lat/lng insufficient.  
6. **New Admin dashboard?** **NO duplicate**; **YES** new tabs inside Customer Administration + first map component.  
7. **Backend changes:** YES (presence + CI APIs).  
8. **Admin frontend changes:** YES.  
9. **Analytics changes:** YES (planned guest analytics + optional heartbeat; no precise GPS in events).  
10. **Database changes:** NONE for guest v1; **RECOMMENDED** presence table for Admin geo.  
11. **RBAC/security:** YES (location access + audit).  
12. **Open decisions:** §37 items 11–16.

Where no change: **NONE REQUIRED** (guest DB; Capacitor location permissions; second analytics store).

---

## 46. E-commerce Existing Capability Audit

**Rule:** extend existing Warmpawz shop catalogue, cart, promotions, and Admin ecommerce — do **not** invent a second ecommerce engine.

All rows below are `[CONFIRMED FROM CODE]` unless marked otherwise.

### 46.1 Feature audit matrix

```text
Feature: Shop PLP
Existing file/path: apps/customer-web/app/shop/page.tsx
Current capability: Client-rendered catalogue; category via ?category=; search/sort
Existing route: /shop
Existing API: GET /ecommerce/products, GET /ecommerce/categories
Existing database model: products, ecommerce_categories
Can it be reused?: YES
Can it be extended?: YES — SEO category path URLs; SSR/static metadata
Missing capability: crawlable category HTML; persisted category slug
Recommended change: Add /shop/c/{slug} SEO pages; keep /shop PLP
```

```text
Feature: Product detail (PDP)
Existing file/path: apps/customer-web/app/shop/[productId]/page.tsx + ProductDetailClient.tsx
Current capability: Client load by UUID; SKU variants; images/price
Existing route: /shop/{productId} (UUID)
Existing API: GET /ecommerce/products/:productId (UUID only)
Existing database model: products + product_skus
Can it be reused?: YES (UI + APIs)
Can it be extended?: YES — slug resolve + static HTML + metadata
Missing capability: products.slug; generateMetadata; real generateStaticParams
Recommended change: Canonical /shop/p/{slug}; UUID route redirects/canonicalizes
```

```text
Feature: Product slug
Existing file/path: N/A in schema
Current capability: NONE
Can it be reused?: NO
Classification: NEW DATA MODEL REQUIRED (additive column on products)
Recommended change: products.slug UNIQUE; public resolve by slug or UUID
```

```text
Feature: Category slug
Existing file/path: Admin CategoryManagement invents slug UI-side; PUT ignores slug
Current capability: Client-derived name slug for ?category=
Classification: EXTEND EXISTING TABLE (persist ecommerce_categories.slug)
Recommended change: Persist unique slug; SEO under /shop/c/{slug}
```

```text
Feature: Brand storefront
Existing file/path: products.brand TEXT; vendor_registered_brands (commission ownership)
Current capability: Display/filter text; own_brand vs third_party commission — NOT a brand CRM
Existing route: NONE
Existing API: NONE for brand list/detail
Classification: EXTEND EXISTING DATA (future) — NOT required for v1 indexable brand pages
Recommended change: v1 — brand as PDP metadata + search text only; NO /brands SEO
```

```text
Feature: Variants / SKUs
Existing file/path: db/migrations/1033_product_skus.sql; product-sku-client.ts
Current capability: One parent product → many product_skus (price/stock/options)
Classification: SUPPORTED BY EXISTING DATA
Recommended change: One canonical SEO URL per parent product; variants selectable on page
```

```text
Feature: Guest cart
Existing file/path: lib/warmpawz-cart-storage.ts → warmpawz_cart localStorage
Current capability: Guest add/remove without login; checkout requires phone
Existing route: /cart, /checkout
Existing API: POST /ecommerce/orders (auth/phone); optional /cart/:customerId after login
Can it be reused?: YES
Recommended change: NONE REQUIRED for guest DB cart; preserve localStorage + restore after login
```

```text
Feature: Ecommerce promotions
Existing file/path: ecommerce_admin_promotions; vendor_promotions; commercial_discount_campaigns;
                    discount-engine ecommerce adapters; Admin ecommerce promotions UI
Current capability: applicable_products / applicable_categories JSONB; listing_ownership_scope;
                    campaign surface marketing|ecommerce
Can it be reused?: YES — authoritative eligibility
Missing capability: Public offer SEO landing (planned in §20); brand-id targeting
Recommended change: Reuse resolver; expose safe eligible product/category summaries on /offers
```

```text
Feature: Admin ecommerce catalogue
Existing file/path: apps/admin-web/app/ecommerce/* (products, categories, promotions, campaigns)
Current capability: Approval, categories, promotions, commission, analytics
Can it be reused?: YES
Recommended change: Extend for slug persistence / offer publication flags — do NOT build second promo UI
```

```text
Feature: Sitemap / product metadata
Existing file/path: NONE under customer-web for shop
Current capability: Root layout generic metadata only
Recommended change: Build-time HTML + sitemap chunks under ECOMMERCE_SEO_ENABLED
```

### 46.2 Indexable content classes that actually exist

```text
E-commerce
├── Product categories          → YES (ecommerce_categories)
├── Product detail pages        → YES (products + UUID PDP today)
├── Brands                      → NO first-class storefront model (TEXT only)
├── Products / variants         → YES (parent product + product_skus)
└── Public ecommerce offers     → YES via promotions/campaigns (SEO via /offers)
```

Do **not** invent brand SEO pages in v1.

---

## 47. E-commerce SEO & Product Discovery

### 47.1 Goals

```text
Google
  ↓
Warmpawz product / category / public offer page
  ↓
Guest
  ↓
Product detail
  ↓
Add to cart
  ↓
Checkout
  ↓
LOGIN
  ↓
Server revalidate price / stock / promotion
  ↓
Payment
  ↓
Order
```

### 47.2 Product detail SEO

Public crawlable fields (when present and public): name, description, images, brand text, category, public price snapshot, availability snapshot, variant options, attributes, public offer badges, shipping/delivery copy if already public, related products, internal links.

**Do not expose:** customer-specific pricing, private promotions, private inventory ledgers, PII, account data.

Reviews/ratings: include in SEO/structured data **only if** existing legitimate review data is shown on the page — never invent ratings. `[OPEN DECISION]` structured data approval (§37.19).

### 47.3 Product URL strategy `[MANDATORY]`

| Pattern | Verdict |
|---------|---------|
| `/products/{slug}` | Collision-safe as static `products`, but **duplicates** shop — **reject v1** |
| `/shop/{slug}` | Conflicts with existing UUID `[productId]` semantics — **unsafe as sole pattern** |
| **`/shop/p/{product-slug}`** | **Recommended canonical** — literal `p` under existing `/shop` |
| `/shop/{productId}` UUID | Keep for Capacitor/deep links; **301 or rel=canonical** → `/shop/p/{slug}` |

Requirements: stable, human-readable, crawlable, collision-safe, static-export compatible, Capacitor deep-link compatible.

### 47.4 Category SEO

Canonical: **`/shop/c/{category-slug}`**.

Contents: title, useful description, product listings with internal links, subcategories where `parent_category_id` exists, public offers, metadata, canonical.

Index only categories with meaningful content + sufficient active inventory + stable taxonomy. Do **not** generate thousands of thin pages.

Search intent examples: “dog food online”, “cat food online”, “pet toys” — **global** category pages; not city duplicates by default (§47.12).

### 47.5 Brand SEO

| Question | Answer |
|----------|--------|
| First-class brand model? | **No** — `products.brand` TEXT + vendor brand registry |
| `/brands/{brand}` in v1? | **NONE REQUIRED** |
| Classification | **EXTEND EXISTING DATA** if/when product later approves a normalized brands table |
| Indexable brand pages | **Not in v1** |

Brand string may appear on PDP metadata and filters; do not invent Royal Canin brand landings until a real brand entity + unique content exists.

### 47.6 Product variants & canonicalization `[MANDATORY]`

```text
One product (parent)
 ├── SKU 4kg
 ├── SKU 8kg
 └── SKU 10kg
```

→ **one canonical URL** `/shop/p/{product-slug}`; variants selectable on page (`product_variant_selected`).

Do **not** create SEO URLs per SKU. Do **not** treat SKUs as separate products unless product ops explicitly splits catalogue rows (rare) — document exception case-by-case to avoid duplicate content.

### 47.7 Ecommerce offer SEO (extends §19–§20 — do not replace)

Keep `/offers` and `/offers/{slug}`.

Ecommerce examples: “20% OFF Royal Canin”, “15% OFF Dog Toys”, “Buy 2 Get 1 Treats”.

Resolution via **existing** eligibility:

```text
Offer
 ├── eligible products (applicable_products)
 ├── eligible categories (applicable_categories)
 ├── listing ownership scope (own_brand / third_party) — not brand slug CRM
 └── campaign surface = ecommerce
```

Landing must link to public `/shop/p/...` and `/shop/c/...` where possible.

### 47.8 Indexable vs not indexable promotions

**INDEXABLE:** public campaign, public ecommerce promotion, public seasonal campaign, public product offer (published + active + public surface).

**NOT INDEXABLE:** customer-specific / VIP / private / internal / draft / cancelled / audience-only / personalized discounts.

Never create `/offers/customer123` or private coupon URLs.

### 47.9 Price / inventory authority

```text
SEO HTML may show price/availability snapshot
  ↓
Checkout / order create
  ↓
Server: current price → inventory → variant → promotion → delivery eligibility
  ↓
Final payable amount
```

**Stale handling `[RECOMMENDATION]`:** on hydrate and before pay, refetch public/live product; if stock insufficient or price changed, block or reprice with clear UX — never claim SEO HTML guarantees stock.

### 47.10 Guest ecommerce journey & login boundary

Login **not** required for: product/category browse, search, public offers, PDP, add to cart (existing localStorage).

Login **required** at checkout/order/payment boundary (existing).

```text
Google → /shop/p/... → Guest → (LocationContext if delivery needs it)
  → Add to cart → Continue browsing → Checkout → LOGIN
  → Restore cart → Revalidate product/stock/promo → Payment → Order
```

No background GPS. Location-aware delivery is application behaviour, not a reason to duplicate canonical URLs per city.

### 47.11 Rendering / hydration

Same as §23: build allowlisted static HTML → S3/CloudFront → hydrate live catalogue. Crawl time must not depend on JWT/GPS/phone.

### 47.12 Location + ecommerce

Default: **global** product/category canonical URLs.

Only create city-specific ecommerce SEO if content/catalogue differ materially, inventory/content sufficient, real search intent, and duplicate content controlled. **Do not** mass-generate `/products/{city}/dog-food`.

### 47.13 Analytics & Admin CI

Events: §17 (`product_*`, `cart_*`, `purchase_completed`, `cart_abandoned`).  
Admin journey: §41.4. Reuse Allyticas + `anonymous_id` / `session_id` / `identity_authenticated` / server `actor_id`.

### 47.14 Internal linking graph

```text
Home → /shop → /shop/c/{category} → /shop/p/{product}
                              ↘ brand text (metadata only in v1)
                              ↘ /offers/{slug} → eligible products
Product → related products → category → offers
```

### 47.15 Feature flag

**`ECOMMERCE_SEO_ENABLED`** — independently controllable from `GUEST_BOOKING_ENABLED` and from service `SEO_PUBLIC_PAGES_ENABLED` (see §31).

### 47.16 Acceptance criteria

Covered in §34 (Product / Category / Ecommerce offer / Commerce / Analytics / Admin). Summary:

| Area | Pass when |
|------|-----------|
| Product SEO | Crawlable HTML, meta, canonical, sitemap/links, no login, hydrates |
| Category SEO | Crawlable; products linked; thin not indexed |
| Offer SEO | Crawlable; links to products/categories; sitemap/expiry rules; private never indexed |
| Commerce | Guest browse/cart; login at checkout; server price/stock/promo |
| Analytics | product/cart/checkout/purchase; abandon only by rule; stitch after login |
| Admin | Ecommerce events in journey; observed ≠ inferred |

### 47.17 Final journey validation (must hold with prior plan)

```text
Google → Service SEO → Guest → Location → Discovery → Booking → Login → Payment
Google → Product SEO → Guest → Product → Cart → Checkout → Login → Payment → Order
Google → Public Offer SEO → Service OR Product → Guest → Booking/Cart → Login
        → Server promotion validation → Payment
All three → anonymous/session analytics → identity_authenticated → actor_id from JWT
        → Admin Customer Intelligence
```

Consistent with: foreground-only location; server `actor_id`; anon stitching; `booking_abandoned` + `cart_abandoned`; `GUEST_BOOKING_ENABLED`; `/locations/...`; `/offers/...`; static export; unified discount resolver; Allyticas; Admin Customer Administration.

---

## 48. E-COMMERCE SEO ADDITION SUMMARY

| # | Item | Result |
|---|------|--------|
| 1 | Existing ecommerce routes discovered | `/shop`, `/shop/[productId]` (UUID), `/cart`, `/checkout`, `/checkout/success`, `/wishlist`, `/promotions` (auth UI). No `/products`, `/brands`, `/offers` app routes today. |
| 2 | Existing ecommerce APIs discovered | `GET /ecommerce/products`, `GET /products/:productId` (UUID), `GET /ecommerce/categories`, cart `/cart/:customerId`, `POST /ecommerce/orders`, reviews/recommendations; Admin `/admin/ecommerce/*`. **No** public slug API; **no** brand API. |
| 3 | Existing product schema discovered | `products` + `product_skus` + legacy variations; stock/price on product/SKU; images; status/active flags; `products.brand` TEXT. |
| 4 | Existing promotion/ecommerce promotion schema | `ecommerce_admin_promotions`, `vendor_promotions`, `commercial_discount_campaigns` (slug + surface), discount-engine ecommerce adapters; eligibility via products/categories/ownership — **reuse**. |
| 5 | Existing product/category/brand slugs | Product slug: **missing**. Category slug: **UI-only, not persisted**. Brand slug: **missing** (no brand entity). |
| 6 | Existing cart/checkout flow | Guest `warmpawz_cart` localStorage; checkout requires phone/login; server authoritative on order. **No DB guest cart required.** |
| 7 | Product SEO routes recommended | **`/shop/p/{product-slug}`** (+ UUID PDP canonicalizes). Not `/products/{slug}` in v1. |
| 8 | Category SEO routes recommended | **`/shop/c/{category-slug}`**. |
| 9 | Brand SEO routes recommended | **`NONE REQUIRED`** (v1). Future optional `/shop/b/{slug}` only after brand model. |
| 10 | Ecommerce offer SEO routes | **Reuse `/offers` + `/offers/{slug}`** — do not create a second offer namespace. |
| 11 | Sitemap changes | Add public `/shop/p/*`, `/shop/c/*`; chunk if large; keep offers/locations/vendors. |
| 12 | Robots/noindex changes | Allow indexable `/shop/p`, `/shop/c`; disallow `/cart`, `/checkout`, `/payment`, account; keep `/promotions` noindex. |
| 13 | Metadata/structured-data changes | Per-product/category title/description/canonical/OG; Product/Offer/BreadcrumbList only when accurate — **OPEN DECISION** for legal. |
| 14 | Analytics event additions | `product_category_viewed`, `product_viewed`, `product_variant_selected`, `product_search_performed`, `product_added_to_cart`, `product_removed_from_cart`, `cart_viewed`, `purchase_completed`, `cart_abandoned` (+ existing checkout/payment). |
| 15 | Admin Customer Intelligence additions | Ecommerce steps in journey timeline; stitch pre-login shop behaviour; no second analytics system. |
| 16 | Required backend changes | Public catalogue read wrappers; slug-or-UUID resolve; public offer eligible product summaries; **no** second discount engine. |
| 17 | Required frontend changes | Static SEO pages under `/shop/p` and `/shop/c`; metadata; hydrate live PDP; analytics events; UUID→canonical. |
| 18 | Required database changes | **RECOMMENDED:** `products.slug`, `ecommerce_categories.slug` (additive). Brand table: **NONE REQUIRED** v1. Guest cart table: **NONE REQUIRED**. |
| 19 | Required feature flags | **`ECOMMERCE_SEO_ENABLED`** (one scoped flag). Not three redundant ecommerce SEO flags. |
| 20 | Capacitor/deep-link changes | OPTIONAL path parity for `/shop/p/*`, `/shop/c/*`, `/offers/*` — GPS **NONE REQUIRED**. |
| 21 | Open decisions | §37 items 17–22 (slugs, redirect vs canonical, JSON-LD, brand future, abandon window, sitemap scale). |

Where no change is required for a sub-area, this plan states **`NONE REQUIRED`** explicitly (guest DB cart, brand SEO v1, second promotion UI, second analytics, city-mass product pages, Capacitor GPS).

---

## Appendix — What changed from previous plan version

| Topic | Previous | This revision |
|-------|----------|---------------|
| Background location | Forbidden | Explicit foreground lifecycle |
| actor_id | Client-trusted | **Server-only from JWT** |
| Identity | Optional table | **identity_authenticated**; table not required |
| Funnel | Basic | + abandonment / payment_completed / **cart_abandoned** |
| SEO URLs | Collision risk | **SAFE via /locations and /offers** |
| Flags | Mixed booking | **GUEST_BOOKING independent** |
| Offers SEO | Missing | Full offer SEO |
| Native | — | **NONE REQUIRED** for location |
| Admin CI | Missing | **Full audit + extend Customer Admin + presence/geo** |
| Workstreams | Implicit | **7 workstreams; Dev3 owns Admin CI after analytics** |
| E-commerce SEO | Missing | **Full audit §46 + architecture §47 + summary §48 under /shop/p|/shop/c; brand NONE v1** |
| Workstream 5 | SEO + Offers | **SEO + Offers + E-commerce SEO** (no 8th workstream) |

---

*End of final plan. Do not implement until open decisions are resolved and this document is approved.*
