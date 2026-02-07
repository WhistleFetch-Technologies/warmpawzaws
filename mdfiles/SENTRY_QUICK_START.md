# ⚡ Sentry Quick Start - Local Testing Only

**No deployment required!** Test Sentry integration locally.

---

## 🚀 3-Step Setup (15 minutes)

### Step 1: Create Sentry Account (5 min)

1. Go to: **https://sentry.io**
2. Sign up (free tier available)
3. Create project:
   - Platform: **Node.js**
   - Framework: **AWS Lambda**
   - Name: `warmpawz-lambda`
4. **Copy your DSN** (looks like: `https://xxx@xxx.ingest.sentry.io/xxx`)

---

### Step 2: Configure DSN (2 min)

Add to `.env.local` in project root:

```bash
# Add these lines to .env.local
SENTRY_DSN=https://your-dsn@sentry.io/project-id
ENABLE_ERROR_TRACKING=true
```

**Replace `https://your-dsn@sentry.io/project-id` with your actual DSN!**

---

### Step 3: Run Test (2 min)

```bash
# From project root
./scripts/test-sentry-local.sh
```

**OR manually:**
```bash
cd backend/lambda
npm run test:sentry
```

---

## ✅ Verify Results

1. Go to: **https://sentry.io**
2. Navigate to your project
3. Click **"Issues"** tab
4. You should see **6 test events**!

⏱️ Events may take 10-30 seconds to appear

---

## 🎯 What Gets Tested

The test script will:
- ✅ Initialize Sentry
- ✅ Capture test errors
- ✅ Send test messages
- ✅ Set user context
- ✅ Add breadcrumbs
- ✅ Capture API errors

All without deploying!

---

## 🚨 Troubleshooting

### "SENTRY_DSN not found"
- Check `.env.local` exists
- Verify DSN is correct
- No quotes needed around DSN

### "Errors not appearing"
- Wait 10-30 seconds
- Check Sentry dashboard filters
- Verify internet connection

### "Module not found"
```bash
cd backend/lambda
npm install
```

---

## 📋 Files Created

- `SENTRY_SETUP_GUIDE.md` - Detailed guide
- `scripts/test-sentry-local.sh` - Test script
- `backend/lambda/scripts/test-sentry.js` - Test runner

---

**Ready?** Follow the 3 steps above! 🚀
