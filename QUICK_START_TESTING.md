# 🚀 Quick Start - Vendor Onboarding Testing

## URLs
- **Vendor App:** https://d1s6ykkj381k58.cloudfront.net/auth
- **Admin UI:** [Your admin URL]
- **API Base:** https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com

## Test Credentials
- **OTP (UAT Mode):** `123456`
- **Test Phones:** `9999888801` to `9999888819`

## Quick Test (5 minutes)

### 1. Open Vendor App
```
https://d1s6ykkj381k58.cloudfront.net/auth
```

### 2. Login
- Phone: `9999888818`
- OTP: `123456`

### 3. Select Role
Choose: **Veterinarian**

### 4. Fill Form
- Business Name: "Dr. Smith Vet Clinic"
- Contact Person: "John Smith"
- Email: "john@vetclinic.com"
- Phone: (auto-filled)
- Address: "123 Main St"
- City: "Mumbai"
- State: "Maharashtra"
- PIN: "400001"

### 5. Submit
Click "Submit Application"

## Verify APIs (via Terminal)

```bash
# Test form-schema endpoint
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/vendor/onboarding/form-schema?phone=9999888877&roleId=072548c8-84a9-4165-a9ec-0387c8c76a0e"

# Expected: {"success":true, "data":{"sections":[...], "fields":[11 fields]}}
```

## All 19 Test Phones

| Role | Phone |
|------|-------|
| Pet Ambulance | 9999888801 |
| Pet Boarding | 9999888802 |
| Pet Breeder | 9999888803 |
| Pet Cafe | 9999888804 |
| Pet Event Organizer | 9999888805 |
| Pet Groomer | 9999888806 |
| Insurance | 9999888807 |
| Nutritionist | 9999888808 |
| Pet Pharmacy | 9999888809 |
| Pet Photographer | 9999888810 |
| Pet Relocation | 9999888811 |
| Pet Resort | 9999888812 |
| Pet Shelter | 9999888813 |
| Pet Products Store | 9999888814 |
| Pet Sunset Services | 9999888815 |
| Pet Trainer | 9999888816 |
| Pet Walker | 9999888817 |
| Veterinarian | 9999888818 ⭐ |
| Veterinary Clinic | 9999888819 |

## Status Check

✅ Backend APIs - WORKING  
✅ Lambda Deployed - ACTIVE  
✅ Frontend Deployed - LIVE  
✅ CloudFront Invalidation - COMPLETED  
⏳ Manual Browser Testing - PENDING

## If UI Doesn't Load

1. **Hard Refresh:** Cmd+Shift+R (Mac) or Ctrl+Shift+F5 (Windows)
2. **Clear Cache:** Browser DevTools → Application → Clear Storage
3. **Check Console:** F12 → Console tab → Look for errors
4. **Try Incognito:** Open in private/incognito mode

## Expected Flow

```
Auth Page → Enter Phone → Send OTP → Enter 123456 
→ Role Selection (19 roles) → Select Role 
→ Form Loads (11 fields, 2 sections) → Fill Form 
→ Submit → Success Message
```

## Need Help?

📄 Full Test Plan: `VENDOR_ONBOARDING_TEST_PLAN.md`  
📊 Results Log: `VENDOR_ONBOARDING_TEST_RESULTS.md`  
📋 Summary: `ONBOARDING_IMPLEMENTATION_SUMMARY.md`
