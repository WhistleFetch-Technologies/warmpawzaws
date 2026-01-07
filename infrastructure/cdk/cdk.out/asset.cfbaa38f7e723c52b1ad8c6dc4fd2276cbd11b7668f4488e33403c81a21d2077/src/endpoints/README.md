# Endpoints Directory

This directory contains Node.js-compatible versions of endpoint files converted from Deno.

## Conversion Process

### Step 1: Copy endpoint file from Supabase functions
Source: `supabase/functions/make-server-3dd53475/<endpoint-file>.tsx`
Target: `backend/lambda/src/endpoints/<endpoint-file>.ts`

### Step 2: Convert imports
- `npm:hono@4` → `hono`
- `jsr:@supabase/supabase-js@2` → `@supabase/supabase-js`
- `npm:@aws-sdk/...` → `@aws-sdk/...`
- Remove `.tsx` extensions from relative imports
- Update relative paths (e.g., `../../lib/` → `../../../supabase/functions/make-server-3dd53475/lib/`)

### Step 3: Convert Deno-specific code
- `Deno.env.get()` → `process.env`
- `Deno.serve()` → Already handled by Lambda handler
- File system operations → Use `/tmp` directory only

### Step 4: Test registration
- Import in `handler.ts`
- Register with Hono app
- Test endpoint accessibility

## Core Endpoints (Priority)

1. `auth-endpoints.ts` - Authentication
2. `booking-endpoints-sql.ts` - Bookings
3. `payment-endpoints-sql.ts` - Payments
4. `customer-routes.ts` - Customers
5. `vendor-routes.ts` - Vendors
6. `staff-crud-endpoints.ts` - Staff

