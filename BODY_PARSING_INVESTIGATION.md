# Body Parsing Issue Investigation

## Problem
`/bookings/create` endpoint receives `undefined` for all body fields despite valid JSON being sent.

## Key Findings

### 1. Handler Difference
- **Refund-policy**: Uses `BaseHandler` (works)
- **Bookings**: Uses `BaseHandlerEnhanced` (fails)

### 2. Route Registration Order
- `registerBookingDetailsEnhancedEndpoints` - line 268
  - Routes: `/bookings/:bookingId/enhanced`, `/bookings/:bookingId/prescriptions`, etc.
- `registerBookingEndpointsEnhanced` - line 271
  - Routes: `/bookings/create`, `/bookings/:bookingId`, etc.

**Issue**: If `/bookings/:bookingId` routes are registered BEFORE `/bookings/create`, Hono might match the parameterized route first.

### 3. Body Parsing Flow
1. `handler/index.ts` receives API Gateway event
2. Parses body: `parsedBody = JSON.parse(requestBody)`
3. Stores in event: `event.__parsedBody = parsedBody`
4. Creates Hono Request with `body: requestBody` (original string)
5. Route handler tries to access body

### 4. Current Implementation
- Bookings route tries pre-parsed body first: `originalEvent.__parsedBody`
- Falls back to `c.req.json()`
- Creates new event with `body: JSON.stringify(body)`
- Handler calls `parseBody(event)` which expects JSON string

## Hypothesis
The body might be consumed before reaching the bookings route, OR route matching is wrong.

## Next Steps
1. Check if route matching is the issue
2. Add comprehensive logging
3. Test with exact refund-policy pattern
