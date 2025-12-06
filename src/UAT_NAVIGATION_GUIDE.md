# 🗺️ COMPLETE UAT NAVIGATION GUIDE

**Created**: November 20, 2025  
**Purpose**: Step-by-step guide to access and test all implemented features

---

## 📱 PART 1: CUSTOMER FEATURES (Tasks 1.1-1.4)

### ✅ Feature: Doctor Search with Advanced Filters & Next Available Slot

#### 🚪 **How to Access:**

```
1. Open App
2. Click "Customer" button (phone number required)
3. Click "Vet Services" card
4. Click "Book Vet Visit" (or "Visit Clinic" button)
5. ✨ VetClinicListViewEnhanced loads
```

#### 📍 **Exact Navigation Path:**

```
App.tsx (main)
  └─ CustomerApp (phone: 9876543210)
      └─ VetServiceRouter
          └─ VetServicesLanding
              └─ [Click "Book Vet Visit"]
                  └─ VetClinicListViewEnhanced ✅ THIS IS THE NEW UI
```

#### 🎯 **What You'll See:**

1. **Orange Header** with title "Find Veterinarians"
2. **Two Toggle Buttons**:
   - "Doctors" (selected by default - orange)
   - "Clinics" (gray)
3. **Search Bar** with placeholder: "Search doctor name, specialization..."
4. **Filter Button** (right side) with count badge if filters are active
5. **Doctor Cards** displaying:
   - Doctor photo
   - Name with "Dr." prefix
   - Specializations (orange badges)
   - Experience and rating
   - Consultation fee
   - **"Next Available" badge** (orange for today, light orange for future)
   - Clinic name
   - Location

#### ✅ **Test Cases:**

1. **Search by Name**:
   - Type "john" in search bar
   - Wait 500ms (debounce)
   - Results update to show doctors with "john" in name
   - Clear button (X) appears
   - Click X to clear search

2. **Filter by Fee**:
   - Click "Filters" button
   - Bottom sheet opens
   - Move "Fee Range" slider to ₹500
   - Click "Apply Filters"
   - Sheet closes
   - Results show only doctors with fee ≤ ₹500
   - Filter count badge shows "1"

3. **Filter by Experience**:
   - Open filters
   - Check "5-10 years" checkbox
   - Apply filters
   - Results show only doctors with 5-10 years experience
   - Filter count badge updates

4. **Clear Filters**:
   - Click "Filters" button
   - Click "Clear Filters" button
   - All filters reset
   - All doctors display again
   - Filter count badge disappears

5. **Toggle to Clinics**:
   - Click "Clinics" toggle button
   - View switches to clinic search
   - Placeholder changes to "Search clinic name..."
   - Clinic cards display with doctor count, services count
   - Filter button disappears (filters only for doctors)

6. **Next Available Slot Display**:
   - View doctor cards
   - Check "Next Available" badge:
     - Orange badge = Today's slot
     - Light orange badge = Future slot
     - Format: "Next: Today 3:00 PM" or "Next: Friday 2:00 PM"
   - If no badge = No slots available in next 7 days

7. **Click on Doctor Card**:
   - Click any doctor card
   - Navigation should trigger (currently may not have destination page)
   - Console logs navigation data

---

## 👨‍⚕️ PART 2: VENDOR FEATURES (Tasks 2.1-2.3)

### ✅ Feature: Smart Scheduling (Breaks, Buffer Time, Holidays)

#### 🚪 **How to Access:**

```
1. Open App
2. Click "Vendor" button
3. Login with vendor phone (e.g., 9999999999)
4. Wait for dashboard to load
5. Scroll down to find "Staff/Doctor Management" card
6. Click "Manage Staff" button
7. Find a staff member card
8. Click "Schedule" button (purple, with calendar icon)
9. ✨ StaffScheduleManagement modal opens
```

#### 📍 **Exact Navigation Path:**

```
App.tsx (main)
  └─ VendorApp (phone: 9999999999)
      └─ VendorLandingPage
          └─ VendorDashboard
              └─ [Scroll to "Staff Management" card]
                  └─ [Click "Manage Staff/Doctors"]
                      └─ StaffManagement
                          └─ [Find staff card]
                              └─ [Click "Schedule" button - purple with calendar icon]
                                  └─ StaffScheduleManagement ✅ THIS IS THE NEW UI
```

#### 🎯 **What You'll See:**

1. **Orange Header** with:
   - Settings icon
   - Title: "Schedule Management"
   - Doctor name subtitle
   - Close button (X)

2. **Three Tabs**:
   - **Breaks** (Coffee icon)
   - **Buffer Time** (Timer icon)
   - **Holidays** (Palmtree icon)

#### ✅ **TEST CASE 1: BREAKS TAB**

1. **View Breaks Tab** (selected by default):
   - Header: "Break Times"
   - Description: "Manage your daily breaks and time-offs"
   - "Add Break" button (orange)
   - List of configured breaks (or empty state)

2. **Add New Break**:
   - Click "Add Break" button
   - Dialog opens with form:
     - Break Type dropdown (Lunch, Tea, Personal, Emergency)
     - Label field
     - Start Time picker
     - End Time picker
     - "Recurring break" checkbox
     - Recurrence dropdown (Every Day, Every Monday, etc.)
   - Fill form:
     - Type: "Lunch Break"
     - Label: "Lunch Break"
     - Start: 13:00
     - End: 14:00
     - Recurring: Checked, "Every Day"
   - Click "Add Break"
   - Toast notification: "Break added successfully"
   - Break appears in list with:
     - Orange/Green/Blue/Red badge (based on type)
     - "Daily" or day name badge
     - Time range
     - Edit and Delete buttons

3. **Edit Break**:
   - Click edit button (pencil icon) on a break
   - Dialog opens with pre-filled form
   - Change end time to 14:30
   - Click "Save Changes"
   - Toast notification: "Break updated successfully"
   - Break updates in list

4. **Delete Break**:
   - Click delete button (trash icon) on a break
   - Confirmation dialog: "Are you sure you want to delete this break?"
   - Click OK
   - Toast notification: "Break deleted successfully"
   - Break disappears from list

#### ✅ **TEST CASE 2: BUFFER TIME TAB**

1. **Switch to Buffer Tab**:
   - Click "Buffer Time" tab
   - Tab turns orange, white background
   - Content shows "Appointment Preferences" form

2. **View Current Settings**:
   - Slot Duration (default: 30 minutes)
   - Buffer Time (default: 5 minutes)
   - Advance Booking Window (default: 30 days)
   - Same-day Cutoff Time (default: 18:00)
   - Info card explaining how buffer time works

3. **Modify Settings**:
   - Change Slot Duration to 45 minutes
   - Change Buffer Time to 10 minutes
   - Change Advance Booking to 60 days
   - Change Same-day Cutoff to 17:00
   - Notice "Save Preferences" button appears (orange)

4. **Save Preferences**:
   - Click "Save Preferences" button
   - Toast notification: "Preferences saved successfully"
   - Button disappears
   - Settings are saved

5. **Understand Buffer Time**:
   - Read info card (blue background)
   - Example: "30min slot + 5min buffer = 35min total"
   - This prevents back-to-back appointments

#### ✅ **TEST CASE 3: HOLIDAYS TAB**

1. **Switch to Holidays Tab**:
   - Click "Holidays" tab
   - Tab turns orange
   - Content shows "Holidays & Leave" section

2. **Add Holiday**:
   - Click "Add Holiday" button (orange)
   - Dialog opens with form:
     - Date picker
     - Type dropdown (Full Day / Half Day)
     - Reason field
     - "Recurring holiday" checkbox
     - Recurrence dropdown (Every Sunday, Every Monday, etc.)
   - Fill form:
     - Date: 2025-12-25
     - Type: "Full Day"
     - Reason: "Christmas"
     - Recurring: Unchecked
   - Click "Add Holiday"
   - Toast notification: "Holiday added successfully"
   - Holiday appears in list with:
     - Red badge (Full Day) or Yellow badge (Half Day)
     - Reason
     - Date formatted nicely
     - Delete button

3. **Add Recurring Holiday** (e.g., every Sunday off):
   - Click "Add Holiday"
   - Fill form:
     - Date: (any Sunday)
     - Type: "Full Day"
     - Reason: "Weekly off"
     - Recurring: Checked
     - Recurrence: "Every Sunday"
   - Click "Add Holiday"
   - Holiday appears with "Every Sunday" badge

4. **Delete Holiday**:
   - Click delete button on a holiday
   - Confirmation: "Are you sure you want to delete this holiday?"
   - Click OK
   - Toast notification: "Holiday deleted successfully"
   - Holiday disappears

5. **Close Modal**:
   - Click X button in header
   - Modal closes
   - Returns to StaffManagement screen

---

## 🔧 API ENDPOINTS REFERENCE

### Customer Search APIs:

```
GET /customer/doctors/search
Query Params:
  - query: string (search term)
  - roleId: "veterinarian"
  - feeMin: number (0-999999)
  - feeMax: number (0-999999)
  - experienceMin: number (0-999)
  - experienceMax: number (0-999)
  - gender: "male" | "female" | "any"
  - availableToday: boolean
  - sortBy: "relevance" | "fee_low" | "fee_high" | "experience" | "rating"
  - limit: number (default 20)
  - offset: number (default 0)

GET /customer/clinics/search
Query Params:
  - query: string
  - roleId: "veterinarian"
  - limit: number
  - offset: number

GET /customer/doctors/:doctorId
Returns: Full doctor details
```

### Staff Schedule APIs:

```
GET /staff/:staffId/breaks
Returns: { success, breaks: [] }

POST /staff/:staffId/breaks
Body: { break: { id, start, end, type, label, isRecurring, recurringDay } }
Returns: { success, breaks: [] }

PUT /staff/:staffId/breaks/:breakId
Body: { break: { ...updates } }
Returns: { success, breaks: [] }

DELETE /staff/:staffId/breaks/:breakId
Returns: { success, breaks: [] }

GET /staff/:staffId/preferences
Returns: { success, preferences: { slotDuration, bufferMinutes, advanceBookingDays, sameDayBookingCutoff } }

PUT /staff/:staffId/preferences
Body: { preferences: { ...settings } }
Returns: { success, preferences }

GET /staff/:staffId/holidays
Returns: { success, holidays: [] }

POST /staff/:staffId/holidays
Body: { holiday: { id, date, type, reason, isRecurring, recurringDay } }
Returns: { success, holidays: [] }

DELETE /staff/:staffId/holidays/:holidayId
Returns: { success, holidays: [] }

GET /staff/:staffId/schedule-config
Returns: { success, config: { breaks, preferences, holidays } }
```

---

## ⚠️ KNOWN LIMITATIONS & WORKAROUNDS

### 1. **No Test Data in KV Store**
**Issue**: Database may be empty  
**Workaround**: Need to create test doctors/clinics first via vendor onboarding  
**Fix**: Run data seeding script (if available) or manually create test data

### 2. **Staff Must Be Created First**
**Issue**: Can't access schedule management without staff  
**Workaround**:
1. Login as vendor
2. Go to Staff Management
3. Click "Add New Doctor/Groomer/Trainer"
4. Fill all required fields (photo, name, phone, specialization, degree)
5. Save
6. Then click "Schedule" button on that staff card

### 3. **Schedule Button May Not Be Visible**
**Issue**: If staff list is empty, can't see schedule button  
**Solution**: Add at least one staff member first

### 4. **Browser Console Errors**
**Issue**: Some API calls may fail if backend not deployed  
**Check**: Open browser console (F12) to see detailed error logs  
**Fix**: Ensure Supabase Edge Functions are deployed

---

## 🧪 COMPLETE TEST SCENARIO

### Scenario A: Customer Searches for Vet

```
1. Open app → Select Customer → Enter phone 9876543210
2. Click "Vet Services"
3. Click "Book Vet Visit"
4. See list of doctors/clinics
5. Type "john" in search → See filtered results
6. Click Filters → Set fee to ₹500 → Apply
7. See only doctors with fee ≤ ₹500
8. Check "Next Available" badges on each card
9. Toggle to "Clinics" → See clinic list
10. Click on a doctor card → Navigate (may not work yet)
```

### Scenario B: Vendor Manages Doctor Schedule

```
1. Open app → Select Vendor → Login with 9999999999
2. Wait for dashboard
3. Scroll to "Staff Management" card
4. Click "Manage Staff/Doctors"
5. See list of staff (if empty, add one first)
6. Click "Schedule" button (purple, calendar icon)
7. Modal opens with 3 tabs

BREAKS:
8. Click "Add Break"
9. Fill: Lunch Break, 13:00-14:00, Daily
10. Save → See break in list
11. Click Edit → Change to 14:30 → Save
12. Click Delete → Confirm → Break removed

BUFFER TIME:
13. Click "Buffer Time" tab
14. Change Slot Duration to 45 min
15. Change Buffer to 10 min
16. Click "Save Preferences"
17. Toast confirms save

HOLIDAYS:
18. Click "Holidays" tab
19. Click "Add Holiday"
20. Fill: Date, Full Day, "Christmas"
21. Save → See holiday in list
22. Add another: Recurring, Every Sunday, "Weekly off"
23. See both holidays in list
24. Delete one → Confirm → Removed

25. Click X to close modal
26. Back to Staff Management
```

---

## 📊 VALIDATION CHECKLIST

### Customer Features:
- [ ] Doctor search loads without errors
- [ ] Search bar works with debouncing
- [ ] Filters open and apply correctly
- [ ] Fee range filter works
- [ ] Experience filter works
- [ ] Clear filters button works
- [ ] Toggle Doctors/Clinics works
- [ ] Next Available badge displays
- [ ] Doctor cards show all information
- [ ] Click on card triggers navigation

### Vendor Features:
- [ ] Staff Management loads
- [ ] Can add new staff
- [ ] Schedule button visible on staff cards
- [ ] Schedule modal opens on click
- [ ] Breaks tab displays
- [ ] Can add break
- [ ] Can edit break
- [ ] Can delete break
- [ ] Buffer Time tab displays
- [ ] Can modify preferences
- [ ] Can save preferences
- [ ] Holidays tab displays
- [ ] Can add holiday
- [ ] Can add recurring holiday
- [ ] Can delete holiday
- [ ] Modal closes properly

---

## 🐛 DEBUGGING TIPS

### If features don't appear:

1. **Open Browser Console** (F12 → Console tab)
2. **Look for errors**:
   - Red text = errors
   - Look for "404" = API endpoint not found
   - Look for "500" = Server error
   - Look for "Failed to fetch" = Network error

3. **Check Network Tab** (F12 → Network tab):
   - Filter by "Fetch/XHR"
   - Look for API calls to `/make-server-3dd53475/...`
   - Check Status (should be 200)
   - Check Response (should have data)

4. **Common Issues**:
   - "Cannot read property of undefined" = Missing data
   - "Network error" = Backend not deployed
   - "Authorization failed" = Missing publicAnonKey
   - Empty list = No test data in database

### Still stuck?

1. Check `/IMPLEMENTATION_PROGRESS.md` for latest status
2. Check `/UAT_VALIDATION_REPORT.md` for test results
3. Check browser console for specific error messages
4. Verify Supabase Edge Functions are deployed
5. Verify KV store has test data

---

## ✅ SUMMARY

**Customer Features Location**:  
`Customer → Vet Services → Book Vet Visit → Doctor/Clinic Search`

**Vendor Features Location**:  
`Vendor → Dashboard → Staff Management → [Staff Card] → Schedule Button`

**All features are integrated and ready for UAT testing!** 🎉

---

**Last Updated**: November 20, 2025  
**Status**: ✅ COMPLETE INTEGRATION  
**Ready for**: UAT Testing
