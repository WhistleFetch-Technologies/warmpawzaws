# Shop cancel/refund hardening — follow-up notes (PR4)

## Prod backfill — missing / stuck refunds (manual only)

**Do not run on deploy.** Requires explicit ops approval after dev smoke → prod backend + admin deploy.

### Pre-check (read-only)

```sql
-- Missing refunds (cancelled + paid + Razorpay payment + no active refund)
SELECT o.order_number, o.id, p.razorpay_payment_id, p.amount
FROM orders o
JOIN payments p ON p.order_id = o.id
WHERE o.order_status = 'cancelled'
  AND LOWER(COALESCE(o.order_type, 'ecommerce')) IN ('ecommerce', 'shop', 'shop_order')
  AND LOWER(COALESCE(o.payment_status, '')) IN ('paid', 'completed')
  AND p.razorpay_payment_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM refunds r
    WHERE r.order_id = o.id AND r.refund_status NOT IN ('failed', 'rejected')
  );

-- Stuck processing (Razorpay refund id set, completed_at null)
SELECT r.id, o.order_number, r.razorpay_refund_id, r.refund_status, r.completed_at
FROM refunds r
JOIN orders o ON o.id = r.order_id
WHERE r.refund_status = 'processing'
  AND r.razorpay_refund_id IS NOT NULL
  AND r.completed_at IS NULL;
```

Verify Razorpay Dashboard: `amount_refunded = 0` before Initiate; `processed` before Reconcile-only.

### Backfill order (29 Jul 2026 incidents)

| Step | Order | Action | Admin API / UI |
|------|-------|--------|----------------|
| 1 | **B** `ORD-1784199432627-799` (₹200) | Initiate | `POST /admin/shop-refunds/initiate` `{ "orderNumber": "ORD-1784199432627-799", "reason": "Manual backfill — missed cancel refund" }` or **Missing refunds** tab → Initiate |
| 2 | **C** `ORD-1784042349207-906` (₹210) | Initiate | Same with `ORD-1784042349207-906` |
| 3 | **A** `ORD-1784810695659-47` (₹200) | Reconcile only | `POST /admin/shop-refunds/:refundId/reconcile` or **Refunds → processing** → Reconcile. Razorpay `rfnd_TGxAN0v6ThMZLf` already `processed` (RRN `620418872022`) — do **not** Initiate |

**Reference IDs**

| Incident | Order UUID | Razorpay payment | Razorpay refund |
|----------|------------|------------------|-----------------|
| B | `43b60aa0-1fab-4793-acac-c3fd46a3e504` | `pay_TE9JF7g6xpkfmn` | — |
| C | (query `order_number`) | `pay_TDQhQlr6BrgJuM` | — |
| A | `d455df50-a0a1-403c-8606-a5832aa71dbb` | `pay_TGwudeasXJksaJ` | `rfnd_TGxAN0v6ThMZLf` |

### Post-check

- `refunds` row exists with `razorpay_refund_id` (B/C) or `refund_status = completed` + `completed_at` set (A).
- `payments.payment_status` → `refunded` (full refund).
- Customer UPI/bank credit within Razorpay SLA; record RRN in support ticket.

---

## Logistics / Shiprocket auto-cancel (deferred)

Before adding synchronous logistics cancel on paid shop cancel:

1. Query dev RDS for active ecommerce shipments:
   ```sql
   SELECT COUNT(*) FROM shipments s
   JOIN orders o ON o.id = s.order_id
   WHERE LOWER(COALESCE(o.order_type, 'ecommerce')) IN ('ecommerce', 'shop')
     AND LOWER(COALESCE(s.status, '')) NOT IN ('cancelled', 'failed', 'rto');
   ```
2. If count is material, hook `trigger-auto-shipment` companion cancel in `cancelPaidShopOrder` **after** refund row insert (async, non-blocking).
3. Until then, ops cancel shipments manually via logistics admin.

## Return API consolidation (design only)

| Module | Role today |
|--------|------------|
| `returns-enhanced.ts` | Primary: vendor decision, process-refund, vendor list |
| `returns.ts` | Legacy shim routes |
| `customer/orders/.../return` | Customer-initiated return (4-layer) |

**Target:** single register module with shared service for return create + refund; keep HTTP paths stable. No behavior change in this initiative.

## Legacy `POST /customer/orders` COD default

`order-base-handlers.service.ts` still defaults `payment_method` to `cod` when omitted. Online-only checkout is enforced by `assertShopCheckoutPaymentAllowed()` — COD/wallet requests fail at API gate. Do not re-enable COD without product approval.
