# Testing Guide: Specialization Display & Google Maps Integration

## ✅ What Was Fixed

### 1. **Specialization Display Issue** 
**Problem**: All veterinarians were showing as "General Practitioner" instead of their actual specializations like "Surgeon", "Dentist", etc.

**Root Cause**: The frontend was using `/customer/search` endpoint which returned raw `staff.specialization` field without applying the specialization mapping.

**Solution**: 
- Applied `getPrimarySpecialization()` mapping function in 3 backend endpoints:
  - `/customer/search` (universal search) - `returnCenters()` and `returnStaff()` functions
  - `/customer/doctors/:doctorId` (single doctor details)
  
**Mapping Logic** (from `/supabase/functions/server/specialization-mapping.tsx`):
- "Sergery" → "Surgeon"
- "Denstist" → "Dentist" 
- "General Pratictioner" → "General Practitioner"
- Plus many more corrections for common typos

### 2. **Google Maps Distance & Directions**
**New Features**:
- User location is automatically detected via browser geolocation API
- Distance is calculated server-side using Haversine formula
- Distance is displayed in the listing view (in orange next to clinic name)
- "Get Directions" button opens Google Maps with turn-by-turn directions
- Works in both "Doctors" and "Clinics" tabs
- Also available in the detailed doctor profile view

---

## 🧪 Testing Instructions

### Test 1: Verify Specialization Display

**Steps**:
1. Navigate to Customer App → Veterinary Services → "Book a Vet"
2. Click "Find a Doctor"
3. View the doctor listing

**Expected Results**:
- Doctors should show their correct specializations:
  - ✅ "Surgeon" (not "General Practitioner")
  - ✅ "Dentist" (not "General Practitioner")
  - ✅ Other specializations as configured
- Check the browser console for logs like:
  ```
  ✅ [SPECIALIZATION] Raw: "Sergery" → Mapped: "Surgeon"
  ✅ [SPECIALIZATION] Primary: Surgeon
  ```

### Test 2: Verify Distance Display

**Steps**:
1. When prompted, **allow location access** in your browser
2. Navigate to the doctor listing
3. Check the console for:
   ```
   📍 User location: 28.6139, 77.2090
   📍 Customer Location: 28.6139, 77.2090
   ```
4. View doctor cards in the list

**Expected Results**:
- Each doctor card shows distance in orange text: `(2.5 km)` or `(10.3 km)`
- Distance appears next to the clinic name
- If location is not allowed, no distance is shown (graceful degradation)

### Test 3: Verify "Get Directions" Button

**Steps**:
1. In the doctor listing, look for "Get Directions" button (blue text with navigation icon)
2. Click the button
3. A new tab should open with Google Maps

**Expected Results**:
- Google Maps opens with route from "Your Location" to the clinic
- Turn-by-turn directions are ready
- Map shows the destination marker at the clinic location

### Test 4: Test in Clinics Tab

**Steps**:
1. Switch to "Clinics" tab in the search view
2. View clinic cards

**Expected Results**:
- Distance is shown in the address line: `(5.2 km)`
- "Directions" button appears at the bottom right
- Clicking it opens Google Maps with directions

### Test 5: Test in Doctor Profile View

**Steps**:
1. Click on any doctor card to open their profile
2. Scroll to the location section (has MapPin icon)

**Expected Results**:
- Specialization shows correctly (e.g., "Surgeon" not "General Practitioner")
- Distance is displayed: `(3.1 km)`
- "Get Directions" button appears below the address
- Clicking it opens Google Maps

---

## 🔍 Backend Verification

### Check Specialization Mapping

**Endpoint**: `GET /customer/search?serviceCategory=veterinary_services&serviceStyle=at_center`

**Expected Response Structure**:
```json
{
  "success": true,
  "results": [
    {
      "id": "center_123",
      "staff": [
        {
          "id": "staff_456",
          "name": "Dr. Sharma",
          "specialization": "Surgeon",  // ✅ Mapped from "Sergery"
          "specializations": ["Surgery", "Emergency Care"]  // ✅ All specializations
        }
      ]
    }
  ]
}
```

### Check Distance Calculation

**Endpoint**: `GET /customer/search?serviceCategory=veterinary_services&serviceStyle=at_center&lat=28.6139&lon=77.2090`

**Expected Response**:
```json
{
  "success": true,
  "results": [
    {
      "id": "center_123",
      "latitude": 28.5355,
      "longitude": 77.3910,
      "distance": 15.2,  // ✅ Distance in km
      "staff": [...]
    }
  ]
}
```

**Backend Console Logs**:
```
🔍 ===== UNIVERSAL CUSTOMER SEARCH =====
📋 Service Category: veterinary_services
🎨 Service Style: at_center
📍 Customer Location: 28.6139, 77.2090
✅ [SPECIALIZATION] Mapping staff: staff_123
✅ [SPECIALIZATION] Raw specialization: "Sergery"
✅ [SPECIALIZATION] Primary: Surgeon
```

---

## 🐛 Troubleshooting

### Issue: Still showing "General Practitioner"

**Possible Causes**:
1. **Browser cache** - Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
2. **Staff data doesn't have specialization field** - Check KV store: `staff:staff_id`
3. **Mapping function not applied** - Check backend logs for specialization mapping

**Fix**: 
- Clear browser cache
- Verify staff object has `specialization`, `services`, or `selectedServices` field
- Check server logs for `[SPECIALIZATION]` entries

### Issue: Distance not showing

**Possible Causes**:
1. **Location permission denied** - Check browser console for geolocation errors
2. **Vendor has no coordinates** - Check `vendor.latitude` and `vendor.longitude` in KV store
3. **API not receiving location** - Check network tab for `lat` and `lon` parameters

**Fix**:
- Allow location access when prompted
- Ensure vendors have `latitude` and `longitude` fields populated
- Check browser console for `📍 User location:` log

### Issue: "Get Directions" button not working

**Possible Causes**:
1. **Coordinates missing** - Vendor doesn't have lat/lon
2. **Popup blocked** - Browser is blocking the new tab

**Fix**:
- Add coordinates to vendor profile
- Allow popups for this site
- Try clicking the button again

---

## 📊 Data Structure Reference

### Staff Object (in KV store)
```typescript
{
  id: "staff_123",
  fullName: "Dr. Sharma",
  specialization: "Sergery",  // Raw value
  services: ["Surgery", "Emergency Care"],  // Used for mapping
  selectedServices: ["Dental", "Surgery"],  // Also checked
  degree: "BVSc & AH",
  experience: 10,
  consultationFee: 500,
  // ... other fields
}
```

### Vendor Object (in KV store)
```typescript
{
  id: "vendor_123",
  businessName: "Pet Care Clinic",
  address: "123 Main St, Delhi",
  latitude: "28.5355",  // ✅ Required for distance
  longitude: "77.3910",  // ✅ Required for distance
  // ... other fields
}
```

---

## 🎯 Success Criteria

✅ **Specializations display correctly** in all views
✅ **Distance shows** when location is enabled
✅ **"Get Directions" opens** Google Maps with proper route
✅ **Works in both** "Doctors" and "Clinics" tabs
✅ **Graceful degradation** when location is disabled
✅ **Backend logs show** specialization mapping and distance calculation

---

## 🚀 Files Modified

### Backend:
- `/supabase/functions/server/universal-customer-search.tsx` - Added specialization mapping and distance calculation
- `/supabase/functions/server/customer-search-endpoints.tsx` - Fixed single doctor endpoint

### Frontend:
- `/components/customer/vet/VetClinicListViewEnhanced.tsx` - Added location detection, distance display, and directions button
- `/components/customer/vet/VetDoctorDetails.tsx` - Added distance and directions to profile view

---

## 📝 Notes

- **Real Google Maps API** is being used (key: `VITE_GOOGLE_MAPS_API_KEY`)
- **Haversine formula** calculates great-circle distance between two points
- **Distance is rounded** to 1 decimal place (e.g., 2.5 km)
- **Specialization mapping** is case-insensitive and handles common typos
- **Location permission** is requested once and remembered by browser
- **Fallback behavior**: If location denied, app works normally without distance info
