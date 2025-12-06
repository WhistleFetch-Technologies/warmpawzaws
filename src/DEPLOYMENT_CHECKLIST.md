# 🚀 EDGE FUNCTION DEPLOYMENT CHECKLIST

## ⚠️ CRITICAL: You MUST deploy the Edge Function to Supabase!

The "Failed to fetch" error means the Supabase Edge Function is **NOT DEPLOYED** or **NOT RUNNING**.

---

## 📋 DEPLOYMENT STEPS

### **Step 1: Install Supabase CLI** (if not installed)
```bash
npm install supabase --save-dev
```

### **Step 2: Login to Supabase**
```bash
npx supabase login
```

### **Step 3: Link Your Project**
```bash
npx supabase link --project-ref vpvpbdwtyugbknrntkho
```

### **Step 4: Deploy the Edge Function**
```bash
npx supabase functions deploy server
```

**Expected Output:**
```
Deploying function (project ref: vpvpbdwtyugbknrntkho)...
Function deployed successfully!
Function URL: https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/server
```

### **Step 5: Verify Deployment**

#### **Option A: Using Browser**
Navigate to:
```
https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-20T...",
  "message": "Warmpawz API Server is running"
}
```

#### **Option B: Using Test Page**
Navigate to `/test-onboarding` in your app and click "▶️ Run All Tests"

---

## 🔍 TROUBLESHOOTING

### **If you get "Failed to fetch":**

1. **Check Supabase Dashboard**:
   - Go to: https://supabase.com/dashboard/project/vpvpbdwtyugbknrntkho
   - Navigate to: **Edge Functions** → **server**
   - Check if function is listed and status is "Active"

2. **Check Function Logs**:
   - In Edge Functions page, click "server" function
   - Go to **Logs** tab
   - You should see logs when you make requests

3. **Check for Deploy Errors**:
   ```bash
   npx supabase functions deploy server --debug
   ```

4. **Check Environment Variables**:
   - Supabase Dashboard → **Settings** → **Edge Functions**
   - Ensure these secrets exist:
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `SUPABASE_ANON_KEY`
     - `SUPABASE_DB_URL`

---

## ✅ POST-DEPLOYMENT VERIFICATION

After deployment, test the onboarding form:

1. **Go to vendor onboarding page**
2. **Select "Pet Grooming"** from services
3. **Click "Start your pet service business"**
4. **✅ You should see the dynamic form load**

Check browser console for:
```
🚀 ========== VENDOR ONBOARDING FORM REQUEST ==========
[VENDOR FORM] Role ID from param: pet_groomer
[VENDOR FORM] ✅ Auto-generated active form saved
```

---

## 📞 NEED HELP?

If deployment fails:
- Check Supabase project is active
- Verify you have correct permissions
- Check firewall/network settings
- Try deploying with `--legacy-bundle` flag:
  ```bash
  npx supabase functions deploy server --legacy-bundle
  ```

---

## 🎯 WHAT WAS FIXED

1. ✅ **Hono version mismatch** - Fixed import from `npm:hono@4` to `npm:hono`
2. ✅ **Service ID to Role ID mapping** - Added mapping from `grooming` → `pet_groomer`
3. ✅ **Enhanced logging** - Added comprehensive request logging
4. ✅ **Retry button** - Added retry button on error state

**The code is ready. You just need to DEPLOY! 🚀**
