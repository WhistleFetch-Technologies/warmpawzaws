# Merge Prod to Dev - Summary

## Overview

Successfully merged the `prod` branch into `develop` branch, configuring the codebase to handle both **development** and **production** environments simultaneously with zero conflicts.

## Changes Made

### 1. Branch Merge
- ✅ Merged `prod` branch into `develop` branch
- ✅ Resolved all conflicts automatically
- ✅ Maintained all production configurations
- ✅ Preserved all development configurations

### 2. Environment-Aware Configuration

#### Admin Web App (`apps/admin-web/`)

**Updated Files:**
- `app/layout.tsx` - Environment-aware runtime configuration
- `app/page.tsx` - Environment-aware authentication
- `app/ecommerce/page.tsx` - Uses environment-aware UAT mode

**Key Features:**
- **Development Environment:**
  - UAT mode: **Enabled**
  - Auto-login: **Enabled** (for testing)
  - API Gateway: `z0b3obweb6` (dev)
  - Hostname detection: `localhost`, `127.0.0.1`, `*.dev.warmpawz.com`

- **Production Environment:**
  - UAT mode: **Disabled**
  - Auto-login: **Disabled** (requires proper authentication)
  - API Gateway: `mss9sa4y01` (prod)
  - Hostname detection: `*.cloudfront.net`, `*.warmpawz.com`, `admin.warmpawz.com`

#### Runtime Configuration

The `runtime-config.js` and inline fallback in `layout.tsx` now:
1. Detect environment based on hostname
2. Set appropriate API Gateway URL
3. Enable/disable UAT mode based on environment
4. Provide fallback configuration if runtime-config.js fails to load

### 3. Scripts Organization

#### Created `scripts-prod/` Folder
Production-specific scripts moved to separate folder:
- `redeploy-lambda-prod.ps1`
- `run-prod.js`
- `test-razorpay-prod.sh`
- `deploy-prod-db-fix.ps1`
- `deploy-prod-lambda-fix.ps1`
- `fix-prod-*.sh` scripts
- `diagnose-prod-api-gateway.sh`
- `verify-and-fix-prod-admin-web.sh`
- `test-prod-api-health.sh`
- `create-prod-nat-gateway.sh`
- `terraform-apply-prod.sh`

#### Development Scripts
Remain in `scripts/` folder:
- `deploy-admin-web.sh` - Supports both dev and prod via `--prod` flag
- `deploy-all.sh` - Development deployments
- All other development and testing scripts

### 4. API Gateway Configuration

**Development:**
- API Gateway ID: `z0b3obweb6`
- URL: `https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com`
- Configured in: `config/urls.json`, `deploy-admin-web.sh`

**Production:**
- API Gateway ID: `mss9sa4y01`
- URL: `https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com`
- Configured in: `config/urls.json`, `deploy-admin-web.sh` (with `--prod` flag)

## How It Works

### Environment Detection

The system automatically detects the environment based on:

1. **Hostname Analysis:**
   ```javascript
   const isProd = hostname.includes('cloudfront.net') || 
                 hostname.includes('warmpawz.com') ||
                 hostname.includes('admin.warmpawz.com');
   
   const isDev = hostname === 'localhost' || 
                hostname === '127.0.0.1' || 
                hostname.includes('localhost') ||
                hostname.includes('.dev.warmpawz.com');
   ```

2. **Runtime Config Priority:**
   - First: `runtime-config.js` (injected at deploy time)
   - Second: `NEXT_PUBLIC_API_BASE_URL` environment variable
   - Third: Environment-based fallback (hostname detection)

### Deployment

**Development Deployment:**
```bash
./scripts/deploy-admin-web.sh
# Uses: z0b3obweb6 API Gateway
# Sets: uatMode: true
```

**Production Deployment:**
```bash
./scripts/deploy-admin-web.sh --prod
# Uses: mss9sa4y01 API Gateway
# Sets: uatMode: false
```

## Benefits

1. ✅ **Single Branch Management** - Both environments in one branch
2. ✅ **Zero Conflicts** - Environment-aware code prevents conflicts
3. ✅ **Clear Separation** - Prod scripts in `scripts-prod/`, dev scripts in `scripts/`
4. ✅ **Automatic Detection** - Environment detected automatically
5. ✅ **Safety** - Production never defaults to UAT mode
6. ✅ **Flexibility** - Easy to add new environments in the future

## Testing

### Verify Development Mode
1. Run locally: `npm run dev` in `apps/admin-web/`
2. Check console: Should see UAT mode enabled
3. Verify API calls go to: `z0b3obweb6.execute-api.ap-south-1.amazonaws.com`

### Verify Production Mode
1. Deploy with `--prod` flag
2. Access via production CloudFront URL
3. Check console: Should see UAT mode disabled
4. Verify API calls go to: `mss9sa4y01.execute-api.ap-south-1.amazonaws.com`

## Files Modified

### Source Files
- `apps/admin-web/app/layout.tsx`
- `apps/admin-web/app/page.tsx`
- `apps/admin-web/app/ecommerce/page.tsx`

### Configuration Files
- `config/urls.json` (removed wrong API Gateway reference)
- `scripts/deploy-admin-web.sh` (hardcoded correct API Gateways)

### New Files
- `scripts-prod/README.md`
- `scripts-prod/*` (production scripts)

## Next Steps

1. ✅ Merge complete - ready for testing
2. Test development deployment
3. Test production deployment
4. Verify both environments work correctly
5. Push to remote repository

## Notes

- Build artifacts (`dist/` folder) are not committed (as per `.gitignore`)
- All production scripts are isolated in `scripts-prod/` folder
- Environment detection is automatic and safe (defaults to production for unknown hostnames)
- UAT mode is completely disabled in production for security
