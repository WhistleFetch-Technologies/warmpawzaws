# 🧪 UAT Testing Checklist
## Customer App - Service Landing Pages

---

## 📱 **Test Environment**
- **Device**: Mobile view (max-width: 430px)
- **Browser**: Chrome/Safari
- **User Role**: Customer with registered account
- **Test Data**: Ensure Platform Admin has seeded vendor data

---

## ✅ **Test Case 1: Pet Training Service**

### Navigation
- [ ] Click "Training" from "All Services" grid on home screen
- [ ] Landing page loads without errors
- [ ] Page displays "Pet Training" header with purple gradient
- [ ] Stats section shows correct numbers

### API Integration
- [ ] Check console for API call: `GET /customer/services?roleId=pet_trainer`
- [ ] Verify response contains training services
- [ ] Featured trainers section populates (or shows placeholder)
- [ ] No console errors

### UI/UX
- [ ] Spotlight offers carousel displays 3 cards
- [ ] Service types (Training Centre, At Home) are visible
- [ ] Back button returns to home screen
- [ ] All buttons are clickable
- [ ] Clicking service type/trainer shows "Coming Soon" (expected)

### Responsive Design
- [ ] Page fits within 430px width
- [ ] No horizontal scroll
- [ ] All text is readable
- [ ] Images/icons load correctly

---

## ✅ **Test Case 2: Pet Boarding Service**

### Navigation
- [ ] Click "Boarding" from "All Services" grid
- [ ] Landing page loads with indigo gradient header
- [ ] Stats display correctly

### API Integration
- [ ] Check console for: `GET /customer/services?roleId=pet_boarder`
- [ ] Featured facilities load
- [ ] No API errors

### UI/UX
- [ ] Spotlight offers show (First Time, Extended Stay, Premium)
- [ ] Boarding options (Overnight, Daycare) visible
- [ ] CCTV monitoring feature highlighted
- [ ] Back button works
- [ ] Clicking facility shows "Coming Soon" (expected)

### Responsive Design
- [ ] Mobile layout correct
- [ ] No layout breaks
- [ ] All content visible

---

## ✅ **Test Case 3: Pet Insurance Service**

### Navigation
- [ ] Click "Insurance" from "All Services" grid
- [ ] Landing page loads with cyan gradient header
- [ ] Trust score displayed in stats

### API Integration
- [ ] Check console for: `GET /customer/services?roleId=pet_insurance`
- [ ] Provider list loads
- [ ] No errors

### UI/UX
- [ ] Three plans displayed (Basic, Premium, Elite)
- [ ] Plan features listed with checkmarks
- [ ] "Most Popular" badge on Premium plan
- [ ] Trusted providers section visible
- [ ] Back navigation works
- [ ] Clicking plan shows "Coming Soon" (expected)

### Responsive Design
- [ ] Plan cards stack properly
- [ ] All pricing visible
- [ ] No text overflow

---

## ✅ **Test Case 4: Pet Cafes Service**

### Navigation
- [ ] Click "Pet Cafes" from "All Services" grid
- [ ] Landing page loads with amber gradient header
- [ ] Cafe stats display

### API Integration
- [ ] Check console for: `GET /customer/services?roleId=pet_cafe`
- [ ] Featured cafes populate
- [ ] No console errors

### UI/UX
- [ ] Experience cards show (Cafe Visit, Parties, Socialization, Events)
- [ ] Spotlight offers carousel works
- [ ] Popular cafes list displays
- [ ] Back button functional
- [ ] Clicking cafe shows "Coming Soon" (expected)

### Responsive Design
- [ ] Mobile-first layout correct
- [ ] Cards aligned properly
- [ ] Icons render correctly

---

## ✅ **Test Case 5: Pet Pharmacy Service**

### Navigation
- [ ] Click "Shop" from "All Services" grid
- [ ] Landing page loads with pink gradient header
- [ ] Pharmacy stats visible

### API Integration
- [ ] Check console for: `GET /customer/services?roleId=pet_pharmacy`
- [ ] Nearby pharmacies load
- [ ] API calls successful

### UI/UX
- [ ] Category cards display (Prescription, OTC, Supplements, Accessories)
- [ ] Delivery time shown for each pharmacy
- [ ] Special offers carousel works
- [ ] "Why Choose Us" section visible
- [ ] Back navigation works
- [ ] Clicking pharmacy shows "Coming Soon" (expected)

### Responsive Design
- [ ] Categories in 2x2 grid
- [ ] Pharmacy cards properly formatted
- [ ] No layout issues

---

## ✅ **Test Case 6: Previously Working Services (Regression Testing)**

### Vet Services
- [ ] Click "Vet Care" - still works ✅
- [ ] All sub-flows functional (Home, Clinic, Tele)
- [ ] No errors introduced

### Grooming Services
- [ ] Click "Grooming" - still works ✅
- [ ] Grooming center and at-home flows functional
- [ ] No regressions

### Walker Services
- [ ] Click "Walker" - still works ✅
- [ ] Walker selection and tracking functional
- [ ] No issues

---

## ✅ **Test Case 7: Coming Soon Services (Expected Behavior)**

### Non-Vendor Services
- [ ] Click "Adoption" → Shows "Coming Soon" ✅
- [ ] Click "Mating" → Shows "Coming Soon" ✅
- [ ] Click "Articles" → Shows "Coming Soon" ✅
- [ ] Back button returns to home from all

---

## 🔍 **Cross-Service Tests**

### Navigation Flow
- [ ] Home → Training → Back → Home ✅
- [ ] Home → Boarding → Back → Home ✅
- [ ] Home → Insurance → Back → Home ✅
- [ ] Home → Cafes → Back → Home ✅
- [ ] Home → Shop → Back → Home ✅

### Multi-Service Journey
- [ ] Navigate to Training, then use phone back button → Works correctly
- [ ] Navigate to multiple services in sequence → No state issues
- [ ] Refresh page on landing page → Redirects to login (expected)

### Error Handling
- [ ] Disconnect internet → Error message or placeholder data shows
- [ ] Slow network → Loading spinner displays
- [ ] No vendors in DB → Placeholder vendors show

---

## 🐛 **Bug Tracking**

### Critical Issues (Blocks UAT)
```
[ ] Issue #___: Description
    Steps to reproduce:
    Expected behavior:
    Actual behavior:
```

### Non-Critical Issues (Fix later)
```
[ ] Issue #___: Description
    Impact: Low/Medium
    Can proceed with UAT: Yes/No
```

---

## 📊 **UAT Sign-Off**

### Test Summary
- **Total Test Cases**: 7 major test cases
- **Tests Passed**: ___/7
- **Tests Failed**: ___/7
- **Blockers Found**: ___
- **Non-Blockers Found**: ___

### Tested By
- **Name**: ___________________
- **Date**: ___________________
- **Environment**: Production/Staging/Local

### Approval
- [ ] All critical test cases passed
- [ ] No blocking issues found
- [ ] Ready for production deployment
- [ ] Requires fixes before deployment

### Notes
```
Additional observations:




```

---

## 🚀 **Post-UAT Next Steps**

### If All Tests Pass ✅
1. Mark Option 1 as **COMPLETE**
2. Proceed to Option 2: Sub-flow development
3. Create detailed booking flows for each service
4. Implement vendor profile pages
5. Build reservation/order systems

### If Issues Found ⚠️
1. Document all bugs in tracking system
2. Prioritize critical vs non-critical
3. Fix blocking issues first
4. Re-test after fixes
5. Get final UAT approval

---

**Testing Instructions:**
1. Start with fresh login to customer app
2. Test each service in order listed above
3. Mark checkboxes as you complete each test
4. Document any issues immediately
5. Take screenshots of errors
6. Check console for API errors
7. Verify no regressions in existing features

**Expected Results:**
- All 5 new landing pages should load successfully
- API calls should work (or fail gracefully)
- Navigation should be smooth
- No errors in existing vet/grooming/walker flows
- "Coming Soon" is expected for sub-flows

**Status:** Ready for UAT Testing ✅
