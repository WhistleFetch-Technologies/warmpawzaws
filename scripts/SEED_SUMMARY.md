# Seed Summary: Policies, Tax, Banners, Spotlight & Promotions

Run `./scripts/seed-policies-tax-banners-spotlight.sh` (set `API_BASE_URL` and optionally `AUTH_TOKEN`).  
Use this doc to verify in the UI and to confirm wiring to customer flows.

---

## 1. Refund / Cancellation Rules

- **Table:** `booking_cancellation_rules`
- **Endpoint:** `POST /admin/refund-rules`
- **Body (camelCase):** `fullRefundBeforeHours`, `partialRefundBeforeHours`, `partialRefundPercentage`, `cancellationCutoffHours`, `isActive`
- **Seeded:** 1 platform default: 48h full refund, 24h 50%, cutoff 6h
- **Where used:** Refund calculation on cancel (`/refund-policy/calculate`), booking cancel flow, admin Refund Policy settings

---

## 2. Cancellation Policies

- **Table:** `cancellation_policies`
- **Endpoint:** `POST /admin/finance/cancellation-policies`
- **Seeded:** "Standard Cancellation" with 48h / 24h / 6h windows
- **Where used:** Admin Finance > Cancellation Policies; can be shown in customer booking/checkout via `/config/policies?service_type=booking`

---

## 3. Scheduling Policies

- **Endpoint:** `POST /admin/scheduling-policies`
- **Seeded:** Buffer time (30 min, 1 concurrent), Slot duration (30 min, 15 min break)
- **Where used:** Admin scheduling config; slot generation and availability logic

---

## 4. Fee Configuration

- **Endpoint:** `PUT /admin/finance/fee-configuration`
- **Body:** `{ "config": { "platformFeePercentage", "maxPlatformFee", "convenienceFeeBooking", ... } }`
- **Seeded:** 2% platform (cap 200), ₹10 booking fee, ₹5 tele, packaging ₹15
- **Where used:** Payment/checkout fee calculation

---

## 5. Tax Rules (GST)

- **Table:** `gst_rules`
- **Endpoint:** `POST /admin/tax-rules`
- **Seeded:** Standard 18%, At-Home 18%, Tele 18%, Pet medicines 12%, Pet food 18%
- **Where used:** Tax calculation in booking and product flows; Admin Tax Management

---

## 6. HSN Codes

- **Table:** `hsn_codes`
- **Endpoint:** `POST /admin/finance/gst/hsn-codes`
- **Body:** `{ "code", "description", "gstRate", "isActive" }`
- **Seeded (market-aligned):**
  - 998351 – Veterinary services for pet animals (0%)
  - 998612 – Animal husbandry, grooming, boarding, training (0%)
  - 2309 – Dog/cat food (18%)
  - 0106 – Live animals (0%)
  - 3004 – Veterinary medicines (12%)
  - 4201 / 6307 / 3926 – Pet accessories (12%)
  - 9609 – Grooming tools / general (18%)
- **Where used:** Product/service tax (HSN on items), invoices, Admin GST/HSN settings

---

## 7. Banners (Customer Home & Dashboards)

- **Table:** `banners`
- **Endpoint:** `POST /admin/banners`
- **Body:** `type` (main | spotlight | category | service), `title`, `subtitle`, `ctaText`, `ctaLink`, `display_order`, `metadata` (e.g. gradient_from, gradient_to, icon), `isActive`
- **Customer API:** `GET /customer/banners?position=home_top` → returns banners with `type = 'main'`
- **Seeded:** 3 main banners – 50% grooming, Free vet check, 20% shop
- **Where used:** Customer home carousel; add/edit in Admin reflects on customer home once saved

---

## 8. Spotlight Offers

- **Table:** `spotlight_offers`
- **Endpoint:** `POST /marketing/spotlights`
- **Body:** `roleId`, `serviceCategory`, `title`, `subtitle`, `discountType`, `discountValue`, `badgeText`, `icon`, `ctaText`, `ctaLink`, `is_active`, `display_order`
- **API:** `GET /marketing/spotlights?active=true`
- **Seeded:** One per role – vet (100% first check), groomer (50%), trainer (20%), boarder (10%)
- **Where used:** Service dashboards / landing pages that consume `/marketing/spotlights`

---

## 9. Promotions (with Code, Spotlight, Published)

- **Table:** `promotions`
- **Endpoint:** `POST /marketing/promotions`
- **Body:** `name`, `code`, `promotionType`, `discountType`, `discountValue`, `applicable_services`, `priority`, `is_spotlight`, `published`, `startDate`, `endDate`
- **APIs:**
  - `GET /promotions/list?service=X&published=true&spotlight=true` – list for dashboards
  - `GET /promotions/validate?code=XXX` – validate at checkout
  - `POST /promotions/apply` – apply to amount
- **Seeded:** GROOM50 (50% grooming), VET100 (free vet check), SAVE20 (20% shop, min ₹500)
- **Where used:** Customer booking/checkout (code + apply); dashboard spotlight sections; taxation is applied on post-discount amount where wired

---

## Verification Checklist

| Area | Where to verify |
|------|------------------|
| Refund rules | Admin > Finance / Refund Policy; cancel a test booking and check refund % |
| Cancellation policies | Admin > Finance > Cancellation Policies |
| Scheduling | Admin > Scheduling / Availability config |
| Fee config | Admin > Finance > Fee Configuration |
| Tax rules | Admin > Tax Management / GST Rules |
| HSN codes | Admin > Finance > GST > HSN Codes |
| Banners | Customer app home carousel; Admin > Banners (type = main) |
| Spotlights | Service dashboards; Admin > Marketing > Spotlights |
| Promotions | Admin > Marketing > Promotions; customer checkout (code GROOM50 / VET100 / SAVE20) |
| Policies in booking | Customer booking flow: policies from `/config/policies?service_type=booking`; tax from tax/HSN rules |
| Banners on home | Customer home: `GET /customer/banners?position=home_top` → type=main |

---

## Wiring Summary

- **Add/Edit in Admin** → Stored in RDS (policies, tax, banners, spotlight_offers, promotions). Customer endpoints read from same tables, so changes reflect in:
  - Customer home banners
  - Service dashboard spotlights and promotion lists
  - Booking/checkout: policies, tax, coupons/promotions
- **Policy checks** are enforced at cancel (refund rules), at booking (cancellation/scheduling), and at payment (tax + promotions).
- **CRUD:** All entities above have corresponding GET/POST/PUT/DELETE (or equivalent) in backend; Admin UI should call these for strict CRUD verification.
