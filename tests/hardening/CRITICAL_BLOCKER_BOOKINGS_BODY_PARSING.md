# CRITICAL BLOCKER: Bookings Body Parsing Issue

**Issue ID:** BLOCKER-001  
**Severity:** CRITICAL  
**Impact:** Blocks 80+ hardening tests requiring booking creation  
**Status:** INVESTIGATING  

---

## Problem

The `/bookings/create` endpoint consistently receives `undefined` for all body fields, despite:
- Framework sending valid JSON with correct headers
- Body parsing pattern identical to working `refund-policy/calculate` endpoint
- Multiple fix attempts applied

---

## Technical Details

### Working Pattern (refund-policy-engine.ts):
```typescript
const body = await c.req.json().catch(() => ({}));
const event: any = {
  httpMethod: 'POST',
  path: c.req.path,
  headers: Object.fromEntries(c.req.raw.headers),
  body: JSON.stringify(body), // ✅ Body correctly parsed
  // ...
};
```

### Failing Pattern (bookings-enhanced.ts):
```typescript
const body = await c.req.json().catch(() => ({})); // ❌ Returns {}
const event: any = {
  // ... same structure
  body: JSON.stringify(body), // Body is empty string "{}"
};
```

### Key Differences:
- **Handler Base Class:** refund-policy uses `BaseHandler`, bookings uses `BaseHandlerEnhanced`
- **Route Registration Order:** bookings at line 193, refund-policy at line 270
- **Body Parsing Result:** refund-policy works, bookings doesn't (same code!)

---

## Attempted Fixes

1. ✅ Simplified requestContext structure
2. ✅ Added http structure for BaseHandlerEnhanced compatibility
3. ✅ Moved route registration order
4. ✅ Added global event storage access
5. ✅ Multiple body parsing fallback approaches
6. ❌ **All attempts failed**

---

## Root Cause Hypothesis

1. **Request Body Consumption:** Hono Request body may be consumed before reaching route handler
2. **Middleware Interference:** Something between handler/index.ts and bookings route
3. **Handler Base Class Difference:** BaseHandlerEnhanced.parseBody() expects different event structure
4. **Request Object Creation:** How body is passed to Hono Request in handler/index.ts

---

## Next Investigation Steps

1. Compare exact Request object creation between working/non-working paths
2. Check if any middleware consumes body before bookings route
3. Test using BaseHandler instead of BaseHandlerEnhanced
4. Direct body access from original event in handler/index.ts

---

## Impact on Hardening Tests

**Blocked Tests:**
- Layer 1: H-001 to H-025 (idempotency, transactions, concurrency)
- Layer 2: H-026 to H-045 (state machine tests)
- Layer 3: H-046 to H-065 (financial atomicity)
- Layer 4: Partial (some security tests)
- Layer 5: Observability tests OK
- Layer 6: Chaos tests OK
- Layer 7: Concurrency tests blocked

**Total Blocked:** ~80 tests

---

## Workaround

Execute non-booking tests first:
- Security tests (endpoints that work)
- Observability tests
- Chaos tests (simulate failures)
- Some financial tests (if payment endpoints work)

---

**Status:** Investigation ongoing, critical priority
