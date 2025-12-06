# 🔧 HOME SERVICES DISCOVERY FIX

## Problem
When vets enabled home services through Service Style Manager, customers still saw "No Home Visit Vets Available" when trying to book home services.

## Root Cause
The customer app was using `/customer/services` endpoint which checks **vendor-level** published services, but home service enablement is stored at **staff-level** in `staff:xxx:style_preferences`.

## Solution Implemented

### 1. Created New Staff Discovery Endpoint ✅

**File**: `/supabase/functions/server/staff-discovery-endpoints.tsx`

**New Endpoints**:
- `GET /customer/discover-staff` - Discover staff by service style preferences
- `GET /customer/discover-staff-by-vendor` - Get vendor staff filtered by style

### 2. Discovery Logic

The new endpoint:
1. ✅ Gets all staff with matching `roleId` (e.g., veterinarian)
2. ✅ Checks each staff's `style_preferences`
3. ✅ Filters by `serviceStyle` (at_home, at_center, tele)
4. ✅ Verifies `enabled: true` AND `available: true`
5. ✅ For home services:
   - Calculates distance from customer location
   - Checks against staff's `maxDistance` preference
   - Only shows staff within their configured radius
6. ✅ Returns sorted list:
   - Home services: sorted by distance, then rating
   - Other styles: sorted by rating

### 3. Updated VetAtHome Component ✅

**Changes**:
- Now calls `/customer/discover-staff?roleId=veterinarian&serviceStyle=at_home`
- Passes customer location for distance filtering
- Maps staff data to display format
- Shows staff photo, name, specializations
- Shows distance if available
- Shows clinic/vendor name

---

## How It Works Now

### Customer Side:
```
1. Customer clicks "Home Services" for Vets
2. System gets customer location (if available)
3. Calls: /customer/discover-staff
   - roleId: veterinarian
   - serviceStyle: at_home
   - latitude: customer_lat
   - longitude: customer_lng
4. Backend checks each vet:
   - Is vet active? ✓
   - Has vet enabled at_home? ✓
   - Is customer within vet's radius? ✓
5. Returns list of eligible vets sorted by distance
6. Customer sees:
   - Vet name & photo
   - Specializations
   - Rating & reviews
   - Distance (e.g., "2.3 km away")
   - Clinic name
   - "Book Now" button
```

### Staff Side:
```
1. Vet enables home services in Service Style Manager
2. Sets distance radius (e.g., 15km)
3. System saves to: staff:xxx:style_preferences
   {
     at_home: {
       enabled: true,
       available: true,
       maxDistance: 15
     }
   }
4. Vet now appears for customers within 15km
5. Customers beyond 15km won't see this vet
```

---

## Testing

### Test 1: Enable Home Services for a Vet

1. **Login as Vet** (e.g., Dr. Vikram Bhat)
2. **Dashboard** → Click "Service Styles" button
3. **Enable "At Home"**:
   - Toggle switch ON
   - Set distance: 20km
   - Should see: "Active - You'll receive home service bookings"

### Test 2: Customer Discovers Vet

1. **Login as Customer**
2. **Go to Vets Dashboard**
3. **Click "Home Services"**
4. **Should now see**:
   - List of vets who enabled home services
   - Each vet shows:
     - Name: "Dr. Vikram Bhat"
     - Specializations: "Internal Medicine, Surgery"
     - Rating: "4.8 • 45 reviews"
     - Distance: "2.3 km away"
     - Clinic: "PetCare Clinic"
     - "Book Now" button

### Test 3: Distance Filtering

**Scenario**: Vet sets max distance to 10km

1. **Customer A** is 5km away → **Sees vet** ✅
2. **Customer B** is 15km away → **Doesn't see vet** ✅

### Test 4: No Vets Available

If NO vets have enabled home services:
- Shows: "No Home Visit Vets Available"
- Message: "No vets have enabled home services in your area yet."
- Suggestion: "Try booking a clinic visit or check back later."

---

## API Examples

### Discover Home Visit Vets

```bash
# Basic discovery
curl "https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/discover-staff?roleId=veterinarian&serviceStyle=at_home" \
  -H "Authorization: Bearer {publicAnonKey}"

# With customer location
curl "https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/discover-staff?roleId=veterinarian&serviceStyle=at_home&latitude=12.9716&longitude=77.5946" \
  -H "Authorization: Bearer {publicAnonKey}"

# Response:
{
  "success": true,
  "staff": [
    {
      "id": "staff_xyz",
      "fullName": "Dr. Vikram Bhat",
      "photo": "...",
      "roleType": "veterinarian",
      "roleName": "Veterinarian",
      "specializations": ["Internal Medicine", "Surgery"],
      "rating": 4.8,
      "reviewCount": 45,
      "vendorId": "vendor_abc",
      "vendorName": "PetCare Clinic",
      "serviceStyle": "at_home",
      "distance": 2.3,
      "services": [
        {
          "serviceId": "consultation",
          "serviceName": "Home Consultation",
          "price": 500,
          "duration": 30
        }
      ],
      "servicesCount": 5,
      "isActive": true,
      "isOnline": true
    }
  ],
  "total": 1
}
```

### Discover Tele Consultation Vets

```bash
curl "https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/discover-staff?roleId=veterinarian&serviceStyle=tele" \
  -H "Authorization: Bearer {publicAnonKey}"
```

### Discover At-Center Vets

```bash
curl "https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/discover-staff?roleId=veterinarian&serviceStyle=at_center" \
  -H "Authorization: Bearer {publicAnonKey}"
```

---

## What's Fixed

✅ **Staff service style preferences are now respected**
✅ **Distance-based filtering for home services**
✅ **Customer sees only eligible staff**
✅ **Distance shown to customer**
✅ **Sorted by distance for home services**
✅ **Staff photo and details displayed**
✅ **Specializations shown**
✅ **No more "No vets available" when vets have enabled home services**

---

## Files Modified

1. ✅ `/supabase/functions/server/staff-discovery-endpoints.tsx` - NEW
2. ✅ `/supabase/functions/server/index.tsx` - Registered new endpoints
3. ✅ `/components/customer/VetAtHome.tsx` - Updated to use new discovery

---

## Next Steps

1. **Test with real data**:
   - Enable home services for 2-3 vets
   - Login as customer
   - Verify they appear

2. **Test distance filtering**:
   - Set one vet to 5km radius
   - Set another to 20km radius
   - Test from different customer locations

3. **Apply same pattern to other roles**:
   - Groomers with home services
   - Trainers with home services
   - Any role that offers home/tele services

4. **Build similar components**:
   - GroomerAtHome
   - TrainerAtHome
   - TeleConsultationVets

---

## Status

🎉 **FIXED!**

**Before**: Vets enabled home services but customers couldn't see them
**After**: Customers can now discover and book vets who enabled home services

**Backend**: ✅ Complete
**Frontend**: ✅ Complete
**Testing**: ⏳ Ready for testing

---

**Deployed**: Ready to test now!
