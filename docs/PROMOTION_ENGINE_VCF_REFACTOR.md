# Promotion engine refactor — V / C / F

**Status:** product contract for the next build on `feature/promo-engine-v1`.  
**Date:** 18 Sep 2026.  
**Supersedes, for product policy only:** HLD visit examples that treat “second visit = 15% off” as pricing, and master plan §18 where catalogue percent owns the Pay Bill payable.  
**Does not supersede:** evaluate → commit → reverse, never credit the wallet on preview, wallet as the cashback ledger.

The promotion engine is the only discount and cashback path on booking, tele, Pay Bill, ecommerce, and wallet spend. Catalogue tier and commission stay settlement math. They are not a second customer discount. Coupons and vendor-promotion tables stay retired.

Identity is real rows, not a slug list in code.

| Thing | Row |
| --- | --- |
| Vendor | `vendors.id`. Display `business_name`. Role is `vendors.role_id` → `roles.id`, `roles.name`, `roles.display_name`. |
| Category | `service_categories.id`. Stable key already on that row is `category_id`. Display `name`. Which roles may offer it is `service_categories.vendor_roles`. |
| Ecommerce category | `ecommerce_categories.id`. Used only when the spend channel is ecommerce. Never a visit. |
| Role | `roles.id`. Not a promo enum. |

`category-aliases.ts` (`vet` → `veterinary`, and the rest of that map) is an inbound cleanup for old callers. New rules store `service_categories.id`. The map is not a category list and must not grow.

---

## Business logic

The promotion is three separate choices of vendor, category, or platform, not one. Visit counting, where the offer is published, and where cashback can be spent are independent.

**V** is one vendor. **C** is one category. **F** is the whole platform, with no vendor or category limit.

### 1. What counts as a visit

Pick **V**, **C**, or **F** first. That is whose transactions get counted.

Then pick how wide the count is:

- **General** counts tele, appointment, and Pay Bill together, inside the scope you already picked. For a vendor, that is every one of those three at that vendor. For a category, every one of those three in that category. For free-for-all, every one of those three on the platform.
- **Specific** is the same three as checkboxes. You tick one, two, or all of tele, appointment, and Pay Bill. Ecommerce is not a visit. It does not add to the count.

### 2. Which visit

After the source is fixed, the rule says which visit it applies to. That is a visit number, or a loop, so nobody types visit 1 through visit 100 by hand. A loop is a pattern: this visit, every Nth visit, from visit X onward.

### 3. What they get

A promotion is one of three:

- Discount only
- Cashback only
- Discount and cashback together

When both are on, **max discount** is the ceiling on the two combined. The instant cut and the cashback together cannot go past that cap.

### 4. Where it is published

Again **V**, **C**, or **F**. This only decides who the offer is for: one vendor, one category, or the whole platform. It does not decide how visits are counted, and it does not decide where cashback is spent.

### 5. Where the cashback can be used

This applies only after payment succeeds. Again **V**, **C**, or **F**: same vendor, same category, or anywhere on the platform.

Under that, you tick the payment types. There are four, not three:

- Tele
- Pay Bill
- Appointment
- Ecommerce

### 6. Expiry

Cashback has one expiry. The clock starts when the cashback is awarded, not when the promotion was created.

Ecommerce never increases the visit count. It only appears as a place the cashback can be spent.

---

## What this build must change

| Already true | Still wrong |
| --- | --- |
| One promotion can be discount, cashback, or both. Stacking keeps one discount and can keep cashback. | Max discount caps only the discount line. Both-together has no shared ceiling. |
| Visit loops exist in the audience step (first, Nth, every Nth, between, from N on). | They read one counter per category name, not V / C / F and not tele vs appointment vs Pay Bill. |
| Expiry days are stored on the cashback benefit and written at commit. | Redeem is a list of category strings. It cannot say “this vendor” or “shop and tele only”. |
| Evaluate does not credit the wallet. Commit does. Reverse exists. | Visit counts are not written when a booking, tele consult, or Pay Bill actually completes. Only `POST /promo-engine/behaviour/events` writes them. |
| Admin categories load from `GET /admin/catalog/categories`. | Checkout still sends loose strings (`VET`, `WPAY`, `grooming`). Pay Bill is a channel, not a category. |
| Booking, Pay Bill, shop, and packages call the engine. | A platform promotion and a vendor promotion can both match. There is no rule that the vendor offer wins. Catalogue and engine have both been used as the customer discount. This build makes the engine the only customer discount. |

---

## Channels

Closed set. Adding a fifth channel is a code change. Adding a vendor, a role, or a catalogue category is not.

| Business name | Stored value | How a live payment is classified |
| --- | --- | --- |
| Tele | `tele` | Booking `service_style` / `service_type` in `tele`, `video_consultation`, `online`. |
| Appointment | `appointment` | `at_center`, `at_clinic`, `at_home`, `home_visit`. Home and clinic are one channel. |
| Pay Bill | `paybill` | Warmpawz Pay initiate / verify. Never a category. |
| Ecommerce | `ecommerce` | Shop order. Spend only. |

Nutrition, grooming, veterinary, walking, and any later catalogue row are **categories** (`service_categories`), reached through the vendor’s **role** (`vendors.role_id`, `service_categories.vendor_roles`). They are not channels and not constants in the engine.

---

## Promotion contract

Stored on the existing promotion row. `metadata` holds the three scopes. `condition_json` holds only the visit loop, compiled by the admin form. `benefit_json` holds discount and cashback. No new table.

```ts
type Letter = 'V' | 'C' | 'F';
type CountChannel = 'tele' | 'appointment' | 'paybill';
type SpendChannel = CountChannel | 'ecommerce';

interface PromoVcfConfig {
  visitSource: {
    letter: Letter;
    /** vendors.id when letter is V */
    vendorId?: string;
    /** service_categories.id when letter is C */
    categoryId?: string;
    width: 'general' | 'specific';
    /** specific only. general means all three count channels. Ticking all three equals general. */
    channels?: CountChannel[];
  };
  visitLoop:
    | { kind: 'visit_number'; n: number }       // this visit. First visit is n = 1, completed count 0.
    | { kind: 'every_nth'; n: number }
    | { kind: 'from_onward'; n: number }
    | { kind: 'between'; n: number; m: number }
    | { kind: 'every' };
  benefitMode: 'discount' | 'cashback' | 'both';
  /** Rupee ceiling. When mode is both, discount + cashback cannot exceed this. */
  maxDiscount?: number;
  publish: {
    letter: Letter;
    vendorId?: string;
    categoryId?: string;
  };
  redeem?: {
    letter: Letter;
    vendorId?: string;
    categoryId?: string;
    /** ecommerce_categories.id when letter is C and the only spend channel is ecommerce */
    ecommerceCategoryId?: string;
    channels: SpendChannel[];
  };
  /** Days after award. Required when benefitMode is cashback or both. */
  expiryDays?: number;
}
```

Discount and cashback values stay the current benefit objects: `PERCENT` or `FIXED`, plus `value`. Expiry is not the promotion start/end. Start/end still limit when the promotion can match.

Validation on save:

- `V` requires `vendorId` that exists on `vendors` and is not deleted.
- `C` requires `categoryId` that exists on `service_categories` (or `ecommerce_categories` only for redeem of an ecommerce channel).
- `F` must not send an id.
- `specific` requires at least one count channel.
- `both` requires `maxDiscount` greater than 0.
- Cashback requires `expiryDays` and at least one spend channel.
- Visit source, publish, and redeem ids are allowed to differ.

---

## Visit profile

`customer_behaviour_profiles.services` is already JSON. Extend it. Do not add a table. Old per-category keys stay so rules saved before this build still resolve.

```ts
interface ChannelCell {
  count: number;
  lastAt: string | null;
}

interface VisitProfile {
  platform: Record<CountChannel, ChannelCell>;
  categories: Record<string, Record<CountChannel, ChannelCell>>; // key = service_categories.id
  vendors: Record<
    string,
    { categoryId: string; roleId: string } & Record<CountChannel, ChannelCell>
  >; // key = vendors.id
}
```

General is not stored. At evaluate time the engine sums the three cells. Specific sums the ticked cells. Each promotion gets its own `visit.count` from its own visit source. Two promotions on one payment can see different numbers.

Completed count is what the loop reads. The payment in progress is not completed, so the first completed visit is 0.

Write one cell on three buckets when a payment **completes**, never on quote:

| Event | Channel | Buckets incremented |
| --- | --- | --- |
| Booking or tele marked completed, and paid | `tele` or `appointment` from service style | platform, `service_categories.id` of that service, `vendors.id` |
| Warmpawz Pay capture | `paybill` | platform, category resolved from that vendor’s role, that `vendors.id` |
| Shop paid, package purchase, quote, failed payment | none | no write |

Idempotency key: `booking_id` or Warmpawz Pay payment id, stored in `customer_behaviour_events`. A retry does not add a second visit. Full refund or cancel after complete decrements that same key once.

Category on a Pay Bill is not a client string. Resolve it on the server:

1. `vendors.role_id`
2. `service_categories` row whose `vendor_roles` contains that `roles.id` or `roles.name`
3. If the Pay Bill is against a booking, the booking’s service category wins when it is a real `service_categories.id`

If no row matches, do not invent a slug. Skip the category bucket, still write platform and vendor, and do not match `C` publish rules.

---

## One winner when promotions conflict

A payment can match a vendor promotion, a category promotion, and a platform promotion at the same time. The customer sees one result.

1. Drop promotions whose **publish** scope does not match this payment. `V` matches only that `vendors.id`. `C` matches only that `service_categories.id`. `F` matches every payment. Publish does not look at visit source.
2. Among the rest, drop those whose visit loop fails for **their** visit source.
3. Exactly one promotion applies. Order: publish `V` beats `C` beats `F`. Same letter: higher `priority`. Still tied: later `updated_at`.
4. The winner’s discount, cashback, or both is the only benefit. Losers do not add a second discount or a second cashback.
5. `explain.rejected_promotions` includes the loser ids and `LOST_TO_MORE_SPECIFIC` or `LOST_TO_PRIORITY`.

This is what makes a clinic’s own ladder beat a platform offer without a deploy. Priority still breaks ties inside one letter, so two vendor rules for the same clinic stay an admin decision.

Limits (per user, budget, dates, active status) still reject before this order. A paused vendor rule does not block the category rule.

---

## Combined cap

When `benefitMode` is `both` and `maxDiscount` is set:

1. Compute the discount (percent or fixed), not above the bill.
2. Compute the cashback (percent or fixed).
3. If discount + cashback is above `maxDiscount`, cut cashback first.
4. If the discount alone is above `maxDiscount`, cut the discount to the cap and set cashback to 0.

Discount only uses `maxDiscount` as today’s per-line cap. Cashback only is not cut by that field; expiry still applies.

---

## Checkout contract

Every quote and every pay uses the same evaluate request. The client does not choose the winner and does not send a promotion id except to reuse a stored evaluation.

```ts
interface EvaluateTransaction {
  channel: 'tele' | 'appointment' | 'paybill' | 'ecommerce';
  amount: number;
  vendorId?: string;          // vendors.id. Required except a shop order with no seller.
  /** Hint only. Server resolves service_categories.id from the booking service or vendor role. */
  categoryId?: string;
  referenceId?: string;       // booking id, order id, or pay bill id
}

interface EvaluateResponse {
  evaluationId: string;
  eligible: boolean;
  winnerPromotionId: string | null;
  summary: {
    grossAmount: number;
    discount: number;
    payable: number;
    cashback: number;
  };
  cashback: {
    amount: number;
    expiryDays: number | null;
    redeem: PromoVcfConfig['redeem'] | null;
  } | null;
  conflicts: Array<{ promotionId: string; reason: 'LOST_TO_MORE_SPECIFIC' | 'LOST_TO_PRIORITY' }>;
}
```

`persist: false` is the lookup while the customer is still browsing. It does not write a visit and does not credit cashback. `persist: true` stores `evaluation_id` for two hours. Pay and verify must send that id back. If it is missing or expired, the server evaluates again with the same contract. Payable on the gateway must equal `summary.payable`. A mismatch is a 400, not a silent second discount.

Customer UI shows one line: the instant discount, then the pending cashback, expiry, and where it can be spent (vendor name, category name, or “anywhere”, plus the ticked channels). It does not list losing promotions.

### Wiring

| Surface | Channel | Vendor and category | Evaluate | Commit | Visit write |
| --- | --- | --- | --- | --- | --- |
| Booking quote and create. Tele is this path when style is tele. | `tele` or `appointment` | `bookings.vendor_id`. Category from the booked service’s catalogue row, else vendor role → `service_categories`. | `booking-promotion-service` | payment success, existing commit | service completed |
| Warmpawz Pay initiate and verify | `paybill` | body `vendorId`. Category from role, or from the linked booking if present. | `customer_warmpawz_pay_initiate_post.service` | verify, `commit-wpay-promo-engine` | capture |
| Shop cart, place order, Razorpay verify | `ecommerce` | seller `vendors.id` when the line has one. Category is not a visit. Publish `F`, or `V` of that seller. | `resolve-ecommerce-engine-discount`, cart in `ads-recommendations` | order paid | never |
| Package purchase | channel of the package’s service style, or no visit | package vendor and its role’s category | `package-booking` | package pay | only if a covered service later completes |
| Wallet debit | channel of the payment being made | vendor and category of that payment | not an earn | `consumePromoCashbackForDebit` checks redeem | never |

Server resolves category before evaluate. Callers stop passing `VET`, `WPAY`, `GROOMING`, or `service_type` as the category. `service_type` remains the style used only to pick `tele` vs `appointment`.

Redeem check, same payment context: letter matches vendor id or category id, and `channel` is in `channels`. Ecommerce is allowed only when ticked. Rows written before this build have a category string and no letter; those keep today’s category check until they expire.

Engine discount is the only reduction of what the customer pays. Warmpawz Pay must not also apply catalogue percent. Shop must not let a vendor coupon replace or add to the engine amount.

---

## Admin form

Reuse the current wizard shell. Replace the audience step. Pickers call live lists.

| Step | Control | Source |
| --- | --- | --- |
| Visit source letter | V / C / F | — |
| Vendor | search by `business_name`, show `roles.display_name` | `vendors` join `roles` on `vendors.role_id`, `is_deleted` is not true |
| Category | `name`, store `id` | `GET /admin/catalog/categories` (`service_categories`). Response must include `id`, `category_id`, `name`, `vendor_roles`. |
| Width | General, or checkboxes tele / appointment / Pay Bill | — |
| Loop | visit number, every Nth, from N on, between. Fields N and M only. | compiles to the existing condition operators |
| Benefit | discount only, cashback only, both. Percent or rupees. Max discount. Expiry days. | existing benefit JSON |
| Publish | V / C / F, same pickers, not copied from visit source unless the admin copies them | — |
| Redeem | V / C / F, then tele, Pay Bill, appointment, ecommerce | wallet row JSON |

No seed of `DEV_GV_*` style codes as the product. No hardcoded category chips.

---

## Implementation order

1. **Context resolver.** One function used by every checkout: `vendorId`, `roleId`, `service_categories.id`, `channel`. Unit tests for role → category via `vendor_roles`, booking style → channel, Pay Bill not becoming a category, unknown role not inventing a slug.
2. **Profile writer** on booking completion and Pay Bill capture. Idempotent. No ecommerce. Refund reverses one event.
3. **Evaluate.** Per promotion, sum `visit.count` from that promotion’s visit source. Apply the loop. Apply publish. Pick one winner with V > C > F, then priority. Return conflicts. Old promotions with no `visitSource` keep today’s category condition so they do not break on deploy.
4. **Combined cap** in `calculate-benefits`.
5. **Commit** copies `redeem` and `expiryDays` onto the wallet row. Spend path checks letter and channel.
6. **Pass the contract** from booking, Pay Bill, shop, and package. Delete the second discount (catalogue percent on Pay Bill, shop coupon overlay).
7. **Admin form** compiles `PromoVcfConfig` into metadata, conditions, and benefits. Vendor search and catalogue categories only.
8. **Customer quote UI** renders the one winner. Reuse `evaluationId` from preview through pay.
9. **Backfill** completed bookings and captured Pay Bill into the new buckets, keyed so it cannot double-count. Dev first. Not on the request path.

No new migration if `metadata`, `services`, and `redeem_scope` stay JSON. If a query needs an index later, add a numbered migration. Do not edit 1111–1114.

---

## Done when

- A new `service_categories` row and a new vendor with a real `role_id` can be selected with no deploy and no edit to `category-aliases.ts`.
- Pay Bill at one vendor does not increment another vendor, and does not increment tele.
- General at that vendor does increment for tele, appointment, and Pay Bill there.
- A shop order never changes a visit count.
- A vendor promotion and a platform promotion on the same bill: the vendor promotion is the only one applied, and the response lists the platform one as `LOST_TO_MORE_SPECIFIC`.
- Discount and cashback together never exceed max discount. The instant cut is kept first.
- Cashback with redeem `V` + Pay Bill unticked cannot be spent on the next Pay Bill at that vendor, and can be spent on ecommerce if that box is ticked.
- Changing the visit number or the percent is an edit of the promotion.
