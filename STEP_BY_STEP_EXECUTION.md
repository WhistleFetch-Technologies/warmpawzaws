# Step-by-Step Execution Guide

## 🎯 Current Status

✅ **All files prepared and ready**
- Migration files: Ready in `./migrations-ready/`
- Function code: Ready in `supabase/functions/make-server-3dd53475/`
- Validation scripts: Ready

---

## Step 1: Apply Database Migrations

### What You Need
- Access to Supabase Dashboard
- SQL Editor access

### Actions Required

#### 1.1 Open Supabase SQL Editor
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor" in left sidebar
4. Click "New query"

#### 1.2 Apply Migration 008
1. **Open file:** `./migrations-ready/008_financial_flows_complete.sql`
2. **Select all:** Cmd+A (Mac) or Ctrl+A (Windows)
3. **Copy:** Cmd+C (Mac) or Ctrl+C (Windows)
4. **Paste** into SQL Editor
5. **Click "Run"** button (or Cmd+Enter / Ctrl+Enter)
6. **Wait** for "Success" message

**Expected:** Creates 7 tables, enhances existing tables, seeds default data

#### 1.3 Apply Migration 009
1. **Open file:** `./migrations-ready/009_financial_rpc_functions.sql`
2. **Select all** and **Copy**
3. **Paste** into SQL Editor (new query or same window)
4. **Click "Run"**
5. **Wait** for "Success" message

**Expected:** Creates 6 RPC functions

#### 1.4 Verify Migrations
1. **Open file:** `./migrations-ready/VERIFY_MIGRATIONS.sql`
2. **Select all** and **Copy**
3. **Paste** into SQL Editor
4. **Click "Run"**

**Expected Results:**
- Tables check: ✅ PASS (count = 7)
- Functions check: ✅ PASS (count = 6)
- Default tier: ✅ PASS
- Default GST rule: ✅ PASS

---

## Step 2: Deploy Edge Functions

### What You Need
- Supabase CLI installed
- Logged in to Supabase
- Project linked

### Actions Required

#### 2.1 Install Supabase CLI (if not installed)

**Option A: Using npm**
```bash
npm install -g supabase
```

**Option B: Using Homebrew (Mac)**
```bash
brew install supabase/tap/supabase
```

**Option C: Using Scoop (Windows)**
```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Verify installation:**
```bash
supabase --version
```

#### 2.2 Login to Supabase
```bash
supabase login
```
This will open a browser for authentication.

#### 2.3 Link to Your Project
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

**Find your project ref:**
- Go to Supabase Dashboard
- Settings → General
- Copy "Reference ID"

#### 2.4 Deploy Function
```bash
cd /Users/ketan/Documents/warmpawzecodev/Warmpawzecodev
supabase functions deploy make-server-3dd53475
```

**Expected output:**
```
Deploying function make-server-3dd53475...
Function deployed successfully!
```

#### 2.5 Verify Deployment
```bash
# List functions
supabase functions list

# Check logs
supabase functions logs make-server-3dd53475 --limit 10

# Test endpoint
curl https://<your-project>.supabase.co/functions/v1/make-server-3dd53475/payments/tiers
```

---

## Alternative: Deploy via Dashboard

If you prefer not to use CLI:

1. **Go to Supabase Dashboard**
   - Navigate to: Edge Functions
   - Find: `make-server-3dd53475`

2. **Upload/Deploy**
   - Click on the function
   - Use "Deploy" or "Update" option
   - Upload the function directory

---

## Verification After Both Steps

### Run Validation Script
```bash
./scripts/validate-financial-setup.sh
```

### Test Endpoints
```bash
# Test tiers
curl https://<your-project>.supabase.co/functions/v1/make-server-3dd53475/payments/tiers

# Test GST calculation
curl -X POST https://<your-project>.supabase.co/functions/v1/make-server-3dd53475/calculate-gst \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000, "roleId": "veterinarian", "serviceStyle": "at_center"}'
```

---

## ✅ Completion Checklist

- [ ] Migration 008 applied in Supabase SQL Editor
- [ ] Migration 009 applied in Supabase SQL Editor
- [ ] Verification query shows all ✅ PASS
- [ ] Supabase CLI installed
- [ ] Logged in to Supabase
- [ ] Project linked
- [ ] Function deployed
- [ ] Endpoints responding
- [ ] Validation script passes

---

## 📞 Need Help?

- **Migration issues:** Check `DEPLOYMENT_GUIDE.md` troubleshooting section
- **Deployment issues:** Check Supabase CLI documentation
- **Verification:** Run `./scripts/validate-financial-setup.sh`

---

**All files are ready! Follow the steps above to complete deployment.**

