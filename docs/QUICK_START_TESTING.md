# 🚀 Quick Start: Testing Walker & Seller Onboarding

**Ready to test?** Follow this quick guide to get started immediately.

---

## ⚡ 5-Minute Quick Test

### Step 1: Start the Application
```bash
# Terminal 1: Start backend (if not already running)
cd backend/lambda
npm run dev  # or your backend start command

# Terminal 2: Start frontend
cd apps/vendor-web
npm run dev
```

### Step 2: Test Walker Onboarding
1. Open browser: `http://localhost:3000` (or your frontend URL)
2. Navigate to vendor registration
3. Enter phone: `+91-9876543210`
4. Select role: **Walker**
5. **Quick Check:** Verify these fields appear:
   - ✅ Enable GPS Tracking (checkbox, checked by default)
   - ✅ Maximum Service Radius (number input)
   - ✅ Maximum Dogs Per Walk (number input)
   - ✅ Available Walk Durations (multiselect with chips)
   - ✅ Years of Experience (dropdown)
   - ✅ Dog Sizes You Can Handle (multiselect)
   - ✅ Emergency Contact Name & Phone
   - ✅ Background Check Certificate (file upload)
   - ✅ Insurance Certificate (file upload)

6. Fill minimum required fields and submit
7. **Expected:** Form submits successfully ✅

### Step 3: Test Seller Onboarding
1. Use different phone: `+91-9876543211`
2. Select role: **Seller** or **E-commerce**
3. **Quick Check:** Verify these fields appear:
   - ✅ Business Type (dropdown)
   - ✅ Product Categories (multiselect with 14 options)
   - ✅ Shipping Methods (multiselect, default: Standard)
   - ✅ Local Delivery Radius (number input)
   - ✅ Inventory Management (dropdown, default: Manual)
   - ✅ Return Policy (textarea, min 50 chars)
   - ✅ Payment Methods (multiselect, default: UPI, Card)
   - ✅ Product Catalog (file upload)

4. Fill minimum required fields and submit
5. **Expected:** Form submits successfully ✅

---

## ✅ Pre-Flight Checklist

Before testing, verify:

- [ ] **Backend is running**
  - Check: `curl http://localhost:8000/health` (or your backend URL)
  - Should return success response

- [ ] **Frontend is running**
  - Check: Open `http://localhost:3000` in browser
  - Should load without errors

- [ ] **API Endpoints accessible**
  - `/vendor/onboarding/form-schema?roleId=walker` should return fields
  - `/vendor/onboarding/form-schema?roleId=seller` should return fields

- [ ] **Google Maps API Key** (for location pinning)
  - Check: Environment variable `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set
  - Or backend returns API key in settings

- [ ] **File Upload Works**
  - Check: `/storage/upload` endpoint is accessible
  - Should accept FormData with files

---

## 🎯 What to Test First

### Priority 1: Critical Path
1. **Role Selection** - Can you select Walker/Seller?
2. **Field Visibility** - Do role-specific fields appear?
3. **Multiselect Works** - Can you select multiple options?
4. **Form Submission** - Does form submit successfully?

### Priority 2: Validation
1. **Required Fields** - Are errors shown for empty required fields?
2. **Number Validation** - Do min/max values work?
3. **Multiselect Validation** - Is at least one selection required?
4. **File Upload** - Do files upload correctly?

### Priority 3: Edge Cases
1. **Invalid Inputs** - Are errors shown for invalid values?
2. **Network Errors** - Does form handle errors gracefully?
3. **File Size** - Are large files rejected?

---

## 🐛 Common Issues & Quick Fixes

### Issue: Role-specific fields don't appear
**Check:**
- Backend endpoint: `/vendor/onboarding/form-schema?roleId=walker`
- Response should include fields with `section: 'additional_information'`
- Browser console for errors

**Fix:**
- Verify backend `getRoleSpecificFields()` method is called
- Check role ID matches: `walker`, `pet_walker`, `seller`, `ecommerce`

### Issue: Multiselect doesn't work
**Check:**
- Browser console for JavaScript errors
- Field type is `multiselect` in form schema
- Component renders correctly

**Fix:**
- Verify `DynamicVendorOnboardingForm.tsx` has multiselect case
- Check formData stores arrays correctly

### Issue: File upload fails
**Check:**
- `/storage/upload` endpoint is accessible
- File size is under limit
- File type is accepted (PDF, JPG, PNG, ZIP)

**Fix:**
- Verify backend file upload handler
- Check CORS settings
- Verify file size limits

### Issue: Form validation errors
**Check:**
- All required fields are filled
- Number fields are within min/max range
- Multiselect has at least one selection
- Files are uploaded

**Fix:**
- Check browser console for validation errors
- Verify field validation rules in backend

---

## 📊 Test Results Log

Quick log template:

```
Date: ___________
Tester: ___________

Walker Test:
- Role selection: ✅ / ❌
- Fields visible: ✅ / ❌
- Multiselect works: ✅ / ❌
- Form submits: ✅ / ❌
- Issues: ________________

Seller Test:
- Role selection: ✅ / ❌
- Fields visible: ✅ / ❌
- Multiselect works: ✅ / ❌
- Form submits: ✅ / ❌
- Issues: ________________
```

---

## 🔍 Quick Verification Commands

### Check Backend Response
```bash
# Test walker form schema
curl "http://localhost:8000/vendor/onboarding/form-schema?roleId=walker" | jq '.fields[] | select(.name | contains("gps") or contains("radius") or contains("dogs"))'

# Test seller form schema
curl "http://localhost:8000/vendor/onboarding/form-schema?roleId=seller" | jq '.fields[] | select(.name | contains("product") or contains("shipping") or contains("payment"))'
```

### Check Frontend Console
Open browser DevTools → Console, look for:
- ✅ `[DYNAMIC FORM] Form schema loaded successfully`
- ✅ `[DYNAMIC FORM] Transformed sections:`
- ❌ Any red error messages

---

## 📝 Next Steps After Quick Test

1. **If everything works:**
   - Run full test suite from `TESTING_GUIDE_WALKER_SELLER.md`
   - Test edge cases
   - Verify database storage

2. **If issues found:**
   - Check browser console for errors
   - Check backend logs
   - Verify API endpoints
   - Review implementation files

3. **Document findings:**
   - Log test results
   - Create bug reports for issues
   - Note any improvements needed

---

## 🎉 Success Indicators

You'll know it's working when:

✅ **Walker:**
- 10 role-specific fields appear
- Multiselect shows chips when selecting
- Form validates all fields
- Submission succeeds

✅ **Seller:**
- 9 role-specific fields appear
- Product categories multiselect works
- Return policy validates 50+ chars
- Form submission succeeds

✅ **General:**
- No console errors
- Smooth UI interactions
- Clear error messages
- Success feedback after submission

---

**Ready?** Start with the 5-Minute Quick Test above! 🚀
