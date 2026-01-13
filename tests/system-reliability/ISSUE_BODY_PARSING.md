# ISSUE: Request Body Parsing in Bookings Endpoint

## Problem
The `/bookings/create` endpoint is not receiving the request body correctly. All fields are coming through as `undefined` even though the body is being sent correctly from the test framework.

## Root Cause
The `createApiGatewayEvent` function in `bookings-enhanced.ts` is trying to parse the body using `c.req.json()`, but this is returning an empty object. The body stream may have already been consumed, or Hono isn't parsing it correctly when the Request is created from API Gateway event.

## Current Status
- ✅ Test framework is sending body correctly (verified in debug logs)
- ✅ Body contains all required fields with valid UUIDs
- ❌ API Gateway/Hono is not parsing body correctly
- ❌ All validation errors show `undefined` for all fields

## Fix Required
The `createApiGatewayEvent` function needs to properly extract the body from the Hono request. Other endpoints (like `refund-policy-engine.ts`) successfully use `await c.req.json().catch(() => ({}))`, but this pattern isn't working for bookings.

## Temporary Workaround
For now, tests will fail with validation errors. Once the body parsing is fixed, tests should proceed to the next validation step (entity existence checks).

## Next Steps
1. Fix body parsing in `bookings-enhanced.ts`
2. Deploy fix to Lambda
3. Re-run tests
4. Continue fixing issues until all 100 tests pass
