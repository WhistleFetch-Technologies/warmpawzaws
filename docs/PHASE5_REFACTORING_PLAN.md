# Phase 5: Function Refactoring Plan

## Overview

Refactor all 200+ files from KV-store usage to SQL-only repositories.

## Refactoring Strategy

### Priority Order

1. **Critical Core Files** (High Priority)
   - `payment-endpoints.tsx` - Payment processing
   - `booking-endpoints.tsx` - Booking management
   - `index.tsx` - Main entry point
   - `vendor-dashboard-endpoints.tsx` - Vendor operations
   - `customer-routes.tsx` - Customer operations

2. **Entity Management Files** (Medium Priority)
   - All `vendor-*.tsx` files
   - All `customer-*.tsx` files
   - All `staff-*.tsx` files
   - All `service-*.tsx` files

3. **Supporting Files** (Lower Priority)
   - Analytics files
   - Search files
   - Notification files
   - Settings files

## Refactoring Pattern

### Before (KV)
```typescript
import * as kv from './kv_store.tsx';

export function paymentEndpoints(app: Hono, kv: any) {
  app.post("/payments/create", async (c) => {
    const { bookingId, amount } = await c.req.json();
    const booking = await kv.get(`booking:${bookingId}`);
    const payment = { id: uuid(), bookingId, amount };
    await kv.set(`payment:${payment.id}`, payment);
    return c.json(payment);
  });
}
```

### After (SQL Repository)
```typescript
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getPaymentsRepository } from '../../lib/repositories/payments.ts';

export function paymentEndpoints(app: Hono) {
  app.post("/payments/create", async (c) => {
    const { bookingId, amount } = await c.req.json();
    const booking = await getBookingsRepository().findById(bookingId);
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }
    const payment = await getPaymentsRepository().create({
      booking_id: bookingId,
      customer_id: booking.customer_id,
      vendor_id: booking.vendor_id,
      amount,
      payment_method: 'razorpay',
    });
    return c.json(payment);
  });
}
```

## Key Changes

1. **Remove KV Parameter**
   - Change: `function endpoint(app: Hono, kv: any)`
   - To: `function endpoint(app: Hono)`

2. **Replace KV Imports**
   - Remove: `import * as kv from './kv_store.tsx'`
   - Add: `import { getXxxRepository } from '../../lib/repositories/xxx.ts'`

3. **Replace KV Operations**
   - `kv.get(key)` → `repository.findById(id)`
   - `kv.set(key, value)` → `repository.create(data)` or `repository.update(id, data)`
   - `kv.getByPrefix(prefix)` → `repository.findByXxx(filters)`
   - `kv.del(key)` → `repository.delete(id)`

4. **Update Function Signatures**
   - Remove `kv` parameter from all endpoint functions
   - Update all function calls in `index.tsx`

## Files to Refactor

### Critical (Start Here)
- [ ] `payment-endpoints.tsx`
- [ ] `booking-endpoints.tsx`
- [ ] `booking-lifecycle-complete.tsx`
- [ ] `vendor-dashboard-endpoints.tsx`
- [ ] `customer-routes.tsx`

### High Priority
- [ ] `vendor-onboarding.tsx`
- [ ] `vendor-bookings.tsx`
- [ ] `vendor-service-management.tsx`
- [ ] `staff-crud-endpoints.tsx`
- [ ] `wallet-endpoints.tsx`

### Medium Priority
- [ ] All other `vendor-*.tsx` files
- [ ] All other `customer-*.tsx` files
- [ ] All other `staff-*.tsx` files

### Lower Priority
- [ ] Analytics endpoints
- [ ] Search endpoints
- [ ] Notification endpoints
- [ ] Settings endpoints

## Progress Tracking

- Total files: ~200
- Completed: 0
- In Progress: 0
- Remaining: ~200

## Testing Strategy

After each refactoring:
1. Verify function compiles
2. Test endpoint manually
3. Check for KV imports (should be zero)
4. Verify SQL queries work

## Notes

- Preserve all business logic exactly
- Maintain API compatibility
- Update error messages if needed
- Add proper error handling for SQL operations

