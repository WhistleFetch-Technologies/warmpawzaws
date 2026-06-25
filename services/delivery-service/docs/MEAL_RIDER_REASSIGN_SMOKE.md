# Meal rider reassign — dev smoke checklist

1. **Happy path:** `ready_for_pickup` → Rider A assigned → Admin CRM **Reassign rider** → Pidge unallocate webhook → Rider B webhook → vendor + customer show Rider B.
2. **Eligibility:** Reject reassign after pickup, delivered, non-Pidge, or within 2-minute debounce.
3. **Cancel guard:** Unallocate during reassign does **not** create `meal_refund_cases` or set `meal_orders.status = cancelled`.
4. **Vendor ticket:** **Rider issue — contact support** creates `meal_order` ticket with `rider_pickup_issue` context.
5. **Customer UI:** Stale Rider A hidden during `reassign_pending`; map hidden; headline “Finding a new delivery partner…”.
6. **Post-cancel guard:** After Pidge meal cancel, later webhooks must not reset `meal_orders.status` to `ready_for_pickup`.

**Deploy order:** migration 1045 → Java delivery-service → Lambda → shared-types + UIs.
