# Supabase to AWS Lambda Migration Guide

## Overview

This document tracks the systematic migration of all Supabase Functions to AWS Lambda handlers.

## Migration Status

### Completed Migrations

1. ✅ **RDS Connection Module** (`backend/lambda/src/database/rds-connection.ts`)
   - Direct PostgreSQL connection using `pg` library
   - Connection pooling
   - Transaction support
   - Query helpers (select, insert, update, delete, upsert)

2. ✅ **Base Handler Class** (`backend/lambda/src/handler/base-handler.ts`)
   - Error handling
   - Logging
   - Response formatting
   - Authentication extraction

3. ✅ **Auth Endpoints** (`backend/lambda/src/endpoints/auth.ts`)
   - POST /auth/send-otp
   - POST /auth/verify-otp

4. ✅ **Vendor Onboarding Endpoints** (`backend/lambda/src/endpoints/vendor-onboarding.ts`)
   - POST /vendor/apply
   - GET /vendor/onboarding/status

### In Progress

- Booking endpoints
- Payment endpoints
- Role config endpoints

### Pending Migrations

All other Supabase functions in:
- `supabase/functions/make-server-3dd53475/` (367 files)
- `supabase/functions/make-server-vendor/` (multiple files)
- `supabase/functions/make-server-booking/` (multiple files)
- `supabase/functions/make-server-payment/` (multiple files)
- `supabase/functions/make-server-customer/` (multiple files)
- `supabase/functions/make-server-admin/` (multiple files)
- `supabase/functions/server/` (283 files)

## Migration Pattern

### Step 1: Identify Supabase Function
```typescript
// Source: supabase/functions/make-server-core/auth-endpoints.tsx
export function registerAuthEndpoints(app: Hono) {
  app.post("/make-server-core/auth/send-otp", async (c) => {
    // ... implementation
  });
}
```

### Step 2: Create Lambda Handler
```typescript
// Target: backend/lambda/src/endpoints/auth.ts
class SendOtpHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    // ... implementation using RDS connection
  }
}
```

### Step 3: Replace Supabase Client
```typescript
// OLD: Using Supabase client
const client = getDbClient();
const { data } = await client.from('table').select('*');

// NEW: Using RDS connection
const data = await select('table', {});
```

### Step 4: Update API Gateway Routes
- Register endpoint in main handler
- Update frontend API calls to use API Gateway URL

## Critical Functions Priority

1. **Authentication** ✅ (Completed)
2. **Vendor Onboarding** ✅ (Completed)
3. **Booking Endpoints** (In Progress)
4. **Payment Endpoints** (Pending)
5. **Role Config** (Pending)
6. **Customer Routes** (Pending)
7. **Admin Routes** (Pending)

## Migration Checklist

For each function:
- [ ] Create Lambda handler class
- [ ] Replace Supabase client with RDS connection
- [ ] Update all database queries
- [ ] Remove Supabase dependencies
- [ ] Add error handling
- [ ] Add logging
- [ ] Write unit tests
- [ ] Update API Gateway routes
- [ ] Update frontend API calls
- [ ] Verify functionality
- [ ] Remove Supabase function file

## Notes

- All migrations must maintain backward compatibility during transition
- Keep Supabase functions running until Lambda handlers are verified
- Use feature flags to switch between Supabase and Lambda
- Monitor error rates during migration

