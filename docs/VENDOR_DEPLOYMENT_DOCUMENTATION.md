# Vendor Web Deployment Documentation

## Overview

This document provides comprehensive documentation for deploying the **Vendor Web** application to AWS. The vendor web app is a Next.js application that is statically exported and deployed to AWS S3, then served via CloudFront.

**Official CloudFront URL**: `https://d1s6ykkj381k58.cloudfront.net`

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Deployment Scripts](#deployment-scripts)
3. [Deployment Process](#deployment-process)
4. [Configuration Details](#configuration-details)
5. [Runtime Configuration](#runtime-configuration)
6. [Troubleshooting](#troubleshooting)
7. [Common Issues and Solutions](#common-issues-and-solutions)

---

## Architecture Overview

### Infrastructure Components

```
┌─────────────────┐
│   CloudFront    │  https://d1s6ykkj381k58.cloudfront.net
│  Distribution   │  Distribution ID: E95171GX1I6HN
└────────┬────────┘
         │
         │ Serves static files
         │
┌────────▼────────┐
│   S3 Bucket     │  warmpawz-dev-vendor-frontend-ap-south-1
│  (Static Host)  │  Region: ap-south-1
└─────────────────┘
         │
         │ API Calls
         │
┌────────▼────────┐
│  API Gateway    │  https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com
│  (HTTP API v2)  │  Name: warmpawz-dev-api
└─────────────────┘
```

### Application Stack

- **Framework**: Next.js 14.2.35
- **Build Output**: Static export (`output: 'export'`)
- **Build Directory**: `dist/`
- **Runtime Config**: Injected at deployment time via `runtime-config.js`

---

## Deployment Scripts

### Primary Scripts

#### 1. `scripts/deploy-vendor-web.sh` (Linux/Mac)

**Location**: `warmpawzApp/warmpawzaws/scripts/deploy-vendor-web.sh`

**Usage**:
```bash
./scripts/deploy-vendor-web.sh
```

**What it does**:
1. Builds the Next.js application
2. Injects runtime configuration
3. Syncs files to S3
4. Invalidates CloudFront cache

#### 2. `scripts/deploy-vendor-web.ps1` (Windows PowerShell)

**Location**: `warmpawzApp/warmpawzaws/scripts/deploy-vendor-web.ps1`

**Usage**:
```powershell
.\scripts\deploy-vendor-web.ps1
```

**What it does**: Same as the bash script, but for Windows environments.

---

## Deployment Process

### Step-by-Step Process

#### Step 1: Build the Application

```bash
cd apps/vendor-web
npm run build
```

**What happens**:
- Next.js compiles the application
- Creates static HTML, CSS, and JavaScript files
- Outputs to `dist/` directory
- Build configuration is in `next.config.js`

**Key Build Settings**:
- `output: 'export'` - Static export mode
- `distDir: 'dist'` - Output directory
- `images: { unoptimized: true }` - Required for static export
- `swcMinify: true` - Minification enabled

**Verification**:
```bash
# Check if dist directory exists
ls -la apps/vendor-web/dist/
```

#### Step 2: Inject Runtime Configuration

The deployment script automatically injects `runtime-config.js` into the `dist/` folder.

**Location**: `apps/vendor-web/dist/runtime-config.js`

**Content**:
```javascript
// Runtime Configuration for Warmpawz vendor-web
// Injected at deployment time with actual API Gateway endpoint
(function() {
  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com",
    uatMode: true
  };
  console.log('🔧 Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();
```

**How API Endpoint is Determined**:
1. Script queries AWS API Gateway v2: `aws apigatewayv2 get-apis --region ap-south-1`
2. Looks for API named `warmpawz-dev-api`
3. Falls back to: `https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com` if not found

#### Step 3: Upload to S3

```bash
aws s3 sync "apps/vendor-web/dist/" "s3://warmpawz-dev-vendor-frontend-ap-south-1/" \
  --delete \
  --exclude "*.map"
```

**What happens**:
- Syncs all files from `dist/` to S3 bucket
- `--delete` flag removes files from S3 that don't exist locally
- `--exclude "*.map"` excludes source map files (reduces size)

**S3 Bucket Details**:
- **Bucket Name**: `warmpawz-dev-vendor-frontend-ap-south-1`
- **Region**: `ap-south-1`
- **Access**: Private (served via CloudFront only)

#### Step 4: Invalidate CloudFront Cache

```bash
aws cloudfront create-invalidation \
  --distribution-id "E95171GX1I6HN" \
  --paths "/*"
```

**What happens**:
- Creates a cache invalidation for all paths (`/*`)
- Forces CloudFront to fetch fresh content from S3
- Returns an invalidation ID

**Important Notes**:
- Cache invalidation can take **5-15 minutes** to propagate globally
- Files are immediately available on S3, but CloudFront may serve cached versions until invalidation completes
- You can check invalidation status in AWS Console

---

## Configuration Details

### AWS Resources

| Resource | Value | Notes |
|----------|-------|-------|
| **CloudFront URL** | `https://d1s6ykkj381k58.cloudfront.net` | Official production URL |
| **CloudFront Distribution ID** | `E95171GX1I6HN` | Used for cache invalidation |
| **S3 Bucket** | `warmpawz-dev-vendor-frontend-ap-south-1` | Static file storage |
| **AWS Region** | `ap-south-1` | Mumbai region |
| **API Gateway** | `warmpawz-dev-api` | HTTP API v2 |
| **API Endpoint** | `https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com` | Fallback endpoint |

### Application Configuration

#### `next.config.js`

Key settings:
```javascript
{
  output: 'export',           // Static export mode
  distDir: 'dist',            // Output directory
  reactStrictMode: true,      // React strict mode
  swcMinify: true,            // SWC minification
  images: { unoptimized: true }, // Required for static export
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true }
}
```

#### `package.json`

Build command:
```json
{
  "scripts": {
    "build": "next build",
    "dev": "next dev -p 3002"
  }
}
```

---

## Runtime Configuration

### How Runtime Config Works

The vendor web app uses a **runtime configuration** system that allows API endpoints to be configured at deployment time, not build time.

#### 1. Config Injection

During deployment, the script creates `runtime-config.js` in the `dist/` folder with the current API Gateway endpoint.

#### 2. Config Loading

The config is loaded in `app/layout.tsx`:
```tsx
<script src="/runtime-config.js" />
```

This script runs before React hydrates, making the config available immediately.

#### 3. Config Usage

The API client (`lib/api-client.ts`) reads the config:

```typescript
function getRuntimeConfig(): RuntimeConfig {
  if (typeof window === 'undefined') return {};
  return window.__WARMPAWZ_RUNTIME_CONFIG__ || {};
}

function getApiBaseUrl(): string {
  const cfg = getRuntimeConfig();
  return (
    cfg.apiBaseUrl ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ''
  );
}
```

**Priority Order**:
1. `window.__WARMPAWZ_RUNTIME_CONFIG__.apiBaseUrl` (runtime config - highest priority)
2. `process.env.NEXT_PUBLIC_API_BASE_URL` (build-time env - fallback)
3. Empty string (error state)

### UAT Mode

The runtime config also includes `uatMode`:
- When `true`: Enables UAT (User Acceptance Testing) mode
- Allows phone-based authentication
- Shows additional debug logging

---

## Troubleshooting

### Common Deployment Issues

#### Issue 1: Build Fails

**Symptoms**:
- `npm run build` fails
- Error messages in console

**Solutions**:
1. **Check Node.js version**: Ensure Node.js 18+ is installed
   ```bash
   node --version
   ```

2. **Clear build cache**:
   ```bash
   cd apps/vendor-web
   rm -rf .next dist node_modules/.cache
   npm run build
   ```

3. **Reinstall dependencies**:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```

4. **Check TypeScript errors**:
   - Review `next.config.js` - `typescript: { ignoreBuildErrors: true }` may hide errors
   - Fix TypeScript errors if possible

#### Issue 2: S3 Upload Fails

**Symptoms**:
- `aws s3 sync` command fails
- Permission denied errors

**Solutions**:
1. **Check AWS credentials**:
   ```bash
   aws sts get-caller-identity
   ```

2. **Verify S3 bucket exists**:
   ```bash
   aws s3 ls s3://warmpawz-dev-vendor-frontend-ap-south-1/
   ```

3. **Check IAM permissions**:
   - Ensure your AWS user/role has `s3:PutObject`, `s3:DeleteObject`, and `s3:ListBucket` permissions

4. **Verify bucket region**:
   ```bash
   aws s3api get-bucket-location --bucket warmpawz-dev-vendor-frontend-ap-south-1
   ```

#### Issue 3: CloudFront Invalidation Fails

**Symptoms**:
- Cache invalidation command fails
- Old content still showing after deployment

**Solutions**:
1. **Verify distribution ID**:
   ```bash
   aws cloudfront list-distributions --query "DistributionList.Items[?Origins.Items[?DomainName=='warmpawz-dev-vendor-frontend-ap-south-1.s3.ap-south-1.amazonaws.com']].{Id:Id,DomainName:DomainName}"
   ```

2. **Check IAM permissions**:
   - Ensure `cloudfront:CreateInvalidation` permission

3. **Manual invalidation via Console**:
   - Go to AWS CloudFront Console
   - Select distribution `E95171GX1I6HN`
   - Create invalidation for `/*`

4. **Wait for propagation**:
   - Cache invalidation takes 5-15 minutes
   - Check invalidation status in CloudFront Console

#### Issue 4: Runtime Config Not Loading

**Symptoms**:
- API calls fail with "API_BASE_URL is not configured"
- Console shows `runtime-config.js` not found

**Solutions**:
1. **Verify runtime-config.js exists in dist/**:
   ```bash
   ls -la apps/vendor-web/dist/runtime-config.js
   ```

2. **Check script tag in layout.tsx**:
   ```tsx
   <script src="/runtime-config.js" />
   ```

3. **Verify file is uploaded to S3**:
   ```bash
   aws s3 ls s3://warmpawz-dev-vendor-frontend-ap-south-1/runtime-config.js
   ```

4. **Check browser console**:
   - Open browser DevTools
   - Check Network tab for `runtime-config.js` request
   - Verify it returns 200 status

5. **Manual fix**: Re-run deployment script to regenerate config

#### Issue 5: API Gateway Endpoint Not Found

**Symptoms**:
- Script shows "Using fallback API endpoint"
- API calls fail

**Solutions**:
1. **Verify API Gateway exists**:
   ```bash
   aws apigatewayv2 get-apis --region ap-south-1 \
     --query "Items[?Name=='warmpawz-dev-api']"
   ```

2. **Check API name**:
   - Ensure API is named exactly `warmpawz-dev-api`
   - Or update script to use correct name

3. **Use fallback endpoint**:
   - The fallback `https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com` should work
   - Verify this endpoint is accessible

#### Issue 6: Old Content Still Showing

**Symptoms**:
- Changes not visible after deployment
- Browser shows cached version

**Solutions**:
1. **Wait for CloudFront invalidation**:
   - Can take 5-15 minutes
   - Check invalidation status in AWS Console

2. **Hard refresh browser**:
   - `Ctrl+Shift+R` (Windows/Linux)
   - `Cmd+Shift+R` (Mac)

3. **Clear browser cache**:
   - Open DevTools → Application → Clear Storage

4. **Check S3 directly**:
   ```bash
   aws s3 ls s3://warmpawz-dev-vendor-frontend-ap-south-1/ --recursive
   ```
   - Verify latest files are uploaded

5. **Verify CloudFront origin**:
   - Ensure CloudFront is pointing to correct S3 bucket

---

## Common Issues and Solutions

### Issue: "dist directory not found after build"

**Cause**: Build failed or didn't complete

**Solution**:
```bash
cd apps/vendor-web
npm run build
# Verify dist/ exists
ls -la dist/
```

### Issue: "Could not find CloudFront distribution"

**Cause**: Distribution ID mismatch or bucket name changed

**Solution**:
1. Find correct distribution:
   ```bash
   aws cloudfront list-distributions --query "DistributionList.Items[*].{Id:Id,Origins:Origins.Items[*].DomainName}"
   ```

2. Update script with correct distribution ID

### Issue: CORS Errors

**Cause**: API Gateway CORS not configured for CloudFront URL

**Solution**:
1. Verify CORS in `backend/lambda/src/handler/index.ts`:
   ```typescript
   allowedOrigins: [
     'https://d1s6ykkj381k58.cloudfront.net', // Vendor
     // ... other origins
   ]
   ```

2. Run CORS fix script:
   ```bash
   ./scripts/fix-cors-api-gateway.sh
   ```

### Issue: Build Takes Too Long

**Cause**: Large bundle size or slow machine

**Solution**:
1. Check bundle size:
   ```bash
   cd apps/vendor-web
   npm run build
   du -sh dist/
   ```

2. Optimize imports (already configured in `next.config.js`)

3. Consider code splitting improvements

---

## Verification Checklist

After deployment, verify:

- [ ] Build completes without errors
- [ ] `dist/` directory exists with files
- [ ] `runtime-config.js` exists in `dist/`
- [ ] S3 sync completes successfully
- [ ] Files visible in S3 bucket
- [ ] CloudFront invalidation created
- [ ] Website accessible at `https://d1s6ykkj381k58.cloudfront.net`
- [ ] Runtime config loads (check browser console)
- [ ] API calls work (check Network tab)
- [ ] No CORS errors in console

---

## Quick Reference

### Deployment Command

**Linux/Mac**:
```bash
./scripts/deploy-vendor-web.sh
```

**Windows**:
```powershell
.\scripts\deploy-vendor-web.ps1
```

### Manual Steps (if script fails)

```bash
# 1. Build
cd apps/vendor-web
npm run build

# 2. Verify dist exists
ls -la dist/

# 3. Upload to S3
aws s3 sync dist/ s3://warmpawz-dev-vendor-frontend-ap-south-1/ --delete --exclude "*.map"

# 4. Invalidate CloudFront
aws cloudfront create-invalidation --distribution-id E95171GX1I6HN --paths "/*"
```

### Key URLs

- **Production URL**: https://d1s6ykkj381k58.cloudfront.net
- **API Gateway**: https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com
- **S3 Bucket**: s3://warmpawz-dev-vendor-frontend-ap-south-1

### Key Files

- **Deployment Script (Bash)**: `scripts/deploy-vendor-web.sh`
- **Deployment Script (PowerShell)**: `scripts/deploy-vendor-web.ps1`
- **Next.js Config**: `apps/vendor-web/next.config.js`
- **Runtime Config Template**: `apps/vendor-web/public/runtime-config.js`
- **API Client**: `apps/vendor-web/lib/api-client.ts`
- **Layout (loads config)**: `apps/vendor-web/app/layout.tsx`

---

## Additional Resources

- **Official CloudFront URLs**: `docs/OFFICIAL_CLOUDFRONT_URLS.md`
- **Next.js AWS Architecture**: `docs/NEXTJS_AWS_SERVERLESS_ARCHITECTURE.md`
- **Deployment Checklist**: `mdfiles/DEPLOYMENT_CHECKLIST.md`

---

## Notes

1. **Always use the official CloudFront URL**: `https://d1s6ykkj381k58.cloudfront.net`
   - Do not create or discover new CloudFront URLs
   - This URL is hardcoded in CORS configuration

2. **Runtime config is critical**:
   - Without it, API calls will fail
   - Always verify it's injected during deployment

3. **Cache invalidation timing**:
   - Plan for 5-15 minutes after deployment
   - Test changes after invalidation completes

4. **Build optimization**:
   - Source maps are excluded from S3 upload (reduces size)
   - Static export means no server-side rendering

5. **Environment-specific configs**:
   - Currently configured for `dev` environment
   - For production, update bucket names and distribution IDs

---

**Last Updated**: 2025-01-XX  
**Maintained By**: Development Team  
**Contact**: See project README
