# 🧪 Problem Grid System - Complete Testing Guide

## 📋 Overview
This guide provides comprehensive end-to-end testing instructions for the Universal Problem Grid System in Warmpawz.

---

## ✅ System Components

### 1. **Backend Files**
- `/supabase/functions/server/problem-grid-catalog.tsx` - Problem definitions for all 6 vendor types
- `/supabase/functions/server/problem-subcategory-mapping.tsx` - Maps problems to service subcategories
- `/supabase/functions/server/problem-grid-vendor-matcher.tsx` - Vendor filtering logic
- `/supabase/functions/server/problem-grid-test.tsx` - Testing & validation endpoints
- `/supabase/functions/server/problem-grid-vendor-guide.tsx` - Vendor guidance endpoints

### 2. **Frontend Components**
- `/components/customer/ProblemGridSelector.tsx` - Full problem grid view
- `/components/customer/VendorDiscoveryByProblem.tsx` - Vendor discovery by problem
- **6 Service Landing Pages** with embedded problem grids
- **6 Service Routers** with problem grid navigation

### 3. **API Endpoints**
| Endpoint | Purpose |
|----------|---------|
| `GET /customer/problem-grid/:roleId` | Get all problems for a vendor type |
| `GET /customer/problem/:problemId` | Get vendor discovery for a problem |
| `GET /test/problem-grid/validate-catalog` | Validate problem catalog |
| `GET /test/problem-grid/test-matching/:roleId/:problemId` | Test matching logic |
| `GET /test/problem-grid/validate-custom-services` | Check custom services |
| `GET /test/problem-grid/e2e/:roleId` | End-to-end flow test |
| `GET /test/problem-grid/valid-subcategories/:roleId` | Get valid subcategory names |
| `GET /vendor/guide/subcategories/:roleId` | Vendor guide for subcategories |
| `GET /vendor/guide/problems/:roleId` | Show how customers search |

---

## 🧪 Testing Procedures

### **TEST 1: Validate Problem Catalog**

**Purpose:** Ensure all problems are properly defined with mappings.

**How to Test:**
```bash
curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475/test/problem-grid/validate-catalog \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**Expected Result:**
```json
{
  "success": true,
  "report": {
    "summary": {
      "totalVendorTypes": 6,
      "totalProblems": 36,
      "issuesFound": 0
    },
    "vendorTypes": {
      "veterinary": { "problemCount": 9, "issues": [] },
      "grooming": { "problemCount": 6, "issues": [] },
      "training": { "problemCount": 6, "issues": [] },
      "walking": { "problemCount": 5, "issues": [] },
      "behavioral": { "problemCount": 5, "issues": [] },
      "boarding": { "problemCount": 5, "issues": [] }
    }
  }
}
```

**✅ Pass Criteria:** `issuesFound: 0`

---

### **TEST 2: Test Problem-to-Service Matching**

**Purpose:** Verify that problems correctly match to services in the database.

**Test Cases:**

#### Veterinary - Surgery Problem
```bash
curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475/test/problem-grid/test-matching/veterinarian/surgery \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

#### Grooming - Full Grooming Problem
```bash
curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475/test/problem-grid/test-matching/groomer/full_grooming \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

#### Training - Basic Obedience Problem
```bash
curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475/test/problem-grid/test-matching/pet_trainer/basic_obedience \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**Expected Result Structure:**
```json
{
  "success": true,
  "test": {
    "problemId": "surgery",
    "problem": {
      "displayName": "Surgery & Procedures",
      "mappedSubCategories": ["sub_surgical_services"]
    },
    "matchingServices": {
      "count": 15,
      "samples": [...]
    },
    "matchingVendors": {
      "count": 8,
      "vendors": [...]
    }
  }
}
```

**✅ Pass Criteria:** 
- `matchingServices.count > 0`
- `matchingVendors.count > 0`

---

### **TEST 3: End-to-End Flow Tests**

**Purpose:** Test complete customer journey for each vendor type.

```bash
# Test all vendor types
for role in veterinarian groomer pet_trainer pet_walker behaviourist pet_boarder; do
  echo "Testing $role..."
  curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475/test/problem-grid/e2e/$role \
    -H "Authorization: Bearer YOUR_ANON_KEY"
done
```

**Expected Result:**
```json
{
  "success": true,
  "roleId": "veterinarian",
  "problemsTestedCount": 3,
  "testResults": [
    {
      "problemId": "surgery",
      "problemName": "Surgery & Procedures",
      "servicesMatched": 15,
      "vendorsMatched": 8,
      "status": "PASS ✅"
    }
  ],
  "summary": {
    "passing": 3,
    "warnings": 0
  }
}
```

**✅ Pass Criteria:**
- All tested problems have `status: "PASS ✅"`
- `vendorsMatched > 0` for each problem

---

### **TEST 4: Validate Custom Services**

**Purpose:** Check if vendor-created custom services have proper subcategory names.

```bash
curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475/test/problem-grid/validate-custom-services \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**Expected Result:**
```json
{
  "success": true,
  "report": {
    "totalCustomServices": 25,
    "validServices": 23,
    "invalidServices": 2,
    "servicesWithoutSubcategory": 0,
    "issues": [
      {
        "serviceId": "CS123",
        "serviceName": "Custom Bath",
        "issue": "Invalid subCategoryName - not in mapping catalog"
      }
    ]
  }
}
```

**✅ Pass Criteria:**
- `invalidServices` should be minimal
- Review and fix any issues listed

---

### **TEST 5: Frontend Navigation Tests**

**Purpose:** Verify that all navigation flows work correctly.

#### Test Veterinary Services
1. Open customer app
2. Navigate to "Veterinary Services"
3. Click on "Surgery & Procedures" in problem grid
4. Verify: Shows list of veterinarians with surgical services
5. Click "View All" button
6. Verify: Shows full problem grid with all 9 health problems
7. Select another problem
8. Verify: Shows filtered vendors

#### Test Grooming Services
1. Navigate to "Grooming Services"
2. Click on "Complete Grooming"
3. Verify: Shows groomers offering full grooming
4. Navigate back and try other problems

#### Test Training Services
1. Navigate to "Training Services"
2. Click on "Behavioral Problems" (Aggression)
3. Verify: Shows trainers specializing in behavioral modification
4. Test "View All" button
5. Verify: ProblemGridSelector opens with all 6 training goals

#### Test Walking Services (NEW)
1. Navigate to "Walking Services"
2. Click on "Regular Walking"
3. Verify: Shows available walkers
4. Test problem grid navigation

#### Test Boarding Services
1. Navigate to "Boarding Services"
2. Click on "Weekend Boarding"
3. Verify: Shows boarding facilities
4. Test full problem grid

#### Test Behavioral Services (NEW)
1. Navigate to "Behavioral Services"
2. Click on "Anxiety & Stress"
3. Verify: Shows behaviorists
4. Test navigation flow

**✅ Pass Criteria for each:**
- Problem grid displays correctly
- Clicking problems navigates to vendor discovery
- Vendors shown match the selected problem
- Back button works correctly
- "View All" opens full problem grid

---

## 🔧 Fixing Issues

### Issue: No Vendors Found for a Problem

**Diagnosis:**
```bash
curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475/test/problem-grid/test-matching/:roleId/:problemId
```

**Common Causes:**
1. **No services match the subcategories** - Check if services exist with correct subCategoryName
2. **Vendors don't have published services** - Check vendor_services data
3. **Role ID mismatch** - Verify vendor roleId matches service applicableRoles

**Fix:**
- Use `/test/problem-grid/valid-subcategories/:roleId` to see correct names
- Ensure services use exact subcategory names from catalog

### Issue: Custom Services Not Appearing

**Diagnosis:**
```bash
curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475/test/problem-grid/validate-custom-services
```

**Common Causes:**
1. **Wrong subCategoryName** - Must match exactly
2. **Service not enabled** - Check isEnabled flag
3. **Service not published** - Check publishStatus

**Fix for Vendors:**
1. Get valid subcategory names:
```bash
curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475/vendor/guide/subcategories/:roleId
```

2. Update service with correct subCategoryName
3. Ensure service is enabled and published

---

## 📊 Vendor Guide Usage

### For Vendors Creating Custom Services

**Step 1: Check What Subcategories to Use**
```bash
curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475/vendor/guide/subcategories/veterinarian \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**Response:**
```json
{
  "success": true,
  "guide": {
    "subcategories": [
      {
        "id": "sub_surgical_services",
        "primaryName": "4. Surgical Services",
        "useThisExactly": "4. Surgical Services",
        "exampleUsage": "When creating a service, set: subCategoryName: \"4. Surgical Services\""
      }
    ]
  },
  "instructions": {
    "step1": "When creating a custom service, you MUST set a subCategoryName",
    "step2": "Use EXACTLY one of the 'primaryName' values",
    "step3": "This ensures your service appears in customer problem-based searches",
    "important": "Spelling and capitalization must match exactly!"
  }
}
```

**Step 2: Create Service with Correct subCategoryName**
```javascript
const newService = {
  serviceName: "Advanced Orthopedic Surgery",
  description: "...",
  subCategoryName: "4. Surgical Services", // ⭐ Use exact name from guide
  price: 15000,
  duration: 120,
  // ... other fields
};
```

---

## ✅ Complete Test Checklist

### Backend Tests
- [ ] ✅ Validate problem catalog (TEST 1)
- [ ] ✅ Test veterinary problem matching (TEST 2)
- [ ] ✅ Test grooming problem matching (TEST 2)
- [ ] ✅ Test training problem matching (TEST 2)
- [ ] ✅ Test walking problem matching (TEST 2)
- [ ] ✅ Test behavioral problem matching (TEST 2)
- [ ] ✅ Test boarding problem matching (TEST 2)
- [ ] ✅ Run E2E for veterinarian (TEST 3)
- [ ] ✅ Run E2E for groomer (TEST 3)
- [ ] ✅ Run E2E for pet_trainer (TEST 3)
- [ ] ✅ Run E2E for pet_walker (TEST 3)
- [ ] ✅ Run E2E for behaviourist (TEST 3)
- [ ] ✅ Run E2E for pet_boarder (TEST 3)
- [ ] ✅ Validate custom services (TEST 4)

### Frontend Tests
- [ ] ✅ Test Veterinary Services navigation (TEST 5)
- [ ] ✅ Test Grooming Services navigation (TEST 5)
- [ ] ✅ Test Training Services navigation (TEST 5)
- [ ] ✅ Test Walking Services navigation (TEST 5)
- [ ] ✅ Test Boarding Services navigation (TEST 5)
- [ ] ✅ Test Behavioral Services navigation (TEST 5)

### Integration Tests
- [ ] ✅ Create custom service with correct subcategory
- [ ] ✅ Verify custom service appears in problem search
- [ ] ✅ Test booking flow from problem grid
- [ ] ✅ Test "View All" problem grid selector
- [ ] ✅ Test back navigation from all screens
- [ ] ✅ Test with different customer accounts
- [ ] ✅ Test with vendors of different roles

---

## 🎯 Success Criteria

The system is **fully operational** when:

1. ✅ All catalog validation tests pass (0 issues)
2. ✅ All E2E tests show "PASS ✅" status
3. ✅ Each problem returns at least 1 matching vendor
4. ✅ All 6 service landing pages show problem grids
5. ✅ Problem grid navigation works in all routers
6. ✅ Custom services with correct subcategories appear in searches
7. ✅ No frontend console errors during navigation
8. ✅ Booking flow works from problem grid discovery

---

## 🚀 Quick Smoke Test

Run this quick test to verify everything works:

```bash
#!/bin/bash

BASE_URL="https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475"
AUTH="Authorization: Bearer YOUR_ANON_KEY"

echo "🧪 Running Problem Grid Smoke Test..."

# Test 1: Validate catalog
echo "\n✓ Testing catalog validation..."
curl -s "$BASE_URL/test/problem-grid/validate-catalog" -H "$AUTH" | jq '.report.summary.issuesFound'

# Test 2: Test one problem from each vendor type
echo "\n✓ Testing veterinary surgery..."
curl -s "$BASE_URL/test/problem-grid/test-matching/veterinarian/surgery" -H "$AUTH" | jq '.test.matchingVendors.count'

echo "\n✓ Testing grooming full service..."
curl -s "$BASE_URL/test/problem-grid/test-matching/groomer/full_grooming" -H "$AUTH" | jq '.test.matchingVendors.count'

echo "\n✓ Testing training obedience..."
curl -s "$BASE_URL/test/problem-grid/test-matching/pet_trainer/basic_obedience" -H "$AUTH" | jq '.test.matchingVendors.count'

echo "\n✅ Smoke test complete!"
```

---

## 📞 Support

If tests fail or issues arise:

1. Check the console logs in browser devtools
2. Review backend logs for error messages
3. Use test endpoints to diagnose specific issues
4. Verify vendor services have correct subcategory names
5. Ensure services are enabled and published

**Test endpoints are production-safe** - they only read data, never modify anything.
