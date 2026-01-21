# Quick Login Reference Card

## 🔐 Vendor Login (Latest Test)

**URL:** https://d1s6ykkj381k58.cloudfront.net/auth

**Credentials:**
- **Phone:** `9876545521`
- **OTP:** `123456`
- **Vendor ID:** `4dd488a2-54a9-4246-80b4-8b3e28636998`

**What to Check After Login:**
1. ✅ Dashboard loads at `/`
2. ✅ Services section shows 3 services:
   - General Consultation (clinic)
   - Home Visit Consultation (home)
   - Instant Consultation (tele)
3. ✅ Staff section shows "Dr. Test Staff"

## 🔐 Admin Login

**URL:** https://dfof7mguaa0a5.cloudfront.net/vendors

**To Approve Vendor:**
1. Go to "New Applications" tab
2. Find application ID: `ceb4830a-feb3-47f4-8048-e4409fb48a08`
3. Click "Approve"
4. Vendor will get UUID: `4dd488a2-54a9-4246-80b4-8b3e28636998`

## 🔐 Customer Service Discovery

**API Base:** `https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com`

**Check Services:**

1. **Clinic Services:**
   ```
   GET /customer/services?vendorId=4dd488a2-54a9-4246-80b4-8b3e28636998&serviceStyle=at_center
   ```

2. **Home Services:**
   ```
   GET /customer/services?vendorId=4dd488a2-54a9-4246-80b4-8b3e28636998&serviceStyle=at_home
   ```

3. **Instant Services:**
   ```
   GET /customer/services?vendorId=4dd488a2-54a9-4246-80b4-8b3e28636998&serviceStyle=tele
   ```

4. **Vendor Info:**
   ```
   GET /customer/vendor/4dd488a2-54a9-4246-80b4-8b3e28636998
   ```

## 📱 Get Fresh Test Credentials

Run this command to get new test vendor:
```bash
cd /Users/ketan/Documents/warmpawzecodev
npx tsx tests/vendor-complete-e2e.ts
```

Look for these lines in output:
- `📱 Test Phone:`
- `🆔 Vendor ID:`
- `📄 Application ID:`

## ✅ Verification Checklist

**Vendor Side:**
- [ ] Login works with phone + OTP
- [ ] Dashboard accessible
- [ ] 3 services visible
- [ ] Staff member visible

**Admin Side:**
- [ ] Can see pending applications
- [ ] Can approve vendor
- [ ] Vendor gets real UUID

**Customer Side:**
- [ ] Clinic services visible (5+ services)
- [ ] Home services visible (6+ services)
- [ ] Instant services visible (5+ services)

## 🎯 Expected Results

- **Test Status:** ✅ 18/20 steps passing (90%)
- **Services Created:** 3
- **Services Visible:** All 3 types
- **Staff Created:** 1
- **Vendor Status:** APPROVED
