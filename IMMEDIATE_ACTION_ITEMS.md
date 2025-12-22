# Immediate Action Items - Quick Start

## 🎯 Priority 1: Critical Verification (Do First)

### 1. Test Service Publishing (5 minutes)
```
1. Go to Vendor Dashboard → Service Catalog
2. Click "Add Service"
3. Fill in details and save
4. ✅ Verify: Service appears immediately
5. ✅ Verify: Shows "Live" badge (if standard service)
```

### 2. Test Service Persistence (2 minutes)
```
1. Publish a service
2. Refresh the page
3. ✅ Verify: Service still there
```

### 3. Test Customer App Service Discovery (5 minutes)
```
1. Go to Customer App
2. Search for services
3. ✅ Verify: Your published services appear
4. ✅ Verify: Only live services shown
```

## 🎯 Priority 2: Feature Verification (Do Next)

### 4. Test Staff Service Enablement (5 minutes)
```
1. Go to Staff Dashboard → Services
2. ✅ Verify: Center services listed
3. Toggle a service to enable
4. ✅ Verify: Service enables successfully
```

### 5. Test CRM Back Arrow (1 minute)
```
1. Go to Admin Portal → Support CRM
2. Click back arrow (←)
3. ✅ Verify: Returns to admin portal
```

### 6. Test Approval Workflow (5 minutes)
```
1. Publish a CUSTOM service
2. ✅ Verify: Shows "Pending Approval" badge
3. Publish a STANDARD service
4. ✅ Verify: Shows "Live" badge immediately
```

## 🎯 Priority 3: Full System Check (Do After Priority 1 & 2)

### 7. Test All CRM Features
- Agent metrics
- Agent assignment
- Auto-routing
- Escalate action

### 8. Verify Pet Information
- Check sidebar navigation
- Open Pet Information Dashboard

### 9. Test AI Chat
- Open chat widget
- Send a message
- Test support mode

## 🚨 If Something Doesn't Work

### Quick Debug Steps:
1. **Check Browser Console** - Look for errors
2. **Check Network Tab** - Verify API calls succeed
3. **Check Server Logs:**
   ```bash
   npx supabase functions logs make-server-3dd53475 --follow
   ```
4. **Check Database:**
   ```sql
   SELECT * FROM services WHERE vendor_id = 'your-id' LIMIT 5;
   ```

## 📋 Quick SQL Checks

### Verify Services Table
```sql
SELECT 
  service_id,
  name,
  publish_status,
  is_live,
  created_at
FROM services
ORDER BY created_at DESC
LIMIT 10;
```

### Verify Vendor Services
```sql
SELECT COUNT(*) FROM vendor_services;
```

### Verify Staff Services
```sql
SELECT COUNT(*) FROM staff_services;
```

## ✅ Success Indicators

You'll know everything works when:
- ✅ Services save and appear immediately
- ✅ Live badges show correctly
- ✅ Services appear in customer app
- ✅ Staff can enable services
- ✅ CRM navigation works
- ✅ No console errors

## 🎉 Expected Timeline

- **Priority 1:** ~15 minutes
- **Priority 2:** ~15 minutes  
- **Priority 3:** ~20 minutes

**Total:** ~50 minutes for complete verification

---

**Start with Priority 1** - These are the most critical fixes that were requested.

