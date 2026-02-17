# Customer Journey – Forensic Checklist

In-depth forensic pass for the **complete customer journey**: Banners, Promotions, Spotlight, Coupons, Loyalty/Rewards, Marketing launch dashboard UI, and API contract alignment.

---

## 1. Banners (Admin → Backend → Customer)

| Step | Endpoint / Flow | Expected | Status |
|------|-----------------|----------|--------|
| 1.1 | Admin GET/POST/PUT/DELETE `/admin/banners` | CRUD works; response has `banners[]` | ✅ Verified |
| 1.2 | Customer GET `/customer/banners` | Returns `banners[]` with `id`, `title`, `subtitle`, `imageUrl`, `ctaText`, `ctaLink`, `gradientFrom`, `gradientTo` | ✅ Aligned (customer-content returns camelCase) |
| 1.3 | Customer banner click POST `/banners/:id/click` | Body `{ source }` (e.g. `home_carousel`), optional `customerId` | ✅ Handler in admin-governance-enhanced; accepts `source`, `customerId` |

**Notes:** Admin create/update accept both camelCase and snake_case. Customer home uses `/customer/banners` and displays carousel from `banners[]`.

---

## 2. Promotions (List, Active, Apply, Validate)

| Step | Endpoint / Flow | Expected | Status |
|------|----------------|----------|--------|
| 2.1 | GET `/promotions/list?service=...&published=true&spotlight=true` | Query params supported; response `{ success, promotions[], total }`; rows have `id`, `name`, `description`, `discount_type`, `discount_value`, `is_spotlight`, `priority`, `promotion_type`, `applicable_services` | ✅ Backend supports; list uses JSONB `@>` for `applicable_services` |
| 2.2 | GET `/promotions/active` | Optional `serviceType`, `customerId`, `vendorRoleId`; response `{ success, promotions[], total }`; same field names (snake_case from DB) | ✅ Fixed: `applicable_services` / `applicable_roles` now use JSONB `@>` (was incorrect `ANY()`) |
| 2.3 | POST `/promotions/validate-code` | Body: `code`, optional `vendorId`, `orderAmount`/`bookingAmount`, `orderType` ('service' \| 'product'). Response: `valid`, `message`, `promotion` (with `discount_type`, `discount_value`, `id`), `discount_amount`, `final_amount`, `promo_category` | ✅ CouponSection & UniversalPaymentPage use this contract |
| 2.4 | POST `/promotions/apply` | Used at checkout; body `promotionId`, `bookingId`/`orderId`, `amount` | ✅ Exists in promotions.ts |
| 2.5 | POST `/promotions/:id/click` | PromotionBanner sends click tracking | ✅ In admin-governance-enhanced or promotions |

**Notes:** PromotionBanner uses `/promotions/list`; GroomingServicesByStyle and promotions page use `/promotions/active`. Both response shapes use DB snake_case; UI normalizers handle both.

---

## 3. Spotlight / Featured Vendors

| Step | Endpoint / Flow | Expected | Status |
|------|-----------------|----------|--------|
| 3.1 | Customer GET `/customer/featured-vendors` | Returns data consumed by home (e.g. `vendors[]` or spotlight items with id, title, subtitle, ctaText, ctaLink) | ✅ Sourced from `spotlight_offers` in customer-content |
| 3.2 | Admin POST `/marketing/spotlights` | Writes to same store read by featured-vendors | ✅ promotions.ts POST writes to `spotlight_offers`; GET /customer/featured-vendors reads from `spotlight_offers` |

---

## 4. Coupons (Bulk, Create, Validate)

| Step | Endpoint / Flow | Expected | Status |
|------|-----------------|----------|--------|
| 4.1 | Admin GET `/admin/coupons` | List coupons | ✅ In validation script |
| 4.2 | Admin POST `/admin/coupons/bulk-generate` | Bulk create | ✅ Added previously |
| 4.3 | Customer validate | POST `/promotions/validate-code` (platform + vendor promotions) | ✅ Same as 2.3 |

---

## 5. Loyalty & Rewards (Customer Journey)

| Step | Endpoint / Flow | Expected | Status |
|------|-----------------|----------|--------|
| 5.1 | GET `/customer/:customerId/rewards/points` | Response: `balance` and/or top-level `points`, `totalPoints`, `tier`, `tierKey`, `pointsToNextTier`, `lifetimePointsEarned` (and snake_case aliases) | ✅ Backend returns `balance` + spread for normalizer compatibility |
| 5.2 | GET `/customer/:customerId/rewards/available` | Response: `rewards` or `catalog` array; items have `id`, `name`, `description`, `points_cost` (or `points_required`), `type`/category, `image_url` | ✅ Backend returns `rewards`/`catalog`; customer normalizes `points_cost` → `points_required` |
| 5.3 | GET `/customer/:customerId/rewards/history` | Response: `history` or array; items have `id`, `type`, `points`, `description`, `created_at`, `booking_id`/`reference_id` | ✅ rewards.ts returns history array |
| 5.4 | GET `/customer/:customerId/rewards/redeemed` | Response: `redemptions` or `redeemed`; items have `redemption_id`, `reward_id`, `redeemed_at`, `validity_days`, `status`, `coupon_code` | ✅ Backend returns `redemptions`; customer normalizes `redemptions`/`redeemed` |
| 5.5 | POST `/customer/:customerId/rewards/redeem` | Body: `rewardId`, `points` | ✅ Backend accepts `rewardId` + `points` |

**Notes:** Rewards page normalizers handle both camelCase and snake_case; backend now provides `balance` and snake_case aliases for points response.

---

## 6. Marketing Launch Plan / Dashboard UI

| Step | Endpoint / Flow | Expected | Status |
|------|-----------------|----------|--------|
| 6.1 | Customer GET `/config/service-launch/customer?state=...&city=...` | Response: `success`, `services` (visible, comingSoon, hidden), `buttons` for backward compat | ✅ service-launch-config.ts returns this shape |
| 6.2 | Customer home | Uses response to show/hide service tiles and “Coming soon” | ✅ CustomerHomeComplete maps serviceId to screens and uses buttons/services |
| 6.3 | Admin config | Platform setting key for launch config; admin UI reads/writes same key | ⚠️ Confirm admin “Marketing” or “Launch” UI uses same `platform_settings` key as service-launch-config |

---

## 7. API Contract Fixes Applied (This Pass)

1. **Promotions GET /promotions/active**  
   - **Issue:** `applicable_services` and `applicable_roles` are JSONB; code used `= ANY(...)` which is for PostgreSQL arrays.  
   - **Fix:** Use `@> $n::jsonb` with `JSON.stringify([serviceType])` / `JSON.stringify([vendorRoleId])` (same as `/promotions/list`).

2. **Rewards GET /customer/:id/rewards/points**  
   - **Enhancement:** Response now includes a `balance` object and snake_case aliases (`total_points`, `points_to_next_tier`, `lifetime_points_earned`, etc.) so customer normalizers work whether they read `raw` or `raw.balance`.

3. **Forensic validation script**  
   - Extended `scripts/forensic-ecommerce-marketing-validation.js` with customer-journey checks:  
     `/customer/banners`, `/promotions/list`, `/promotions/active`, `/config/service-launch/customer`, `POST /promotions/validate-code`, and `/customer/:id/rewards/points` and `/rewards/available` (with dummy customerId for contract check).

---

## 8. How to Run Validation

```bash
# Start API (e.g. Lambda local or node server), then:
API_BASE=http://localhost:3000 node scripts/forensic-ecommerce-marketing-validation.js
```

Covers: e-commerce admin, marketing admin, northbound shapes, and customer journey (banners, promotions, service launch, validate-code, rewards points/available).

---

## 9. Optional Follow-ups

- Confirm admin **Marketing / Launch plan** UI reads and writes the same `platform_settings` key as `/config/service-launch/customer` (SETTING_KEY in service-launch-config).
