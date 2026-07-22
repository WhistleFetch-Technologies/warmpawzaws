# Shop cancel/refund hardening — follow-up notes (PR4)

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
