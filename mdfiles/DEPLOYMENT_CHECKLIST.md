# Deployment Checklist - Vendor Web Fix

## ✅ Completed Fixes

1. **UAT Critical Fixes** (Backend)
   - ✅ Service update SQL error fix
   - ✅ Facility provisioning during approval
   - ✅ PUT /vendor/facility/:vendorId endpoint

2. **CloudFront Static Files** (Infrastructure)
   - ✅ Diagnostic script created
   - ⚠️  Manual CloudFront behavior update needed (see below)

3. **Vendor App Redirect** (Frontend)
   - ✅ Root page redirect fix (router.replace → window.location.href)

## 📋 Deployment Steps

### Step 1: Deploy Vendor Web Frontend (Current Fix)

```bash
cd /Users/ketan/Documents/warmpawzecodev
./scripts/deploy-vendor-web.sh
```

This will:
- Build the Next.js app with the redirect fix
- Upload to S3
- Invalidate CloudFront cache

**Expected time:** 5-10 minutes

### Step 2: Verify Deployment

After deployment completes, test:

1. **Root URL redirect:**
   ```
   https://d1s6ykkj381k58.cloudfront.net/
   ```
   - Should redirect to `/auth` if no session
   - No more stuck "Loading..." screen

2. **Auth page:**
   ```
   https://d1s6ykkj381k58.cloudfront.net/auth
   ```
   - Should load login page immediately

3. **Check console:**
   - No JavaScript syntax errors
   - Runtime config loads correctly
   - Session check works

### Step 3: Deploy Backend Fixes (If Not Already Done)

The UAT critical fixes need to be deployed to the Lambda backend:

```bash
# Option 1: Deploy via CDK (if configured)
cd infrastructure/cdk
npm run deploy

# Option 2: Direct Lambda deployment
cd backend/lambda
./deploy.sh
```

**Backend fixes to verify:**
- ✅ Service update endpoint (no SQL errors)
- ✅ Facility provisioning on approval
- ✅ PUT /vendor/facility/:vendorId endpoint exists

### Step 4: Fix CloudFront Static Files (Manual - Recommended)

To prevent JavaScript files from returning HTML:

1. **Go to AWS Console → CloudFront**
2. **Select Distribution:** `E95171GX1I6HN`
3. **Behaviors tab → Create Behavior**
   - Path Pattern: `/_next/*`
   - Priority: Higher than default (place before default)
   - Origin: Same as default behavior
   - Custom Error Responses: **None**
   - Cache Policy: `CachingOptimized`
4. **Save and wait for deployment** (5-15 minutes)

Or run diagnostic script:
```bash
./scripts/fix-cloudfront-static-files.sh
```

### Step 5: Run Test Suite (Optional)

Verify all fixes are working:

```bash
# Test UAT fixes
./scripts/test-uat-fixes.sh

# Or comprehensive test
API_BASE_URL=https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com \
  npx ts-node tests/uat-critical-fixes.test.ts
```

## 🎯 Quick Start (Priority Order)

### Immediate (Do Now)
1. ✅ **Deploy vendor web frontend** - Fixes the loading screen issue
   ```bash
   ./scripts/deploy-vendor-web.sh
   ```

### Next (Today)
2. ⚠️  **Fix CloudFront behaviors** - Prevents JS files returning HTML
   - Manual: AWS Console (recommended)
   - Or: Run diagnostic script for instructions

3. ✅ **Deploy backend fixes** - UAT critical fixes
   - Only if not already deployed

### Later (This Week)
4. ✅ **Re-run UAT scenarios** - Verify all fixes end-to-end
5. ✅ **Monitor production** - Check for any SQL errors or issues

## 📊 Verification Checklist

After deployment, verify:

- [ ] Root URL redirects to `/auth` (no stuck loading)
- [ ] Auth page loads correctly
- [ ] Login flow works
- [ ] Vendor dashboard loads after login
- [ ] Service updates work (no SQL errors)
- [ ] Facility profile saves successfully
- [ ] No JavaScript syntax errors in console
- [ ] Static files load correctly (not HTML)

## ⚠️  Known Issues

1. **Font preload warning** - Non-critical, performance optimization
2. **CloudFront static files** - Manual fix needed (see Step 4)
3. **Cache propagation** - Changes may take 5-15 minutes

## 🆘 Troubleshooting

### Still seeing "Loading..." screen?
- Wait 5-15 minutes for CloudFront cache invalidation
- Hard refresh browser (Cmd+Shift+R)
- Check browser console for errors

### JavaScript files still returning HTML?
- Complete Step 4 (CloudFront behavior fix)
- Wait for CloudFront deployment to complete

### Backend endpoints not working?
- Verify Lambda deployment completed
- Check API Gateway is updated
- Review CloudWatch logs

---

**Ready to deploy?** Start with Step 1: `./scripts/deploy-vendor-web.sh`
