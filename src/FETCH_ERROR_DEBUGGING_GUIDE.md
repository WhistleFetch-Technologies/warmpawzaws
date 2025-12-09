# 🐛 FETCH ERROR DEBUGGING GUIDE
## "Failed to fetch" - Admin Vendor Data Loading

**Error:** `TypeError: Failed to fetch`  
**Component:** `/components/admin/AdminVendorManagementNew.tsx`  
**Endpoints:** Multiple admin vendor endpoints

---

## 🔍 WHAT WAS FIXED

### 1. **Backend Endpoint Improvements** ✅
**File:** `/supabase/functions/server/admin-vendor-endpoints.tsx`

**Changes:**
- Added environment variable validation before creating Supabase client
- Added `.limit(1000)` to prevent database timeout on large datasets
- Added detailed console logging for debugging
- Better error handling with specific error messages

**Fixed Endpoint:** `GET /admin/vendors/all`

### 2. **Frontend Error Handling** ✅
**File:** `/components/admin/AdminVendorManagementNew.tsx`

**Changes:**
- Added `error` state to display errors properly
- Replaced `alert()` with proper error UI component
- Added retry functionality
- Added loading state UI
- Better error message formatting

**New Features:**
- Error display screen with detailed troubleshooting
- Retry button to re-attempt fetch
- Loading spinner during data fetch
- Reload page button

---

## 🚨 COMMON CAUSES & SOLUTIONS

### Cause 1: **Server Not Running**
**Symptoms:**
- Immediate "Failed to fetch" error
- No server logs in Supabase function logs
- Health check fails

**Solution:**
```bash
# Check if server is deployed
# Go to Supabase Dashboard → Edge Functions → make-server-3dd53475
# Check deployment status

# If not deployed, redeploy:
supabase functions deploy make-server-3dd53475
```

**Verification:**
```bash
# Test health endpoint
curl https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/health \
  -H "Authorization: Bearer {publicAnonKey}"

# Should return: {"status": "ok", "message": "Server is running"}
```

---

### Cause 2: **Database Query Timeout**
**Symptoms:**
- Error occurs after 10-30 seconds
- Server logs show "Query timeout" or hangs
- Large number of vendor records in database

**Solution:**
✅ **Already Fixed** - Added `.limit(1000)` to query

**Additional Optimization:**
```typescript
// If you have more than 1000 vendors, implement pagination
const { data, error } = await supabase
  .from('kv_store_3dd53475')
  .select('key, value')
  .like('key', 'vendor:%')
  .range(0, 999) // First 1000 records
  .limit(1000);
```

---

### Cause 3: **CORS Error**
**Symptoms:**
- Browser console shows CORS-related error
- Network tab shows request cancelled or CORS preflight failed
- Error message mentions "CORS policy"

**Solution:**
CORS is already configured in the server. Check if:

1. **Using correct domain:**
   - ✅ `https://{projectId}.supabase.co`
   - ❌ `http://localhost:54321` (local Supabase CLI - different CORS)

2. **Headers are correct:**
   ```javascript
   headers: {
     'Authorization': `Bearer ${publicAnonKey}`,
     'Content-Type': 'application/json' // Only for POST/PUT
   }
   ```

---

### Cause 4: **Missing Environment Variables**
**Symptoms:**
- Server returns 500 error
- Server logs show "Missing Supabase credentials"
- Error occurs when creating Supabase client

**Solution:**
Check Supabase Edge Function environment variables:

1. Go to Supabase Dashboard → Settings → Edge Functions
2. Verify these secrets exist:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`

**Set missing secrets:**
```bash
supabase secrets set SUPABASE_URL="https://{projectId}.supabase.co"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

---

### Cause 5: **Network/Connectivity Issue**
**Symptoms:**
- Other websites/APIs also failing
- Intermittent errors
- Works in different network

**Solution:**
1. Check internet connection
2. Try different network (mobile hotspot)
3. Disable VPN/proxy if enabled
4. Clear browser cache and reload

---

### Cause 6: **Database Connection Issue**
**Symptoms:**
- Database queries in other parts of app also failing
- Supabase dashboard shows database offline
- Error mentions "connection refused"

**Solution:**
1. Check Supabase project status:
   - Go to Supabase Dashboard → Project Settings
   - Check if project is paused (free tier auto-pauses after inactivity)
   
2. **Unpause project:**
   - Click "Restore project" if paused

3. **Check database health:**
   ```bash
   # Test direct database query
   curl https://{projectId}.supabase.co/rest/v1/kv_store_3dd53475?select=key&limit=1 \
     -H "apikey: {publicAnonKey}" \
     -H "Authorization: Bearer {publicAnonKey}"
   ```

---

## 🔬 DEBUGGING STEPS

### Step 1: Check Server Health
```javascript
// In browser console
fetch('https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/health', {
  headers: { 'Authorization': 'Bearer {publicAnonKey}' }
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

**Expected:** `{status: "ok", message: "Server is running"}`

---

### Step 2: Test Vendor Endpoint Directly
```javascript
// In browser console
fetch('https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/all', {
  headers: { 'Authorization': 'Bearer {publicAnonKey}' }
})
.then(r => {
  console.log('Status:', r.status);
  return r.json();
})
.then(data => {
  console.log('Vendors:', data.vendors?.length || 0);
  console.log('First vendor:', data.vendors?.[0]);
})
.catch(error => {
  console.error('Error:', error);
  console.error('Error type:', error.constructor.name);
});
```

**Expected:**
```json
{
  "success": true,
  "vendors": [...],
  "total": 10
}
```

---

### Step 3: Check Browser Network Tab
1. Open DevTools (F12)
2. Go to Network tab
3. Reload the page
4. Look for the failed request

**Check:**
- **Status Code:** Should be 200 (if not, check what it is)
- **Type:** Should be "fetch"
- **Size:** If 0 bytes or "failed", network issue
- **Time:** If very long (>30s), timeout issue

---

### Step 4: Check Server Logs
1. Go to Supabase Dashboard
2. Navigate to Edge Functions → make-server-3dd53475
3. Click "Logs"
4. Look for error messages

**Common log errors:**
- `❌ Missing Supabase credentials` → Set environment variables
- `❌ Error fetching vendors: [error]` → Database query issue
- `Query timeout` → Need pagination or query optimization
- `Unauthorized` → Check API keys

---

## 🛠️ QUICK FIXES

### Fix 1: Clear Everything and Retry
```bash
# Clear browser cache
Ctrl+Shift+Delete (Chrome/Edge)
Cmd+Shift+Delete (Mac)

# Hard reload
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)

# Or clear in DevTools
F12 → Network tab → Check "Disable cache"
```

---

### Fix 2: Verify API Keys
```javascript
// In browser console
console.log('Project ID:', '{projectId}');
console.log('Anon Key:', '{publicAnonKey}'.substring(0, 20) + '...');

// Test if key works
fetch('https://{projectId}.supabase.co/rest/v1/', {
  headers: { 'apikey': '{publicAnonKey}' }
})
.then(r => console.log('Key valid:', r.ok))
.catch(e => console.log('Key invalid:', e));
```

---

### Fix 3: Database Direct Query Test
```javascript
// Test if database is accessible
fetch('https://{projectId}.supabase.co/rest/v1/kv_store_3dd53475?select=key&limit=10', {
  headers: {
    'apikey': '{publicAnonKey}',
    'Authorization': 'Bearer {publicAnonKey}'
  }
})
.then(r => r.json())
.then(data => {
  console.log('✅ Database accessible');
  console.log('Records found:', data.length);
})
.catch(error => {
  console.error('❌ Database not accessible:', error);
});
```

---

## 📊 MONITORING & PREVENTION

### Add Request Timeout
```typescript
// In loadData function, add timeout
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

try {
  const response = await fetch(url, {
    headers: { ... },
    signal: controller.signal
  });
  clearTimeout(timeoutId);
  
  // ... rest of code
} catch (error) {
  if (error.name === 'AbortError') {
    setError('Request timed out after 30 seconds. The server may be slow or overloaded.');
  } else {
    // ... existing error handling
  }
}
```

---

### Add Retry Logic
```typescript
// Automatic retry with exponential backoff
const fetchWithRetry = async (url: string, options: any, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      
      // If 5xx error, retry
      if (response.status >= 500 && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        continue;
      }
      
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
};
```

---

## ✅ VERIFICATION CHECKLIST

After implementing fixes, verify:

- [ ] Health endpoint responds: `GET /health`
- [ ] Vendor stats loads: `GET /admin/vendors/stats`
- [ ] All vendors loads: `GET /admin/vendors/all`
- [ ] Quality alerts loads: `GET /quality/alerts`
- [ ] No console errors in browser
- [ ] Loading spinner appears briefly then disappears
- [ ] Vendor grid displays data
- [ ] No error messages shown

---

## 🆘 STILL NOT WORKING?

If you've tried everything and it still fails:

### Collect This Information:
1. **Browser console logs** (all red errors)
2. **Network tab screenshot** (showing failed request)
3. **Supabase function logs** (from dashboard)
4. **Error message from error screen**
5. **Project ID** (redact if sharing publicly)

### Temporary Workaround:
```typescript
// Use mock data while debugging
const loadData = async () => {
  try {
    setLoading(true);
    
    // Mock data for testing
    const mockVendors = [
      {
        id: 'vendor_1',
        fullName: 'Test Vendor',
        businessName: 'Test Business',
        phone: '1234567890',
        status: 'approved',
        // ... other fields
      }
    ];
    
    setAllVendors(mockVendors);
    setApplications(mockVendors);
    
    console.log('⚠️ Using mock data - fetch is failing');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    setLoading(false);
  }
};
```

---

## 📝 RECENT FIXES APPLIED

### ✅ Backend (admin-vendor-endpoints.tsx)
1. Added environment variable validation
2. Added query limit to prevent timeout
3. Improved error messages
4. Added detailed logging

### ✅ Frontend (AdminVendorManagementNew.tsx)
1. Added error state management
2. Created error display UI
3. Added retry functionality
4. Improved loading state
5. Better error messages with troubleshooting steps

---

**Next Steps:**
1. Clear browser cache
2. Hard reload the page
3. Check browser console for specific error
4. Try steps in order from Step 1 above
5. Report specific error if persists

---

**Need Help?** Check server logs first, then try each debugging step in order!
