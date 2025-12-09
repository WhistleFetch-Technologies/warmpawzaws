# 🔧 PHASE 1: DATABASE PERSISTENCE FIX

**Priority:** P0 - CRITICAL  
**Estimated Time:** 2 hours  
**Status:** 🔴 IN PROGRESS

---

## 🎯 OBJECTIVE

Fix the core issue where vendor services are not being persisted to the database, causing:
- Services disappearing after page refresh
- Staff management showing no services
- Customer app not showing vendor services

---

## 🐛 ROOT CAUSE

**File:** `/supabase/functions/server/vendor-service-endpoints.tsx`

**Problem:** The `POST /vendor/:vendorId/services/configure` endpoint receives the service data but **does not write it to the KV store**.

**Current Code (BROKEN):**
```typescript
app.post('/make-server-3dd53475/vendor/:vendorId/services/configure', async (c) => {
  const { vendorId } = c.req.param();
  const { serviceStyle, services } = await c.req.json();
  
  console.log(`Received ${services.length} services`);
  
  // ❌ PROBLEM: No kv.set() calls here!
  // Data is received but never persisted
  
  return sendSuccess(c, { message: 'Configuration saved' });
});
```

---

## ✅ FIX IMPLEMENTATION

### Step 1: Update Service Configuration Endpoint

**Action:** Add proper KV store persistence with atomic operations

**New Code:**
```typescript
app.post('/make-server-3dd53475/vendor/:vendorId/services/configure', async (c) => {
  try {
    const { vendorId } = c.req.param();
    const { serviceStyle, services } = await c.req.json();
    
    console.log(`💾 [SERVICE-CONFIG] Saving ${services.length} services for vendor ${vendorId}, style: ${serviceStyle}`);
    
    if (!services || services.length === 0) {
      return sendError(c, 'No services provided', 400);
    }
    
    // ✅ FIX: Persist each service to KV store
    const savePromises = services.map(async (service) => {
      const key = `vendor_service:${vendorId}:${serviceStyle}:${service.id}`;
      const value = {
        vendorId,
        serviceId: service.id,
        serviceName: service.name,
        serviceStyle,
        categoryName: service.categoryName,
        isEnabled: service.isEnabled,
        customPrice: service.customPrice || null,
        customDuration: service.customDuration || null,
        customDescription: service.customDescription || null,
        isPlatformManaged: service.isPlatformManaged,
        enabledAt: service.isEnabled ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(key, value);
      console.log(`✅ [SERVICE-CONFIG] Saved: ${key}`);
      
      return { serviceId: service.id, saved: true };
    });
    
    // Wait for all saves to complete
    const results = await Promise.all(savePromises);
    
    const savedCount = results.filter(r => r.saved).length;
    const enabledCount = services.filter(s => s.isEnabled).length;
    
    console.log(`✅ [SERVICE-CONFIG] Successfully saved ${savedCount} services, ${enabledCount} enabled`);
    
    return sendSuccess(c, { 
      message: 'Services saved successfully',
      savedCount,
      enabledCount,
      results
    });
  } catch (error) {
    console.error('❌ [SERVICE-CONFIG] Error saving services:', error);
    return sendError(c, `Failed to save services: ${error.message}`, 500);
  }
});
```

---

### Step 2: Update Service Retrieval Endpoint

**Action:** Merge catalog services with vendor's enabled status

**New Code:**
```typescript
app.get('/make-server-3dd53475/vendor/:vendorId/services/:serviceStyle', async (c) => {
  try {
    const { vendorId, serviceStyle } = c.req.param();
    
    console.log(`📋 [SERVICE-LOAD] Loading services for vendor ${vendorId}, style: ${serviceStyle}`);
    
    // 1. Load all catalog services
    const catalogServices = await kv.getByPrefix('service_catalog:');
    console.log(`📊 [SERVICE-LOAD] Found ${catalogServices.length} total catalog services`);
    
    // 2. Filter by service style
    const filteredCatalog = catalogServices.filter(s => 
      s.serviceStyle === serviceStyle || s.serviceStyle === 'all'
    );
    console.log(`📊 [SERVICE-LOAD] Filtered to ${filteredCatalog.length} services for style: ${serviceStyle}`);
    
    // 3. ✅ FIX: Load vendor's saved services
    const vendorServiceKeys = await kv.getByPrefix(`vendor_service:${vendorId}:${serviceStyle}:`);
    console.log(`📊 [SERVICE-LOAD] Found ${vendorServiceKeys.length} vendor-enabled services`);
    
    // Create a map for quick lookup
    const vendorServiceMap = new Map(
      vendorServiceKeys.map(vs => [vs.serviceId, vs])
    );
    
    // 4. Merge catalog with vendor's enabled status
    const mergedServices = filteredCatalog.map(catalogService => {
      const vendorService = vendorServiceMap.get(catalogService.id);
      
      return {
        ...catalogService,
        isEnabled: vendorService?.isEnabled || false,
        customPrice: vendorService?.customPrice || catalogService.price,
        customDuration: vendorService?.customDuration || catalogService.duration,
        customDescription: vendorService?.customDescription || catalogService.description,
        enabledAt: vendorService?.enabledAt || null,
        hasVendorOverrides: !!(vendorService?.customPrice || vendorService?.customDuration)
      };
    });
    
    const enabledCount = mergedServices.filter(s => s.isEnabled).length;
    
    console.log(`✅ [SERVICE-LOAD] Returning ${mergedServices.length} services, ${enabledCount} enabled`);
    
    return sendSuccess(c, { 
      services: mergedServices,
      totalCount: mergedServices.length,
      enabledCount,
      catalogCount: filteredCatalog.length,
      vendorServiceCount: vendorServiceKeys.length
    });
  } catch (error) {
    console.error('❌ [SERVICE-LOAD] Error loading services:', error);
    return sendError(c, `Failed to load services: ${error.message}`, 500);
  }
});
```

---

### Step 3: Add Service Deletion Endpoint

**Action:** Allow vendors to remove/disable services

**New Code:**
```typescript
app.delete('/make-server-3dd53475/vendor/:vendorId/services/:serviceStyle/:serviceId', async (c) => {
  try {
    const { vendorId, serviceStyle, serviceId } = c.req.param();
    
    console.log(`🗑️ [SERVICE-DELETE] Removing service ${serviceId} from vendor ${vendorId}`);
    
    const key = `vendor_service:${vendorId}:${serviceStyle}:${serviceId}`;
    
    // Check if service exists
    const existing = await kv.get(key);
    if (!existing) {
      return sendError(c, 'Service not found', 404);
    }
    
    // Delete the service
    await kv.del(key);
    
    console.log(`✅ [SERVICE-DELETE] Deleted: ${key}`);
    
    return sendSuccess(c, { 
      message: 'Service deleted successfully',
      deletedService: existing
    });
  } catch (error) {
    console.error('❌ [SERVICE-DELETE] Error deleting service:', error);
    return sendError(c, `Failed to delete service: ${error.message}`, 500);
  }
});
```

---

### Step 4: Add Bulk Service Operations

**Action:** Enable/disable multiple services at once

**New Code:**
```typescript
app.post('/make-server-3dd53475/vendor/:vendorId/services/bulk-update', async (c) => {
  try {
    const { vendorId } = c.req.param();
    const { operation, serviceStyle, serviceIds } = await c.req.json();
    
    console.log(`📦 [BULK-UPDATE] ${operation} ${serviceIds.length} services for vendor ${vendorId}`);
    
    if (operation === 'enable') {
      // Enable multiple services
      const promises = serviceIds.map(async (serviceId) => {
        const key = `vendor_service:${vendorId}:${serviceStyle}:${serviceId}`;
        const existing = await kv.get(key);
        
        if (existing) {
          await kv.set(key, { ...existing, isEnabled: true, enabledAt: new Date().toISOString() });
        } else {
          // Service not in vendor's list yet, add it
          const catalogService = await kv.get(`service_catalog:${serviceId}`);
          if (catalogService) {
            await kv.set(key, {
              vendorId,
              serviceId,
              serviceName: catalogService.name,
              serviceStyle,
              categoryName: catalogService.categoryName,
              isEnabled: true,
              customPrice: null,
              customDuration: null,
              isPlatformManaged: catalogService.isPlatformManaged,
              enabledAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
        }
      });
      
      await Promise.all(promises);
      return sendSuccess(c, { message: `${serviceIds.length} services enabled` });
      
    } else if (operation === 'disable') {
      // Disable multiple services
      const promises = serviceIds.map(async (serviceId) => {
        const key = `vendor_service:${vendorId}:${serviceStyle}:${serviceId}`;
        const existing = await kv.get(key);
        
        if (existing) {
          await kv.set(key, { ...existing, isEnabled: false, disabledAt: new Date().toISOString() });
        }
      });
      
      await Promise.all(promises);
      return sendSuccess(c, { message: `${serviceIds.length} services disabled` });
      
    } else if (operation === 'delete') {
      // Delete multiple services
      const promises = serviceIds.map(async (serviceId) => {
        const key = `vendor_service:${vendorId}:${serviceStyle}:${serviceId}`;
        await kv.del(key);
      });
      
      await Promise.all(promises);
      return sendSuccess(c, { message: `${serviceIds.length} services deleted` });
    } else {
      return sendError(c, 'Invalid operation. Use: enable, disable, or delete', 400);
    }
  } catch (error) {
    console.error('❌ [BULK-UPDATE] Error:', error);
    return sendError(c, `Bulk update failed: ${error.message}`, 500);
  }
});
```

---

## 🧪 TESTING PLAN

### Test Case 1: Save Services
**Steps:**
1. Login as vet clinic vendor
2. Navigate to Service Management → At Center
3. Enable 5 services (Checkup, Vaccination, Surgery, Dental, Grooming)
4. Click "Save Configuration"
5. Check browser console for log: "✅ Saved: vendor_service:vendor_123:at_center:checkup"
6. Verify success toast appears

**Expected:**
- All 5 services saved to KV store with keys: `vendor_service:{vendorId}:at_center:{serviceId}`
- Console shows 5 "✅ Saved" messages
- Success toast: "Services saved successfully"

**Verification:**
```javascript
// Run in browser console
fetch(`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/services/at_center`, {
  headers: { 'Authorization': `Bearer ${publicAnonKey}` }
})
.then(r => r.json())
.then(data => {
  console.log('Enabled services:', data.services.filter(s => s.isEnabled));
  console.log('Enabled count:', data.enabledCount);
});

// Should return 5 enabled services
```

---

### Test Case 2: Persist After Refresh
**Steps:**
1. After saving 5 services (from Test Case 1)
2. Hard refresh page (Ctrl+Shift+R)
3. Navigate back to Service Management → At Center
4. Check if all 5 services are still enabled

**Expected:**
- All 5 services show as enabled (checkmarks ON)
- Custom prices/durations preserved
- No need to re-enable

**Verification:**
```javascript
// Check database directly
const services = await kv.getByPrefix('vendor_service:vendor_123:at_center:');
console.log('Persisted services:', services.length); // Should be 5
console.log('Enabled services:', services.filter(s => s.isEnabled).length); // Should be 5
```

---

### Test Case 3: Service Appears in Staff Management
**Steps:**
1. After saving 5 services (from Test Case 1)
2. Navigate to Staff Management
3. Click "Add Staff Member"
4. Add staff: Name "John", Phone "9876543210"
5. Click "Assign Services to John"
6. Check if all 5 center services appear in the assignment list

**Expected:**
- Service assignment screen shows 5 services
- Each service has checkbox
- Can select and assign to staff

**API Test:**
```javascript
// Test new endpoint
fetch(`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/services/available-for-staff`, {
  headers: { 'Authorization': `Bearer ${publicAnonKey}` }
})
.then(r => r.json())
.then(data => {
  console.log('Services available for staff:', data.services.length); // Should be 5
  console.log('Services:', data.services.map(s => s.serviceName));
});
```

---

### Test Case 4: Bulk Enable/Disable
**Steps:**
1. Enable 3 services
2. Disable all 3 at once using bulk update
3. Verify all 3 are disabled
4. Re-enable 2 of them using bulk update
5. Verify only 2 are enabled

**API Test:**
```javascript
// Bulk enable
fetch(`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/services/bulk-update`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${publicAnonKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    operation: 'enable',
    serviceStyle: 'at_center',
    serviceIds: ['service_1', 'service_2', 'service_3']
  })
})
.then(r => r.json())
.then(console.log);

// Bulk disable
fetch(`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/services/bulk-update`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${publicAnonKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    operation: 'disable',
    serviceStyle: 'at_center',
    serviceIds: ['service_1', 'service_2']
  })
})
.then(r => r.json())
.then(console.log);
```

---

## ✅ SUCCESS CRITERIA

### Critical (Must Pass)
- [ ] Services persist after save (Test Case 1)
- [ ] Services remain after page refresh (Test Case 2)
- [ ] Services appear in staff assignment (Test Case 3)
- [ ] No console errors during save
- [ ] No data loss

### High Priority (Should Pass)
- [ ] Bulk operations work (Test Case 4)
- [ ] Custom prices/durations persist
- [ ] Service count matches enabled services
- [ ] API response time < 500ms

### Nice to Have
- [ ] Loading states show during save
- [ ] Success animations
- [ ] Error handling shows user-friendly messages

---

## 🚀 DEPLOYMENT STEPS

### 1. Update Backend (10 minutes)
```bash
# Navigate to backend directory
cd supabase/functions/server

# Edit vendor-service-endpoints.tsx
# Add all 4 endpoint implementations from above

# Test locally if possible
supabase functions serve make-server-3dd53475

# Deploy to production
supabase functions deploy make-server-3dd53475
```

### 2. Verify Deployment (5 minutes)
```bash
# Check function logs
supabase functions logs make-server-3dd53475

# Test health endpoint
curl https://${PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475/health
```

### 3. Test on Staging (15 minutes)
- Run all 4 test cases
- Check browser console for errors
- Verify database persistence
- Check API response times

### 4. Deploy to Production (5 minutes)
- If all tests pass → Deploy
- Monitor error logs for 30 minutes
- If errors > 1% → Rollback immediately

---

## 🐛 TROUBLESHOOTING

### Issue: Services still not saving
**Check:**
1. Backend deployed successfully?
2. Endpoint is receiving data? (Check logs)
3. KV store accessible? (Check permissions)
4. Service IDs match catalog? (Check key format)

**Debug:**
```javascript
// Check if service exists in catalog
const catalogService = await kv.get('service_catalog:service_123');
console.log('Catalog service:', catalogService);

// Check if vendor service was saved
const vendorService = await kv.get('vendor_service:vendor_123:at_center:service_123');
console.log('Vendor service:', vendorService);

// List all vendor services
const allVendorServices = await kv.getByPrefix('vendor_service:vendor_123:');
console.log('All vendor services:', allVendorServices.length);
```

### Issue: Services load but show wrong enabled status
**Check:**
1. Key format correct? (`vendor_service:{vendorId}:{serviceStyle}:{serviceId}`)
2. Merge logic working? (Check console logs)
3. isEnabled field correct type? (boolean, not string)

**Debug:**
```typescript
// Add more logging to GET endpoint
console.log('Catalog services:', filteredCatalog.length);
console.log('Vendor services:', vendorServiceKeys.length);
console.log('Vendor service map size:', vendorServiceMap.size);
console.log('First merged service:', mergedServices[0]);
```

---

## 📊 MONITORING

### Metrics to Track
- **Save Success Rate:** Target 99.9%
- **Retrieval Success Rate:** Target 99.9%
- **API Latency:** Target < 500ms
- **Database Write Time:** Target < 100ms per service
- **Error Rate:** Target < 0.1%

### Alerts to Set
- Alert if save success rate < 95%
- Alert if API latency > 1s
- Alert if error rate > 1%
- Alert if KV store write fails

---

**Status:** 🔴 READY TO IMPLEMENT  
**Estimated Time:** 2 hours (1 hour coding + 1 hour testing)  
**Risk Level:** Low (Changes are isolated to service endpoints)  
**Rollback Plan:** Revert to previous version if error rate > 1%

---

**Next Actions:**
1. Implement 4 endpoint updates in backend
2. Deploy to staging
3. Run all 4 test cases
4. If all pass → Deploy to production
5. Monitor for 1 hour
6. Move to Phase 2 (UI/UX Improvements)
