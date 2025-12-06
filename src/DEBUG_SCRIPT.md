# 🔍 DEBUG SCRIPT - Vendor Service Approval Flow

## CRITICAL BUG FOUND & FIXED

**Issue:** Route prefix was doubled in reverification.tsx  
**Root Cause:** Routes in reverification.tsx had `/make-server-3dd53475/` prefix, but index.tsx registered them with `.route("/make-server-3dd53475", ...)`, resulting in `/make-server-3dd53475/make-server-3dd53475/...`

**Fix Applied:** ✅ Removed prefix from all routes in reverification.tsx

---

## STEP-BY-STEP DEBUGGING

### **Step 1: Open Browser Console**

Go to your admin dashboard and open the browser console (F12).

### **Step 2: Check What Vendor Published**

When vendor publishes services, they should see console logs like:
```
🚀 [VENDOR-SERVICES] Publishing services for vendor vendor_xxxxx, style: at_clinic
📋 [VENDOR-SERVICES] Created approval request: RATE_REQ_1731845000000
```

**If you see this**, the backend is working correctly and the approval request was created.

### **Step 3: Check Database Directly**

Run this in browser console to see what was actually created:

```javascript
// Replace with your actual values
const projectId = "YOUR_PROJECT_ID";
const publicAnonKey = "YOUR_PUBLIC_ANON_KEY";

// Helper function to call KV store (you need to add this endpoint)
async function checkDatabase() {
  console.log('=== DATABASE DEBUG ===');
  
  // Check rate change requests
  const response1 = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/debug/kv-prefix/rate_change_request`,
    { headers: { 'Authorization': `Bearer ${publicAnonKey}` }}
  );
  const rateChanges = await response1.json();
  console.log('📋 Rate Change Requests:', rateChanges);
  
  // Check custom service approvals
  const response2 = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/debug/kv-prefix/custom_service_approval`,
    { headers: { 'Authorization': `Bearer ${publicAnonKey}` }}
  );
  const customApprovals = await response2.json();
  console.log('📦 Custom Service Approvals:', customApprovals);
}

checkDatabase();
```

### **Step 4: Test Admin Endpoint Directly**

```javascript
// Test the admin rate changes endpoint
async function testAdminEndpoint() {
  console.log('=== TESTING ADMIN ENDPOINT ===');
  
  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/rate-changes`,
    { headers: { 'Authorization': `Bearer ${publicAnonKey}` }}
  );
  
  console.log('Response Status:', response.status);
  
  if (response.ok) {
    const data = await response.json();
    console.log('✅ Admin Endpoint Response:', data);
    console.log('📊 Total Requests:', data.rateChanges?.length || 0);
    
    if (data.rateChanges && data.rateChanges.length > 0) {
      console.log('📋 First Request:', data.rateChanges[0]);
    }
  } else {
    const error = await response.text();
    console.error('❌ Admin Endpoint Error:', error);
  }
}

testAdminEndpoint();
```

### **Step 5: Check Vendor Services**

```javascript
// Check the vendor's services directly
async function checkVendorServices(vendorId, serviceStyle) {
  console.log('=== CHECKING VENDOR SERVICES ===');
  
  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/services/${serviceStyle}`,
    { headers: { 'Authorization': `Bearer ${publicAnonKey}` }}
  );
  
  if (response.ok) {
    const data = await response.json();
    console.log('✅ Vendor Services:', data);
    
    // Check publish status
    const pendingServices = data.services?.filter(s => s.publishStatus === 'pending_approval');
    console.log('📋 Services Pending Approval:', pendingServices);
    
    // Check for approval request IDs
    pendingServices?.forEach(s => {
      console.log(`   Service: ${s.serviceName}`);
      console.log(`   Status: ${s.publishStatus}`);
      console.log(`   Approval Request ID: ${s.approvalRequestId || 'NOT SET'}`);
    });
  } else {
    console.error('❌ Error fetching vendor services');
  }
}

// Replace with your vendor ID and service style
checkVendorServices('vendor_xxxxx', 'at_clinic');
```

---

## EXPECTED FLOW TRACE

### **1. Vendor Publishes (at_clinic or at_center)**

**Console Output:**
```
🚀 Publishing services...
✅ Services published: {status: "pending_approval", requestId: "RATE_REQ_1731845000000"}
```

**Database Changes:**
```
Created: rate_change_request:RATE_REQ_1731845000000
Updated: vendor_services:vendor_xxxxx:at_clinic
  - Each enabled service: publishStatus = "pending_approval"
  - Each enabled service: approvalRequestId = "RATE_REQ_1731845000000"
```

### **2. Admin Opens Rate Changes Tab**

**Console Output:**
```
📊 [ADMIN] Fetching all rate change requests...
   Found 1 rate_change_request: entries
   Found 0 custom_service_approval: entries
   Transformed to N pending rate changes
   Transformed to 0 pending custom services
✅ [ADMIN] Rate Changes tab loaded: N rate changes + 0 custom services = N total
```

**UI Display:**
```
Table with N rows:
- Request ID: RATE_REQ_1731845000000_serviceId
- Vendor: (vendor name)
- Service: (service name)
- Proposed Rate: ₹X
- Status: Pending
```

---

## COMMON ISSUES & FIXES

### **Issue 1: "Found 0 rate_change_request: entries"**

**Cause:** Vendor publish didn't create the approval request

**Debug:**
1. Check vendor service style: `at_home` and `tele` auto-publish (no approval needed)
2. Only `at_center` and `at_clinic` require approval
3. Check console logs when vendor clicks "Publish"

**Fix:** Ensure vendor has `at_center` or `at_clinic` service style

### **Issue 2: "Services showing as pending but not in admin tab"**

**Cause:** Route prefix issue (NOW FIXED)

**Verify Fix:**
```javascript
// This should return 200 OK now
fetch(`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/rate-changes`, {
  headers: { 'Authorization': `Bearer ${publicAnonKey}` }
}).then(r => console.log('Status:', r.status));
```

### **Issue 3: "Admin tab shows 0 requests but database has data"**

**Cause:** Data structure mismatch

**Debug:**
```javascript
// Manually fetch a rate change request
async function debugRequest(requestId) {
  // You need to add a debug endpoint in backend
  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/debug/kv-get/rate_change_request:${requestId}`,
    { headers: { 'Authorization': `Bearer ${publicAnonKey}` }}
  );
  const data = await response.json();
  console.log('Request Data:', data);
  
  // Check structure
  console.log('Has services array:', Array.isArray(data.services));
  console.log('Status:', data.status);
  console.log('Services count:', data.services?.length);
}
```

---

## QUICK FIX TEST

After the route prefix fix, immediately test:

### **Test 1: Admin Endpoint Accessible**
```javascript
fetch('https://YOUR_PROJECT.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/rate-changes')
  .then(r => r.json())
  .then(data => {
    console.log('✅ Endpoint working!');
    console.log('Requests:', data.rateChanges?.length || 0);
  })
  .catch(err => console.error('❌ Endpoint error:', err));
```

Expected: `✅ Endpoint working! Requests: N`

### **Test 2: Vendor Publish New Service**

1. Go to vendor dashboard
2. Add/enable a service
3. Click "Publish"
4. Check console for: `📋 [VENDOR-SERVICES] Created approval request: RATE_REQ_xxxxx`
5. Copy the request ID

### **Test 3: Check Admin Tab**

1. Go to admin dashboard → Rate Changes
2. Should see the request appear
3. Check console for: `📊 [ADMIN] Fetching all rate change requests...`

---

## DETAILED BACKEND TRACE

### **When Vendor Publishes:**

**File:** `/supabase/functions/server/vendor-service-management.tsx`  
**Endpoint:** `POST /make-server-3dd53475/vendor/:vendorId/services/publish`

**Code Flow:**
```javascript
Line 522: console.log(`🚀 [VENDOR-SERVICES] Publishing services...`)
Line 546: Check if isPlatformManaged (at_home || tele)
Line 569: else branch - Create approval request
Line 571: const requestId = `RATE_REQ_${Date.now()}`
Line 596: await kv.set(`rate_change_request:${requestId}`, approvalRequest)
Line 599-604: Update vendor_services publishStatus to 'pending_approval'
Line 608: console.log(`📋 [VENDOR-SERVICES] Created approval request: ${requestId}`)
```

### **When Admin Views:**

**File:** `/supabase/functions/server/reverification.tsx`  
**Endpoint:** `GET /admin/vendors/rate-changes` (NO PREFIX NOW!)

**Code Flow:**
```javascript
Line 112: console.log('📊 [ADMIN] Fetching all rate change requests...')
Line 115: const rateChangeRequests = await kv.getByPrefix('rate_change_request:')
Line 116: console.log(`   Found ${rateChangeRequests.length} entries`)
Line 119-120: Filter status === 'pending'
Line 123: if (req.services && req.services.length > 0) - Transform bulk
Line 139: Combine and sort
Line 143: Return combined array
```

---

## EMERGENCY DEBUG ENDPOINT

Add this temporary debug endpoint to your backend for testing:

**File:** `/supabase/functions/server/index.tsx`

```typescript
// TEMPORARY DEBUG ENDPOINT
app.get('/make-server-3dd53475/debug/kv-prefix/:prefix', async (c) => {
  try {
    const { prefix } = c.req.param();
    const results = await kv.getByPrefix(prefix + ':');
    return c.json({ 
      prefix, 
      count: results.length, 
      data: results 
    });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

app.get('/make-server-3dd53475/debug/kv-get/:key', async (c) => {
  try {
    const { key } = c.req.param();
    const data = await kv.get(key);
    return c.json({ key, data });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});
```

Then use:
```javascript
// Check all rate change requests
fetch('https://PROJECT.supabase.co/functions/v1/make-server-3dd53475/debug/kv-prefix/rate_change_request')
  .then(r => r.json())
  .then(console.log);

// Check specific request
fetch('https://PROJECT.supabase.co/functions/v1/make-server-3dd53475/debug/kv-get/rate_change_request:RATE_REQ_1731845000000')
  .then(r => r.json())
  .then(console.log);
```

---

## EXPECTED RESULTS AFTER FIX

### ✅ **Vendor Side:**
- Clicks "Publish"
- Sees: "Services submitted for admin approval"
- Services show status: "Pending Approval"
- Console shows: `📋 [VENDOR-SERVICES] Created approval request: RATE_REQ_xxxxx`

### ✅ **Admin Side:**
- Opens Rate Changes tab
- Console shows: `📊 [ADMIN] Fetching all rate change requests...`
- Console shows: `   Found 1 rate_change_request: entries`
- Console shows: `✅ [ADMIN] Rate Changes tab loaded: N total`
- Table displays N pending requests

### ✅ **Approve:**
- Admin clicks approve
- Console shows: `✅ [ADMIN] Approving request: RATE_REQ_xxxxx`
- Console shows: `✅ [ADMIN] Bulk request approved: N services`
- Request disappears from table
- Vendor services updated to `publishStatus: 'published'`

---

## NEXT STEPS

1. ✅ **Fix Applied** - Route prefix removed from reverification.tsx
2. 🧪 **Test** - Try publishing from vendor again
3. 🔍 **Verify** - Check admin Rate Changes tab
4. 📊 **Report** - Run the debug scripts above and share console output

**If still not working, run all debug scripts and share the console output!**
