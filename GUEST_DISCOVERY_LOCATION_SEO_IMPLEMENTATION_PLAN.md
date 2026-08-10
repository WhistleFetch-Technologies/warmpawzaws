# Warmpawz — Guest Discovery, Location, Analytics, SEO & Offers

## Final Implementation-Ready Plan (Revised)

| Field | Value |
|-------|-------|
| Document | `GUEST_DISCOVERY_LOCATION_SEO_IMPLEMENTATION_PLAN.md` |
| Branch context | `feature/warmpawz-pay-appointments-unified` |
| Status | **Final blueprint — implementation not started** |
| Scope | Documentation only |
| Last revised | 2026-08-10 |

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

---

## 1. Executive Summary

Warmpawz must move from **login-first** entry to **guest browse → location-aware discovery → login at booking/payment**, while adding **crawlable SEO** for location/category pages and **public offers**, and a trustworthy **anonymous → authenticated analytics** trail.

**Mandatory rules in this revision**

1. **Foreground location only** — no background GPS. `[MANDATORY]`
2. **`actor_id` is always server-derived from validated JWT** — client-supplied `actor_id` ignored/rejected. `[MANDATORY]`
3. Explicit **`identity_authenticated`** association at login without a mandatory new DB table. `[MANDATORY]`
4. Funnel includes **`booking_abandoned`** with a defined rule. `[MANDATORY]`
5. SEO routes must be **collision-safe** with `app/[persona]/[[...vendorSlug]]`. `[MANDATORY]`
6. **`GUEST_BOOKING_ENABLED` is an independent flag.** `[MANDATORY]`
7. SEO includes **public promotions/offers**, server-validated at booking. `[MANDATORY]`

**Do not:** redesign discovery SQL; remove global `requireAuth`; add background location; introduce a second analytics or discount engine; create DB guest carts in v1.

---

## 2. Business Requirements

### 2.1 Search engine discovery

Public pages (location/category, selected vendor/service, **public offers**) crawlable by Google/Bing without JWT, phone, address, or GPS.

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
| `GET /public/offers` / `GET /public/offers/:slug` | **new read models** from published promotions/campaigns | no customer PII; no personalized pricing |
| `POST /analytics/v1/events` | existing | allowlisted; **server-derived actor_id** |

**Never public:** booking create, payment, `/promotions/apply*`, coupon apply for account, addresses, pets, phone cart.

**Defer:** radar, problem-grid variants, autocomplete (unless UI blocked).

---

## 12. Guest Booking Boundary

| Allowed without login | Requires auth |
|-----------------------|---------------|
| Browse, search, discover, offers, vendor/service, public slots, select intent | Booking create, payment, account data, personalized promo resolution for checkout |

Controlled by **`GUEST_BOOKING_ENABLED`** independently of discovery flags. `[MANDATORY]`

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

Ecommerce `warmpawz_cart` remains separate. **No DB guest cart in v1.**

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
| `cart_item_added` / `removed` | Shop/intent | item_type, ids |
| `login_prompt_shown` | Soft gate | reason, stage, returnPath |
| `login_started` / `login_completed` | Auth UI | method |
| `identity_authenticated` | Post-login | anonymous_id (props); actor server |
| `booking_started` | Enter book flow / confirm intent | vendor_id, service_id, stage |
| `booking_abandoned` | See §18 | stage, vendor_id, service_id, … |
| `checkout_started` | Checkout enter | |
| `payment_started` / `failed` / `completed` | Razorpay | error_code if fail |
| `booking_failed` / `booking_completed` | Create API result | booking_id |

Also: `offer_viewed`, `offer_cta_clicked` for offer SEO pages `[RECOMMENDATION]`.

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

Never trust URL / localStorage / SEO HTML for discount amount.

```text
SEO Offer Page (informational)
  → Guest discovery (LocationContext)
  → Booking
  → unified-discount-resolver / existing calculate-booking & validate-code
  → actual discount
```

Re-check: active, customer eligible, service/vendor/date/location/usage/stacking/amount.

**Do not** create a second promotion engine.

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
Human: same URL → LocationContext → eligible nearby vendors/services → guest book → login → server promo resolve
```

Live GPS must **not** change canonical URL.

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
3. **Offers** — `/offers`, `/offers/{slug}`  
4. **Campaign/seasonal** — only with unique content  

Do not mass-generate thin pages. Cap allowlisted cities × categories × active public offers.

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
| `/shop` | `app/shop` | N/A | No | — |
| `/warmpawz-pay/...` | static | N/A | No | — |
| `/promotions` | `app/promotions` | N/A | Exists; auth UI | **noindex**; offers SEO under `/offers` |
| `/offers` | **none** | `/offers` | **No** | SAFE |
| `/offers/{slug}` | **none** | `/offers/[slug]` | **No** | SAFE |
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
```

**Rejected for v1:** `/[city]/[category]` (collides with `[persona]`).

Optional alternative: literal folders `app/bangalore/[category]` per city — works (static first segment) but scales poorly; prefer `/locations/...`.

---

## 23. SEO Rendering Strategy

`[CONFIRMED FROM CODE]` Prod = static export.

**Choice:** current export + **build-time generated HTML** for allowlisted `/locations/*` and `/offers/*`.  
Defer full SSR/ISR rewrite. No separate SEO app.

```text
Build: stable HTML + metadata + JSON-LD + internal links
  (best-effort or snapshot data; build must not fail if live API down)
Hydration: LocationContext → live /public discovery & offer eligibility UI
```

SEO must **not** depend on live discovery succeeding at build time.

---

## 24. Sitemap / Robots / Metadata

| Artifact | Rule |
|----------|------|
| `robots.txt` | Allow `/locations/`, `/offers/`, `/vendor/`; Disallow `/auth`, `/checkout`, `/bookings`, `/profile`, `/promotions` (in-app), account paths |
| `sitemap.xml` | Generated: locations allowlist + **active public offers** + selected vendors; refresh on deploy/schedule |
| Metadata | title, description, canonical, OG |
| noindex | account, checkout, payment, private bookings, expired offers (or expired template), `/promotions` |

---

## 25. Capacitor Android

| Item | Verdict |
|------|---------|
| Geolocation plugin | Present |
| Fine/coarse | Present |
| Background location | **Do not add** |
| MainActivity WebChromeClient | Present — keep |
| Code change for GPS | **NONE REQUIRED** |
| App Links | OPTIONAL fill `assetlinks.json` SHA + path parity incl. `/offers`, `/locations` |

---

## 26. Capacitor iOS

| Item | Verdict |
|------|---------|
| WhenInUse usage string | Present |
| Background modes | **Do not add** |
| Code change for GPS | **NONE REQUIRED** |
| Universal Links | OPTIONAL real Team ID + AASA paths for `/offers`, `/locations`, `/vendor` |

---

## 27. Deep Linking

```text
SEO/share URL → browser
  and/or App Link / Universal Link → Capacitor → same path
```

Preserve: route, query, `anonymous_id`, LocationContext cache.  
Offer slug must survive open. Single URL for web and app.

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
→ marketing fields: title, description, validity, category, terms, slug, status
→ NO personalized discount amount guaranteeing checkout price
→ NO customer PII
```

Apply/validate remain authenticated + resolver.

### 29.4 Booking / payment

**Unchanged** — always authenticated; server revalidates slot, price, promotion.

---

## 30. Security

1. `actor_id` server-derived from validated JWT. `[MANDATORY]`  
2. Client cannot impersonate another customer in analytics.  
3. Public discovery: no customer PII.  
4. Public offer pages: no customer-specific promo data.  
5. Client location ≠ authorization.  
6. Booking/payment server-authorized.  
7. Promotion eligibility server-validated (existing resolver).  
8. Slot availability revalidated before book.  
9. Precise GPS not in analytics by default.  
10. Background location prohibited.  
11. Rate limit public GETs + analytics ingest.  
12. Open-redirect protection on `redirect` param.

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
| `SEO_PUBLIC_PAGES_ENABLED` | `/locations/*`, `/offers/*` |

**Optional:** `PUBLIC_SLOTS_ENABLED`, `WPAY_HUB_USE_NEARBY`.

**Rollout order**

```text
GUEST_BROWSING → GUEST_LOCATION → GUEST_DISCOVERY → GUEST_ANALYTICS
  → GUEST_BOOKING → SEO_PUBLIC_PAGES
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

Never direct prod hotfixes without staging smoke.

---

## 33. Testing Matrix

**Guest:** first open, refresh, restart, permission allow/deny, manual location, cache.  

**Foreground location:** samples while active; ≥500m / stale refresh; debounce; **no** continuous track in background; resume refresh.  

**Analytics:** anon events; session; server actor_id; reject/ignore client actor_id; `identity_authenticated`; journey reconstruction; `booking_abandoned`; funnel.  

**Discovery:** Marketplace, Pay nearby, vendor, service, slots.  

**Booking:** intent, login, restore, slot/price/promo revalidate, payment, regression.  

**Offers:** public URL, crawler HTML, metadata, active/expired, guest browse, server eligibility, deep link.  

**SEO:** collision safety (`/locations/...`, `/offers/...`), HTML, canonical, sitemap, robots, noindex private.  

**Mobile:** Android/iOS foreground permission, deep links for offers/locations/vendor.

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

---

## 35. Rollback Strategy

- Disable flags independently (`GUEST_BOOKING` first if payment risk).  
- Keep analytics actor derivation (security fix — do not rollback).  
- Public routes can stay with rate limits or env-disable registration.  
- SEO: `noindex` / flag off without deleting URLs.  
- No DB rollback for v1.

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
File: app/promotions/page.tsx
Current: in-app offers list
Change: keep; ensure noindex; do not use as SEO canonical
Risk: Low
```

### Capacitor / Infra / DB

- Android/iOS location: **NONE**  
- Deep link well-known: **OPTIONAL**  
- Infra: existing deploy scripts only  
- DB migrations: **NONE** required v1  

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

---

## 38. Final Change Summary

```text
Files to modify:
  Backend: auth-middleware.ts; product-analytics/routes.ts; product-analytics/service-ingest.ts;
           discovery parse files; warmpawz-pay nearby service usage; promotions read path (new public handlers)
  Frontend: auth/page.tsx; vendor-profile-share.ts; BannerVendorDeepLinkClient.tsx; app/page.tsx;
            providers.tsx; allyticas-ingest.ts; analytics.ts; customer-discovery-coords.ts;
            customer-location.ts; geolocation-utils.ts; LocationPermission.tsx; HomeHeaderSection.tsx;
            useDiscoverServicesFeed.ts; search-discovery-params.ts; adapt-wpay-nearby-vendors.ts;
            api-client.ts; booking routers; checkout/page.tsx; promotions/page.tsx (noindex)
  SEO/deep-link optional: well-known association files

Files to create:
  LocationContext.tsx; anonymous-id.ts; guest-journey-snapshot.ts; guest-route-policy.ts;
  ManualLocationSheet.tsx; public discovery/slots/pay/offers routes + sanitizers;
  app/locations/[city]/[category]/page.tsx; app/offers/page.tsx; app/offers/[slug]/page.tsx;
  public/robots.txt; sitemap generator

Files to delete:
  NONE

Backend changes: YES (ingest security, public aliases, public offers read)
Frontend changes: YES (guest, location, booking boundary, SEO pages, analytics client)
Analytics changes: YES (server actor_id, identity_authenticated, booking_abandoned, allowlist)
Database changes: NONE (required)
Capacitor Android changes: NONE (location); OPTIONAL App Links metadata
Capacitor iOS changes: NONE (location); OPTIONAL AASA metadata
Infrastructure changes: NONE (required); use existing deploy scripts
SEO changes: YES (/locations/*, /offers/*, robots, sitemap)
Promotion changes: YES (public read/SEO pages only; resolver unchanged)

New packages: NONE
New migrations: NONE (required); OPTIONAL later
New feature flags:
  GUEST_BROWSING_ENABLED
  GUEST_LOCATION_ENABLED
  GUEST_DISCOVERY_ENABLED
  GUEST_ANALYTICS_ENABLED
  GUEST_BOOKING_ENABLED   ← independent
  SEO_PUBLIC_PAGES_ENABLED

Highest-risk changes:
  1) Server-side actor_id enforcement (security correctness)
  2) Guest home auth wall removal
  3) GUEST_BOOKING + payment/promo revalidation
  4) Public slots + public offers data exposure
  5) SEO routing (mitigated by /locations and /offers prefixes)

Open decisions: see §37

Recommended implementation order:
  M1 Foundation (anon/session, ingest+server actor_id, identity_authenticated,
     LocationContext foreground, redirect fix, guest home)
  M2 Guest discovery APIs + FE + public slots
  M3 GUEST_BOOKING_ENABLED + intent + revalidate slot/price/promo + pay
  M4 Funnel + booking_abandoned + reporting
  M5 SEO /locations + /offers + sitemap/robots
  M6 Deep links + device QA
```

---

## Appendix — What changed from previous plan version

| Topic | Previous | This revision |
|-------|----------|---------------|
| Background location | Forbidden (implied) | Explicit allowed/prohibited foreground lifecycle |
| actor_id | Client could send customer UUID | **Server-only from JWT; client ignored** |
| Identity link | Optional table emphasis | **`identity_authenticated` + context; table NOT required** |
| Funnel | Basic list | **+ price_viewed, booking_summary_viewed, payment_completed, booking_abandoned** |
| SEO URLs | `/bangalore/vet` risk | **Collision analysis; SAFE via `/locations/...` and `/offers/...`** |
| Flags | Booking mixed with discovery | **`GUEST_BOOKING_ENABLED` independent** |
| Offers SEO | Missing | **Full promotion classification + public offer SEO + server resolver** |
| Native | No change | Reaffirmed **NONE REQUIRED** for location |

---

*End of final plan. Do not implement until open decisions are resolved and this document is approved.*
`)