# 🧪 Region Manager - Testing Guide

## 🎯 Complete Testing Checklist

Use this guide to verify all Region Manager functionality works correctly.

---

## ⚙️ Prerequisites

- [x] Access to Admin Portal
- [x] Admin credentials
- [x] Region endpoints deployed
- [x] KV store accessible

---

## 📝 Test Suite

### **Test 1: Access Region Manager** ✅

**Steps**:
1. Open browser
2. Navigate to Warmpawz Admin Portal
3. Log in with admin credentials
4. Look at left sidebar
5. Click "🌍 Region Manager"

**Expected Result**:
- ✅ Region Manager opens
- ✅ Shows List View
- ✅ Header displays "Region Manager"
- ✅ Shows logo and back button
- ✅ "Create Region" button visible in top right

**Status**: Pass / Fail  
**Notes**: _________________________________

---

### **Test 2: View Empty State** ✅

**Condition**: No regions exist yet

**Steps**:
1. Open Region Manager
2. Observe the display

**Expected Result**:
- ✅ Empty state card displays
- ✅ Shows globe icon
- ✅ Message: "No regions found"
- ✅ Subtitle: "Get started by creating your first region"
- ✅ "Create Region" button visible

**Status**: Pass / Fail  
**Notes**: _________________________________

---

### **Test 3: Create India Region** ✅

**Steps**:
1. Click "Create Region" button
2. View opens with 4 template cards
3. Verify India template shows:
   - 🇮🇳 flag
   - "India" as name
   - "Indian Rupee, +91, Hindi/English" as description
4. Click on India template card
5. Wait for processing

**Expected Result**:
- ✅ Loading indicator appears
- ✅ Success toast notification: "INDIA region created successfully!"
- ✅ Redirects to List View
- ✅ India region card appears in grid
- ✅ Card shows:
  - 🇮🇳 flag icon
  - "India" name
  - "IN" code
  - Green checkmark (active)
  - "₹ (INR)" currency
  - "+91" phone
  - "en" language
  - "DD/MM/YYYY" date format
  - Service tags (veterinary, grooming, etc.)
  - Edit button
  - Deactivate button

**Status**: Pass / Fail  
**Notes**: _________________________________

---

### **Test 4: Create USA Region** ✅

**Steps**:
1. Click "Create Region" button
2. Verify USA template shows:
   - 🇺🇸 flag
   - "United States" name
   - "USD, +1, English" description
3. Click on USA template card
4. Wait for processing

**Expected Result**:
- ✅ Success toast: "USA region created successfully!"
- ✅ Redirects to List View
- ✅ USA region card appears
- ✅ Card shows:
  - 🇺🇸 flag
  - "United States" name
  - "US" code
  - Green checkmark (active)
  - "$ (USD)" currency
  - "+1" phone
  - "en" language
  - Service tags

**Status**: Pass / Fail  
**Notes**: _________________________________

---

### **Test 5: Search Functionality** ✅

**Steps**:
1. In List View, locate search box at top
2. Type "India" in search box
3. Observe results
4. Clear search
5. Type "US" in search box
6. Observe results
7. Type "XYZ" (non-existent)
8. Observe results

**Expected Result**:
- ✅ Typing "India" shows only India region
- ✅ Typing "US" shows only USA region
- ✅ Typing "XYZ" shows "No regions found" message
- ✅ Search is case-insensitive
- ✅ Search filters in real-time (no button needed)
- ✅ Clearing search shows all regions again

**Status**: Pass / Fail  
**Notes**: _________________________________

---

### **Test 6: Summary Stats** ✅

**Steps**:
1. With 2 regions created (India and USA)
2. Look at search bar area
3. Find summary stats on right side

**Expected Result**:
- ✅ Shows "2 total regions"
- ✅ Shows "2 active"
- ✅ Stats update when regions change

**Status**: Pass / Fail  
**Notes**: _________________________________

---

### **Test 7: Edit Region - Basic Tab** ✅

**Steps**:
1. Click "Edit" button on India region card
2. Edit view opens with tabs
3. Verify "Basic" tab is selected by default
4. Observe fields:
   - Region Name: "India"
   - Region Code: "IN"
   - Region Status toggle: ON (green)
5. Change Region Name to "India Test"
6. Click "Save Changes" button (top right)
7. Wait for processing

**Expected Result**:
- ✅ Edit view opens correctly
- ✅ All fields pre-filled with current values
- ✅ Can edit Region Name
- ✅ Can edit Region Code
- ✅ Toggle switch works
- ✅ Save button shows loading spinner
- ✅ Success toast: "Region updated successfully!"
- ✅ Redirects to List View
- ✅ India card shows "India Test" name
- ✅ Changes persist on refresh

**Status**: Pass / Fail  
**Notes**: _________________________________

---

### **Test 8: Edit Region - Currency Tab** ✅

**Steps**:
1. Click "Edit" on India region
2. Click "Currency" tab
3. Verify fields:
   - Currency Code: "INR"
   - Currency Symbol: "₹"
   - Decimal Places: "2"
   - Thousands Separator: ","
4. Change Currency Symbol to "Rs."
5. Change Decimal Places to "0"
6. Click "Save Changes"

**Expected Result**:
- ✅ Currency tab displays correctly
- ✅ All fields editable
- ✅ Number inputs work
- ✅ Changes save successfully
- ✅ Toast notification appears
- ✅ Returns to List View

**Status**: Pass / Fail  
**Notes**: _________________________________

---

### **Test 9: Edit Region - Phone Tab** ✅

**Steps**:
1. Click "Edit" on India region
2. Click "Phone" tab
3. Verify fields:
   - Country Code: "+91"
   - Phone Length: "10"
   - Phone Format: "XXXXX XXXXX"
   - Placeholder: "+91 98765 43210"
4. Change Phone Length to "11"
5. Click "Save Changes"

**Expected Result**:
- ✅ Phone tab displays correctly
- ✅ All fields editable
- ✅ Changes save successfully
- ✅ Returns to List View

**Status**: Pass / Fail  
**Notes**: _________________________________

---

### **Test 10: Edit Region - Localization Tab** ✅

**Steps**:
1. Click "Edit" on India region
2. Click "Localization" tab
3. Verify fields:
   - Primary Language: "en"
   - Date Format: "DD/MM/YYYY"
   - Timezone: "Asia/Kolkata"
   - RTL Support: OFF
4. Change Date Format to "YYYY-MM-DD"
5. Toggle RTL Support ON
6. Click "Save Changes"

**Expected Result**:
- ✅ Localization tab displays correctly
- ✅ All fields editable
- ✅ Toggle switch works
- ✅ Changes save successfully
- ✅ Returns to List View

**Status**: Pass / Fail  
**Notes**: _________________________________

---

### **Test 11: Edit Region - Services Tab** ✅

**Steps**:
1. Click "Edit" on India region
2. Click "Services" tab
3. Verify all 11 services are listed with toggles:
   - Veterinary
   - Grooming
   - Training
   - Walking
   - Behavioral
   - Boarding
   - Adoption
   - Sunset
   - Insurance
   - Pharmacy
   - Pet Cafe
4. Verify all are ON (green)
5. Toggle "Sunset" OFF
6. Toggle "Pet Cafe" OFF
7. Click "Save Changes"

**Expected Result**:
- ✅ Services tab displays correctly
- ✅ All 11 services visible
- ✅ All toggles work
- ✅ Can toggle multiple services
- ✅ Changes save successfully
- ✅ Services disabled for that region

**Status**: Pass / Fail  
**Notes**: _________________________________

---

### **Test 12: Edit Region - Breeds Tab** ✅

**Steps**:
1. Click "Edit" on India region
2. Click "Breeds" tab
3. Verify fields:
   - Popular Dog Breeds (comma-separated)
   - Popular Cat Breeds (comma-separated)
4. Current dog breeds: "Labrador, German Shepherd, Golden Retriever, Indian Pariah Dog, Beagle, Pug, Shih Tzu, Rottweiler"
5. Add ", Pomeranian" to dog breeds
6. Modify cat breeds
7. Click "Save Changes"

**Expected Result**:
- ✅ Breeds tab displays correctly
- ✅ Fields show comma-separated values
- ✅ Can edit breed lists
- ✅ Changes save successfully
- ✅ Breeds update correctly

**Status**: Pass / Fail  
**Notes**: _________________________________

---

### **Test 13: Toggle Region Status - Deactivate** ✅

**Steps**:
1. In List View, find India region card
2. Observe status: Green checkmark (active)
3. Observe button: "Deactivate"
4. Click "Deactivate" button
5. Wait for processing

**Expected Result**:
- ✅ Loading/processing indicator
- ✅ Success toast: "Region deactivated successfully"
- ✅ Status indicator changes to gray X
- ✅ Button text changes to "Activate"
- ✅ Card remains in list
- ✅ Change persists on refresh

**Status**: Pass / Fail  
**Notes**: _________________________________

---

### **Test 14: Toggle Region Status - Activate** ✅

**Steps**:
1. With India region deactivated (gray X)
2. Observe button: "Activate"
3. Click "Activate" button
4. Wait for processing

**Expected Result**:
- ✅ Loading/processing indicator
- ✅ Success toast: "Region activated successfully"
- ✅ Status indicator changes to green checkmark
- ✅ Button text changes to "Deactivate"
- ✅ Change persists on refresh

**Status**: Pass / Fail  
**Notes**: _________________________________

---

### **Test 15: Create UAE Region** ✅

**Steps**:
1. Click "Create Region"
2. Select "United Arab Emirates" template
3. Wait for creation

**Expected Result**:
- ✅ UAE region created
- ✅ Shows 🇦🇪 flag
- ✅ "United Arab Emirates" name
- ✅ "AE" code
- ✅ "AED" currency
- ✅ "+971" phone
- ✅ Active by default

**Status**: Pass / Fail  
**Notes**: _________________________________

---

### **Test 16: Create Singapore Region** ✅

**Steps**:
1. Click "Create Region"
2. Select "Singapore" template
3. Wait for creation

**Expected Result**:
- ✅ Singapore region created
- ✅ Shows 🇸🇬 flag
- ✅ "Singapore" name
- ✅ "SG" code
- ✅ "S$ (SGD)" currency
- ✅ "+65" phone
- ✅ Active by default

**Status**: Pass / Fail  
**Notes**: _________________________________

---

### **Test 17: Template "Already Created" State** ✅

**Steps**:
1. Create India region (if not already created)
2. Click "Create Region"
3. Observe India template card

**Expected Result**:
- ✅ India card shows "✓ Already created" text
- ✅ Card is grayed out/disabled
- ✅ Card is not clickable
- ✅ Other templates remain clickable

**Status**: Pass / Fail  
**Notes**: _________________________________

---

### **Test 18: Responsive Design** ✅

**Steps**:
1. Open Region Manager
2. Resize browser window to:
   - Desktop (> 1024px)
   - Tablet (768px - 1024px)
   - Mobile (< 768px)
3. Test all views at each size

**Expected Result - Desktop**:
- ✅ 3 columns for region cards
- ✅ All elements visible
- ✅ Proper spacing

**Expected Result - Tablet**:
- ✅ 2 columns for region cards
- ✅ Responsive layout
- ✅ No horizontal scroll

**Expected Result - Mobile**:
- ✅ 1 column for region cards
- ✅ Stack vertically
- ✅ Touch-friendly buttons
- ✅ Readable text

**Status**: Pass / Fail  
**Notes**: _________________________________

---

### **Test 19: Navigation - Back Buttons** ✅

**Steps**:
1. Click "Create Region"
2. Click "Back to List" button
3. Verify returns to List View
4. Click "Edit" on any region
5. Click "Back to List" button
6. Verify returns to List View
7. From Region Manager, click "Back" in header
8. Verify returns to Admin Portal

**Expected Result**:
- ✅ All back buttons work
- ✅ Navigation is smooth
- ✅ No data loss
- ✅ Proper breadcrumb trail

**Status**: Pass / Fail  
**Notes**: _________________________________

---

### **Test 20: Error Handling** ✅

**Steps**:
1. Disconnect internet
2. Try to load regions
3. Try to create a region
4. Try to save changes
5. Reconnect internet
6. Try operations again

**Expected Result**:
- ✅ Error toasts appear for failed operations
- ✅ Error messages are user-friendly
- ✅ Console shows detailed errors
- ✅ No crashes or white screens
- ✅ Operations work after reconnection

**Status**: Pass / Fail  
**Notes**: _________________________________

---

### **Test 21: Loading States** ✅

**Steps**:
1. Load Region Manager
2. Create a region
3. Edit a region
4. Toggle status
5. Search for regions

**Expected Result**:
- ✅ Loading spinner on initial load
- ✅ Button shows loading during create
- ✅ Save button shows loading during update
- ✅ Status button shows loading during toggle
- ✅ Search is instant (no loading)

**Status**: Pass / Fail  
**Notes**: _________________________________

---

### **Test 22: Multiple Regions Display** ✅

**Steps**:
1. Create all 4 regions (India, USA, UAE, Singapore)
2. View List View
3. Observe layout

**Expected Result**:
- ✅ All 4 regions visible
- ✅ Grid layout (3 columns on desktop)
- ✅ Each card displays correctly
- ✅ No overlapping
- ✅ Proper spacing
- ✅ Summary shows "4 total regions"

**Status**: Pass / Fail  
**Notes**: _________________________________

---

### **Test 23: Edit Without Saving** ✅

**Steps**:
1. Click "Edit" on any region
2. Make changes to any field
3. Click "Back to List" WITHOUT saving
4. Return to List View
5. Click "Edit" on same region again

**Expected Result**:
- ✅ Changes were NOT saved
- ✅ Original values still present
- ✅ No error messages
- ✅ Data integrity maintained

**Status**: Pass / Fail  
**Notes**: _________________________________

---

### **Test 24: Service Tags Display** ✅

**Steps**:
1. In List View, observe region cards
2. Look at service tags section

**Expected Result**:
- ✅ Shows first 4 enabled services as tags
- ✅ If more than 4 services, shows "+X more" tag
- ✅ Tags are readable
- ✅ Tags have proper styling (gray background)

**Status**: Pass / Fail  
**Notes**: _________________________________

---

### **Test 25: Regional Flag Emojis** ✅

**Steps**:
1. View all region cards
2. Verify flags display correctly:
   - India: 🇮🇳
   - USA: 🇺🇸
   - UAE: 🇦🇪
   - Singapore: 🇸🇬

**Expected Result**:
- ✅ All flags render correctly
- ✅ Flags are visible and clear
- ✅ Appropriate size
- ✅ Orange gradient background

**Status**: Pass / Fail  
**Notes**: _________________________________

---

## 📊 Test Summary

### **Total Tests**: 25

**Results**:
- ✅ Passed: ___ / 25
- ❌ Failed: ___ / 25
- ⏭️ Skipped: ___ / 25

### **Critical Issues Found**:
1. _________________________________
2. _________________________________
3. _________________________________

### **Minor Issues Found**:
1. _________________________________
2. _________________________________
3. _________________________________

### **Suggestions for Improvement**:
1. _________________________________
2. _________________________________
3. _________________________________

---

## 🎯 Acceptance Criteria

For Region Manager to be considered production-ready:

- [ ] All 25 tests pass
- [ ] No critical bugs
- [ ] UI is responsive
- [ ] All CRUD operations work
- [ ] Error handling is robust
- [ ] Loading states work
- [ ] Navigation is smooth
- [ ] Data persists correctly
- [ ] Toasts appear appropriately
- [ ] Professional appearance

**Overall Status**: Pass / Fail

---

## 📝 Testing Notes

**Tester Name**: _________________________________  
**Date**: _________________________________  
**Browser**: _________________________________  
**Screen Size**: _________________________________  
**Operating System**: _________________________________

**Additional Comments**:
_________________________________
_________________________________
_________________________________

---

## 🔄 Regression Testing

After any code changes, re-run these tests:

**Priority 1 (Always test)**:
- Test 1: Access Region Manager
- Test 3: Create India Region
- Test 7: Edit Region - Basic Tab
- Test 13: Toggle Status - Deactivate
- Test 19: Navigation - Back Buttons

**Priority 2 (Test if related)**:
- All edit tab tests (8-12)
- Search functionality (5)
- Template creation (3, 4, 15, 16)

**Priority 3 (Weekly)**:
- All remaining tests
- Edge cases
- Error scenarios

---

## 🆘 If Tests Fail

### **Debug Steps**:
1. Check browser console for errors
2. Verify network requests in DevTools
3. Check Supabase function logs
4. Verify KV store data
5. Test API endpoints directly
6. Review recent code changes

### **Common Issues**:

**Issue**: Regions not loading
- Check network connection
- Verify API endpoint URL
- Check Authorization header
- Review server logs

**Issue**: Can't create region
- Verify template exists in backend
- Check for duplicate region ID
- Review KV store permissions
- Check error toast message

**Issue**: Save not working
- Verify PUT endpoint
- Check request body format
- Review validation errors
- Check network tab

**Issue**: UI looks broken
- Clear browser cache
- Hard refresh (Ctrl+Shift+R)
- Check CSS imports
- Verify Tailwind classes

---

## ✅ Sign-Off

**Tested By**: _________________________________  
**Date**: _________________________________  
**Version**: _________________________________  
**Result**: Pass / Fail  

**Approved for Production**: Yes / No  

**Signature**: _________________________________

---

**Testing Complete!** 🎉

Use this checklist every time you:
- Deploy Region Manager
- Make code changes
- Update dependencies
- Release new version
- Onboard new team members

---

**Document Version**: 1.0  
**Last Updated**: November 27, 2024  
**Status**: Ready for UAT ✅
