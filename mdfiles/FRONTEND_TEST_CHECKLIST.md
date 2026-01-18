# Frontend Testing Checklist

## 🧪 Step-by-Step Frontend Testing Guide

### Prerequisites
- [ ] Customer web app is deployed and accessible
- [ ] Browser DevTools open (F12)
- [ ] Network tab ready to monitor API calls

---

## Test 1: Service Discovery (Working Now)

### Steps:
1. Open customer app in browser
2. Navigate to **Vet** service section
3. Observe vendor list

### Expected Results:
- [ ] Real vendor names appear (e.g., "Vet Warmpaz")
- [ ] No placeholder text like "Test Vendor" or "Sample Clinic"
- [ ] Real addresses shown
- [ ] Phone numbers visible
- [ ] Ratings displayed (even if 0)

### Browser Console Check:
- [ ] Open DevTools → Network tab
- [ ] Filter by "discover-services"
- [ ] Verify API call: `GET /customer/discover-services?category=vet`
- [ ] Check response status: **200 OK**
- [ ] Verify response contains real vendor data

### Screenshot/Notes:
```
Vendors Found:
- Vet Warmpaz (Bengaluru)
- Test Veterinary Clinic (Mumbai)
```

---

## Test 2: Vendor Details Page

### Steps:
1. Click on a vendor (e.g., "Vet Warmpaz")
2. View vendor profile/details page

### Expected Results:
- [ ] Vendor name matches
- [ ] Real address displayed
- [ ] Phone number shown: 9606901515
- [ ] Email shown: abhayankarbellur@gmail.com
- [ ] Services list (may be empty if no services configured)
- [ ] No placeholder data

### Browser Console Check:
- [ ] API call to `/customer/vendor/:vendorId` or similar
- [ ] Response contains vendor details
- [ ] No 404 or 500 errors

---

## Test 3: Problem Grid Navigation (After Table Creation)

### Steps:
1. Navigate to problem grid
2. Select a problem (e.g., "Health Checkup")
3. View vendors/specialists list

### Expected Results:
- [ ] Vendors appear for selected problem
- [ ] Specialists/doctors shown for vet clinics
- [ ] Schedule availability displayed
- [ ] "Next Available" slot shown
- [ ] Real vendor data (not placeholders)

### Browser Console Check:
- [ ] API call: `GET /customer/vendors/by-problem?problemGridId=health-checkup&roleId=veterinarian`
- [ ] Response status: **200 OK**
- [ ] Response includes `vendors` array
- [ ] Response includes `specialists` array (if available)
- [ ] Response includes `data.vendors` and `data.specialists`

---

## Test 4: Specialists Display

### Steps:
1. Navigate to problem grid
2. Select a vet-related problem
3. Look for specialists/doctors section

### Expected Results:
- [ ] Doctor names appear (if vendors have staff)
- [ ] Specializations shown
- [ ] Services per specialist listed
- [ ] Clinic name associated with each specialist
- [ ] "Book with [Doctor Name]" buttons work

### Browser Console Check:
- [ ] Response includes `specialists` array
- [ ] Each specialist has:
  - `fullName`
  - `specializationDetails`
  - `services`
  - `clinicId`, `clinicName`, `clinicAddress`

---

## Test 5: Schedule Availability

### Steps:
1. View vendor list
2. Check for availability indicators

### Expected Results:
- [ ] "Available Today" badge (if vendor has slots today)
- [ ] "Next Available: [Date] [Time]" shown
- [ ] Service styles listed (at_center, at_home, tele)

### Browser Console Check:
- [ ] Response includes `isAvailableToday` field
- [ ] Response includes `nextAvailable` object
- [ ] Response includes `availableServiceStyles` array

---

## Test 6: Filters

### Steps:
1. Open filters panel
2. Test each filter option

### Price Range Filter:
- [ ] Set minimum price
- [ ] Set maximum price
- [ ] Verify results filtered correctly

### Sorting:
- [ ] Sort by "Highest Rated"
- [ ] Sort by "Nearest"
- [ ] Sort by "Price: Low to High"
- [ ] Verify sorting works

### Location Filter:
- [ ] Enter location
- [ ] Verify distance calculated
- [ ] Verify vendors sorted by distance

---

## Test 7: Error Handling

### Steps:
1. Test with invalid problem ID
2. Test with no matching vendors
3. Test with network issues

### Expected Results:
- [ ] Graceful error messages
- [ ] "No vendors found" message (not crash)
- [ ] Fallback to alternative endpoints
- [ ] No placeholder data shown

---

## Test 8: Performance

### Steps:
1. Monitor page load time
2. Check API response times
3. Verify smooth scrolling

### Expected Results:
- [ ] Page loads in < 3 seconds
- [ ] API calls complete in < 2 seconds
- [ ] Smooth user experience
- [ ] No lag or freezing

---

## 🐛 Common Issues & Solutions

### Issue: Placeholder Data Still Showing
**Check**:
- API calls are being made
- API responses contain real data
- Frontend is using API data (not defaults)
- Check `groomingServices.length > 0` condition

### Issue: No Vendors Display
**Check**:
- API endpoint is correct
- API returns vendors
- Vendor status is 'approved'
- Browser console for errors

### Issue: Specialists Not Showing
**Check**:
- Vendors have staff in database
- Staff is_active = true
- API response includes specialists array
- Frontend renders specialists correctly

### Issue: Schedule Not Showing
**Check**:
- `vendor_schedule_slots` table exists
- Schedule slots configured
- API response includes schedule data
- Frontend displays schedule correctly

---

## ✅ Final Verification

After all tests:
- [ ] All real vendor data displays
- [ ] No placeholder/mock data visible
- [ ] Specialists appear correctly
- [ ] Schedule shows properly
- [ ] Filters work
- [ ] No console errors
- [ ] Performance acceptable
- [ ] User experience smooth

---

## 📝 Test Results Template

```
Date: ___________
Tester: ___________

Test 1: Service Discovery
- Status: [ ] Pass [ ] Fail
- Notes: ________________

Test 2: Vendor Details
- Status: [ ] Pass [ ] Fail
- Notes: ________________

Test 3: Problem Grid
- Status: [ ] Pass [ ] Fail
- Notes: ________________

Test 4: Specialists
- Status: [ ] Pass [ ] Fail
- Notes: ________________

Test 5: Schedule
- Status: [ ] Pass [ ] Fail
- Notes: ________________

Test 6: Filters
- Status: [ ] Pass [ ] Fail
- Notes: ________________

Overall Status: [ ] Ready [ ] Needs Fixes
```

---

**Ready to test!** 🚀
