# Vendor Onboarding Testing Plan - All 19 Roles

## Test Environment
- **Vendor App URL:** https://d1s6ykkj381k58.cloudfront.net/auth
- **API Base URL:** https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com
- **UAT Mode:** Enabled (OTP: 123456)

## Prerequisites
✅ Backend Lambda deployed with fixes
✅ Frontend deployed to S3 and CloudFront
✅ Onboarding forms seeded for all 19 roles
✅ APIs verified working via curl

## Test Flow for Each Role

### Step 1: Authentication
1. Navigate to vendor app
2. Enter test phone number (e.g., 9999888800 + role_index)
3. Click "Send Verification Code"
4. Enter OTP: `123456`
5. Click "Verify & Continue"

### Step 2: Role Selection
1. Verify all 19 roles are displayed
2. Select the target role
3. Verify role card highlights

### Step 3: Onboarding Form
**Expected:**
- Form loads automatically (no Solo/Business selection)
- Dynamic fields based on role configuration
- Minimum 11 standard fields:
  - Business Name
  - Contact Person Name
  - Phone Number
  - Email
  - Business Type (dropdown)
  - Address
  - City
  - State
  - PIN Code
  - GST Number (optional)
  - Bank Account Details

### Step 4: Form Submission
1. Fill all mandatory fields
2. Upload documents if required
3. Click "Submit Application"
4. Verify success message

### Step 5: Admin Review (Manual via Admin UI)
1. Login to Admin UI
2. Navigate to Vendor Applications
3. Review application
4. Test all three actions:
   - **Approve**: Vendor should see "You're approved" screen
   - **Request Clarification**: Vendor can update and resubmit
   - **Reject**: Vendor goes back to role selection

### Step 6: Post-Approval (Vendor Dashboard)
1. Click "Get Started"
2. Verify dashboard loads with role-specific capabilities
3. Check available menu items match role configuration

## 19 Roles to Test

### 1. Pet Ambulance (edd2378b-4913-4086-8259-b79d9f414984)
**Phone:** 9999888801
**Capabilities:** booking, gps_tracking, emergency, staff_management, schedule_management
**Service Styles:** home_visit, emergency

### 2. Pet Boarding (e0ad746d-14be-4cf9-9cdc-f86f4fd41851)
**Phone:** 9999888802
**Capabilities:** booking, cctv_access, facility_management, staff_management, package_management
**Service Styles:** at_center, overnight

### 3. Pet Breeder (300a2324-fb4d-4554-9cf0-f569791ce39b)
**Phone:** 9999888803
**Capabilities:** catalog, booking, portfolio, pet_listing, adoption
**Service Styles:** at_center, home_visit

### 4. Pet Cafe (2571a3af-26d8-4581-8d4f-c2be64b6d0a3)
**Phone:** 9999888804
**Capabilities:** booking, menu, table_management, facility_management, package_management
**Service Styles:** at_center, dine_in

### 5. Pet Event Organizer (3e4c4789-ec07-4fd5-a69d-e21e6003986f)
**Phone:** 9999888805
**Capabilities:** booking_create, service_pricing, package_management, staff_management
**Service Styles:** at_center, outdoor, home_visit

### 6. Pet Groomer (002fbd36-38b0-4b6b-aeb2-c270923e8ff5)
**Phone:** 9999888806
**Capabilities:** booking, portfolio, service_pricing, staff_management, package_management
**Service Styles:** at_center, home_visit

### 7. Insurance (25053d68-1639-4897-8936-2f18e4060a2a)
**Phone:** 9999888807
**Capabilities:** chat, staff_management, claim_management, policy_management
**Service Styles:** online, consultation

### 8. Nutritionist (654b0a3f-226d-425e-ad16-f6783d82e308)
**Phone:** 9999888808
**Capabilities:** booking, chat, meal_plan, subscription_management, consultation
**Service Styles:** at_center, video_consultation, tele, meal_delivery

### 9. Pet Pharmacy (e7339244-28c6-46d5-a9ae-a4d80fefef8a)
**Phone:** 9999888809
**Capabilities:** catalog, inventory, prescription_fulfillment, order_management
**Service Styles:** at_center, delivery, pickup

### 10. Pet Photographer (3b95453b-fa0a-4edb-8978-13f804a6c340)
**Phone:** 9999888810
**Capabilities:** booking, portfolio, gallery_management, package_management
**Service Styles:** at_center, outdoor, home_visit

### 11. Pet Relocation (d8e1105a-6aeb-4116-8be4-1c6b5a7bc154)
**Phone:** 9999888811
**Capabilities:** booking_create, service_pricing, documentation, gps_tracking
**Service Styles:** pickup_delivery, international

### 12. Pet Resort (ee833ce2-f4fa-4957-bd83-e09a9df4af13)
**Phone:** 9999888812
**Capabilities:** booking, cctv_access, facility_management, package_management, room_management
**Service Styles:** at_center, overnight, vacation

### 13. Pet Shelter (22924ac2-34d1-4f0c-afb1-2c95fd1e6f0a)
**Phone:** 9999888813
**Capabilities:** adoption, donation, volunteer_management, pet_listing
**Service Styles:** at_center, adoption_center

### 14. Pet Products Store (5056756d-3b05-457a-9725-3f922800b520)
**Phone:** 9999888814
**Capabilities:** catalog, inventory, order_management, subscription_management
**Service Styles:** at_center, online, delivery

### 15. Pet Sunset Services (f64778b1-053d-4ab7-bfce-e765c4514cde)
**Phone:** 9999888815
**Capabilities:** booking, memorial, counseling, cremation_services
**Service Styles:** at_center, home_visit

### 16. Pet Trainer (d34be94a-7b96-4d33-b26a-f3e6f000f17f)
**Phone:** 9999888816
**Capabilities:** booking, progress_tracking, package_management, staff_management
**Service Styles:** at_center, home_visit, outdoor, video_consultation

### 17. Pet Walker (2fd34a4e-ddd5-4ebe-908a-7e629abcb810)
**Phone:** 9999888817
**Capabilities:** gps_tracking, photo_updates, booking, staff_management
**Service Styles:** outdoor, home_visit

### 18. Veterinarian (Solo) (072548c8-84a9-4165-a9ec-0387c8c76a0e)
**Phone:** 9999888818
**Capabilities:** prescription, medical_records, booking, chat, tele, emergency
**Service Styles:** at_clinic, video_consultation, home_visit, tele

### 19. Veterinary Clinic (c005549a-950a-48ea-b860-4552ad4fa104)
**Phone:** 9999888819
**Capabilities:** prescription, medical_records, booking, staff_management, diagnostic_services, pharmacy
**Service Styles:** at_clinic, video_consultation, home_visit, emergency

## Testing Checklist

For each role, verify:
- [ ] Role displays correctly in selection screen
- [ ] Dynamic form loads without errors
- [ ] All form fields are appropriate for the role
- [ ] Form submission succeeds
- [ ] Admin can review the application
- [ ] Approval flow works
- [ ] Dashboard capabilities match role configuration
- [ ] Service catalog shows relevant services
- [ ] Staff management (if applicable)
- [ ] Booking management
- [ ] Earnings and settlements

## Known Issues Fixed
✅ POST request body parsing
✅ UUID vs. role name mismatch in form lookup
✅ Vendor type validation removed
✅ Frontend auto-sets vendor_type to "business"
✅ Onboarding forms seeded for all roles

## Current Status
**CloudFront Status:** Invalidation in progress (can take 1-2 minutes)
**Last Invalidation ID:** IF668GMF0JKRJBNAA7EOD9F4X

Once CloudFront cache refreshes, the vendor app will load properly and you can begin testing all 19 roles systematically.

## API Verification (Already Tested via curl)
✅ `/auth/send-otp` - Working
✅ `/auth/verify-otp` - Working
✅ `/vendor/onboarding/status` - Working
✅ `/vendor/onboarding/select-role` - Working
✅ `/vendor/onboarding/select-vendor-type` - Working
✅ `/vendor/onboarding/form-schema` - Working (Returns 11 fields, 2 sections)
✅ `/config/roles` - Working (Returns all 19 roles)

## Next Steps
1. Wait 2-3 minutes for CloudFront invalidation to complete
2. Hard refresh the browser (Cmd+Shift+R or Ctrl+Shift+F5)
3. Start testing from Role #1 (Pet Ambulance)
4. Document any issues found
5. Progress through all 19 roles systematically
