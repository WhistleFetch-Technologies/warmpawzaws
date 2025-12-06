# Backend Implementation Guide - Pet Holiday Service

## 🎯 Objective
Ensure the `pet_holiday` vendor role is properly configured and accessible via the universal customer search API.

---

## ✅ Quick Checklist

### 1. Verify Role Configuration
**File:** `/supabase/functions/server/seed_roles.tsx`

Check that pet_holiday exists in MASTER_ROLES array:
```typescript
{ 
  id: 'pet_holiday', 
  name: 'Pet Holiday', 
  type: 'hospitality', 
  homeService: false, 
  serviceCategory: 'hospitality_services' 
}
```

**Status:** ✅ Already exists in seed_roles.tsx (line 35)

---

### 2. Verify Universal Search Endpoint
**File:** `/supabase/functions/server/universal-customer-search.tsx`

Ensure `pet_holiday` is mapped in the category mappings:

```typescript
const categoryToRoleMapping: Record<string, string[]> = {
  // ... other mappings
  'hospitality_services': ['pet_cafe', 'pet_holiday'],
  // ... rest
};
```

**Action Required:** Check if pet_holiday is included in hospitality_services mapping

---

### 3. Test Data - Create Sample Vendors

Use Admin Panel or API to create test vendors:

**Example Vendor 1: Goa Paradise Pet Resort**
```json
{
  "businessName": "Paws Paradise Goa",
  "roleId": "pet_holiday",
  "roleName": "Pet Holiday",
  "serviceCategory": "hospitality_services",
  "vendorType": "service_provider",
  "ownerName": "Rajesh Kumar",
  "phone": "+919876543210",
  "email": "contact@pawsparadise.com",
  "address": {
    "street": "Beach Road, Candolim",
    "city": "Goa",
    "state": "Goa",
    "pincode": "403515",
    "country": "India",
    "latitude": 15.5171,
    "longitude": 73.7635
  },
  "status": "approved",
  "isActive": true,
  "rating": 4.8,
  "totalReviews": 145,
  "serviceStyles": ["at_center"],
  "description": "Luxury pet-friendly beach resort with ocean views, private beach access, and premium pet care facilities",
  "amenities": ["Beach Access", "Swimming Pool", "Pet Spa", "Gourmet Dining", "24/7 Vet Care"],
  "photos": [
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800",
    "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800"
  ],
  "priceRange": {
    "min": 5000,
    "max": 20000,
    "currency": "INR"
  },
  "packages": [
    {
      "name": "Weekend Getaway",
      "duration": "2 Days",
      "price": 8000,
      "includes": ["Accommodation", "Meals", "Beach Access", "Pet Activities"]
    },
    {
      "name": "Week-Long Paradise",
      "duration": "7 Days",
      "price": 25000,
      "includes": ["Luxury Suite", "All Meals", "Spa", "Beach Activities", "Photography"]
    }
  ]
}
```

**Example Vendor 2: Coorg Hills Pet Retreat**
```json
{
  "businessName": "Mountain Paws Coorg",
  "roleId": "pet_holiday",
  "roleName": "Pet Holiday",
  "serviceCategory": "hospitality_services",
  "vendorType": "service_provider",
  "ownerName": "Priya Sharma",
  "phone": "+919876543211",
  "email": "stay@mountainpaws.com",
  "address": {
    "street": "Madikeri Road",
    "city": "Coorg",
    "state": "Karnataka",
    "pincode": "571201",
    "country": "India",
    "latitude": 12.4244,
    "longitude": 75.7382
  },
  "status": "approved",
  "isActive": true,
  "rating": 4.9,
  "totalReviews": 98,
  "serviceStyles": ["at_center"],
  "description": "Serene hill station retreat nestled in coffee plantations with nature trails and pet-friendly activities",
  "amenities": ["Nature Trails", "Coffee Plantation Tours", "Bonfire Evenings", "Pet Grooming", "Outdoor Play Area"],
  "photos": [
    "https://images.unsplash.com/photo-1586375300773-8384e3e4916f?w=800",
    "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800"
  ],
  "priceRange": {
    "min": 4000,
    "max": 15000,
    "currency": "INR"
  },
  "packages": [
    {
      "name": "Hill Station Escape",
      "duration": "3 Days",
      "price": 12000,
      "includes": ["Cottage Stay", "All Meals", "Plantation Tour", "Trekking"]
    }
  ]
}
```

**Example Vendor 3: Jaipur Royal Pet Palace**
```json
{
  "businessName": "Royal Paws Jaipur",
  "roleId": "pet_holiday",
  "roleName": "Pet Holiday",
  "serviceCategory": "hospitality_services",
  "vendorType": "service_provider",
  "ownerName": "Vikram Singh",
  "phone": "+919876543212",
  "email": "info@royalpaws.com",
  "address": {
    "street": "Amer Road",
    "city": "Jaipur",
    "state": "Rajasthan",
    "pincode": "302002",
    "country": "India",
    "latitude": 26.9124,
    "longitude": 75.7873
  },
  "status": "approved",
  "isActive": true,
  "rating": 4.7,
  "totalReviews": 203,
  "serviceStyles": ["at_center"],
  "description": "Heritage-inspired luxury resort offering royal treatment for pets with cultural experiences",
  "amenities": ["Heritage Architecture", "Royal Spa", "Cultural Events", "Palace Tours", "Traditional Cuisine"],
  "photos": [
    "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800",
    "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800"
  ],
  "priceRange": {
    "min": 6000,
    "max": 25000,
    "currency": "INR"
  },
  "packages": [
    {
      "name": "Royal Weekend",
      "duration": "2 Days",
      "price": 10000,
      "includes": ["Palace Room", "Royal Meals", "City Tour", "Pet Spa"]
    },
    {
      "name": "Maharaja Experience",
      "duration": "5 Days",
      "price": 35000,
      "includes": ["Luxury Suite", "Full Board", "Heritage Tours", "Photography", "Pet Shopping"]
    }
  ]
}
```

---

### 4. API Endpoint Testing

**Test Command:**
```bash
curl -X GET \
  'https://[PROJECT_ID].supabase.co/functions/v1/make-server-3dd53475/customer/services?roleId=pet_holiday' \
  -H 'Authorization: Bearer [ANON_KEY]'
```

**Expected Response:**
```json
{
  "vendors": [
    {
      "id": "vendor_xxx",
      "businessName": "Paws Paradise Goa",
      "roleId": "pet_holiday",
      "roleName": "Pet Holiday",
      "rating": 4.8,
      "totalReviews": 145,
      "location": "Goa, India",
      "distance": "245 km",
      "phone": "+919876543210",
      "email": "contact@pawsparadise.com",
      "serviceStyles": ["at_center"],
      "description": "Luxury pet-friendly beach resort...",
      "amenities": ["Beach Access", "Swimming Pool", ...],
      "photos": ["url1", "url2"],
      "priceRange": { "min": 5000, "max": 20000 },
      "isVerified": true,
      "packages": [...]
    }
    // ... more vendors
  ],
  "count": 3,
  "category": "hospitality_services"
}
```

---

### 5. Verify Distance Calculation

Ensure vendors show distance from customer location:
- Check latitude/longitude are set for vendors
- Verify distance calculation in universal-customer-search.tsx
- Test with different customer locations

---

### 6. Admin Panel Verification

**Steps:**
1. Login to Admin panel
2. Navigate to Vendor Management
3. Filter by Role: "Pet Holiday"
4. Verify test vendors appear
5. Check all fields are populated correctly
6. Ensure status is "approved" and isActive is true

---

## 🧪 Testing Steps

### Step 1: Backend Verification
```bash
# Check if role exists in KV store
GET role:config:pet_holiday

# Expected: Role configuration object
```

### Step 2: Create Test Vendors
```bash
# Use vendor onboarding API or admin seeding
POST /vendor/onboarding
# With pet_holiday roleId
```

### Step 3: Query Customer API
```bash
GET /customer/services?roleId=pet_holiday

# Should return list of approved pet_holiday vendors
```

### Step 4: Frontend Testing
1. Open Customer App
2. Navigate to Home
3. Click "Pet Holiday" service card
4. Verify:
   - ✅ Landing page loads
   - ✅ Vendors display if available
   - ✅ Stats show correct count
   - ✅ Empty state shows if no vendors
   - ✅ Back button works
   - ✅ UI matches design (cyan theme)

---

## 🔍 Troubleshooting

### Issue: No vendors returned
**Check:**
- Vendor status is "approved"
- Vendor isActive is true
- roleId exactly matches "pet_holiday"
- serviceCategory is set correctly

### Issue: Distance not showing
**Check:**
- Vendor has latitude/longitude
- Customer location is available
- Distance calculation function is working

### Issue: API returns 404
**Check:**
- Role exists in role:config KV store
- Endpoint mapping includes pet_holiday
- Universal search includes hospitality_services

---

## 📝 Code Locations

**Role Configuration:**
- `/supabase/functions/server/seed_roles.tsx` (line 35)
- `/supabase/functions/server/role-config-endpoints.tsx`

**API Endpoint:**
- `/supabase/functions/server/universal-customer-search.tsx`
- Look for `categoryToRoleMapping` object

**Frontend:**
- `/components/customer/PetHolidayServicesLanding.tsx`
- `/components/customer/CustomerHomeComplete.tsx` (line 199)
- `/components/customer/CustomerHomeWrapper.tsx` (added holiday routing)

---

## ✅ Completion Criteria

- [ ] pet_holiday role exists in role configuration
- [ ] At least 3 test vendors created with pet_holiday roleId
- [ ] API endpoint returns vendors correctly
- [ ] Distance calculation works
- [ ] Frontend displays vendors properly
- [ ] Empty state shows when no vendors available
- [ ] Navigation works end-to-end
- [ ] Color scheme is consistent (cyan)

---

## 🚀 Ready for Production

Once all checklist items are complete:
1. Mark pet_holiday as production-ready
2. Update vendor onboarding forms to include pet_holiday
3. Document pet_holiday specific requirements
4. Train customer support on pet holiday services

---

**Priority: Medium**
**Estimated Time: 30 minutes**
**Dependencies: None (all frontend complete)**

---

*This completes the 100% vendor role coverage for Warmpawz! 🎉*
