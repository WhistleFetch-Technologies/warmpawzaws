# Local Build URLs for UI Parity Check

**Date:** 2026-01-07  
**Status:** ⚠️ Dev servers running but may have errors

---

## 🚀 LOCAL DEV SERVER URLs

### Customer Web App
**URL:** http://localhost:3001

**Port:** 3001  
**Status:** ⚠️ Running (check for errors)

**What to Check:**
- ✅ Full CustomerHomeComplete UI with all sections
- ✅ Status bar, header, pet selector
- ✅ Enhanced search bar
- ✅ Trending problems section
- ✅ Problem grid navigation
- ✅ Hero banner carousel
- ✅ Quick services grid (17 services)
- ✅ Grooming services spotlight
- ✅ Vet services
- ✅ Hot deals carousel
- ✅ Featured services
- ✅ What's new section
- ✅ Adoption & breeding services
- ✅ Pet food vendors
- ✅ Pet care articles
- ✅ Training & boarding services
- ✅ Bottom navigation
- ✅ AI assistant button

---

### Vendor Web App
**URL:** http://localhost:3002

**Port:** 3002  
**Status:** ⚠️ Running (check for errors)

**What to Check:**
- ✅ All 53 vendor components with real UI
- ✅ Vendor dashboard
- ✅ Booking management
- ✅ Service management
- ✅ Availability management
- ✅ Profile management

---

### Admin Web App
**URL:** http://localhost:3003

**Port:** 3003  
**Status:** ✅ Running

---

## ⚠️ TROUBLESHOOTING

If you see 500 errors:

1. **Check browser console** for specific errors
2. **Check terminal logs** where dev servers are running
3. **Common issues:**
   - Missing imports
   - Syntax errors from automated replacement
   - Missing environment variables
   - API client configuration

### Fix Syntax Errors:
Some files may have broken API calls from automated replacement. Check:
- `apps/customer-web/components/customer/CustomerHomeComplete.tsx`
- `apps/customer-web/components/customer/MyBookings.tsx`
- `apps/vendor-web/components/vendor/VendorDetailsFormNew.tsx`

---

## 📊 UI REPLICATION STATUS

### Components Copied:
- ✅ **67 customer components** from reference
- ✅ **53 vendor components** from reference
- ✅ **Total: 120 components** with real UI code

### Key Changes:
- ✅ All imports adapted to `@/` paths
- ✅ AWS Serverless compatible (uses `apiClient`)
- ✅ 'use client' directives added
- ✅ Removed figma asset imports

---

## 🔍 PARITY CHECKLIST

### Customer Web - Main Home Screen:
- [ ] Status bar displays correctly
- [ ] Header with profile photo & greeting
- [ ] Pet selector carousel works
- [ ] Search bar is functional
- [ ] Trending problems section visible
- [ ] Problem grid navigation works
- [ ] Hero banner carousel rotates
- [ ] Quick services grid (17 services) visible
- [ ] Grooming services spotlight visible
- [ ] Vet services cards visible
- [ ] Hot deals carousel scrolls
- [ ] Featured services grid visible
- [ ] What's new section visible
- [ ] Adoption services visible
- [ ] Pet food vendors visible
- [ ] Pet articles visible
- [ ] Training & boarding cards visible
- [ ] Bottom navigation works
- [ ] AI assistant button visible

### Vendor Web:
- [ ] Dashboard loads correctly
- [ ] Booking management visible
- [ ] Service management works
- [ ] All vendor components render

---

## 🛠️ COMMANDS

### Start Dev Servers:
```bash
# Customer Web
cd apps/customer-web && npm run dev

# Vendor Web
cd apps/vendor-web && npm run dev

# Admin Web
cd apps/admin-web && npm run dev
```

### Stop Dev Servers:
```bash
# Find and kill processes
lsof -ti:3001 | xargs kill
lsof -ti:3002 | xargs kill
lsof -ti:3003 | xargs kill
```

### Check Server Status:
```bash
# Check if ports are in use
lsof -ti:3001,3002,3003

# Test URLs
curl http://localhost:3001
curl http://localhost:3002
curl http://localhost:3003
```

### View Logs:
```bash
# Customer Web logs
tail -f /tmp/customer-web-dev.log

# Vendor Web logs
tail -f /tmp/vendor-web-dev.log
```

---

## 📝 NOTES

- Dev servers are running on ports 3001, 3002, 3003
- If you see 500 errors, check browser console and terminal logs
- All new UI screens should be visible once errors are fixed
- Compare with reference folder: `/Users/ketan/Documents/Warmpawz Ecosystem Development`

---

**Status:** ⚠️ Servers running - check for errors in browser console
