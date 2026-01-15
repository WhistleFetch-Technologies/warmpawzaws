# 🚀 START TESTING NOW

**You're all set!** Follow these steps to begin testing immediately.

---

## ⚡ Step 1: Start Your Servers

### Terminal 1: Backend
```bash
cd backend/lambda
npm run dev
# or your backend start command
```

**Verify:** Backend should be running on `http://localhost:8000` (or your port)

### Terminal 2: Frontend
```bash
cd apps/vendor-web
npm run dev
```

**Verify:** Frontend should be running on `http://localhost:3000` (or your port)

---

## ⚡ Step 2: Open Browser

1. Navigate to: `http://localhost:3000` (or your frontend URL)
2. Go to vendor registration/onboarding page
3. Open browser DevTools (F12) → Console tab (to see logs)

---

## ⚡ Step 3: Test Walker Onboarding

### Quick Test (2 minutes)
1. **Enter phone:** `+91-9876543210`
2. **Select role:** **Walker** or **Pet Walker**
3. **Verify:** You should see 10 additional fields:
   - ✅ Enable GPS Tracking (checkbox, checked)
   - ✅ Maximum Service Radius (km)
   - ✅ Maximum Dogs Per Walk
   - ✅ Available Walk Durations (multiselect)
   - ✅ Years of Experience (dropdown)
   - ✅ Dog Sizes You Can Handle (multiselect)
   - ✅ Emergency Contact Name
   - ✅ Emergency Contact Phone
   - ✅ Background Check Certificate (file upload)
   - ✅ Insurance Certificate (file upload)

4. **Test multiselect:**
   - Click "Available Walk Durations"
   - Select multiple options (20, 30, 45)
   - Verify chips appear
   - Remove one chip (click X)

5. **Fill required fields and submit**

**Expected:** ✅ Form submits successfully

---

## ⚡ Step 4: Test Seller Onboarding

### Quick Test (2 minutes)
1. **Use different phone:** `+91-9876543211`
2. **Select role:** **Seller** or **E-commerce** or **Pet Products Store**
3. **Verify:** You should see 9 additional fields:
   - ✅ Business Type (dropdown)
   - ✅ Product Categories You Sell (multiselect, 14 options)
   - ✅ Shipping Methods Offered (multiselect)
   - ✅ Local Delivery Radius (km)
   - ✅ Inventory Management System (dropdown)
   - ✅ Return Policy (textarea, needs 50+ chars)
   - ✅ GST/VAT Registration Number (optional)
   - ✅ Payment Methods Accepted (multiselect)
   - ✅ Product Catalog (file upload)

4. **Test multiselect:**
   - Click "Product Categories"
   - Select multiple categories
   - Verify chips appear

5. **Test validation:**
   - Enter short return policy (< 50 chars) → Should show error
   - Enter long return policy (50+ chars) → Should accept

6. **Fill required fields and submit**

**Expected:** ✅ Form submits successfully

---

## ✅ Success Checklist

After testing, verify:

- [ ] Walker role selection works
- [ ] 10 walker fields appear
- [ ] Seller role selection works
- [ ] 9 seller fields appear
- [ ] Multiselect fields work (chips appear)
- [ ] Number validations work (min/max)
- [ ] File uploads work
- [ ] Form submission succeeds
- [ ] No console errors
- [ ] Success message appears

---

## 🐛 If Something Doesn't Work

### Issue: Fields don't appear
**Check:**
- Browser console for errors
- Backend is running
- API endpoint: `/vendor/onboarding/form-schema?roleId=walker`
- Network tab for API calls

### Issue: Multiselect doesn't work
**Check:**
- JavaScript errors in console
- Field type is `multiselect` in response
- Component renders correctly

### Issue: Form doesn't submit
**Check:**
- All required fields filled
- Validation errors shown
- Network tab for submission request
- Backend logs for errors

---

## 📝 Document Your Results

Use this template:

```
Test Date: ___________
Tester: ___________

Walker Test:
- Role selection: ✅ / ❌
- Fields visible: ✅ / ❌ (10 fields)
- Multiselect works: ✅ / ❌
- Validation works: ✅ / ❌
- Form submits: ✅ / ❌
- Issues: ________________

Seller Test:
- Role selection: ✅ / ❌
- Fields visible: ✅ / ❌ (9 fields)
- Multiselect works: ✅ / ❌
- Validation works: ✅ / ❌
- Form submits: ✅ / ❌
- Issues: ________________

Overall Status: ✅ Ready / ❌ Issues Found
```

---

## 📚 Full Testing Guide

For comprehensive testing, see:
- **Full Guide:** `docs/TESTING_GUIDE_WALKER_SELLER.md`
- **Quick Start:** `docs/QUICK_START_TESTING.md`
- **Verification:** `docs/VERIFICATION_RESULTS.md`

---

## 🎯 What to Test

### Priority 1 (Must Work)
1. ✅ Role selection
2. ✅ Fields appear
3. ✅ Form submission

### Priority 2 (Should Work)
1. ✅ Multiselect interactions
2. ✅ Field validations
3. ✅ File uploads

### Priority 3 (Nice to Have)
1. ✅ Error messages
2. ✅ Loading states
3. ✅ Success feedback

---

## 🚀 You're Ready!

**Everything is implemented and verified. Start testing now!**

1. Start your servers
2. Open browser
3. Test Walker onboarding
4. Test Seller onboarding
5. Document results

**Good luck! 🎉**
