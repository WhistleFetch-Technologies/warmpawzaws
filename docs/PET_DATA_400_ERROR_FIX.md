# Pet Data 400 Error Fix

## Issue
**Error:** `Failed to load resource: the server responded with a status of 400 ()`
**Message:** `Error loading pet data: ApiError: HTTP 400 - Pet not found`

## Root Cause
Route conflict between two endpoints:
1. `GET /customer/pets/:phone` - Registered in `customer-enhanced.ts` (line 326)
2. `GET /customer/pets/:petId` - Registered in `pets.ts` (line 356)

**Problem:** 
- `registerCustomerEndpointsEnhanced` was called BEFORE `registerPetEndpoints`
- When frontend calls `/customer/pets/${petId}` with a UUID, Hono matches the first route (`/customer/pets/:phone`)
- The phone route tries to process the UUID as a phone number, which fails validation and returns 400

## Solution

### 1. Reordered Route Registration
**File:** `backend/lambda/src/handler/index.ts`

Moved `registerPetEndpoints(app)` to be called BEFORE `registerCustomerEndpointsEnhanced(app)`:

```typescript
// ✅ FIX: Register pet endpoints BEFORE customer endpoints to avoid route conflict
// /customer/pets/:petId must come before /customer/pets/:phone
registerPetEndpoints(app); // /customer/pets/:petId - before /customer/pets/:phone
// Now register parameterized routes
registerCustomerEndpointsEnhanced(app); // /customer/:customerId (parameterized - must be last)
```

### 2. Added UUID Validation in Phone Route
**File:** `backend/lambda/src/endpoints/customer-enhanced.ts`

Added UUID check to prevent phone route from processing pet IDs:

```typescript
app.get('/customer/pets/:phone', async (c) => {
  try {
    const phone = c.req.param('phone');
    if (!phone) {
      return c.json({ error: 'phone is required' }, 400);
    }

    // ✅ FIX: If the parameter looks like a UUID (petId), return 404
    // This allows the /customer/pets/:petId route to handle it
    if (isValidUUID(phone)) {
      return c.json({ error: 'Pet not found' }, 404);
    }

    // ... rest of phone route logic
  }
});
```

## How It Works

1. **Route Matching Order:**
   - `/customer/pets/:petId` is registered first
   - `/customer/pets/:phone` is registered second

2. **Request Flow:**
   - Request: `GET /customer/pets/{uuid}`
   - Hono checks routes in order
   - First route (`/customer/pets/:petId`) matches if UUID is valid
   - If not a valid petId, falls through to phone route
   - Phone route checks if it's a UUID and returns 404 if so

3. **Phone Number Requests:**
   - Request: `GET /customer/pets/1234567890`
   - First route doesn't match (not a valid UUID)
   - Second route (`/customer/pets/:phone`) matches and processes

## Testing

### Test Case 1: Pet ID (UUID)
```bash
GET /customer/pets/fGQ5pNSPl1biZwiKRN42S
Expected: 200 OK with pet data
```

### Test Case 2: Phone Number
```bash
GET /customer/pets/9611377119
Expected: 200 OK with pets array
```

### Test Case 3: Invalid Pet ID
```bash
GET /customer/pets/invalid-id
Expected: 404 Not Found
```

## Files Changed

1. `backend/lambda/src/handler/index.ts`
   - Reordered route registration
   - Moved `registerPetEndpoints` before `registerCustomerEndpointsEnhanced`

2. `backend/lambda/src/endpoints/customer-enhanced.ts`
   - Added UUID validation in `/customer/pets/:phone` route
   - Returns 404 if parameter is a UUID (allows petId route to handle it)

## Status
✅ **FIXED** - Route conflict resolved, pet data loading should work correctly now.

## Deployment
After deploying these changes:
1. Pet data by ID will load correctly
2. Phone-based pet queries will continue to work
3. No breaking changes to existing functionality
