# Function Split Deployment Guide

## ✅ Status: Complete

All 6 split functions are successfully deployed and operational:

- ✅ `make-server-core` - Auth, Health, Regions
- ✅ `make-server-admin` - Admin operations
- ✅ `make-server-vendor` - Vendor operations
- ✅ `make-server-customer` - Customer operations
- ✅ `make-server-booking` - Booking management
- ✅ `make-server-payment` - Payment processing

## 🎯 Deployment Commands

### Deploy All Functions (Initial Setup)
```bash
npx supabase functions deploy make-server-core --project-ref vpvpbdwtyugbknrntkho --no-verify-jwt
npx supabase functions deploy make-server-admin --project-ref vpvpbdwtyugbknrntkho --no-verify-jwt
npx supabase functions deploy make-server-vendor --project-ref vpvpbdwtyugbknrntkho --no-verify-jwt
npx supabase functions deploy make-server-customer --project-ref vpvpbdwtyugbknrntkho --no-verify-jwt
npx supabase functions deploy make-server-booking --project-ref vpvpbdwtyugbknrntkho --no-verify-jwt
npx supabase functions deploy make-server-payment --project-ref vpvpbdwtyugbknrntkho --no-verify-jwt
```

### Deploy Individual Functions (Ongoing)
```bash
# Changed vendor code? Only deploy vendor function
npx supabase functions deploy make-server-vendor --project-ref vpvpbdwtyugbknrntkho --no-verify-jwt

# Changed auth? Only deploy core function
npx supabase functions deploy make-server-core --project-ref vpvpbdwtyugbknrntkho --no-verify-jwt

# Changed payment? Only deploy payment function
npx supabase functions deploy make-server-payment --project-ref vpvpbdwtyugbknrntkho --no-verify-jwt
```

## 🔄 Function Mapping

### Original Function → Split Functions

| Original Endpoint | New Function | New Endpoint |
|------------------|--------------|--------------|
| `/auth/*` | `make-server-core` | `/auth/*` |
| `/regions/*` | `make-server-core` | `/regions/*` |
| `/admin/*` | `make-server-admin` | `/admin/*` |
| `/vendor/*` | `make-server-vendor` | `/vendor/*` |
| `/customer/*` | `make-server-customer` | `/customer/*` |
| `/bookings/*` | `make-server-booking` | `/bookings/*` |
| `/payments/*` | `make-server-payment` | `/payments/*` |

## 🌐 Base URLs

All functions are accessible at:
```
https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/{function-name}/
```

Examples:
- Core: `https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-core/health`
- Admin: `https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-admin/health`
- Vendor: `https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-vendor/health`

## 🔧 Client Migration (If Needed)

### Option 1: Update Client to Use New Functions

**Before:**
```javascript
const response = await fetch(
  'https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/auth/login',
  { ... }
);
```

**After:**
```javascript
const response = await fetch(
  'https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-core/auth/login',
  { ... }
);
```

### Option 2: Keep Original Function as Router (Temporary)

You can keep `make-server-3dd53475` as a lightweight router that forwards requests to the appropriate split function. This allows gradual migration.

## 📊 Health Check Endpoints

All functions have health endpoints:
```bash
# Test all functions
curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-core/health
curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-admin/health
curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-vendor/health
curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-customer/health
curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-booking/health
curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-payment/health
```

## 🚀 Benefits Achieved

1. **Faster Deployments** - Small bundles deploy quickly
2. **Independent Scaling** - Each function scales separately
3. **Isolated Failures** - One function issue doesn't break others
4. **Easy Debugging** - Smaller codebases easier to debug
5. **Better Performance** - Cold start only loads what's needed
6. **No Bundle Explosion** - Each function ~10-50 imports vs 188

## 🔍 Key Fixes Applied

### KV to SQL Migration
- ✅ All KV dependencies removed
- ✅ All endpoints use SQL repositories
- ✅ Debug endpoint rewritten to use SQL-only

### Boot Error Fixes
- ✅ Dynamic imports for endpoint modules (prevents boot errors)
- ✅ Lazy endpoint registration
- ✅ Proper error handling and guards

### CORS and OPTIONS
- ✅ Global OPTIONS handlers
- ✅ CORS headers on all responses
- ✅ Health endpoints publicly accessible

## 📝 Notes

- The original `make-server-3dd53475` function can be kept or removed based on client migration status
- All functions use the same `_shared` utilities for consistency
- All functions have identical CORS and error handling setup
- Health endpoints are available for monitoring

## 🐛 Troubleshooting

### Function Not Responding
1. Check health endpoint: `curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/{function-name}/health`
2. Check Supabase Dashboard → Edge Functions → Logs
3. Verify deployment succeeded: `npx supabase functions list`

### Boot Error
- Check for static imports of endpoint modules
- Use dynamic imports: `await import('./endpoint.tsx')`
- Ensure no top-level code execution during module load

### CORS Issues
- All functions have global OPTIONS handlers
- CORS headers are set on all responses
- Health endpoints are publicly accessible

