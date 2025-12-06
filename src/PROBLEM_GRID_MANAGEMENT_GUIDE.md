# 🎯 Universal Problem Grid System - Complete Management Guide

## 📋 Table of Contents
1. [System Architecture Overview](#system-architecture-overview)
2. [Where Data Lives (KV Store Keys)](#where-data-lives)
3. [How to Add New Problem Categories](#how-to-add-new-problem-categories)
4. [How to Manage Services](#how-to-manage-services)
5. [How to Add Problem Grids to New Vendor Types](#how-to-add-problem-grids-to-new-vendor-types)
6. [Testing & Validation](#testing--validation)
7. [Troubleshooting Guide](#troubleshooting-guide)

---

## 🏗️ System Architecture Overview

### The Problem Grid System has 3 layers:

```
┌─────────────────────────────────────────────────────────┐
│  LAYER 1: PROBLEM GRID CATALOG                          │
│  /supabase/functions/server/problem-grid-catalog.tsx    │
│  • Defines problem categories for each vendor type      │
│  • Maps problems to service subcategories               │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  LAYER 2: SUBCATEGORY MAPPING                           │
│  /supabase/functions/server/problem-subcategory-        │
│  mapping.tsx                                             │
│  • Maps subcategory IDs to actual service names         │
│  • Supports multiple name variations                    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  LAYER 3: VENDOR MATCHER                                │
│  /supabase/functions/server/problem-grid-vendor-        │
│  matcher.tsx                                             │
│  • Finds vendors with matching services                 │
│  • Validates vendor eligibility                         │
└─────────────────────────────────────────────────────────┘
```

### Data Flow:
```
Customer selects problem 
    → System maps problem to subcategories
    → Finds services matching subcategories
    → Filters vendors who have those services enabled
    → Returns matching vendors to customer
```

---

## 📦 Where Data Lives (KV Store Keys)

### Service Catalog (Master Data)
```
service:${serviceId}
├── serviceName: "Basic Health Checkup"
├── categoryName: "Healthcare Service Providers"
├── subCategoryName: "1. Preventive & Wellness Care"
├── applicableRoles: ["veterinarian", "vet_clinic"]
├── price: 500
└── ...
```

### Vendor Services (New Structure - Recommended)
```
vendor_services:${vendorId}:at_home
vendor_services:${vendorId}:at_center
vendor_services:${vendorId}:tele
├── services: [
│   {
│     serviceId: "service:uuid",
│     serviceName: "Basic Health Checkup",
│     isEnabled: true,
│     publishStatus: "published",
│     customPrice: 600
│   }
│ ]
```

### Vendor Services (Legacy Structure - Still Supported)
```
vendor:${vendorId}:services
└── ["service:uuid-1", "service:uuid-2", ...]
```

### Vendor Profile
```
vendor:${vendorId}
├── roleId: "veterinarian"
├── status: "approved"
├── isActive: true
├── businessName: "Pet Care Clinic"
└── ...
```

---

## ➕ How to Add New Problem Categories

### Method 1: Via Code (Recommended for Initial Setup)

#### Step 1: Add to Problem Grid Catalog
**File:** `/supabase/functions/server/problem-grid-catalog.tsx`

```typescript
// Example: Adding a new vet health problem
export const vetHealthProblems = [
  // ... existing problems ...
  {
    id: 'orthopedics',                    // Unique ID (lowercase, underscores)
    name: 'Orthopedics',                  // Short name
    displayName: 'Bone & Joint Care',     // Customer-facing name
    icon: '🦴',                            // Emoji icon
    color: '#14B8A6',                     // Hex color
    gradient: 'from-teal-500 to-teal-600', // Tailwind gradient
    description: 'Bone fractures, joint problems, orthopedic surgeries',
    keywords: ['bone', 'fracture', 'joint', 'orthopedic', 'limb'],
    mappedSubCategories: [                // CRITICAL: Maps to service subcategories
      'sub_surgical_services',
      'sub_specialty_services'
    ],
    order: 10                             // Display order
  }
];
```

#### Step 2: Update Role Mapping
In the same file, update `getProblemGridByRole()`:

```typescript
export function getProblemGridByRole(roleId: string): any[] {
  const roleMapping: Record<string, any[]> = {
    // Veterinary - all variations supported
    'veterinarian': vetHealthProblems,
    'role_veterinarian': vetHealthProblems,
    'vet_clinic': vetHealthProblems,
    // ... (system handles variations automatically)
  };
  
  return roleMapping[roleId] || [];
}
```

#### Step 3: Add Subcategory Mapping (If New)
**File:** `/supabase/functions/server/problem-subcategory-mapping.tsx`

```typescript
export const subcategoryIdToNames: Record<string, string[]> = {
  // ... existing mappings ...
  
  'sub_orthopedics': [                   // NEW SUBCATEGORY
    'Orthopedic Services',
    'Bone & Joint Care',
    'Orthopedics',
    'Fracture Treatment'                 // Add all variations
  ],
};
```

#### Step 4: Deploy Changes
```bash
# Changes are automatically deployed since server is in Deno
# No manual deployment needed!
```

---

### Method 2: Via Admin UI (Coming Soon)

**Note:** While there's a Health Problem Management endpoint (`/admin/health-problems`), it's designed for a different legacy system. For Problem Grids, you must use the code-based approach above.

---

## 🛠️ How to Manage Services

### Creating Services in Service Catalog

#### Option 1: Via Admin Dashboard
1. **Go to:** Admin Dashboard → Service Catalog → Service Catalog Tab
2. **Click:** "Create New Service"
3. **Fill in:**
   - **Service Name:** "Orthopedic Consultation"
   - **Category:** "Healthcare Service Providers"
   - **Sub Category:** "5. Specialty Vet Services"
   - **Applicable Roles:** Select "Veterinarian", "Vet Clinic"
   - **Price:** 800
   - **Service Style:** Check applicable (At Home, At Center, Tele)
   - **Description:** Full description
4. **Save**

#### Option 2: Via Catalog Seed
**File:** `/supabase/functions/server/catalog-seed-data-v2.tsx`

```typescript
{
  id: generateId('service'),
  serviceName: 'Orthopedic Consultation',
  categoryName: 'Healthcare Service Providers',
  subCategoryName: '5. Specialty Vet Services',
  applicableRoles: ['veterinarian', 'vet_clinic'],
  serviceStyle: ['at_center', 'at_home'],
  price: 800,
  duration: 45,
  description: 'Specialized consultation for bone and joint problems',
  status: 'active'
}
```

### How Vendors Enable Services

#### Vendor Flow:
1. **Vendor logs in** → Dashboard → "Service Management"
2. **Views available services** filtered by their `roleId`
3. **Selects services** they want to offer
4. **Sets custom pricing** (optional)
5. **Publishes services** (status: `published`)
6. **System stores** in: `vendor_services:${vendorId}:${serviceStyle}`

#### What Makes a Vendor Show Up in Problem Grid Search:

✅ **Required Conditions:**
1. Vendor `roleId` matches service `applicableRoles`
2. Vendor `status` = "approved"
3. Vendor `isActive` = true
4. Vendor has enabled the matching service
5. Service `publishStatus` = "published" or "auto_published"
6. Service `isEnabled` = true

---

## 🎨 How to Add Problem Grids to New Vendor Types

### Example: Adding Problem Grid for "Pet Cafe"

#### Step 1: Define Problem Categories
**File:** `/supabase/functions/server/problem-grid-catalog.tsx`

```typescript
/**
 * PET CAFE NEEDS
 * Maps to Pet Cafe service subcategories
 */
export const petCafeNeeds = [
  {
    id: 'playtime',
    name: 'Playtime & Socialization',
    displayName: 'Social Play',
    icon: '🎾',
    color: '#F59E0B',
    gradient: 'from-amber-500 to-amber-600',
    description: 'Interactive play sessions with other pets',
    keywords: ['play', 'social', 'interaction', 'fun'],
    mappedSubCategories: ['sub_cafe_play'],
    order: 1
  },
  {
    id: 'cafe_boarding',
    name: 'Daycare Cafe',
    displayName: 'Day Boarding',
    icon: '☕',
    color: '#8B5CF6',
    gradient: 'from-purple-500 to-purple-600',
    description: 'Day-time care in cafe environment',
    keywords: ['daycare', 'cafe', 'boarding', 'supervision'],
    mappedSubCategories: ['sub_cafe_daycare'],
    order: 2
  }
  // ... add more
];
```

#### Step 2: Add to Role Mapping
```typescript
export function getProblemGridByRole(roleId: string): any[] {
  const roleMapping: Record<string, any[]> = {
    // ... existing mappings ...
    
    // ✅ PET CAFE - All variations
    'pet_cafe': petCafeNeeds,
    'role_pet_cafe': petCafeNeeds,
    'cafe': petCafeNeeds,
    'role_cafe': petCafeNeeds,
  };
  
  return roleMapping[roleId] || [];
}

export function getAllProblemGrids() {
  return {
    veterinary: vetHealthProblems,
    grooming: groomingNeeds,
    training: trainingGoals,
    walking: walkingNeeds,
    behavioral: behavioralIssues,
    boarding: boardingNeeds,
    petCafe: petCafeNeeds,  // ✅ ADD HERE
  };
}
```

#### Step 3: Create Subcategory Mappings
**File:** `/supabase/functions/server/problem-subcategory-mapping.tsx`

```typescript
export const subcategoryIdToNames: Record<string, string[]> = {
  // ... existing mappings ...
  
  // ============================================
  // PET CAFE SUBCATEGORIES
  // ============================================
  'sub_cafe_play': [
    '1. Play & Socialization',
    'Play Services',
    'Social Play',
    'Interactive Play'
  ],
  'sub_cafe_daycare': [
    '2. Cafe Daycare',
    'Daycare Services',
    'Day Boarding',
    'Cafe Stay'
  ],
};
```

#### Step 4: Add Role Subcategories
In the same file:

```typescript
export function getSubcategoriesForVendorType(roleId: string): string[] {
  const roleSubcategories: Record<string, string[]> = {
    // ... existing mappings ...
    
    // Pet Cafe
    'pet_cafe': ['sub_cafe_play', 'sub_cafe_daycare'],
    'cafe': ['sub_cafe_play', 'sub_cafe_daycare'],
  };
  
  const cleanRoleId = roleId.replace('role_', '');
  return roleSubcategories[roleId] || roleSubcategories[cleanRoleId] || [];
}
```

#### Step 5: Create Services in Catalog
Add services to the service catalog that match these subcategories:

```typescript
// In catalog seed or via Admin UI
{
  serviceName: 'Interactive Play Session',
  categoryName: 'Pet Cafe Services',
  subCategoryName: '1. Play & Socialization',
  applicableRoles: ['pet_cafe'],
  price: 300,
  duration: 60
}
```

#### Step 6: Test the Integration
Use the Admin Problem Category Mapper (see Testing section below)

---

## 🧪 Testing & Validation

### Using the Problem Category Mapper

#### Access:
Admin Dashboard → (Add to menu or direct URL)

Or via browser console:
```javascript
// Navigate to mapper
window.location.href = '/admin#problem-mapper';
```

#### How to Test:

1. **Select Vendor Type** (left sidebar)
   - Click on the vendor type (e.g., "Veterinarian")
   - System loads problem grid for that type

2. **View Problem Categories**
   - See all problems with their mappings
   - Green checkmark ✅ = has mappings
   - Red X ❌ = no mappings

3. **Test Individual Problems**
   - Click "Test Mapping" on any problem
   - System shows:
     - Matched subcategories
     - Total services found
     - Total vendors found
     - Sample services and vendors

4. **Check Console Logs** (F12)
   - Detailed breakdown of matching logic
   - Diagnostic information if no vendors found
   - Service and vendor role validation

#### What to Look For:

✅ **Successful Test:**
```
📊 Filtering Results:
   Total vendors checked: 50
   Role matches: 20
   Approved & active: 15
   With matching published services: 12
```

❌ **Problem Indicators:**
```
⚠️ NO VENDORS FOUND despite 10 matching services!
🔍 Check:
   1. Do vendors have correct roleId?
   2. Are vendors approved?
   3. Do service applicableRoles match vendor roleId?
```

---

## 🔧 Troubleshooting Guide

### Problem: No Vendors Found

#### Diagnostic Checklist:

**1. Check Service Subcategory Mapping**
```typescript
// In problem-grid-catalog.tsx
{
  id: 'surgery',
  mappedSubCategories: ['sub_surgical_services'], // ← Must match service subCategoryName
}
```

**2. Check Service Catalog**
```sql
-- Check if service exists with correct subcategory
service:${id}
{
  subCategoryName: '4. Surgical Services',  // ← Must match mapping variation
  applicableRoles: ['veterinarian'],        // ← Must match vendor roleId
}
```

**3. Check Vendor Role**
```sql
vendor:${id}
{
  roleId: 'veterinarian',  // ← Must match service applicableRoles
  status: 'approved',      // ← Must be approved
  isActive: true           // ← Must be active
}
```

**4. Check Vendor Services**
```sql
-- New structure
vendor_services:${vendorId}:at_center
{
  services: [
    {
      serviceId: 'service:uuid',
      isEnabled: true,           // ← Must be true
      publishStatus: 'published' // ← Must be published
    }
  ]
}

-- OR Legacy structure
vendor:${vendorId}:services
['service:uuid-1', 'service:uuid-2']  // ← Must contain matching service ID
```

---

### Problem: Wrong Vendors Showing Up

**Cause:** Service `applicableRoles` too broad

**Fix:**
```typescript
// In service catalog
{
  serviceName: 'Surgical Procedure',
  applicableRoles: ['veterinarian', 'vet_clinic'],  // ← Be specific
  // DON'T use: ['all'] or overly broad roles
}
```

---

### Problem: Subcategory Not Matching

**Cause:** Name variation not in mapping

**Fix in `problem-subcategory-mapping.tsx`:**
```typescript
'sub_surgical_services': [
  '4. Surgical Services',      // ← Original
  'Surgical Services',          // ← Without number
  'Surgery & Procedures',       // ← Alternative
  'Surgery',                    // ← Short form
  'Surgical Procedures',        // ← ADD YOUR VARIATION HERE
],
```

---

### Problem: Console Showing 500 Error

**Check these endpoints:**
1. `/customer/problem-grid/${vendorType}` - Returns problem categories
2. `/customer/discover-by-problem/${vendorType}/${problemId}` - Returns vendors

**Common Causes:**
- Undefined `vendorType`
- Invalid `problemId`
- Missing problem in catalog

**Fix:** Add validation in backend:
```typescript
// Already implemented in health-problem-endpoints.tsx
const problem = findProblemById(problemId);
if (!problem) {
  return c.json({ 
    success: false, 
    error: `Problem ${problemId} not found` 
  }, 404);
}
```

---

## 📝 Quick Reference: File Locations

```
Backend Files:
├── /supabase/functions/server/
│   ├── problem-grid-catalog.tsx          ← Problem definitions
│   ├── problem-subcategory-mapping.tsx   ← Subcategory mappings
│   ├── problem-grid-vendor-matcher.tsx   ← Vendor matching logic
│   ├── health-problem-endpoints.tsx      ← API endpoints
│   └── doctor-discovery-endpoints.tsx    ← Discovery endpoints

Frontend Files:
├── /components/admin/
│   └── ProblemCategoryMapper.tsx         ← Admin testing UI
├── /components/customer/
│   ├── ProblemGridSelector.tsx           ← Customer problem selector
│   └── VendorDiscoveryByProblem.tsx      ← Vendor discovery screen
```

---

## 🎯 Best Practices

### When Adding New Problems:
1. ✅ Use descriptive, customer-friendly names
2. ✅ Include relevant keywords for search
3. ✅ Map to specific subcategories (not too broad)
4. ✅ Test thoroughly with real vendor data
5. ✅ Use existing subcategories when possible

### When Creating Services:
1. ✅ Use consistent subcategory naming
2. ✅ Be specific with `applicableRoles`
3. ✅ Add service to catalog BEFORE expecting vendors to enable
4. ✅ Support multiple service styles (at_home, at_center, tele)

### When Onboarding Vendors:
1. ✅ Ensure correct `roleId` is set
2. ✅ Guide vendors to enable relevant services
3. ✅ Verify services are published, not just enabled
4. ✅ Test problem grid discovery after vendor setup

---

## 🚀 Quick Start Checklist

When adding a new problem grid for a vendor type:

- [ ] Define problem categories in `problem-grid-catalog.tsx`
- [ ] Add role mapping in `getProblemGridByRole()`
- [ ] Add to `getAllProblemGrids()`
- [ ] Create subcategory mappings in `problem-subcategory-mapping.tsx`
- [ ] Add role subcategories in `getSubcategoriesForVendorType()`
- [ ] Create matching services in service catalog
- [ ] Test using Problem Category Mapper
- [ ] Onboard test vendor and enable services
- [ ] Verify end-to-end customer discovery flow

---

## 💡 Pro Tips

1. **Use Console Logs:** The system has extensive logging. Check browser console (F12) when testing.

2. **Test Incrementally:** Don't create all problems at once. Add one, test, then add more.

3. **Leverage Variations:** The subcategory mapping supports multiple name variations. Use this for backward compatibility.

4. **Admin Tools:** Use the Problem Category Mapper in Admin Dashboard for quick testing.

5. **Vendor Perspective:** After setup, test from vendor side to ensure services are visible and can be enabled.

---

## 📞 Need Help?

If you encounter issues:

1. Check console logs (F12) for detailed error messages
2. Use Problem Category Mapper to diagnose
3. Verify all checklist items above
4. Check this guide's troubleshooting section
5. Review the example implementations in existing problem grids

---

**Last Updated:** January 2025  
**System Version:** Universal Problem Grid v2.0  
**Architecture:** 3-Layer with Triple Validation
