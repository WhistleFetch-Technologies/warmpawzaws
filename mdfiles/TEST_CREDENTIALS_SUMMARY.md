# Test Credentials Summary

## 🎯 Latest Test Run Results

**Date:** 2026-01-13  
**Test Status:** ✅ **18/20 Steps Passing (90%)**

---

## 🔐 VENDOR LOGIN CREDENTIALS

### Latest Test Vendor

| Field | Value |
|-------|-------|
| **Phone Number** | `9876545521` |
| **OTP Code** | `123456` (UAT mode) |
| **Email** | `vendor-1768333445521@test.warmpawz.app` |
| **Vendor ID** | `4dd488a2-54a9-4246-80b4-8b3e28636998` |
| **Application ID** | `ceb4830a-feb3-47f4-8048-e4409fb48a08` |
| **Role** | `veterinarian` |
| **Vendor Type** | `business` |
| **Status** | `APPROVED` |

### How to Login

1. **Open Vendor Web App:**
   ```
   https://d1s6ykkj381k58.cloudfront.net/auth
   ```

2. **Enter Phone:** `9876545521`
3. **Enter OTP:** `123456`
4. **Expected:** Redirects to dashboard (vendor is approved)

---

## 🔐 ADMIN LOGIN

### Admin Panel URL
```
https://dfof7mguaa0a5.cloudfront.net/vendors
```

### To Approve New Vendor

1. Navigate to "New Applications" tab
2. Find application: `ceb4830a-feb3-47f4-8048-e4409fb48a08`
3. Click "Approve"
4. Vendor will be created with UUID: `4dd488a2-54a9-4246-80b4-8b3e28636998`

---

## 🔐 CUSTOMER SERVICE DISCOVERY

### API Base URL
```
https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com
```

### Test Endpoints

#### 1. Get Clinic Services
```bash
GET /customer/services?vendorId=4dd488a2-54a9-4246-80b4-8b3e28636998&serviceStyle=at_center
```
**Expected:** Returns 5+ services including "General Consultation"

#### 2. Get Home Services
```bash
GET /customer/services?vendorId=4dd488a2-54a9-4246-80b4-8b3e28636998&serviceStyle=at_home
```
**Expected:** Returns 6+ services including "Home Visit Consultation"

#### 3. Get Instant Services
```bash
GET /customer/services?vendorId=4dd488a2-54a9-4246-80b4-8b3e28636998&serviceStyle=tele
```
**Expected:** Returns 5+ services including "Instant Consultation"

#### 4. Get Vendor Info
```bash
GET /customer/vendor/4dd488a2-54a9-4246-80b4-8b3e28636998
```
**Expected:** Returns vendor details with services

---

## 📊 What Was Created in Test

### Services Created (3 total)

1. **Clinic Service:**
   - Name: "General Consultation"
   - Style: `at_center`
   - Price: ₹500
   - Duration: 30 minutes
   - Service ID: `b65c30f4-8c29-4e2b-9a33-481cee176b7c`

2. **Home Service:**
   - Name: "Home Visit Consultation"
   - Style: `at_home`
   - Price: ₹800
   - Duration: 45 minutes

3. **Instant Service:**
   - Name: "Instant Consultation"
   - Style: `tele`
   - Price: ₹600
   - Duration: 20 minutes

### Staff Created (1 total)

- Name: "Dr. Test Staff"
- Role: `veterinarian`
- Specialization: "General Practice"
- Qualifications: "BVSc"
- Experience: 5 years

---

## ✅ Verification Checklist

### Vendor Dashboard
- [ ] Login successful with phone + OTP
- [ ] Dashboard loads at `/`
- [ ] Services section visible
- [ ] 3 services listed:
  - [ ] General Consultation (clinic)
  - [ ] Home Visit Consultation (home)
  - [ ] Instant Consultation (tele)
- [ ] Staff section shows "Dr. Test Staff"
- [ ] Profile accessible

### Admin Panel
- [ ] Can access admin panel
- [ ] Pending applications visible
- [ ] Can approve vendor application
- [ ] Approved vendor appears in approved list
- [ ] Vendor has real UUID (not temp ID)

### Customer Discovery
- [ ] Clinic services visible (5+ services)
- [ ] Home services visible (6+ services)
- [ ] Instant services visible (5+ services)
- [ ] Services have correct pricing
- [ ] Services have correct duration

---

## 🔄 Get Fresh Credentials

To get new test credentials, run:

```bash
cd /Users/ketan/Documents/warmpawzecodev
./get-test-credentials.sh
```

Or manually:
```bash
npx tsx tests/vendor-complete-e2e.ts
```

Look for these output lines:
- `📱 Test Phone:`
- `🆔 Vendor ID:`
- `📄 Application ID:`

---

## 📱 Quick Test Commands

### Test Vendor Login (cURL)
```bash
# Send OTP
curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/auth/send-otp" \
  -H "Content-Type: application/json" \
  -H "X-UAT-Mode: true" \
  -d '{"phone":"9876545521","role":"vendor"}'

# Verify OTP
curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -H "X-UAT-Mode: true" \
  -d '{"phone":"9876545521","otp":"123456","role":"vendor"}'
```

### Test Customer Services (cURL)
```bash
# Get clinic services
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/services?vendorId=4dd488a2-54a9-4246-80b4-8b3e28636998&serviceStyle=at_center" \
  -H "X-UAT-Mode: true"

# Get home services
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/services?vendorId=4dd488a2-54a9-4246-80b4-8b3e28636998&serviceStyle=at_home" \
  -H "X-UAT-Mode: true"

# Get instant services
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/services?vendorId=4dd488a2-54a9-4246-80b4-8b3e28636998&serviceStyle=tele" \
  -H "X-UAT-Mode: true"
```

---

## 🎯 Test Results Summary

| Phase | Steps | Status |
|-------|-------|--------|
| Onboarding & Approval | 8/8 | ✅ 100% |
| Vendor Dashboard | 1/2 | ⚠️ 50% |
| Staff Management | 1/1 | ✅ 100% |
| Services Management | 5/5 | ✅ 100% |
| Customer Visibility | 3/4 | ✅ 75% |
| **TOTAL** | **18/20** | **✅ 90%** |

---

## 📝 Notes

- **OTP Code:** Always `123456` in UAT mode
- **Phone Numbers:** Generated with timestamp (last 5 digits)
- **Vendor IDs:** Real UUIDs after approval (not temp IDs)
- **Services:** Created with `is_enabled: true` and `publish_status: 'published'`
- **Test Data:** Each test run creates new vendor with unique phone/email

---

## 🚨 Known Issues

1. **Profile Update Endpoint:** Returns "Service Unavailable"
   - Workaround: Use other profile endpoints

2. **Customer Vendor Discovery:** May return error
   - Workaround: Use `/customer/services` endpoint directly

---

## 📞 Support

If verification fails:
1. Check vendor status in admin panel
2. Verify vendor ID is correct
3. Check API responses for errors
4. Ensure backend is deployed with latest fixes
5. Run test again to get fresh credentials
