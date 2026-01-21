# 🔧 Sentry Setup Guide - Local Testing (No Deployment)

**Date:** January 2, 2026  
**Purpose:** Set up Sentry error tracking and test locally without deploying

---

## 📋 STEP 1: CREATE SENTRY ACCOUNT (5 minutes)

### 1.1 Sign Up
1. Go to: **https://sentry.io**
2. Click "Get Started" or "Sign Up"
3. Choose:
   - **Email signup** (recommended)
   - Or use GitHub/Google OAuth

### 1.2 Create Organization
1. After signup, create an organization
2. Name: `warmpawz` (or your choice)
3. Select plan: **Developer** (free tier)

### 1.3 Create Project
1. Click **"Create Project"**
2. Select platform: **Node.js**
3. Framework: **AWS Lambda**
4. Project name: `warmpawz-lambda`
5. Click **"Create Project"**

### 1.4 Get Your DSN
After project creation, you'll see:
```
Your DSN
https://xxx@xxx.ingest.sentry.io/xxx
```

**⚠️ IMPORTANT:** Copy this DSN - you'll need it in the next steps!

---

## 📋 STEP 2: CONFIGURE DSN LOCALLY (2 minutes)

### 2.1 Create Local Environment File

**Option A: Add to `.env.local` (Recommended)**
```bash
# Add to .env.local
SENTRY_DSN=https://your-dsn@sentry.io/project-id
ENABLE_ERROR_TRACKING=true
```

**Option B: Create Test Environment File**
```bash
# Create test environment file
cat > backend/lambda/.env.test << EOF
SENTRY_DSN=https://your-dsn@sentry.io/project-id
ENABLE_ERROR_TRACKING=true
NODE_ENV=test
EOF
```

### 2.2 Update Error Tracking Config

The error tracking utility will automatically read from:
1. Environment variables (Lambda)
2. Process environment
3. `.env` files (if using dotenv)

**No code changes needed** - it's already configured to read from environment!

---

## 📋 STEP 3: TEST LOCALLY (10 minutes)

### 3.1 Install Dependencies
```bash
cd backend/lambda
npm install
```

### 3.2 Run Test Script
```bash
# From project root
./scripts/test-sentry-local.sh
```

**OR manually:**
```bash
cd backend/lambda
node scripts/test-sentry.js
```

### 3.3 Verify in Sentry Dashboard
1. Go to: https://sentry.io
2. Navigate to your project: `warmpawz-lambda`
3. Click **"Issues"** tab
4. You should see test errors appear!

---

## 📋 STEP 4: TEST WITH MOCK LAMBDA HANDLER (Optional)

### 4.1 Create Test Lambda Event
```bash
# Run the test script
cd backend/lambda
npm run test:sentry
```

This will:
- Initialize Sentry
- Capture test errors
- Send to Sentry dashboard
- Verify integration works

---

## ✅ VERIFICATION CHECKLIST

After setup, verify:

- [ ] Sentry account created
- [ ] Project created (Node.js/AWS Lambda)
- [ ] DSN copied
- [ ] DSN added to `.env.local` or test file
- [ ] Test script runs successfully
- [ ] Errors appear in Sentry dashboard
- [ ] Error details include context (user, request, etc.)

---

## 🧪 LOCAL TESTING OPTIONS

### Option 1: Test Script (Recommended)
```bash
./scripts/test-sentry-local.sh
```

### Option 2: Manual Node.js Test
```bash
cd backend/lambda
node -e "require('./src/utils/error-tracking').captureException(new Error('Test error'))"
```

### Option 3: Unit Test
```bash
cd backend/lambda
npm test -- --testNamePattern="error-tracking"
```

---

## 🚨 TROUBLESHOOTING

### Issue: "Sentry DSN not found"
**Solution:**
- Check `.env.local` has `SENTRY_DSN`
- Verify DSN format: `https://xxx@xxx.ingest.sentry.io/xxx`
- Check for typos

### Issue: "Errors not appearing in Sentry"
**Solution:**
- Verify `ENABLE_ERROR_TRACKING=true`
- Check internet connection (Sentry needs API access)
- Check Sentry dashboard filters (may be filtered)
- Wait 10-30 seconds for events to appear

### Issue: "Module not found: @sentry/serverless"
**Solution:**
```bash
cd backend/lambda
npm install
```

---

## 📊 EXPECTED RESULTS

### After Setup:
- ✅ Sentry account active
- ✅ Project created
- ✅ DSN configured
- ✅ Test errors captured
- ✅ Errors visible in dashboard
- ✅ Error context included (user, request, etc.)

### In Sentry Dashboard:
- **Issues tab:** Shows captured errors
- **Performance tab:** Shows request timing
- **Releases tab:** Shows deployment versions
- **Alerts:** Can configure notifications

---

## 🔒 SECURITY NOTES

### Sensitive Data Filtering
The error tracking utility automatically filters:
- `Authorization` headers
- `Cookie` headers
- `X-Auth-Token` headers
- Other sensitive fields

**No action needed** - already implemented!

---

## 📝 NEXT STEPS (After Local Testing)

Once local testing works:

1. **Add to Lambda Environment** (when ready to deploy)
   ```bash
   # Via AWS Console or CLI
   SENTRY_DSN=https://your-dsn@sentry.io/project-id
   ENABLE_ERROR_TRACKING=true
   ```

2. **Configure Alerts** (optional)
   - Set up email/Slack notifications
   - Configure error thresholds

3. **Set Up Releases** (optional)
   - Track deployments
   - Monitor release health

---

**Status:** ✅ **READY FOR LOCAL TESTING**  
**Time Required:** 15-20 minutes  
**Deployment Required:** ❌ **NO**
