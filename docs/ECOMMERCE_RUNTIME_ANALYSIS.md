# E-commerce Runtime Analysis

**Status:** Analysis only (no implementation)  
**Date:** 2026-07-08  

---

## Investigation 9 — Runtime Policy

### Engine domains

```ts
enum DiscountDomain {
  SERVICE = 'SERVICE',
  ECOMMERCE = 'ECOMMERCE',
}
```

Resolvers choose domain explicitly:

| Path | Domain |
|------|--------|
| Booking calculate / service resolve | `SERVICE` |
| Cart / best cart promotion | `ECOMMERCE` |
| `validate-code` | From `orderType` (booking → SERVICE, product → ECOMMERCE) |

### Policy loader (`runtime-policy-loader.ts`)

`loadRuntimePolicy(domain, …)` merges:

| Slice | Per-domain? |
|-------|-------------|
| Priority configuration | Yes (`domains[SERVICE|ECOMMERCE]`) |
| Stack policy | Yes (e.g. ecommerce `allowPlatformWithVendor: false` by default) |
| Limits | Yes |
| Funding | Shared |
| **businessRules** (Best Offer, combination matrix) | **Global** — one bundle field |
| Feature flags / publish id | Global |

### Independence answers

| Question | Finding |
|----------|---------|
| Does Runtime Policy support Services and E-commerce independently? | **Partial** — stack/priority/limits yes; businessRules no |
| Can Services Policy affect E-commerce? | **Yes** for shared businessRules and single published bundle; stack defaults differ per domain when configured |
| Can E-commerce Policy affect Services? | Same — shared businessRules edits impact both |

Policy Center UI domain selector is largely **view-oriented**; durable edits still sit in one published JSON.

### Candidate normalization quirk

- Platform promotion candidates normalize as **`SERVICE`** always.  
- Coupon candidates normalize as **`ECOMMERCE`** always.  

That mismatches rows that are product-scoped platform promotions or service-bucket coupons. Runtime domain for evaluate depends on **caller**, but shared providers can load overly broad sets before in-memory gates.

### Vendor physical split (good)

- Services: `vendor_service_promotions`  
- Shop: `vendor_promotions` with `applicable_products` / `applicable_categories`  

Vendor path is the **most cleanly separated** runtime surface today.

### Platform path (weak)

Shared `promotions` / `coupons` tables rely on `applicable_to` / targeting metadata. List endpoints and some validators do not consistently enforce domain. Booking apply uses `platformPlatformAppliesToBooking`-style exclusion of pure products; shop list and coupon galleries do not mirror that discipline.

---

## Runtime implications for the three QA bugs

1. **Admin list leak:** Not a runtime policy bug — persistence/heuristic.  
2. **Customer sees all coupons:** List APIs + FE galleries ignore domain filters; policy stack does not hide gallery items.  
3. **Wrong targeting UI:** Admin surface catalog — not policy.

---

## Recommendation (runtime)

Keep **one engine + one policy publish pipeline**. Extend domain independence by:

1. Persisting `discount_domain` (or strict `applicable_to` + surface) so list/load providers filter in SQL.  
2. Moving Best Offer / combination **businessRules** under `domains[SERVICE|ECOMMERCE]` when Shop vs Services rules diverge.  
3. Making ecommerce platform coupon validation reject service-only scopes (mirror of services rejecting products).  
4. Leaving vendor table split as-is.
