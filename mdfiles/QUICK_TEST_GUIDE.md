# 🚀 Quick Test Guide - Vendor Dashboard Fixes

## ✅ Build Status: PASSED (No Errors)

---

## 🎯 Quick Start - Test in 5 Minutes

### 1. Start Server
```bash
cd /Users/ketan/Documents/warmpawzecodev/apps/vendor-web
npm run dev
```
Open: `http://localhost:3002`

---

## 🧪 Quick Tests

### Test 1: Staff Management Button (30 seconds)
1. Login as **veterinary clinic** or **pet groomer**
2. Look for orange "Manage Staff" button
3. **Expected:** ✅ Button visible and clickable

### Test 2: Center Profile Button (30 seconds)
1. Login as vendor with `at_center` service style
2. Look for purple "Center Profile" button  
3. **Expected:** ✅ Button visible and clickable

### Test 3: Custom Services (1 minute)
1. Navigate to Custom Services
2. Open browser console (F12)
3. **Expected:** ✅ See logs, no `h.map` error

---

## 🔍 Browser Console Quick Checks

```javascript
// Paste this in browser console (F12)

// 1. Check capabilities loading
const vendorData = JSON.parse(localStorage.getItem('vendorData'));
console.log('✅ Role:', vendorData.roleId);
console.log('✅ Service Style:', vendorData.serviceStyle);

// 2. Test custom services endpoint
fetch('/api/admin/service-catalog')
  .then(r => r.json())
  .then(d => console.log('✅ Services loaded:', Array.isArray(d.services)));

// 3. Check role capabilities
fetch(`/api/config/roles/${vendorData.roleId}`)
  .then(r => r.json())
  .then(d => console.log('✅ Capabilities:', d.capabilities));
```

---

## ✅ Success Indicators

### You Should See:
- ✅ No red errors in console
- ✅ Buttons appear based on role
- ✅ Custom services loads without crash
- ✅ Logs show: `[useVendorCapabilities] ✅ Loaded capabilities from DATABASE`

### You Should NOT See:
- ❌ `h.map is not a function`
- ❌ `TypeError` in console
- ❌ Missing buttons for eligible roles
- ❌ 500 errors in network tab

---

## 🎨 Visual Check

**Staff Management Button:**
- Color: Orange border (#FF8C42)
- Icon: 👥 Users
- Text: "Manage Staff"

**Center Profile Button:**
- Color: Purple border (#A855F7)
- Icon: 🏢 Building
- Text: "Center Profile"

---

## 📱 Test Roles

| Role | Staff Button | Center Button |
|------|-------------|---------------|
| Veterinary Clinic | ✅ YES | ✅ YES |
| Pet Groomer | ✅ YES | ✅ YES (if at_center) |
| Pet Trainer | ✅ YES | ✅ YES (if at_center) |
| Dog Walker | ❌ NO | ❌ NO (mobile only) |
| Pet Store | ❌ NO | ✅ YES |

---

## 🐛 If Something's Wrong

### No Buttons Appearing?
```javascript
// Debug in console:
const v = JSON.parse(localStorage.getItem('vendorData'));
console.log('Debug Info:', {
  roleId: v.roleId,
  serviceStyle: v.serviceStyle,
  capabilities: v.capabilities
});
```

### Custom Services Crashing?
1. Check Network tab for API errors
2. Look for `[CUSTOM-SERVICE]` logs in console
3. Verify vendor has `custom_services` capability

### Slow Loading?
- Check console for `[useVendorCapabilities]` logs
- Should see "Loaded from DATABASE" message
- If not, check `/api/config/roles/:id` endpoint

---

## 📊 Performance Check

**Expected Load Times:**
- Dashboard: < 2 seconds
- Custom Services: < 3 seconds
- Capabilities: < 1 second (cached after first load)

---

## 🚦 Ready to Deploy?

### Checklist:
- [ ] All buttons appear correctly
- [ ] No console errors
- [ ] Custom services works
- [ ] API calls successful
- [ ] Tested 3+ different roles

**All checked?** → Ready for staging deployment! 🎉

---

## 📞 Need Help?

Check detailed guide: `VERIFICATION_TESTS.md`
Check fixes summary: `VENDOR_DASHBOARD_FIXES_SUMMARY.md`

---

*Generated: January 15, 2026*
