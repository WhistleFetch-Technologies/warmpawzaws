# Manual Verification Guide - Vendor & Customer Login

**Date:** 2026-01-13  
**Purpose:** Manual verification of E2E test results

## 🔐 Test Credentials

### Vendor Login Details

**Phone Number:** `98765XXXXX` (Last 5 digits change with each test run)  
**OTP Code:** `123456` (UAT mode - always works)  
**Role:** `veterinarian`  
**Vendor Type:** `business`

### Latest Test Vendor (From Most Recent Run)

**Phone:** `9876545521`  
**Email:** `vendor-1768333445521@test.warmpawz.app`  
**Vendor ID:** `4dd488a2-54a9-4246-80b4-8b3e28636998`  
**Application ID:** `ceb4830a-feb3-47f4-8048-e4409fb48a08`  
**Service ID:** `b65c30f4-8c29-4e2b-9a33-481cee176b7c`  
**Status:** `APPROVED` (after admin approval)

**Note:** Run the test again to get fresh credentials for a new vendor.

### Customer Login Details

**Note:** Customer login not tested in E2E test, but services are verified via customer discovery endpoints.

**For Customer Testing:**
- Use any valid customer phone number
- OTP: `123456` (UAT mode)
- Role: `customer`

## 🌐 Application URLs

### Vendor Web App
**URL:** `https://d1s6ykkj381k58.cloudfront.net`

**Login Flow:**
1. Navigate to `/auth`
2. Enter vendor phone number
3. Enter OTP: `123456`
4. Should redirect to dashboard (if approved) or onboarding (if pending)

### Admin Web App
**URL:** `https://dfof7mguaa0a5.cloudfront.net`

**Login Flow:**
1. Navigate to `/vendors` or admin login page
2. Use admin credentials
3. Check "Pending Applications" tab
4. Approve vendor applications

### Customer Web App
**URL:** `https://d2aoyjj8ine0wk.cloudfront.net` (if available)

**Service Discovery:**
- Services visible via API endpoints
- Can search by vendor ID or service style

## 📋 Manual Verification Steps

### Step 1: Vendor Login Verification

1. **Open Vendor Web App:**
   ```
   https://d1s6ykkj381k58.cloudfront.net/auth
   ```

2. **Enter Phone Number:**
   - Use phone from latest test output
   - Format: `98765XXXXX`

3. **Enter OTP:**
   - OTP: `123456`
   - Should verify successfully

4. **Expected Result:**
   - ✅ If vendor is APPROVED: Redirects to dashboard (`/`)
   - ✅ If vendor is UNDER_REVIEW: Redirects to onboarding status page
   - ✅ If vendor is INIT/ROLE_PENDING: Redirects to role selection

### Step 2: Vendor Dashboard Verification

**After Login, Check:**

1. **Dashboard Access:**
   - URL: `https://d1s6ykkj381k58.cloudfront.net/`
   - Should show vendor dashboard
   - Should display vendor capabilities

2. **Services Section:**
   - Navigate to `/services`
   - Should show created services:
     - General Consultation (clinic)
     - Home Visit Consultation (home)
     - Instant Consultation (tele)

3. **Staff Section:**
   - Navigate to staff management
   - Should show created staff member: "Dr. Test Staff"

4. **Profile:**
   - Navigate to profile settings
   - Should show vendor information

### Step 3: Admin Panel Verification

1. **Open Admin Web App:**
   ```
   https://dfof7mguaa0a5.cloudfront.net/vendors
   ```

2. **Check Pending Applications:**
   - Go to "New Applications" tab
   - Should see vendor applications with status "UNDER_REVIEW"

3. **Approve Vendor:**
   - Click "Approve" button
   - Should create vendor record
   - Vendor status should change to "APPROVED"

4. **Verify Approved Vendor:**
   - Go to "Approved" tab
   - Should see approved vendor
   - Vendor should have real UUID (not temp ID)

### Step 4: Service Creation Verification

**In Vendor Dashboard:**

1. **Create Clinic Service:**
   - Navigate to Services section
   - Click "Create Service" or "Add Custom Service"
   - Fill in:
     - Name: "General Consultation"
     - Style: "at_center" or "clinic"
     - Price: 500
     - Duration: 30
   - Should create successfully

2. **Create Home Service:**
   - Name: "Home Visit Consultation"
   - Style: "at_home"
   - Price: 800
   - Duration: 45

3. **Create Instant Service:**
   - Name: "Instant Consultation"
   - Style: "tele" or "video_consultation"
   - Price: 600
   - Duration: 20

4. **Verify Services List:**
   - All 3 services should appear
   - Services should be enabled/published

### Step 5: Customer Visibility Verification

**Using API or Customer App:**

1. **Check Clinic Services:**
   ```
   GET https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/services?vendorId={VENDOR_ID}&serviceStyle=at_center
   ```
   - Should return services with style "at_center"
   - Should include "General Consultation"

2. **Check Home Services:**
   ```
   GET https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/services?vendorId={VENDOR_ID}&serviceStyle=at_home
   ```
   - Should return services with style "at_home"
   - Should include "Home Visit Consultation"

3. **Check Instant Services:**
   ```
   GET https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/services?vendorId={VENDOR_ID}&serviceStyle=tele
   ```
   - Should return services with style "tele"
   - Should include "Instant Consultation"

4. **Check Vendor Discovery:**
   ```
   GET https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/vendor/{VENDOR_ID}
   ```
   - Should return vendor information
   - Should include services list

## 🔍 Quick Verification Checklist

### Vendor Side:
- [ ] Can login with phone + OTP (123456)
- [ ] Dashboard loads after approval
- [ ] Can see services section
- [ ] Can create custom services
- [ ] Services appear in services list
- [ ] Staff can be created
- [ ] Profile can be viewed

### Admin Side:
- [ ] Can see pending applications
- [ ] Can approve vendor applications
- [ ] Approved vendors appear in approved list
- [ ] Vendor gets real UUID after approval

### Customer Side:
- [ ] Can discover vendor by ID
- [ ] Can see clinic services (at_center)
- [ ] Can see home services (at_home)
- [ ] Can see instant services (tele)
- [ ] Services have correct pricing and duration

## 📱 Latest Test Run Details

To get the latest test vendor details, run:

```bash
cd /Users/ketan/Documents/warmpawzecodev
npx tsx tests/vendor-complete-e2e.ts
```

The output will show:
- Test Phone Number
- Test Email
- Vendor ID (after approval)
- Application ID
- Service IDs

## 🧪 API Testing

### Get Vendor Details
```bash
curl -X GET "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/vendor/{VENDOR_ID}/profile" \
  -H "Authorization: Bearer {VENDOR_TOKEN}" \
  -H "X-UAT-Mode: true"
```

### Get Vendor Services
```bash
curl -X GET "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/vendor/{VENDOR_ID}/services" \
  -H "Authorization: Bearer {VENDOR_TOKEN}" \
  -H "X-UAT-Mode: true"
```

### Get Customer Services
```bash
curl -X GET "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/services?vendorId={VENDOR_ID}&serviceStyle=at_center" \
  -H "X-UAT-Mode: true"
```

## 🎯 Expected Test Results

Based on latest test run:
- ✅ **18/20 steps passing (90%)**
- ✅ **Services Created:** 3 (clinic, home, instant)
- ✅ **Services Visible:** All 3 types visible to customers
- ✅ **Staff Created:** 1 staff member
- ✅ **Vendor Approved:** Successfully

## ⚠️ Known Issues

1. **Profile Update Endpoint:**
   - Returns "Service Unavailable"
   - Workaround: Use other profile endpoints

2. **Customer Vendor Discovery:**
   - Endpoint may return error
   - Workaround: Use `/customer/services` endpoint

## 📞 Support

If verification fails:
1. Check latest test output for exact vendor ID
2. Verify vendor status in admin panel
3. Check API responses for error details
4. Ensure backend is deployed with latest fixes
