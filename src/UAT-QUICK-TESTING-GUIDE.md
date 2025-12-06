# 🚀 PHASE 1 - QUICK UAT TESTING GUIDE
## Manual Testing Execution Guide

**For:** QA Testers / Product Owners  
**Time Required:** 30-45 minutes  
**Prerequisites:** Access to vendor app, test phone numbers

---

## 🎯 QUICK TEST EXECUTION

### **Test 1: Vet Rejection Flow (5 mins)**

#### Setup:
1. Use phone: `+919876543210`
2. Ensure vendor status is `'rejected'` in database
3. Add rejection reason: "License expiry date missing"

#### Steps:
1. Open vendor app → Enter phone number
2. ✅ **VERIFY:** See rejection screen with reason
3. Click "Correct & Resubmit"
4. ✅ **VERIFY:** Form loads with ALL data pre-filled
5. ✅ **VERIFY:** License fields show (licenseNumber, licenseExpiryDate)
6. ✅ **VERIFY:** Documents show previews
7. Add license expiry date: "2026-12-31"
8. Click "Verify & Continue"
9. ✅ **VERIFY:** Status changes to 'pending'
10. ✅ **VERIFY:** Toast shows "Application resubmitted successfully!"

#### Console Check:
```
📝 Starting re-onboarding in correction mode...
📋 Loading application data for re-onboarding: vendor_xxx
✅ Loaded vendor data for Veterinarian
📋 Pre-filling form with existing application data
📤 Resubmitting application to: .../resubmit-application
✅ Application resubmitted successfully
```

**Result:** 🟢 PASS / 🔴 FAIL

---

### **Test 2: Walker Clarification Flow (5 mins)**

#### Setup:
1. Use phone: `+919123456789`
2. Ensure vendor status is `'clarification'`
3. Add clarification note: "Upload police verification"

#### Steps:
1. Open vendor app → Enter phone number
2. ✅ **VERIFY:** See clarification screen with admin note
3. Click "Correct & Resubmit"
4. ✅ **VERIFY:** Form loads with data
5. ✅ **VERIFY:** NO license fields (walker doesn't need license)
6. ✅ **VERIFY:** Custom fields show (experienceWithBreeds, walkingArea)
7. Upload police verification document
8. Click "Verify & Continue"
9. ✅ **VERIFY:** Status changes to 'pending'

#### Console Check:
```
📝 Starting re-onboarding in clarification mode...
📋 Loaded vendor data for Pet Walker
  ✅ NO license fields in console (correct!)
📤 Resubmitting application
```

**Result:** 🟢 PASS / 🔴 FAIL

---

### **Test 3: Multiple Resubmissions (5 mins)**

#### Setup:
1. Use vendor with `resubmissionCount: 1`
2. Status: `'rejected'`

#### Steps:
1. Open vendor app
2. Click "Correct & Resubmit"
3. Make changes
4. Resubmit
5. ✅ **VERIFY:** `resubmissionCount` becomes 2
6. ✅ **VERIFY:** `previousReviews` array has 2 entries
7. Check admin panel
8. ✅ **VERIFY:** Shows "Resubmission #2" badge

#### Console Check:
```
🔄 RESUBMISSION for vendor_xxx
   Resubmission #2
```

**Result:** 🟢 PASS / 🔴 FAIL

---

### **Test 4: Grooming Center (5 mins)**

#### Setup:
1. Use vendor with `vendorType: 'center'`
2. Role: Pet Groomer
3. Status: `'rejected'`

#### Steps:
1. Open vendor app
2. Click "Correct & Resubmit"
3. ✅ **VERIFY:** `businessName` field shows
4. ✅ **VERIFY:** `gstNumber` field shows
5. ✅ **VERIFY:** GST certificate upload field shows
6. Upload GST certificate
7. Resubmit
8. ✅ **VERIFY:** Resubmission succeeds

**Result:** 🟢 PASS / 🔴 FAIL

---

### **Test 5: Vet Clinic (License + Center) (5 mins)**

#### Setup:
1. Use vendor with `vendorType: 'center'`
2. Role: Veterinarian
3. Status: `'clarification'`

#### Steps:
1. Open vendor app
2. Click "Correct & Resubmit"
3. ✅ **VERIFY:** `businessName` shows (center type)
4. ✅ **VERIFY:** `licenseNumber` shows (vet role) ⭐ CRITICAL
5. ✅ **VERIFY:** `licenseExpiryDate` shows (vet role) ⭐ CRITICAL
6. ✅ **VERIFY:** `gstNumber` shows (center type)
7. Update license expiry
8. Resubmit
9. ✅ **VERIFY:** Success

**Result:** 🟢 PASS / 🔴 FAIL

---

## 🔍 EDGE CASE TESTS (Optional - 10 mins)

### Edge 1: Missing Documents
- Create vendor with no documents
- ✅ Form loads without error
- ✅ Upload sections empty
- ✅ Can upload from scratch

### Edge 2: No Location Pin
- Create vendor without location
- ✅ Map loads at default position
- ✅ Can set location via "Locate Me"
- ✅ Resubmission works without location

### Edge 3: Very Long Rejection Reason
- Set 500+ character rejection reason
- ✅ Full text displays
- ✅ No layout breakage

---

## 📊 QUICK CHECKLIST

### Critical Features (Must Work):
- [ ] Rejection screen shows correctly
- [ ] Clarification screen shows correctly
- [ ] "Correct & Resubmit" button works
- [ ] Form pre-fills ALL fields
- [ ] Documents show previews
- [ ] License fields show for vets
- [ ] License fields DON'T show for walkers
- [ ] Can edit any field
- [ ] Can upload new documents
- [ ] Resubmit changes status to 'pending'
- [ ] Admin sees resubmission in panel

### Data Integrity:
- [ ] All fields preserved during resubmission
- [ ] Documents not replaced unless re-uploaded
- [ ] Custom fields preserved
- [ ] Resubmission count increments
- [ ] Previous reviews stored in history

### Error Handling:
- [ ] No console errors during load
- [ ] No console errors during submit
- [ ] Toast notifications show on success/failure
- [ ] Loading states work

---

## 🐛 DEFECT REPORTING

**If you find a bug, report using this format:**

```
BUG: [Short description]
Severity: Critical/High/Medium/Low
Steps to Reproduce:
1. [Step 1]
2. [Step 2]
Expected: [What should happen]
Actual: [What actually happened]
Screenshot: [If applicable]
Console Errors: [Paste errors]
```

**Example:**
```
BUG: License fields not showing for vet
Severity: Critical
Steps:
1. Open vet vendor app
2. Click "Correct & Resubmit"
3. Form loads
Expected: licenseNumber and licenseExpiryDate fields visible
Actual: Fields missing
Console: No errors
```

---

## ✅ SIGN-OFF

**Test Completed By:** _________________  
**Date:** _________________  
**Overall Result:** 🟢 PASS / 🔴 FAIL  

**Test Results:**
- Test 1 (Vet Rejection): ___________
- Test 2 (Walker Clarification): ___________
- Test 3 (Multiple Resubmissions): ___________
- Test 4 (Grooming Center): ___________
- Test 5 (Vet Clinic): ___________

**Critical Bugs Found:** ___________  
**Blocking Bugs Found:** ___________

**Production Ready?** ☐ YES  ☐ NO (Explain): _________________

---

## 🎯 SUCCESS CRITERIA

**✅ APPROVED FOR PRODUCTION when:**
- All 5 critical tests pass
- 0 critical bugs
- 0 blocking bugs
- All fields pre-fill correctly
- License logic works correctly (shows for vets, not for walkers)
- Resubmissions change status to pending

**❌ NOT APPROVED when:**
- Any critical test fails
- Any critical/blocking bug found
- License fields not working correctly
- Data loss during resubmission

---

**Quick Reference:**  
📄 Full Test Plan: `/UAT-TEST-PLAN-PHASE1.md`  
🤖 Automated Validation: `/UAT-AUTOMATED-VALIDATION.md`  
📋 Implementation Details: `/PHASE1-IMPLEMENTATION-COMPLETE.md`
