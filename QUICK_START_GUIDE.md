# ⚡ Quick Start Guide - Critical Fixes Configuration

**Date:** January 2, 2026  
**Time Required:** 30-60 minutes  
**Status:** Ready to Configure

---

## 🎯 WHAT TO DO RIGHT NOW

### Step 1: Install Dependencies (2 minutes)

```bash
cd backend/lambda
npm install
```

**What this does:**
- Installs Sentry SDK (v7.120.4)
- Updates all dependencies
- Prepares for error tracking

---

### Step 2: Set Up Sentry (10 minutes)

**2.1 Create Sentry Account:**
1. Go to: https://sentry.io
2. Sign up (free tier available)
3. Create organization

**2.2 Create Project:**
1. Click "Create Project"
2. Select: **Node.js**
3. Framework: **AWS Lambda**
4. Project name: `warmpawz-lambda`
5. Click "Create Project"

**2.3 Get DSN:**
1. After project creation, you'll see your DSN
2. It looks like: `https://xxx@xxx.ingest.sentry.io/xxx`
3. Copy this DSN

**2.4 Add to Lambda Environment:**
```bash
# Option 1: Via AWS Console
# 1. Go to Lambda Console
# 2. Select: warmpawz-dev-api-handler
# 3. Configuration → Environment variables
# 4. Add:
#    SENTRY_DSN = https://your-dsn@sentry.io/project-id
#    ENABLE_ERROR_TRACKING = true

# Option 2: Via AWS CLI
aws lambda update-function-configuration \
  --function-name warmpawz-dev-api-handler \
  --environment "Variables={SENTRY_DSN=https://your-dsn@sentry.io/project-id,ENABLE_ERROR_TRACKING=true}" \
  --region ap-south-1
```

---

### Step 3: Test CI/CD Pipeline (5 minutes)

**3.1 Commit Changes:**
```bash
cd /Users/ketan/Documents/warmpawzecodev
git add .
git commit -m "feat: Add critical fixes - tests, security scanning, error tracking"
git push origin develop
```

**3.2 Monitor Workflow:**
1. Go to: https://github.com/ketan0103/warmpawzaws/actions
2. Click on the latest workflow run
3. Verify:
   - ✅ Tests job runs
   - ✅ Security scan runs
   - ✅ Build succeeds
   - ✅ Deployment completes

**3.3 Check Results:**
- Test results: Available as artifact
- Security scan: Check for vulnerabilities
- Build: Should complete successfully

---

### Step 4: Verify Error Tracking (5 minutes)

**4.1 Trigger Test Error:**
```bash
# Make a request that will error
curl https://dev.api.warmpawz.com/nonexistent-endpoint
```

**4.2 Check Sentry:**
1. Go to Sentry dashboard
2. Check "Issues" tab
3. You should see the error

**4.3 Check CloudWatch:**
```bash
# View Lambda logs
aws logs tail /aws/lambda/warmpawz-dev-api-handler --follow
```

---

## ✅ VERIFICATION CHECKLIST

After completing steps above, verify:

- [ ] Sentry SDK installed (`npm list @sentry/serverless`)
- [ ] Sentry DSN configured in Lambda
- [ ] Error tracking enabled
- [ ] CI/CD pipeline runs successfully
- [ ] Tests run in pipeline (may show warnings)
- [ ] Security scan runs
- [ ] Error appears in Sentry dashboard

---

## 🚨 TROUBLESHOOTING

### Issue: Sentry not capturing errors

**Check:**
1. DSN is correct in Lambda environment
2. `ENABLE_ERROR_TRACKING=true` is set
3. Lambda has internet access (for Sentry API calls)
4. Check CloudWatch logs for Sentry initialization messages

### Issue: Tests not running in CI/CD

**Check:**
1. `package.json.cicd` exists (or test scripts in root package.json)
2. Test dependencies are installed
3. Check workflow logs for specific errors

### Issue: Security scan not working

**Check:**
1. npm audit should work without Snyk
2. Snyk requires `SNYK_TOKEN` in GitHub secrets (optional)
3. Check workflow logs for Snyk errors

---

## 📊 EXPECTED RESULTS

### After Configuration:

**Sentry:**
- ✅ Errors appear in Sentry dashboard
- ✅ User context included
- ✅ Sensitive data filtered

**CI/CD:**
- ✅ Tests run automatically
- ✅ Security scan runs
- ✅ Results visible in GitHub Actions

**Mobile:**
- ✅ Builds work after SDK installation
- ✅ APKs generated successfully

---

## 🎯 NEXT PRIORITIES

After completing quick start:

1. **Enable Cognito Authorizers** (2-3 hours)
   - Follow: `docs/COGNITO_AUTHORIZER_PRODUCTION_ENABLEMENT.md`

2. **Complete Mobile Setup** (1-2 hours)
   - Install Android SDK
   - Test builds

3. **Set Up Monitoring** (1 hour)
   - Configure Sentry alerts
   - Set up error notifications

---

**Status:** ✅ **READY TO CONFIGURE**  
**Start:** Install dependencies and set up Sentry  
**Time:** 30 minutes for basic setup
