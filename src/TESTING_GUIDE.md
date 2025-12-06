# 🧪 Problem Grid Testing Guide

## Quick Test Steps

### 1️⃣ Veterinary Service (Reference - Already Working)
```
Customer Home → Vet Services → "What's Your Health Problem?" section
```
1. Click on any health problem (e.g., "Surgery", "Heart Care") ✅
2. Should show vendors specialized in that problem ✅
3. Click "View All" → Should open full problem grid ✅
4. Select any problem → Should show specialized vendors ✅

---

### 2️⃣ Grooming Service (NEWLY UPDATED)
```
Customer Home → Grooming Services → "What Does Your Pet Need?" section
```
**Test Cases:**
1. **Direct Problem Selection**
   - Click "Full Grooming" tile
   - Console should show: `[GROOMING-ROUTER] Fetching problem details for: full_grooming`
   - Should navigate to vendor discovery page
   - Should show groomers specialized in full grooming

2. **View All Flow**
   - Click "View All" button
   - Should open ProblemGridSelector with all grooming problems
   - Select any problem
   - Console should show: `[GROOMING-ROUTER] Problem selected from grid`
   - Should show relevant groomers

3. **Vendor Selection**
   - Click on a groomer from discovery page
   - Console should show: `[GROOMING-ROUTER] Vendor selected`
   - Should navigate to grooming center profile

---

### 3️⃣ Training Service (NEWLY UPDATED)
```
Customer Home → Training Services → "What's Your Training Goal?" section
```
**Test Cases:**
1. **Direct Problem Selection**
   - Click "Puppy Training" or "Obedience" tile
   - Console: `[TRAINING-ROUTER] Fetching problem details for: puppy_training`
   - Should show trainers specialized in that goal

2. **View All Flow**
   - Click "View All"
   - Should show full problem grid for training
   - Select "Behavior Correction"
   - Should show behavior specialists

3. **Vendor Selection**
   - Select a trainer
   - Console: `[TRAINING-ROUTER] Vendor selected`
   - Should navigate to trainer profile

---

### 4️⃣ Walking Service (NEWLY UPDATED)
```
Customer Home → Walking Services → Problem Grid section
```
**Test Cases:**
1. **Direct Problem Selection**
   - Click any walking need (e.g., "Daily Walks", "Exercise")
   - Console: `[WALKING-ROUTER] Fetching problem details for: daily_walks`
   - Should show walkers specialized in that service

2. **View All Flow**
   - Click "View All"
   - Should show full problem grid
   - Select any walking type
   - Should show relevant walkers

3. **Vendor Selection**
   - Select a walker
   - Console: `[WALKING-ROUTER] Walker selected`
   - Should navigate to walker service

---

### 5️⃣ Behavioral Service (NEWLY UPDATED)
```
Customer Home → Behavioral Services → Problem Grid section
```
**Test Cases:**
1. **Direct Problem Selection**
   - Click any behavioral issue (e.g., "Aggression", "Anxiety")
   - Console: `[BEHAVIORAL-ROUTER] Fetching problem details for: aggression`
   - Should show behaviorists specialized in that issue

2. **View All Flow**
   - Click "View All"
   - Should show full problem grid
   - Select any issue
   - Should show specialists

3. **Vendor Selection**
   - Select a behaviorist
   - Console: `[BEHAVIORAL-ROUTER] Behaviorist selected`
   - Should show alert with vendor name (booking flow TBD)

---

### 6️⃣ Boarding Service (NEWLY UPDATED)
```
Customer Home → Boarding Services → "What's Your Boarding Need?" section
```
**Test Cases:**
1. **Direct Problem Selection**
   - Click "Short Stay" or "Long Term" tile
   - Console: `[BOARDING-ROUTER] Fetching problem details for: short_stay`
   - Should show boarding centers specialized in that service

2. **View All Flow**
   - Click "View All"
   - Should show full problem grid for boarding
   - Select "Daycare"
   - Should show daycare facilities

3. **Vendor Selection**
   - Select a boarding center
   - Console: `[BOARDING-ROUTER] Boarding center selected`
   - Should navigate to boarding center profile

---

## 🔍 What to Check

### For Each Test:

#### ✅ **Console Logs**
Look for these logs in the browser console:
```
📍 [SERVICE-ROUTER] Navigating to: problem_selected { problemId: 'xxx' }
🎯 [SERVICE-ROUTER] Fetching problem details for: xxx
✅ [SERVICE-ROUTER] Problem fetched successfully: { ... }
✅ [SERVICE-ROUTER] Vendor selected: { ... }
```

#### ✅ **Network Calls**
Check Network tab for:
```
GET /make-server-3dd53475/customer/universal-problem-discovery?problemGridId=xxx&roleId=yyy
Status: 200 OK
```

#### ✅ **UI Behavior**
- Problem grid displays correctly on landing page
- "View All" button works
- Individual problem tiles are clickable
- Vendor discovery page shows after selection
- Back button works from each screen
- No errors in console
- Smooth transitions between screens

#### ✅ **Data Display**
- Problem name/icon shows correctly
- Vendor count displays
- Vendor cards show proper information
- Specializations match the selected problem

---

## 🐛 Common Issues & Solutions

### Issue: "No vendors found"
**Possible Causes:**
1. Backend hasn't been set up with problem grids
2. No staff have `specializations` configured
3. RoleId mismatch between frontend and backend

**Solution:**
- Run setup script to populate test data
- Check backend logs for problem grid configuration
- Verify roleId matches between router and backend

---

### Issue: "Problem grid not showing"
**Possible Causes:**
1. Landing page not calling `onNavigate('problem_grid')`
2. Router not handling the navigation

**Solution:**
- Check landing page onClick handlers
- Verify router has `if (screen === 'problem_grid')` handler
- Check console for navigation logs

---

### Issue: "Vendor selection doesn't work"
**Possible Causes:**
1. Vendor ID not being passed correctly
2. Router not handling vendor selection
3. Profile component not receiving vendorId

**Solution:**
- Check `onVendorSelect` handler in router
- Verify vendor data structure (vendorId vs id)
- Check console logs for vendor selection

---

### Issue: "API returns 404 or 500"
**Possible Causes:**
1. Backend endpoint not deployed
2. RoleId doesn't exist in backend
3. Problem ID doesn't match backend catalog

**Solution:**
- Check backend server logs
- Verify endpoint exists: `/customer/universal-problem-discovery`
- Test API directly with curl/Postman

---

## 📊 Expected API Response

### Universal Problem Discovery Response:
```json
{
  "problemGrid": {
    "id": "surgery",
    "displayName": "Surgery",
    "description": "Surgical procedures for pets",
    "icon": "🔪",
    "category": "medical"
  },
  "specialists": [
    {
      "vendorId": "vet_123",
      "businessName": "City Vet Clinic",
      "fullName": "Dr. Sarah Johnson",
      "specializations": ["surgery", "emergency"],
      "rating": 4.8,
      "location": {
        "city": "Mumbai",
        "address": "123 Main St"
      }
    }
  ],
  "totalCount": 5
}
```

---

## ✅ Success Criteria

All services pass when:
- [ ] Problem grids display on landing pages
- [ ] "View All" opens full problem catalog
- [ ] Clicking specific problem shows relevant vendors
- [ ] Vendor count is accurate
- [ ] Vendor selection navigates properly
- [ ] Back navigation works smoothly
- [ ] No console errors
- [ ] Network requests succeed (200 OK)
- [ ] Data displays correctly
- [ ] All 6 services work identically

---

## 🚀 Quick Smoke Test

**Fastest way to verify everything works:**

1. Open browser console (F12)
2. Navigate to Customer Home
3. For each service (Vet, Grooming, Training, Walking, Behavioral, Boarding):
   - Click the service
   - Click any problem tile
   - Verify vendors appear
   - Click back
   - Click "View All"
   - Select a problem
   - Verify vendors appear
   - Click back twice to landing

If all 6 services complete this flow without errors, the implementation is successful! ✅

---

## 📝 Test Reporting Template

```
Service: [Veterinary/Grooming/Training/Walking/Behavioral/Boarding]
Date: [Date]
Tester: [Name]

✅ = Pass | ❌ = Fail | ⚠️ = Partial

Landing Page Display: [ ]
Direct Problem Selection: [ ]
View All Flow: [ ]
Problem Grid Display: [ ]
Vendor Discovery: [ ]
Vendor Selection: [ ]
Back Navigation: [ ]
Console Logs: [ ]
API Calls: [ ]
Data Accuracy: [ ]

Issues Found:
1. 
2. 
3. 

Notes:
```

---

Good luck testing! 🎉
