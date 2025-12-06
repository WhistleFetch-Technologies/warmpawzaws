# 🧪 PROBLEM GRID SEARCH - TESTING GUIDE

## What Was Implemented

The **Universal Staff Problem Search** system allows customers to find service providers (vets, groomers, trainers, etc.) based on specific problem categories. This creates an intelligent discovery experience where customers can find specialists for their exact needs.

### Key Features:
1. ✅ **Universal Role Support** - Works for all 6 vendor types (vet, groomer, trainer, walker, behaviourist, boarding)
2. ✅ **Problem-Based Discovery** - Customers search by problem, not by service names
3. ✅ **Specialization Matching** - Matches staff based on their configured specializations
4. ✅ **Service Validation** - Only shows staff with active published services
5. ✅ **Dual Response Format** - Returns both individual staff AND their parent clinics/centers
6. ✅ **Location-Based** - Supports radius-based search with distance sorting

---

## API Endpoints

### 1. Main Search Endpoint
```
GET /customer/staff-by-problem/:roleId/:problemId
```

**Parameters:**
- `roleId` - Vendor role (veterinarian, groomer, trainer, dog_walker, behaviourist, boarding)
- `problemId` - Problem category ID from problem grid
- `lat`, `lng` - Optional location coordinates
- `radius` - Optional search radius in km (default: 50)
- `limit` - Optional max results (default: 20)
- `offset` - Optional pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "problem": { "id": "cardiology", "name": "Cardiology", ... },
  "staff": [...],        // Individual staff members
  "clinics": [...],      // Parent clinics/centers
  "total": 5,
  "breakdown": {
    "totalStaff": 5,
    "totalClinics": 3
  }
}
```

### 2. Diagnostic Endpoint (Specializations)
```
GET /admin/diagnostic/staff-specializations/:roleId?withServices=true
```

Shows all staff for a role with their specialization configuration.

### 3. Problem Search Diagnostic
```
GET /admin/diagnostic/problem-search/:roleId/:problemId
```

Step-by-step analysis of why a problem search may not be returning results.

---

## Testing Steps

### STEP 1: Run the Comprehensive Diagnostic

This checks if the problem search will work before running the actual search.

```bash
curl -X GET \
  "https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475/admin/diagnostic/problem-search/veterinarian/cardiology" \
  -H "Authorization: Bearer YOUR_ANON_KEY" | jq '.'
```

**What to check:**
- ✅ All 5 steps should pass
- ✅ `summary.status` should be "SUCCESS"
- ✅ `summary.expectedResults` should be > 0

**If any step fails, the diagnostic will tell you:**
- What's missing (vendors, staff, services, specializations)
- Exact recommendations on how to fix it
- Sample data showing the current state

---

### STEP 2: Check Staff Specializations

See which staff have specializations configured.

```bash
curl -X GET \
  "https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475/admin/diagnostic/staff-specializations/veterinarian?withServices=true" \
  -H "Authorization: Bearer YOUR_ANON_KEY" | jq '.'
```

**Key metrics:**
- `statistics.totalStaff` - Total staff count
- `statistics.withServices` - Staff with active published services
- `statistics.matchingAtLeastOneProblem` - Staff that will appear in searches

**If `matchingAtLeastOneProblem` is 0:**
- Staff don't have specializations set
- Or specializations don't match problem grid subcategories

---

### STEP 3: Run the Actual Problem Search

Search for cardiologists:

```bash
curl -X GET \
  "https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475/customer/staff-by-problem/veterinarian/cardiology?lat=28.6139&lng=77.2090&radius=50" \
  -H "Authorization: Bearer YOUR_ANON_KEY" | jq '.'
```

**Expected results:**
```json
{
  "success": true,
  "staff": [
    {
      "id": "staff_xxx",
      "fullName": "Dr. Name",
      "specialization": "sub_specialty_services",
      "specializations": ["sub_specialty_services", "sub_diagnostics"],
      "clinicName": "Clinic Name",
      "consultationFee": 500,
      "services": [...],
      "serviceCount": 5,
      "rating": 4.5,
      "distance": 2.3
    }
  ],
  "clinics": [
    {
      "id": "vendor_xxx",
      "name": "Clinic Name",
      "matchingStaffCount": 2,
      "serviceCount": 15,
      "doctors": [...]
    }
  ],
  "total": 5
}
```

---

## Problem Categories by Role

### Veterinarian
- `surgery` - Surgery & Procedures
- `cardiology` - Heart & Cardiovascular
- `dermatology` - Skin & Coat Care
- `dentistry` - Dental Care
- `ophthalmology` - Eye Care
- `neurology` - Neurological Care
- `medicine` - General Health
- `emergency` - Emergency Care
- `physiotherapy` - Physical Therapy

### Groomer
- `full_grooming` - Complete Grooming
- `bath_only` - Bath & Brush
- `haircut_styling` - Haircut & Styling
- `nail_care` - Nail Trimming
- `deshedding` - De-shedding
- `spa_treatment` - Spa & Wellness

### Trainer
- `obedience_training` - Basic Obedience
- `puppy_training` - Puppy Training
- `advanced_training` - Advanced Commands
- `agility_training` - Agility Training
- `protection_training` - Protection Training

### Dog Walker
- `active_walk` - Active/Exercise Walk
- `leisurely_walk` - Leisurely Walk
- `puppy_walk` - Puppy Walking
- `group_walk` - Group Walking

### Behaviourist
- `separation_anxiety` - Separation Anxiety
- `aggression` - Aggression Issues
- `fear_phobia` - Fear & Phobias
- `potty_training` - Potty Training Issues

### Boarding
- `short_stay` - Short Stay (1-3 days)
- `long_stay` - Long Stay (Weekly/Monthly)
- `daycare` - Daycare Services
- `luxury_boarding` - Luxury Boarding

---

## Specialization Configuration

### How Specializations Work

Staff specializations map to **service subcategories**. The problem grid then maps problems to these subcategories.

**Example for Cardiology:**
- Problem: `cardiology` (Heart & Cardiovascular)
- Maps to subcategories: `sub_specialty_services`, `sub_diagnostics`
- Staff with these specializations will match

### Supported Formats

Staff can have specializations in two formats:

**1. Array format (recommended):**
```json
{
  "specializations": ["sub_specialty_services", "sub_diagnostics"]
}
```

**2. String format (legacy):**
```json
{
  "specialization": "Heart & Cardiovascular"
}
```

### Setting Specializations

```bash
curl -X POST \
  "https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475/admin/staff/STAFF_ID/specializations" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "specializations": ["sub_specialty_services", "sub_diagnostics"]
  }'
```

### Valid Specialization IDs

**For Veterinarians:**
- `sub_preventive_wellness` - Preventive & Wellness Care
- `sub_diagnostics` - Diagnostics
- `sub_medical_treatment` - Medical Treatment
- `sub_surgical_services` - Surgical Services
- `sub_specialty_services` - Specialty Services (cardiology, dermatology, etc.)
- `sub_emergency_critical` - Emergency & Critical Care
- `sub_vet_home` - Home Visit Services
- `sub_teleconsult` - Tele-consultation

**Display Name Aliases (also work):**
- `Heart & Cardiovascular` → matches `sub_specialty_services`
- `Cardiology` → matches `sub_specialty_services`
- `Surgery & Procedures` → matches `sub_surgical_services`
- `Dermatology` → matches `sub_specialty_services`
- `Skin & Coat Care` → matches `sub_specialty_services`
- And more... (see `/supabase/functions/server/problem-subcategory-mapping.tsx`)

---

## Troubleshooting

### Issue: Search returns empty results

**Run the diagnostic:**
```bash
curl -X GET \
  "https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475/admin/diagnostic/problem-search/veterinarian/cardiology" \
  -H "Authorization: Bearer YOUR_ANON_KEY" | jq '.issues'
```

The diagnostic will tell you exactly what's wrong:
- No approved vendors
- No active staff
- No published services
- No matching specializations

### Issue: Staff have specializations but still don't match

**Check the mapping:**
```bash
# Get the problem details
curl -X GET \
  "https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475/customer/staff-by-problem/veterinarian/cardiology" \
  -H "Authorization: Bearer YOUR_ANON_KEY" | jq '.problem.mappedSubCategories'
```

Make sure staff specializations include at least one of these subcategories.

### Issue: Staff don't have services

**Check service configuration:**
```bash
curl -X GET \
  "https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475/vendor/services?vendorId=VENDOR_ID&staffId=STAFF_ID" \
  -H "Authorization: Bearer YOUR_ANON_KEY" | jq '.'
```

Services must have:
- `isEnabled: true` or `isActive: true`
- `publishStatus: "published"` or `"auto_published"`

---

## Quick Test Script

Run this to quickly verify everything works:

```bash
#!/bin/bash
export PROJECT_ID="YOUR_PROJECT_ID"
export ANON_KEY="YOUR_ANON_KEY"
export BASE_URL="https://${PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475"

# 1. Run diagnostic
echo "🔍 Running diagnostic..."
DIAG=$(curl -s "$BASE_URL/admin/diagnostic/problem-search/veterinarian/cardiology" \
  -H "Authorization: Bearer $ANON_KEY")

EXPECTED=$(echo "$DIAG" | jq -r '.summary.expectedResults // 0')
echo "Expected results: $EXPECTED"

if [ "$EXPECTED" -eq 0 ]; then
  echo "❌ FAIL: Diagnostic shows issues"
  echo "$DIAG" | jq '.issues'
  echo "$DIAG" | jq '.recommendations'
  exit 1
fi

# 2. Run actual search
echo "🔍 Running search..."
SEARCH=$(curl -s "$BASE_URL/customer/staff-by-problem/veterinarian/cardiology" \
  -H "Authorization: Bearer $ANON_KEY")

FOUND=$(echo "$SEARCH" | jq -r '.total // 0')
echo "Found: $FOUND staff"

if [ "$FOUND" -eq 0 ]; then
  echo "❌ FAIL: Search returned no results"
  exit 1
fi

if [ "$FOUND" -ne "$EXPECTED" ]; then
  echo "⚠️  WARNING: Expected $EXPECTED but found $FOUND"
fi

echo "✅ SUCCESS: Problem grid search is working!"
echo ""
echo "Staff found:"
echo "$SEARCH" | jq -r '.staff[] | "  • \(.fullName) at \(.clinicName)"'
```

---

## Implementation Details

### File Structure
- `/supabase/functions/server/universal-staff-problem-search.tsx` - Main search endpoint
- `/supabase/functions/server/problem-grid-catalog.tsx` - Problem definitions
- `/supabase/functions/server/problem-subcategory-mapping.tsx` - Subcategory name mappings
- `/supabase/functions/server/diagnostic-staff-specializations.tsx` - Specialization diagnostic
- `/supabase/functions/server/problem-search-diagnostic.tsx` - Search diagnostic

### Search Algorithm
1. Validate problem exists and get mapped subcategories
2. Find all approved active vendors for role
3. Get all active staff under these vendors
4. Filter staff with at least 1 active published service
5. Match staff specializations against problem's subcategories
6. Calculate distances and apply radius filter
7. Sort by distance (or rating if no location)
8. Paginate and return results

### Specialization Matching Logic
Supports multiple matching strategies:
- **Exact match**: `staff.specializations` includes subcategory ID
- **Array contains**: Any element in `staff.specializations` matches
- **String exact**: `staff.specialization` exactly matches display name
- **Partial match**: Normalized string matching for variations
- **Case-insensitive**: All matching is case-insensitive

---

## Next Steps

After testing:

1. ✅ Verify all staff have specializations set
2. ✅ Verify all staff have published services
3. ✅ Test all problem categories for your role
4. ✅ Test with real location coordinates
5. ✅ Test pagination with limit and offset
6. ✅ Integrate into customer mobile app

---

## Support

If you encounter issues:
1. Run the diagnostic endpoint first
2. Check the server logs for detailed information
3. Verify data using the diagnostic tools
4. Update specializations or services as needed

The diagnostic endpoints provide actionable recommendations for fixing any issues!
