---
name: PDP Delivery Estimate
overview: Show "Deliver by …" on the shop PDP via client-side SLA calculation in shared-types. Extend the existing product API with vendor location fields only — no new endpoint, no Shiprocket, no blocking first paint.
todos:
  - id: shared-sla-util
    content: Add computeDeliverySlaEstimate() + state normalization + unit tests in packages/shared-types
    status: pending
  - id: product-api-vendor-fields
    content: Extend GET /ecommerce/products/:id SQL join to return vendor_state, vendor_pincode, vendor_shipping_origin_pincode
    status: pending
  - id: pdp-ui
    content: "ProductDetailClient: pincode/state from address, useMemo estimate, delivery card UI + guest pincode input"
    status: pending
  - id: local-qa
    content: Run shared-types tests + manual PDP QA (zero extra requests, pincode change instant, product load unchanged)
    status: pending
isProject: false
---

# PDP Delivery Estimate (Client-Side, No New API)

> Canonical copy also at `~/.cursor/plans/pdp_delivery_estimate_fb5cec20.plan.md`

## Goal

Show **"Deliver by {date}"** on [ProductDetailClient.tsx](apps/customer-web/app/shop/[productId]/ProductDetailClient.tsx):

- **Same state:** 2–3 days | **Different state:** 4–5 days
- **Client-side** calculation in `@warmpawz/shared-types`
- **No new API** — extend existing `GET /ecommerce/products/:id` with vendor location fields
- **No Shiprocket**, **no deploy** in implementation task

## Summary

| Item | Approach |
|------|----------|
| Calculation | Client `computeDeliverySlaEstimate()` in `packages/shared-types` |
| API | Extend existing product GET (+3 vendor fields) |
| PDP | `useMemo` when product + pincode ready |
| Extra HTTP requests | **0** |

See full plan in `pdp_delivery_estimate_fb5cec20.plan.md` in Cursor plans for diagrams, types, tests, and UI details.
