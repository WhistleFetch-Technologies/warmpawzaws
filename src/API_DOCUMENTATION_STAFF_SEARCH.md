# 🔍 Universal Staff & Vendor Search API Documentation

## Overview

This document describes the **standardized** way to search for staff and vendors across ALL service types in Warmpawz. The system uses a universal approach where:

- **Veterinarians** → "Doctors" (staff persona for vet vendors)
- **Groomers** → "Groomers" (staff persona for grooming vendors)
- **Trainers** → "Trainers" (staff persona for training vendors)
- **Walkers** → "Walkers" (staff persona for walking vendors)

## Architecture

### Data Schema Standardization

#### Vendor Record (`vendor:{vendorId}`)
```json
{
  "id": "vendor_9880826240",
  "roleId": "pet_clinic",
  "vendorType": "center",
  "status": "approved",
  "isActive": true,
  "businessName": "Cura Pet Hospital",
  "phone": "9880826240",
  "address": "123 Main St",
  "city": "Bangalore",
  "consultationFee": 500,
  "rating": 4.5,
  "totalReviews": 100
}
```

#### Staff Record (`staff:{staffId}`)
```json
{
  "id": "staff_9611377119",
  "vendorId": "vendor_9880826240",
  "fullName": "Dr. Nimish Jain",
  "phone": "9611377119",
  "email": "nimish@example.com",
  "role": "Doctor",
  "roleType": "veterinarian",
  "specialization": "Veterinary Medicine",
  "degree": "BVSc & AH",
  "yearsOfExperience": 8,
  "consultationFee": 500,
  "gender": "male",
  "photo": "https://...",
  "isActive": true,
  "rating": 4.8,
  "totalReviews": 50
}
```

#### Vendor Staff Array (`vendor:{vendorId}:staff`)
```json
["staff_9611377119", "staff_9677885544", "staff_9988776655"]
```

#### Staff Services (`staff:{staffId}:service:{serviceId}`)
```json
{
  "id": "service_123",
  "serviceId": "svc_consultation",
  "serviceName": "General Consultation",
  "category": "consultation",
  "categoryName": "Consultation",
  "price": 500,
  "duration": 30,
  "serviceStyle": "at_center",
  "isActive": true
}
```

#### Vendor Services (`vendor_services:{vendorId}:{serviceStyle}`)
```json
{
  "services": [
    {
      "id": "svc_consultation",
      "name": "General Consultation",
      "category": "consultation",
      "categoryName": "Consultation",
      "price": 500,
      "duration": 30,
      "serviceStyle": "at_center",
      "isEnabled": true,
      "publishStatus": "published"
    }
  ]
}
```

---

## API Endpoints

### 1. Universal Staff Search

**GET** `/make-server-3dd53475/customer/staff/search`

Search for staff across ALL vendor types with role-based filtering.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | `""` | Search term (name, specialization) |
| `roleId` | string | `""` | Filter by vendor role (veterinarian, pet_groomer, pet_trainer, etc.) |
| `serviceStyle` | string | `""` | Filter by service style (at_center, at_home, tele) |
| `feeMin` | number | `0` | Minimum consultation fee |
| `feeMax` | number | `999999` | Maximum consultation fee |
| `experienceMin` | number | `0` | Minimum years of experience |
| `experienceMax` | number | `999` | Maximum years of experience |
| `gender` | string | `""` | Gender filter (male, female) |
| `sortBy` | string | `rating` | Sort by: rating, fee_low, fee_high, experience, relevance |
| `limit` | number | `50` | Results per page |
| `offset` | number | `0` | Pagination offset |

#### Special Role Handling

The `roleId` parameter supports intelligent grouping:

- `roleId=veterinarian` → Includes: `veterinarian`, `pet_clinic`, `vet_clinic`
- `roleId=pet_groomer` → Exact match only
- `roleId=""` → All roles

#### Response

```json
{
  "success": true,
  "staff": [
    {
      // Staff Info
      "id": "staff_9611377119",
      "staffId": "staff_9611377119",
      "fullName": "Dr. Nimish Jain",
      "phone": "9611377119",
      "email": "nimish@example.com",
      "role": "Doctor",
      "roleType": "veterinarian",
      
      // Professional Info
      "specialization": "Veterinary Medicine",
      "qualification": "BVSc & AH",
      "degree": "BVSc & AH",
      "yearsOfExperience": 8,
      "consultationFee": 500,
      
      // Personal
      "gender": "male",
      "photo": "https://...",
      "bio": "Experienced veterinarian...",
      "languages": ["English", "Hindi"],
      
      // Stats
      "rating": 4.8,
      "totalReviews": 50,
      "totalAppointments": 200,
      "completedAppointments": 180,
      
      // Vendor/Clinic Info
      "vendorId": "vendor_9880826240",
      "clinicId": "vendor_9880826240",
      "vendorName": "Cura Pet Hospital",
      "clinicName": "Cura Pet Hospital",
      "vendorAddress": "123 Main St",
      "vendorCity": "Bangalore",
      "vendorPhone": "9880826240",
      "vendorRoleId": "pet_clinic",
      "vendorType": "center",
      
      // ✅ KEY: Services for booking
      "services": [
        {
          "id": "service_123",
          "serviceId": "svc_consultation",
          "name": "General Consultation",
          "category": "consultation",
          "categoryName": "Consultation",
          "price": 500,
          "duration": 30,
          "serviceStyle": "at_center",
          "description": ""
        }
      ],
      "serviceCount": 5,
      
      // Availability
      "isActive": true,
      "availableToday": true,
      "nextAvailableSlot": "Today 2:00 PM",
      
      // Service Styles Available
      "serviceStylesAvailable": ["at_center", "tele"]
    }
  ],
  "total": 15,
  "count": 10,
  "limit": 50,
  "offset": 0,
  "filters": {
    "query": "",
    "roleId": "veterinarian",
    "serviceStyle": "at_center",
    "feeRange": [0, 999999],
    "experienceRange": [0, 999],
    "gender": "",
    "sortBy": "rating"
  }
}
```

#### Example Calls

**Get all veterinarian doctors in at_center clinics:**
```
GET /customer/staff/search?roleId=veterinarian&serviceStyle=at_center
```

**Get groomers who do at_home services:**
```
GET /customer/staff/search?roleId=pet_groomer&serviceStyle=at_home
```

**Search for experienced trainers:**
```
GET /customer/staff/search?roleId=pet_trainer&experienceMin=5&sortBy=experience
```

---

### 2. Legacy Doctor Search (Backward Compatible)

**GET** `/make-server-3dd53475/customer/doctors/search`

Legacy endpoint maintained for backward compatibility. Now supports multiple vet roles.

#### Key Improvements

✅ **Fixed Role Filter** - Now includes `pet_clinic` vendors:
```javascript
// OLD (broken):
roleId === 'veterinarian' → Only matched 'veterinarian' role

// NEW (fixed):
roleId === 'veterinarian' → Matches 'veterinarian', 'pet_clinic', 'vet_clinic'
```

✅ **Added Services** - Each doctor now includes their services array

✅ **Comprehensive Logging** - Shows exactly which staff are included/excluded

#### Response (Same as universal search)

Returns doctors with all fields including `services` array.

---

### 3. Get Individual Staff Details

**GET** `/make-server-3dd53475/customer/staff/:staffId`

Get detailed information for a specific staff member.

#### Response

```json
{
  "success": true,
  "staff": {
    // Same structure as search results
    "id": "staff_9611377119",
    "fullName": "Dr. Nimish Jain",
    "services": [...],
    "serviceCount": 5,
    "serviceStylesAvailable": ["at_center", "tele"]
    // ... all other fields
  }
}
```

---

### 4. Clinic/Vendor Services

**GET** `/make-server-3dd53475/customer/clinic/:clinicId/services`

Get all published services for a specific clinic/vendor.

#### Response

```json
{
  "success": true,
  "services": [
    {
      "id": "svc_123",
      "serviceId": "svc_123",
      "name": "General Consultation",
      "description": "",
      "price": 500,
      "duration": 30,
      "serviceStyle": "at_center",
      "category": "consultation",
      "categoryName": "Consultation",
      "subCategoryName": "General",
      "isPackage": false,
      "publishStatus": "published",
      "isEnabled": true,
      "vendorId": "vendor_9880826240",
      "vendorName": "Cura Pet Hospital"
    }
  ],
  "vendor": {
    "id": "vendor_9880826240",
    "name": "Cura Pet Hospital",
    "type": "center",
    "roleId": "pet_clinic"
  }
}
```

---

## Data Flow

### Staff Creation Flow

```
1. Vendor Dashboard → Create Staff
2. Backend creates `staff:{staffId}` record
3. Backend adds staffId to `vendor:{vendorId}:staff` array ✅
4. Staff can login with phone number
5. Staff appears in customer search results
```

### Customer Search Flow

```
1. Customer App → Call /customer/staff/search
2. Backend gets all approved vendors (filtered by roleId)
3. For each vendor:
   - Get `vendor:{vendorId}:staff` array
   - For each staffId in array:
     - Get `staff:{staffId}` record
     - Get `staff:{staffId}:service:*` records
     - Apply filters (fee, experience, gender, etc.)
     - Include if staff.isActive === true
4. Return paginated, sorted results
```

---

## Critical Business Rules

### ✅ Service Availability

**Staff Services** (Priority 1):
- Stored at: `staff:{staffId}:service:{serviceId}`
- Used when available

**Vendor Services** (Fallback):
- Stored at: `vendor_services:{vendorId}:{serviceStyle}`
- Used when staff has no services assigned
- Only `published` and `enabled` services shown

### ✅ Role Mapping

| Vendor Role | Staff Persona | Search Parameter |
|-------------|---------------|------------------|
| `pet_clinic` | Doctor | `roleId=veterinarian` |
| `veterinarian` | Doctor | `roleId=veterinarian` |
| `pet_groomer` | Groomer | `roleId=pet_groomer` |
| `pet_trainer` | Trainer | `roleId=pet_trainer` |
| `dog_walker` | Walker | `roleId=dog_walker` |

### ✅ Service Style Filtering

- `at_center` → Clinic/center-based services
- `at_home` → Home visit services  
- `tele` → Teleconsultation services

Staff will only appear if they have at least one service matching the requested `serviceStyle`.

---

## Debugging

### Check if doctor appears:

**1. Call debug endpoint:**
```
GET /debug/doctors/find?name=Nimish
```

**2. Check console logs when searching:**
```
🔍 ═══════════ UNIVERSAL STAFF SEARCH ═══════════
📊 Total vendors in database: 50
📊 Filtered vendors: 10

   ┌─────────────────────────────────────────────────────────
   │ 🏥 Cura Pet Hospital
   │    ID: vendor_9880826240
   │    Role: pet_clinic
   │    Staff Array: 3 members → [staff_9611377119, ...]
   │    ✅ Dr. Nimish Jain - Active
   │       └─ Services: 5
   │       └─ ✅ INCLUDED in results
   └─────────────────────────────────────────────────────────
```

### Common Issues:

❌ **Staff not in vendor array** → Run migration or recreate staff
❌ **Vendor ID mismatch** → staff.vendorId ≠ vendor.id
❌ **Staff inactive** → staff.isActive = false
❌ **No services** → No services assigned to staff or vendor
❌ **Wrong role filter** → Using `pet_clinic` instead of `veterinarian`

---

## Migration Notes

If doctors are missing, check:

1. **Staff record exists:** `staff:{staffId}`
2. **In vendor array:** `vendor:{vendorId}:staff` includes staffId
3. **Vendor ID matches:** staff.vendorId === vendor.id
4. **Staff is active:** staff.isActive === true
5. **Has services:** Either staff services OR vendor services exist

Use `/debug/doctors/investigation` to see complete system state.

---

## Frontend Integration

### Example: Load Veterinarians for Booking

```typescript
const loadVets = async () => {
  const response = await fetch(
    `${API_BASE}/customer/staff/search?roleId=veterinarian&serviceStyle=at_center`,
    {
      headers: { 'Authorization': `Bearer ${publicAnonKey}` }
    }
  );
  
  const data = await response.json();
  
  // data.staff contains all vets with their services
  data.staff.forEach(vet => {
    console.log(`${vet.fullName} has ${vet.serviceCount} services`);
    console.log('Services:', vet.services);
  });
};
```

### Example: Filter by Service Style

```typescript
// Get only doctors who do home visits
const response = await fetch(
  `${API_BASE}/customer/staff/search?roleId=veterinarian&serviceStyle=at_home`
);

// Get only groomers who work at centers
const response = await fetch(
  `${API_BASE}/customer/staff/search?roleId=pet_groomer&serviceStyle=at_center`
);
```

---

## Performance Considerations

- **Pagination**: Use `limit` and `offset` for large result sets
- **Caching**: Consider caching staff lists on client side (5-10 minutes)
- **Service Style**: Pre-filter by serviceStyle to reduce data transfer
- **Lazy Loading**: Load services only when user selects a staff member

---

## Next Steps

1. **Frontend Migration**: Update all components to use new universal endpoint
2. **Service Assignment**: Ensure all staff have services assigned
3. **Testing**: Test across all vendor types (vets, groomers, trainers)
4. **Monitoring**: Track search performance and result accuracy
