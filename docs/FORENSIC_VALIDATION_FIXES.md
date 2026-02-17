# Forensic Validation – Recent Fixes

**Purpose:** Systematic validation and testing of fixes for refund-on-cancel policy, featured vendors, banner click tracking, and wallet ↔ rewards.

**Run code-path validation:** `node scripts/forensic-validation-fixes.js`  
**Optional live API tests:** `API_URL=https://your-api node scripts/forensic-validation-fixes.js`

---

## 1. Refund on Cancellation Uses Refund Policy Only

**Requirement:** Cancellation refund must use **refund policy** (vendor_refund_tiers / cancellation-policy-service). **Payment policy** is only for “how much to pay at booking” (100%, partial, etc.) and must never be used for cancellation refunds.

### Code-path validation

| Check | Location | Expected |
|-------|----------|----------|
| Cancel handler uses refund tier service | `backend/lambda/src/endpoints/bookings-enhanced.ts` | Imports and calls `getRefundTierForCancellation`, `computeRefundFromTier` |
| No payment policy in cancel flow | `backend/lambda/src/endpoints/bookings-enhanced.ts` | No `resolvePaymentPolicy`, `payment_policy`, or `paymentPolicy` in cancel handler block |
| Refund policy source | `backend/lambda/src/lib/services/cancellation-policy-service.ts` | Reads `vendor_refund_tiers`; `cancelled_by = 'pet_parent'` for customer cancels |

### Manual / E2E test

1. Create a paid booking (customer pays 100% or partial per **payment policy**).
2. Configure a **refund tier** for the vendor (e.g. “>24h → 100% refund”, “12–24h → 50%”).
3. Customer cancels **>24h** before booking → expect full refund (per refund tier).
4. Customer cancels **<12h** → expect partial or no refund per tier (not per payment policy).
5. Confirm refund amount matches refund tier logic, not payment percentage.

---

## 2. Featured / Spotlight Block on Customer Home

**Requirement:** Customer home shows a “Featured providers” block from admin-configured spotlights; data from `GET /customer/featured-vendors` (reads `spotlight_offers`).

### Code-path validation

| Check | Location | Expected |
|-------|----------|----------|
| Backend endpoint | `backend/lambda/src/endpoints/customer-content.ts` | `GET /customer/featured-vendors`; queries `spotlight_offers` (is_active, date range); returns `{ success, vendors, total }` |
| Endpoint registered | `backend/lambda/src/handler/index.ts` | `registerCustomerContentEndpoints(app)` called |
| Customer home state & fetch | `apps/customer-web/components/customer/CustomerHomeComplete.tsx` | `featuredVendors` state; fetch in `loadDynamicContent` from `/customer/featured-vendors?limit=6` |
| UI block | Same file | “Featured providers” section when `featuredVendors.length > 0`; cards use `onNavigate(ctaLink, { vendorId })` |

### Manual / E2E test

1. In Admin → Marketing → Spotlight, add a spotlight (vendor, title, image, CTA link).
2. Open customer app home (logged in or with phone).
3. Confirm “Featured providers” section appears when spotlights exist.
4. Confirm each card shows title/subtitle/image and CTA; click navigates to correct screen (e.g. vet, grooming).
5. With no active spotlights, section does not render.

### API test (optional)

- `GET /customer/featured-vendors?limit=6` → 200, body `{ success: true, vendors: [...], total: N }`; each vendor has `id`, `vendorId`, `vendorName`, `title`, `subtitle`, `imageUrl`, `ctaText`, `ctaLink`.

---

## 3. Banner Click Tracking

**Requirement:** Customer banner CTA calls `POST /banners/:id/click`; backend records click and analytics are available to admin.

### Code-path validation

| Check | Location | Expected |
|-------|----------|----------|
| Customer sends click | `apps/customer-web/components/customer/CustomerHomeComplete.tsx` | `apiClient.post(\`/banners/${banner.id}/click\`, { ... })` on banner CTA |
| Backend route | `backend/lambda/src/endpoints/admin-governance-enhanced.ts` | `app.post('/banners/:id/click', ...)`; writes to `banner_clicks`; updates `banners.click_count` |
| Route registered | `backend/lambda/src/handler/index.ts` | `registerAdminGovernanceEnhancedEndpoints(app)` called |
| Admin analytics | Same governance file | `GET /admin/banners/analytics` uses click data |

### Manual / E2E test

1. Note current `click_count` or analytics for a banner (Admin → Marketing → Banners / Analytics).
2. On customer home, click a banner CTA (or the banner itself if that triggers the POST).
3. Refresh admin analytics; confirm click count increased or new click record.

### API test (optional)

- `POST /banners/<valid-banner-uuid>/click` with body `{ customerId?: string, source?: string }` → 200, `{ success: true, message: 'Click tracked' }` (or similar).

---

## 4. Wallet → Rewards & Referral Links

**Requirement:** Wallet screen exposes quick actions to Rewards & Loyalty and Refer & Earn.

### Code-path validation

| Check | Location | Expected |
|-------|----------|----------|
| Wallet quick actions | `apps/customer-web/components/customer/CustomerWallet.tsx` | Buttons/links that call `onNavigate('rewards-loyalty')` and `onNavigate('referral-system')` (or href `/rewards`, `/referrals`) |
| Wrapper passes onNavigate | Customer app wrapper that renders Wallet | `WalletPage` or `CustomerWallet` receives `onNavigate` and uses it when inside app |

### Manual / E2E test

1. Open customer app → Account → Wallet (or direct wallet route).
2. Confirm “Rewards & points” and “Refer & Earn” (or equivalent) are visible.
3. Click each → navigates to Rewards/Loyalty and Referral screens (or correct URLs).

---

## 5. CustomerHomeWrapper Type Fix (allowedServiceStyles)

**Requirement:** No type error when passing problem grid selection to `ProblemGridFlowRouter` (ServiceStyle[]).

### Code-path validation

| Check | Location | Expected |
|-------|----------|----------|
| Type assertion | `apps/customer-web/components/customer/wrappers/CustomerHomeWrapper.tsx` | `allowedServiceStyles` passed as `('at_home' | 'at_center' | 'tele')[]` (e.g. cast from string[]) |

### Build test

- `npm run build` in `apps/customer-web` completes without type errors.

---

## Summary Checklist

| # | Fix | Code-path | Manual/E2E | API (optional) |
|---|-----|-----------|------------|-----------------|
| 1 | Refund on cancel = refund policy only | ✅ Script | Cancel booking, verify refund % from tier | — |
| 2 | Featured vendors on home | ✅ Script | Add spotlight, check home block | GET featured-vendors |
| 3 | Banner click tracking | ✅ Script | Click banner, check admin analytics | POST banners/:id/click |
| 4 | Wallet → Rewards/Referral | ✅ Script | Open wallet, click links | — |
| 5 | allowedServiceStyles type | ✅ Script + build | — | — |

---

## Validation results (code-path)

Run: `node scripts/forensic-validation-fixes.js`

| Area | Checks | Status |
|------|--------|--------|
| 1. Refund on cancel = refund policy only | 7 | ✅ All passed |
| 2. Featured vendors | 8 | ✅ All passed |
| 3. Banner click tracking | 4 | ✅ All passed |
| 4. Wallet → Rewards/Referral | 4 | ✅ All passed |
| 5. allowedServiceStyles type | 1 | ✅ Passed |
| **Total** | **24** | **0 failed** |

Build: `apps/customer-web` `npm run build` completes successfully (type check includes CustomerHomeWrapper).

*Document generated for forensic validation. Last updated: 2026-02-14.*
