# Quick Start - Testing Guide
**Date:** 2025-01-28

---

## 🚀 QUICK START

### 1. Start the App

```bash
cd /Users/ketan/Documents/warmpawzecodev/Warmpawzecodev/apps/WarmpawzVendor
npm install  # If needed
npm run ios  # For iOS
# OR
npm run android  # For Android
```

---

## 🧪 TESTING WORKFLOW

### Step 1: Authentication & Onboarding
1. Test OTP login
2. Test role selection
3. Test onboarding flow
4. Verify navigation to dashboard

### Step 2: Core Booking Operations (Batch 1)
1. Navigate to Bookings
2. Open a booking detail
3. Test all action buttons:
   - Complete Booking
   - Assign Staff
   - Check-In
   - Start Service
   - Upload Files
   - GPS Tracking
   - Route Tracking

### Step 3: Real-Time Features (Batch 2)
1. Test Chat screen
2. Test Video Call screen
3. Test Notifications
4. Test Emergency Alert
5. Test Live Tracking
6. Test Location Sharing

### Step 4: Financial Operations (Batch 3)
1. Test Earnings screen
2. Test Payouts screen
3. Test Commission Breakdown
4. Test Reports
5. Test Data Export
6. Test Analytics screens

### Step 5: Settings & Account (Batch 4)
1. Test Settings hub
2. Test Profile management
3. Test Preferences
4. Test Security settings
5. Test Help & Support

---

## ✅ QUICK VALIDATION CHECKLIST

- [ ] App starts without errors
- [ ] Authentication works
- [ ] Dashboard loads
- [ ] Navigation works
- [ ] All 40 screens accessible
- [ ] No crashes
- [ ] APIs respond correctly
- [ ] Permissions work

---

## 🐛 COMMON ISSUES

### If app doesn't start:
- Check dependencies: `npm install`
- Check Metro bundler: `npm start`
- Check device/emulator connection

### If navigation fails:
- Check App.tsx navigation setup
- Verify screen imports
- Check navigation data passing

### If APIs fail:
- Check API_BASE_URL in config
- Verify authentication tokens
- Check network connectivity

---

## 📝 TEST RESULTS

Document any issues found:
- Screen name
- Issue description
- Steps to reproduce
- Expected vs actual behavior
- Priority (P0/P1/P2)

---

**Ready to test!** 🚀

