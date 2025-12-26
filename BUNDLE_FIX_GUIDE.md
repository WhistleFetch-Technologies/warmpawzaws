# Bundle Explosion Fix Guide

## Root Cause Identified ✅

**Problem:** `make-server-3dd53475` has **188 top-level imports**, causing bundle explosion during cold start.

**Evidence:**
- Canary function deploys successfully (infrastructure works)
- Main function fails with 500 during deployment (bundle too large)
- 513 TypeScript files, 9MB total size
- All endpoints imported at module initialization

## Solution Strategy

### Phase 1: Minimal Boot (Immediate Fix)

1. **Keep only essential imports at top level:**
   - `Hono` framework
   - `cors` middleware
   - `logger` middleware

2. **Convert all endpoint imports to lazy loading:**
   - Use `await import()` inside handlers
   - Load endpoints on first request or in background

3. **Move heavy SDKs to lazy loading:**
   - Payment SDKs
   - Elasticsearch clients
   - AWS SDKs
   - Any large npm packages

### Phase 2: Systematic Refactoring

1. **Create endpoint registry:**
   ```typescript
   // endpoint-registry.ts
   export const endpointLoaders = {
     regions: () => import('./region-endpoints.tsx'),
     auth: () => import('./auth-endpoints.tsx'),
     // ... etc
   };
   ```

2. **Lazy load in handlers:**
   ```typescript
   app.get('/regions/*', async (c) => {
     const { regionEndpoints } = await import('./region-endpoints.tsx');
     return regionEndpoints.fetch(c.req);
   });
   ```

### Phase 3: Split Function (Long-term)

Split into smaller functions:
- `make-server-auth`
- `make-server-regions`
- `make-server-admin`
- `make-server-vendor`
- etc.

## Immediate Action Items

1. ✅ Backup created: `index.ts.backup`
2. ⏳ Convert imports to lazy loading
3. ⏳ Test deployment
4. ⏳ Gradually add endpoints back

## Files to Modify

- `supabase/functions/make-server-3dd53475/index.ts` - Main entry point
- All endpoint files should be ready for lazy loading

## Testing

After fixes:
1. Deploy: `npx supabase functions deploy make-server-3dd53475`
2. Test OPTIONS: `curl -X OPTIONS https://.../regions/active`
3. Test health: `curl https://.../health`
4. Check logs for bundle size warnings

