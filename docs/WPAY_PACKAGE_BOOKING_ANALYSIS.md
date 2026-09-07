# Warmpawz Pay — Package Booking Analysis

**Date:** 2026-09-03  
**Branch context:** `feature-guest-user`  
**Status:** Investigation only. No implementation in this document.

This note maps today’s Warmpawz Pay vs Marketplace package behaviour against the attached admin/customer flowchart, and lists what must change to offer **package booking on the Pay model**.

---

## 1. Requirement (from product)

Warmpawz Pay already has two admin catalogues:

| Catalogue | Admin path | What it publishes |
|-----------|------------|-------------------|
| **Book Appointment (WAPPT)** | `/warmpawz-appointments/catalogue` | Vendor + flat `appointment_fee` |
| **Pay Bill** | `/warmpawz-pay/catalogue` | Vendor + W-Pay **tier** + customer discount % |

Marketplace already has **packages** (vendor sets price, customer buys a multi-session package).

**New ask**

1. **Customer (Pay model):** after picking a published Pay vendor, two options — **Book Appointment** (existing) and **Book Packages** (new). Package booking should copy the Marketplace package journey (browse package → quote → pay → sessions).
2. **Vendor (Pay model):** today they cannot add/edit at-home / at-center prices. For **packages only**, they must be able to add, edit, and publish package prices.
3. **Commission:** do **not** use the vendor’s Marketplace subscription tier. Use the **same W-Pay tier** Admin selected when publishing the vendor to Pay (`warmpawz_pay_merchant_pricing.tier_id`).
4. **GST:** reuse Admin **Marketplace category GST cards**. No new GST table. Only the commission source changes.

**Out of scope (unless product later says otherwise)**

- Changing Pay Bill walk-in quote / appointment-fee credit.
- Vendor wallets or loyalty.
- Editing GST calculation code without the GST financial-lineage process.
- Adding a third admin “packages catalogue” (not required if packages live on `vendor_services` and the vendor is already Pay-published).

---

## 2. How the flowchart maps to code today

```text
ADMIN
  Create tier → commission % → Applies To: Marketplace / Warmpawz Pay / Both
        │
        ├─ Marketplace: publish service catalogue
        │     ├─ not a package → appointment-style service (vendor sets selling price)
        │     └─ is package    → vendor package cost → customer buys package
        │
        └─ Warmpawz Pay: publish vendor
              ├─ Pay Bill catalogue  (tier + discount)
              └─ Book Appointment catalogue (appointment fee)
                    │
CUSTOMER
  Book Appointment  → fee → slot → later Pay Bill + credit   (exists)
  Buy Package       → vendor cost + commission → pay         (Marketplace only)
```

### What already matches the chart

- Admin **Tier Management** (`/finance?tab=tiers`) creates `vendor_tiers` with `commission_rate` and two flags: `marketplace_enabled`, `warmpawz_pay_enabled` (no single `applies_to` column — both checkboxes = “Both”).
- **Marketplace packages** exist: Admin “Mark as Package” on `service_catalog`, vendor adopts/creates `vendor_services` with `metadata.isPackage` + `packageDetails`, customer uses shell screen `purchase-package`.
- **W-Pay publish** stores commission on **`warmpawz_pay_merchant_pricing.tier_id`**, not on `vendors.tier`.
- **Book Appointment** is a separate catalogue (`warmpawz_appointments_vendor_catalog.appointment_fee`). Appointment fee is **platform revenue**; vendor is paid later via Pay Bill settlement.

### What does **not** exist yet

- No W-Pay package catalogue, APIs, or `commerce_mode` for packages.
- Customer Pay / WAPPT vendor profile is **priceless** (slot + appointment fee only). There is no “Book Packages” option.
- Vendor pricing lock (`isWarmpawzPayPricingLocked` / `canVendorEditServicePrice`) blocks at-home / at-center **price** edits. Packages are not exempted.
- PawPoints on the flowchart are **not** wired to W-Pay payments today. Ignore for this feature unless product re-opens loyalty.

---

## 3. Critical commercial correction (flowchart vs live Marketplace)

The attached chart shows package price as:

```text
Vendor package cost  +  tier commission %  =  customer display price
Example: ₹10,000 + 20% = ₹12,000
```

**That is not how Marketplace packages work in code.**

| Concept | Flowchart | Live Marketplace (`package-pricing.ts` + GST guard) |
|---------|-----------|-----------------------------------------------------|
| Who sets customer price | Implied: cost + markup | Vendor sets **selling price** (`custom_price ?? price`) |
| Commission | Added **above** cost | Deducted **from vendor gross at settlement** |
| Customer total | Cost + commission | Selling price **+ GST + platform/convenience fees** |
| GST | “Applicable GST” at reconcile | **Once** at package purchase, from category GST cards |

GST guard invariant:

```text
Vendor Net = Vendor Gross − Platform Commission
Commission must never reduce the customer selling price.
```

**Product decision required before build**

| Option | Meaning | Recommendation |
|--------|---------|----------------|
| **A — Copy Marketplace (recommended)** | Vendor types the **customer package price**. W-Pay tier % is taken from vendor gross at payout. GST from category cards. Customer UI/API reuse is real. | Matches “copy Marketplace flow” + “same Pay publish tier”. |
| **B — Copy flowchart markup** | Vendor types **cost**; system adds W-Pay tier % as display price. | New pricing engine. Conflicts with GST “customer price = selling price” invariant. Do not do this without an explicit GST-protected change. |

This analysis assumes **Option A** unless product writes Option B.

Pay Bill is a **third** model (customer types bill amount; discount % must be **below** tier commission; platform GST is global `admin_settings` wpay rates). **Do not** apply Pay Bill discount % to packages unless product asks.

---

## 4. Current systems (facts)

### 4.1 Two Pay catalogues (already)

| Programme | Table | Admin sets | Customer sees |
|-----------|-------|------------|---------------|
| Pay Bill | `warmpawz_pay_vendor_catalog` + `warmpawz_pay_merchant_pricing` | Tier + discount % | `/warmpawz-pay` hub → pay bill |
| Book Appointment | `warmpawz_appointments_vendor_catalog` | Appointment fee | WAPPT discovery → slots → fee checkout |

A vendor can be in one, both, or neither. Full “book then pay bill with credit” needs **both** published.

### 4.2 Commission sources (do not mix)

| Flow | Rate comes from |
|------|-----------------|
| Marketplace booking / package | `resolveVendorCommissionPolicy()` → subscription → `vendors.tier` → default |
| W-Pay Pay Bill | `warmpawz_pay_merchant_pricing.tier_id` → `vendor_tiers.commission_rate` |
| WAPPT appointment fee | No vendor commission (platform keeps the fee) |

**For W-Pay packages:** use the Pay Bill publish tier (`merchant_pricing.tier_id`), not Marketplace subscription.

### 4.3 GST sources (do not mix)

| Flow | GST source |
|------|------------|
| Marketplace service / package | `tax_categories` + `catalog_category_id` + scope `service_booking` (`gst-catalog-role-resolution.ts`) |
| W-Pay Pay Bill | Global `admin_settings` category `wpay` (platform GST + convenience GST) — **not** category cards |
| WAPPT appointment fee | Same category pipeline as a service booking when checkout uses the fee |

**For W-Pay packages:** reuse Marketplace **category GST cards** (`service_booking`). Do not use Pay Bill global wpay GST on the package selling price.

Protected GST files must not be casually edited. See `docs/GST_FINANCIAL_LINEAGE_GUARD.md`.

### 4.4 Marketplace package stack (reuse)

| Layer | Path |
|-------|------|
| Admin “Mark as Package” | `apps/admin-web/components/admin/catalog/AddServiceModal.tsx` |
| Vendor create/edit/publish | `vendorServices.vendor.ts`, `/services/manage`, `/services/pricing` |
| Customer purchase | `PackageBookingPage.tsx` (`purchase-package`), `POST /packages/quote`, `POST /packages/purchase-from-vendor-service` |
| Pricing + GST | `backend/lambda/src/utils/package-pricing.ts` |
| Sessions / earnings | `package_purchases`, `package_scheduled_sessions`, child bookings, `package-session-earnings-allocation.ts` |

### 4.5 Why vendors cannot set Pay prices today

When Commerce Switch `activeModelId = warmpawz_pay`:

- Backend: `isWarmpawzPayPricingLocked()` locks `at_home` / `at_center`.
- Vendor UI: `canVendorEditServicePrice()` hides those rows.
- Customer WAPPT profile: services shown **without** prices.

Tele/online prices stay editable. **Packages are not an exception.**

---

## 5. Target design

Keep Pay Bill and Book Appointment as they are. Add a **third customer journey** on the same Pay-published vendor: Marketplace-style packages, with **Pay-tier commission** and **category GST**.

```text
Pay-published vendor
  ├─ Book Appointment   (unchanged WAPPT fee + slots)
  ├─ Pay Bill           (unchanged, optional same-day credit)
  └─ Book Packages      (NEW — Marketplace package UX)
         vendor sets package selling price
         GST from existing category cards
         commission % from Pay publish tier
```

### 5.1 Admin

- **No new catalogue required** for v1.
- Gate: vendor must be **published on Pay Bill** (so `tier_id` exists). Optionally also require WAPPT publish if the vendor should appear in the appointment list — product can allow packages-only later.
- Tier Management stays as-is. The W-Pay-enabled tier picked at Pay publish is the only commercial input.
- GST Configuration (`/finance?tab=gst-config`) stays as-is. Package category must already have a `service_booking` card (same as Marketplace).

### 5.2 Vendor

- Keep the lock for **one-off service** at-home / at-center prices.
- **Unlock** add / edit / publish for rows where `metadata.isPackage` (or `isPackage`) is true.
- Vendor types the **customer package price** (Option A), plus session count / package details — same as Marketplace custom package create.
- Backend must allow price writes for package rows even when `warmpawz_pay` is active (`rejectVendorServicePriceChangeIfLocked` needs a package exception).
- Discovery/list APIs must **not** strip package prices for Pay mode.

### 5.3 Customer

On the Pay-model vendor surface (WAPPT profile and/or `/warmpawz-pay/vendors/:id`):

1. **Book Appointment** — existing fee + slot flow.
2. **Book Packages** — list that vendor’s **published packages** (with prices) → existing `purchase-package` / `PackageBookingPage` (quote → Razorpay/wallet → sessions → `/my-packages`).

Do not send package purchase through Pay Bill initiate/verify.

Commerce-switch routing today sends service keys to `/warmpawz-pay` or WAPPT. Package rows already branch to `purchase-package` in Marketplace routers (`vendor-package-purchase-nav.ts`). Pay-mode routers must do the same instead of treating every service as a priceless appointment.

### 5.4 Backend / finance

| Concern | Proposed behaviour |
|---------|-------------------|
| Price authority | Vendor `custom_price` on the package `vendor_services` row |
| Quote / GST | Reuse `quotePackagePricing` / `POST /packages/quote` (category GST, fees) |
| Purchase / sessions | Reuse `package_purchases` + PSS + child bookings |
| Commission rate | Resolve **`warmpawz_pay_merchant_pricing.tier_id`** when the vendor is Pay-published (or stamp `commerce_mode` on the purchase). Do **not** use Marketplace `vendors.tier` |
| Vendor net | `Vendor Gross − (Gross × W-Pay tier %)` — same GST-guard formula |
| Settlement | Prefer existing **package session earnings** (`package-session-earnings-allocation.ts` + `vendor_earnings`), with the rate swapped to the Pay tier. Do **not** run Pay Bill `accrueWpaySettlement()` on a package purchase |
| Appointment fee credit | Does **not** apply to package purchase |

---

## 6. Gap list (what actually has to change)

| Area | Today | Needed |
|------|-------|--------|
| Customer Pay vendor UI | Appointment / Pay Bill only | Two CTAs: Book Appointment, Book Packages |
| Customer package nav | Marketplace verticals only | Pay discovery must route `isPackage` → `purchase-package` |
| Vendor pricing lock | All at-home/center prices locked | Exception for package rows |
| Vendor package create | Works in Marketplace; Pay UI may hide prices | Allow create/edit/publish packages under Pay |
| Price strip on APIs | WAPPT omits prices | Keep omitting one-off service prices; **show** package prices |
| Commission resolver | Packages use Marketplace tier | Packages on Pay vendors use `merchant_pricing.tier_id` |
| GST | Already category-based for packages | Reuse; no new cards |
| Admin | Two Pay catalogues | No third catalogue for v1 |
| Tests | Marketplace package + W-Pay lock suites | Lock-exception tests; commission-source tests; Pay CTA tests |

---

## 7. What we will not change

- GST rate math, category resolver, invoice/Customer Paid lineage (`docs/GST_FINANCIAL_LINEAGE_GUARD.md`).
- Pay Bill quote (`computeWpayCommercialQuote`), appointment-fee credit, or WAPPT fee authority.
- Admin Action Sources / loyalty (paused separately).
- E-commerce `commission_tiers` (shop only).

---

## 8. Suggested build order

1. **Confirm Option A vs B** (selling price vs cost-plus). Default A.
2. **Vendor lock exception** for `isPackage` (API + vendor-web).
3. **Commission hook** in package earnings: if vendor has active W-Pay `tier_id`, use that rate.
4. **Customer CTAs** on Pay vendor profile + package list (only published packages).
5. **Wire nav** from Pay/WAPPT profile → existing `PackageBookingPage`.
6. Smoke: Pay-published vendor, W-Pay-only tier (e.g. 15%), package ₹10,000, category GST 18% → customer pays Marketplace-style total; vendor net = ₹10,000 × (1 − 0.15); GST snapshot once; sessions allocate vendor net; Pay Bill still unchanged.

---

## 9. Open questions for product

1. **Selling price vs cost-plus** — confirm Option A.
2. **Must the vendor be on both catalogues**, or is Pay Bill publish (tier) enough to sell packages?
3. **Packages-only Pay vendors** (no appointment fee) — allowed?
4. **Apply Pay Bill discount %** to packages? (Recommend **no**.)
5. **Which customer surface** shows the two buttons — WAPPT profile, Pay Bill vendor page, or both?

---

## 10. Key files

| Topic | Path |
|-------|------|
| W-Pay catalogue / pricing | `apps/admin-web/app/warmpawz-pay/catalogue/`, `backend/lambda/src/endpoints/warmpawz-pay/` |
| WAPPT catalogue | `apps/admin-web/app/warmpawz-appointments/catalogue/` |
| Tier applicability | `db/migrations/1101_vendor_tiers_commerce_applicability.sql`, `TierManagement.tsx` |
| W-Pay tier on vendor | `db/migrations/1102_wpay_merchant_pricing_tier_id.sql`, `warmpawz-pay-pricing.service.ts` |
| Marketplace commission | `backend/lambda/src/finance/commission/resolve-vendor-commission-policy.ts` |
| Vendor price lock | `backend/lambda/src/commerce-switch/helpers/is-warmpawz-pay-pricing-locked.ts`, `apps/vendor-web/lib/wappt-service-pricing-lock.ts` |
| Package quote / GST | `backend/lambda/src/utils/package-pricing.ts` |
| Package purchase UI | `apps/customer-web/components/customer/PackageBookingPage.tsx` |
| GST admin | `apps/admin-web/components/admin/finance/gstConfig/GSTConfigurationManagement.tsx` |
| GST guard | `docs/GST_FINANCIAL_LINEAGE_GUARD.md` |

---

## 11. One-line summary

W-Pay already publishes a vendor with a **commission tier**. Marketplace already has **packages + category GST**. The feature is a **join**: unlock vendor package prices under Pay, show **Book Appointment | Book Packages** to the customer, reuse the Marketplace purchase/session stack, and take **only the Pay publish tier** as the commission rate — without inventing cost-plus markup or a new GST system.
