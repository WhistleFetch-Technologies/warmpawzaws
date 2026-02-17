# 360° Forensic Integration & Gap Analysis

**Wallet · Rewards & Loyalty · Coupons · Service/Vendor Discovery · Promotions · Spotlights · Banners · Articles · Announcements**

This document maps integrations across **Customer Web**, **Vendor Web**, and **Admin Web**, with backend APIs and identified gaps.

---

## 1. Wallet

| Layer | What exists | API / Source |
|-------|-------------|--------------|
| **Customer** | `WalletIcon` (header balance), `CustomerWallet`, `WalletPage` (balance, transactions, top-up) | `GET /customer/wallet?phone=`, `GET /wallet/:customerId`, `GET /customer/wallet/transactions`, `POST /customer/wallet/add-funds`, `POST /wallet/:customerId/credit` |
| **Admin** | No dedicated “Wallet management” screen. Refunds can credit customer wallet (bookings, appointments). | Wallet updated via booking/refund flows; no bulk credit UI. |
| **Vendor** | N/A (customer wallet only) | — |
| **Backend** | `customer-phone-convenience.ts` (wallet by phone), `wallet.ts` (by customerId). Tables: `customer_wallets`, `wallet_transactions`. | — |

**Gaps**

- **Wallet ↔ Rewards**: Wallet screen does not link to Rewards & Loyalty (or show loyalty points). Rewards are under Account sidebar only.
- **Admin**: No UI to credit/debit a customer wallet for support or promotions.
- **Single source of truth**: Some responses use `wallet_balance` on `customers` (refunds), others `customer_wallets`; ensure consistency.

---

## 2. Rewards & Loyalty Points

| Layer | What exists | API / Source |
|-------|-------------|--------------|
| **Customer** | `RewardsLoyaltyPage` (points balance, redeem, history). Reached via Account sidebar “Rewards & Loyalty”. `/rewards` page (standalone). | `GET /customer/:customerId/rewards/points`, `rewards/available`, `rewards/history`, `rewards/redeemed`; redeem via POST. |
| **Admin** | `app/loyalty/page.tsx`: Rules (earn/redeem rates), Stats, Transactions. Segments & Action Rules (separate endpoints). | `GET/POST/PUT/DELETE /admin/loyalty/rules`, `GET /admin/loyalty/stats`, `GET /admin/loyalty/transactions`, `admin/loyalty-segments`, `admin/loyalty-action-rules` |
| **Vendor** | N/A (platform loyalty) | — |
| **Backend** | `rewards.ts` (customer-facing), `loyalty.ts` (admin rules/stats), `loyalty-points-service` (award on signup, order, profile complete). Tables: `customer_loyalty_points`, `loyalty_tiers`, `rewards_catalog`, etc. | — |

**Gaps**

- **Discovery**: Rewards & Loyalty is only in Account sidebar; no link from Wallet or from post-checkout success.
- **Rewards catalog**: Admin config for “available rewards” (redemption catalog) vs backend `rewards/available` – confirm admin UI exists and is wired to same catalog.
- **Customer ID**: Rewards APIs use `customerId` (UUID); customer app gets it from `/customer/by-phone` or `localStorage.customerId` – ensure set after login.

---

## 3. Coupons & Promotion Codes

| Layer | What exists | API / Source |
|-------|-------------|--------------|
| **Customer** | `UniversalPaymentPage`, `CouponSection`: validate at checkout. `EnhancedPaymentPage` uses legacy endpoint only. | Primary: `POST /promotions/validate-code` (vendorId, orderAmount, bookingAmount, orderType). Fallback: `GET /coupons/validate/:code?amount=` |
| **Admin** | Promotions (ecommerce), Marketing. Coupon/promotion CRUD. | Admin promotion endpoints; legacy `coupons` table. |
| **Vendor** | `PromotionsManagement`, `ServicePromotionsManagement`: create/edit vendor-specific promotions and service promotions. | Vendor promotions stored in `vendor_promotions`, `vendor_service_promotions`. |
| **Backend** | `vendor-promotions.ts`: `POST /promotions/validate-code` checks vendor_promotions, vendor_service_promotions, then legacy coupons. `promotions.ts`: `GET /coupons/validate/:code`. `discount-calculation-service`: applyCoupon. | — |

**Gaps**

- **Two code paths**: Customer uses `/promotions/validate-code` first (correct), then fallback `/coupons/validate/:code`. Ensure both paths stay in sync (e.g. same min/max rules).
- **Vendor scope**: Validate-code accepts `vendorId`; vendor-created codes should be scoped to that vendor. Confirm vendor UI sends correct context when testing.
- **Admin vs vendor**: Platform-wide coupons (admin) vs vendor-specific (vendor UI) – clear in backend; ensure admin docs describe when to use which.

---

## 4. Service Discovery

| Layer | What exists | API / Source |
|-------|-------------|--------------|
| **Customer** | Vet, Grooming, Training, Home services, etc. use discovery. `VetServiceRouter`, `GroomingServicesByStyle`, `HomeServiceProviderListView`, `UniversalServiceProviderList`, `ClinicListView` call discovery APIs. | `GET /customer/discover-services?category=&serviceStyle=&roleId=&latitude=&longitude=`, `GET /customer/services/by-style?style=&category=`, `GET /customer/vendors/by-problem?problemGridId=&roleId=`, `GET /customer/vendors/search?category=` |
| **Admin** | Catalog (services), Roles, Problem Grid: configure categories, roles, specializations, problem→role mapping. | Catalog and role endpoints; problem grid config. |
| **Vendor** | Vendor configures services, pricing, service styles (at_center, at_home, tele). | Service catalog, availability. |
| **Backend** | `service-discovery.ts`, role/catalog endpoints. Discovery reads from `service_catalog`, vendors, specializations. | — |

**Gaps**

- **Catalog → discovery**: Changes in admin catalog/roles must be reflected in discovery (correct tables and indexes). No caching layer should serve stale catalog.
- **Spotlight in discovery**: `GET /customer/discover-services` can take `spotlight=true`; confirm whether customer app uses it anywhere (e.g. “Featured” section).
- **Location**: Discovery supports lat/lon for distance; customer location from localStorage or browser – document expected keys (`customer_latitude`, `customer_longitude`).

---

## 5. Vendor Discovery

| Layer | What exists | API / Source |
|-------|-------------|--------------|
| **Customer** | Same discovery APIs return vendors; problem-based flow uses `vendors/by-problem`. Search uses `vendors/search`. | As in Service Discovery. |
| **Admin** | Vendors list, tiers, approval. Spotlight (marketing) can feature vendors. | Vendor CRUD, spotlight_offers. |
| **Vendor** | Onboarding, profile, services. No “discovery” UI (they are the discovered). | — |
| **Backend** | Discovery and vendor endpoints; `spotlight_offers` table. | — |

**Gaps**

- **Spotlight visibility**: Admin “Spotlight” tab adds to `spotlight_offers`. Confirm customer-facing discovery or home actually shows “featured” vendors (e.g. sort or filter by spotlight).
- **Vendor profile completeness**: Discovery response quality depends on vendor profile (photo, address, services). Admin/vendor UIs should encourage completeness.

---

## 6. Promotions (Display & Apply)

| Layer | What exists | API / Source |
|-------|-------------|--------------|
| **Customer** | `PromotionBanner`, `CartPromotionsBanner`, `CouponSection`; payment page applies codes. Cart/checkout may use `promotions-engine.ts` (client-side). | Validate: `POST /promotions/validate-code`. Optional: fetch “available promotions” for display if such an API exists. |
| **Admin** | Marketing (banners, spotlights, announcements), Ecommerce promotions. | Banners CRUD, spotlights, platform_settings (announcements). |
| **Vendor** | Promotions management (product + service promotions). | `vendor_promotions`, `vendor_service_promotions`. |
| **Backend** | `promotions.ts`, `vendor-promotions.ts`; validate-code unifies vendor + legacy coupons. | — |

**Gaps**

- **List “my promotions” for customer**: No clear “Your offers” or “Promotions for you” that fetches a list (by vendor or global). Main flow is “enter code at checkout.”
- **Vendor promotions in discovery**: No explicit “this vendor has a promotion” badge in discovery results unless added in vendor object from backend.

---

## 7. Banners

| Layer | What exists | API / Source |
|-------|-------------|--------------|
| **Customer** | `CustomerHomeComplete`: carousel from `GET /customer/banners?position=home_top&limit=5`. CTA click: `onNavigate(banner.ctaLink)`. Tracks click: `POST /banners/:id/click`. | `GET /customer/banners`, `POST /banners/:id/click` |
| **Admin** | Marketing → Banners tab: list, add, edit, delete. Fetches `GET /admin/banners`, writes `POST/PUT/DELETE /admin/banners`. | `admin-governance-enhanced.ts`: GET/POST/PUT/DELETE `/admin/banners`, GET `/admin/banners/analytics`. |
| **Vendor** | `BannerManagement` (vendor-specific banners if supported). | Depends on backend support for vendor-level banners. |
| **Backend** | `customer-content.ts`: GET `/customer/banners` (reads `banners` table, type/date filters). `admin-governance-enhanced.ts`: CRUD + click tracking + analytics. | — |

**Gaps**

- **Click tracking path**: **CONFIRMED.** Customer calls `POST /banners/:id/click` from `CustomerHomeComplete`. Backend route is registered in `admin-governance-enhanced.ts`; records to `banner_clicks` and increments `banners.click_count`. ID is `banners.id`.
- **Banner types**: Backend uses `type` (main, spotlight, category, service). Customer uses `position=home_top` → `main`. Admin UI should expose type and dates clearly.

---

## 8. Spotlights

| Layer | What exists | API / Source |
|-------|-------------|--------------|
| **Customer** | No dedicated “Spotlight” section on home. Discovery can filter by `spotlight=true`. | `GET /customer/discover-services?spotlight=true` (if used). |
| **Admin** | Marketing → Spotlight tab: add/remove vendor from spotlight, duration, type. | `GET /marketing/spotlights`, `POST /marketing/spotlights`, `DELETE /marketing/spotlights/:id` |
| **Vendor** | N/A (admin assigns spotlight) | — |
| **Backend** | `promotions.ts`: spotlight_offers table; discovery can order by `is_spotlight`. | — |

**Gaps**

- **Customer visibility**: **FIXED.** Home now has a “Featured providers” block from `GET /customer/featured-vendors` (reads `spotlight_offers`). Renders when admin has added spotlights; cards use `onNavigate(ctaLink, { vendorId })`.
- **Spotlight vs banner**: Banners are creative carousel; spotlights are vendor-focused. Ensure admin copy distinguishes them.

---

## 9. Articles / Content

| Layer | What exists | API / Source |
|-------|-------------|--------------|
| **Customer** | `CustomerHomeComplete` loads `GET /customer/articles?limit=3&featured=true` in `loadDynamicContent`; used for articles section if present. | `GET /customer/articles?category=&limit=&featured=` |
| **Admin** | Marketing (or Content) tab: “Articles” / content pages. Fetches `GET /admin/content/pages`, CRUD `POST/PUT/DELETE /admin/content/pages`. | `admin-advanced.ts`: GET/POST/PUT/DELETE `/admin/content/pages`. |
| **Vendor** | N/A | — |
| **Backend** | `customer-content.ts`: GET `/customer/articles` from `content_pages` (published, category in allowlist). Admin CRUD in admin-advanced. | — |

**Gaps**

- **Table name**: Customer API reads `content_pages`; admin uses “content/pages” in path. Ensure admin CRUD writes to same `content_pages` table and `is_published`, `category`, `metadata.featured` are set correctly.
- **Customer article click**: If customer taps an article, ensure there is a detail view or link (e.g. slug) and that backend or app serves it.

---

## 10. Announcements (“What’s New”)

| Layer | What exists | API / Source |
|-------|-------------|--------------|
| **Customer** | `CustomerHomeComplete`: “What’s New” section from `GET /customer/announcements?limit=3`. CTA uses `onNavigate(ctaLink)`. | `GET /customer/announcements` |
| **Admin** | Marketing → Announcements tab: edit list; saved as `platform_settings` key `home_announcements`. | `GET /admin/platform-settings?key=home_announcements`, `POST /admin/platform-settings` (body with setting_key, setting_value). |
| **Vendor** | N/A | — |
| **Backend** | `customer-content.ts`: reads `platform_settings.setting_key = 'home_announcements'` (JSON array). Admin: `admin-comprehensive.ts` platform-settings GET/POST. | — |

**Gaps**

- **End-to-end**: Wired. Admin saves JSON array; customer reads it. Ensure structure matches (id, title, subtitle, ctaText, ctaLink, is_active, display_order, etc.).

---

## 11. Referral System

| Layer | What exists | API / Source |
|-------|-------------|--------------|
| **Customer** | `ReferralSystemPage`; reached via Account sidebar “Refer & Earn”. | Depends on referral API (e.g. invite codes, share link). |
| **Admin** | May have referral stats or config (to confirm). | — |
| **Vendor** | N/A | — |
| **Backend** | Referral endpoints if any (to be confirmed). | — |

**Gaps**

- **API coverage**: Confirm backend referral APIs (create invite, list invites, reward on signup/order) and that `ReferralSystemPage` uses them.

---

## Summary: Priority Gaps

| Priority | Gap | Recommendation |
|----------|-----|----------------|
| **P1** | Wallet screen has no link to Rewards & Loyalty | Add “Rewards & points” link/button on Wallet page → rewards-loyalty screen. |
| **P1** | Rewards not discoverable from Wallet or post-checkout | Same as above; optionally show “You earned X points” on order success with link to rewards. |
| **P2** | ~~No “Featured” / Spotlight block on customer home~~ | **DONE:** “Featured providers” block on home uses `GET /customer/featured-vendors` (spotlight_offers). |
| **P2** | Admin: no UI to credit/debit customer wallet | Add “Wallet adjustment” in support or customer detail (amount, reason, credit/debit). |
| **P2** | Coupon: two validation paths (promotions vs coupons) | Keep single primary path `/promotions/validate-code`; document fallback; align rules. |
| **P3** | Rewards catalog (admin) ↔ customer rewards/available | Verify admin can configure redemption catalog and that customer “rewards/available” reads it. |
| **P3** | ~~Banner click tracking~~ | **CONFIRMED:** Route registered in admin-governance-enhanced; analytics at `GET /admin/banners/analytics`. |
| **P3** | Article detail on customer app | Ensure article slug or id opens a read view; backend or static content. |

---

## Integration Matrix (Quick Reference)

| Feature        | Customer Web      | Vendor Web        | Admin Web           | Backend (key endpoints) |
|----------------|-------------------|-------------------|---------------------|--------------------------|
| Wallet         | ✅ Balance, txns  | —                 | ❌ No wallet UI     | /customer/wallet, /wallet/:id |
| Rewards        | ✅ Page, redeem   | —                 | ✅ Rules, stats     | /customer/:id/rewards/*, /admin/loyalty/* |
| Coupons        | ✅ Validate at pay| ✅ Create promos  | ✅ Promotions       | /promotions/validate-code, /coupons/validate |
| Service discovery | ✅ Multiple UIs | —                 | ✅ Catalog, roles   | /customer/discover-services, by-style, by-problem |
| Vendor discovery | ✅ Same APIs    | —                 | ✅ Vendors, spotlight | Same + spotlight_offers |
| Banners        | ✅ Carousel, click| Optional          | ✅ CRUD, analytics  | /customer/banners, /admin/banners, /banners/:id/click |
| Spotlights     | ✅ Home “Featured” + discovery | —              | ✅ Manage           | /customer/featured-vendors, /marketing/spotlights |
| Articles       | ✅ List (home)    | —                 | ✅ Content pages    | /customer/articles, /admin/content/pages |
| Announcements  | ✅ What’s New     | —                 | ✅ Platform settings| /customer/announcements, platform_settings |
| Referrals      | ✅ Page           | —                 | ?                   | Confirm referral APIs    |

---

*Document generated from codebase review. Last updated: 2026-02-14.*
