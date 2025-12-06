# Warmpawz Deployment Scripts

Quick scripts to deploy and verify the Warmpawz Edge Functions.

## 🚀 Quick Start

### 1. Deploy Edge Function

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

This will:
- Check if Supabase CLI is installed
- Link to your Supabase project
- Deploy the `server` Edge Function
- Run a quick health check

### 2. Verify Deployment

```bash
chmod +x scripts/verify-deployment.sh
export SUPABASE_ANON_KEY=your_anon_key_here
./scripts/verify-deployment.sh
```

This will:
- Test health endpoint
- Test dynamic form endpoints for all 8 vendor roles
- Verify auto-generation is working
- Show detailed results

## 📋 Prerequisites

- **Supabase CLI** installed: `npm install -g supabase`
- **Project ID**: `vpvpbdwtyugbknrntkho`
- **Anon Key**: Get from Supabase Dashboard → Settings → API

## 🔧 Scripts

### `deploy.sh`
Deploys the Edge Function to Supabase.

**Usage:**
```bash
./scripts/deploy.sh
```

**What it does:**
1. Checks if Supabase CLI is installed
2. Links project if not already linked
3. Deploys `server` function
4. Runs health check

### `verify-deployment.sh`
Verifies the deployed Edge Function is working correctly.

**Usage:**
```bash
export SUPABASE_ANON_KEY=your_key
./scripts/verify-deployment.sh
```

**What it tests:**
1. Health endpoint (`/health`)
2. Dynamic form endpoint (`/admin/onboarding-forms/:roleId`)
3. All 8 vendor role forms
4. Auto-generation functionality

**Output:**
- ✅ Green checkmarks for passing tests
- ❌ Red X for failing tests
- Summary with pass/fail counts

## 🐛 Troubleshooting

### Error: `supabase: command not found`

**Solution:**
```bash
npm install -g supabase
```

### Error: `Project not linked`

**Solution:**
```bash
supabase link --project-ref vpvpbdwtyugbknrntkho
```

### Error: `Failed to fetch` in app

**Checklist:**
1. Run `./scripts/deploy.sh` to deploy function
2. Run `./scripts/verify-deployment.sh` to verify
3. Check function logs: `supabase functions logs server --tail`
4. Verify Edge Function exists in dashboard

### Error: Tests fail with 401 Unauthorized

**Solution:**
Make sure you've set the ANON_KEY:
```bash
export SUPABASE_ANON_KEY=your_actual_anon_key
```

Get your anon key from:
https://app.supabase.com/project/vpvpbdwtyugbknrntkho/settings/api

## 📊 Expected Output

### Successful Deployment
```
========================================
  Warmpawz Edge Function Deployment
========================================

✅ Supabase CLI found
✅ Project linked

📦 Deploying 'server' Edge Function...

Function deployed successfully!

========================================
  ✅ Deployment Complete!
========================================

✅ Health check passed!
```

### Successful Verification
```
========================================
  Warmpawz Deployment Verification
========================================

1️⃣  Testing Health Endpoint
   ✅ Health check passed

2️⃣  Testing Dynamic Form Endpoint
   ✅ Dynamic form endpoint working
   🎉 Auto-generation is working!
   📋 Form status: active

3️⃣  Testing All Vendor Roles
   ✅ pet_clinic
   ✅ pet_groomer
   ✅ pet_trainer
   ✅ pet_sitter
   ✅ pet_walker
   ✅ pet_boarding
   ✅ pet_store
   ✅ pet_insurance

   Results: 8 passed, 0 failed

========================================
  Summary
========================================

🎉 All tests passed! Edge Function is working correctly.
```

## 🔗 Useful Links

- **Supabase Dashboard**: https://app.supabase.com/project/vpvpbdwtyugbknrntkho
- **Edge Functions**: https://app.supabase.com/project/vpvpbdwtyugbknrntkho/functions
- **Function Logs**: https://app.supabase.com/project/vpvpbdwtyugbknrntkho/logs/functions
- **API Settings**: https://app.supabase.com/project/vpvpbdwtyugbknrntkho/settings/api

## 📚 More Help

See [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) for detailed deployment instructions.
