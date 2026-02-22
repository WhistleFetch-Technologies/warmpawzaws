# Duplicate Services Fix - Comprehensive Documentation

## Overview

This document provides a complete implementation guide for fixing the "Duplicate Services" bug that caused the same service to appear multiple times in customer-side API responses. This fix was implemented in production and needs to be verified/applied in UAT/dev environments.

**Objective**: Enable Cursor AI agents to understand, maintain, and re-implement this fix if needed in the future, especially for dev/UAT environments.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Root Cause Analysis](#root-cause-analysis)
3. [Solution: Correlated Subquery Pattern](#solution-correlated-subquery-pattern)
4. [All Implementation Locations](#all-implementation-locations)
5. [Before & After Code Comparison](#before--after-code-comparison)
6. [Database Schema Context](#database-schema-context)
7. [Testing & Verification](#testing--verification)
8. [Dev/UAT Implementation Guide](#devuat-implementation-guide)
9. [Troubleshooting Guide](#troubleshooting-guide)

---

## Problem Statement

### Symptom

**Customer-side API** (`/customer/services/by-style`) was returning the **same service multiple times** for a single vendor.

**Example**:
```json
{
  "providers": [
    {
      "vendorId": "73eb9a17-99ca-440e-ab50-6759be781729",
      "services": [
        {
          "id": "c66bb162-95e1-423d-8778-55dd486e9b39",
          "name": "Home Visit Consultation",
          "description": "Home Visit Consultation for diagnostics"
        },
        {
          "id": "c66bb162-95e1-423d-8778-55dd486e9b39",  // SAME ID
          "name": "Home Visit Consultation",              // SAME NAME
          "description": "Home Visit Consultation for Pet Sitter"  // Different description
        },
        {
          "id": "c66bb162-95e1-423d-8778-55dd486e9b39",  // SAME ID
          "name": "Home Visit Consultation",              // SAME NAME
          "description": "Home Visit Consultation for Pet Walker"  // Different description
        }
        // ... 11 more duplicates
      ]
    }
  ]
}
```

**Impact**:
- Customer sees the same service 14 times in the UI
- Confusing user experience
- Incorrect service counts
- Potential booking errors

---

## Root Cause Analysis

### The Problem: Cartesian Product from LEFT JOIN

**Root Cause**: A `LEFT JOIN service_catalog` was causing a **cartesian product** because `service_catalog` has **multiple rows per `service_name`** (one for each role - Veterinarian, Pet Sitter, Pet Walker, etc.).

### Why This Happened

#### Database Structure

**`vendor_services` table**:
- Has **1 row** per vendor service
- Example: `id = c66bb162`, `service_name = "Home Visit Consultation"`, `service_style = "at_home"`

**`service_catalog` table**:
- Has **multiple rows** per `service_name` because the same service exists for different roles
- Example: 14 rows for "Home Visit Consultation" with `service_style = "at_home"`:
  - Row 1: `applicable_roles = ["vet_solo", "veterinarian"]`, `description = "Home Visit Consultation for diagnostics"`
  - Row 2: `applicable_roles = ["pet_sitter"]`, `description = "Home Visit Consultation for Pet Sitter"`
  - Row 3: `applicable_roles = ["pet_walker"]`, `description = "Home Visit Consultation for Pet Walker"`
  - ... 11 more rows

#### The Problematic Query Pattern

**❌ BEFORE (Causes Duplicates)**:
```sql
SELECT 
  vs.id,
  vs.service_name,
  COALESCE(vs.custom_description, sc.description) as description
FROM vendor_services vs
LEFT JOIN service_catalog sc 
  ON sc.service_name = vs.service_name 
  AND sc.service_style = vs.service_style
WHERE vs.vendor_id = $1
```

**What Happens**:
1. `vendor_services` has 1 row: "Home Visit Consultation"
2. `service_catalog` has 14 rows matching `service_name = "Home Visit Consultation"` AND `service_style = "at_home"`
3. `LEFT JOIN` creates: **1 × 14 = 14 duplicate rows**
4. Each duplicate has a different `description` from `service_catalog`

**Result**: API returns the same service 14 times, each with a slightly different description.

---

## Solution: Two-Layer Fix

### Fix 1: Correlated Subquery Pattern (Prevents JOIN Duplicates)

Replace `LEFT JOIN service_catalog` with a **correlated subquery** in the `SELECT` clause:

**✅ AFTER (No Duplicates)**:
```sql
SELECT 
  vs.id,
  vs.service_name,
  COALESCE(
    vs.custom_description, 
    (SELECT sc.description 
     FROM service_catalog sc 
     WHERE sc.service_name = vs.service_name 
       AND sc.service_style = vs.service_style 
     LIMIT 1)
  ) as description
FROM vendor_services vs
WHERE vs.vendor_id = $1
```

### Why This Works

1. **Scalar Subquery**: Returns a **single value** (not a row set)
2. **Correlated**: Uses values from the outer query (`vs.service_name`, `vs.service_style`)
3. **LIMIT 1**: Ensures exactly one description is returned (even if multiple matches exist)
4. **No JOIN**: No cartesian product because it's not a JOIN operation

**Result**: Each `vendor_services` row appears **exactly once**, with one description.

### Fix 2: Application-Level Deduplication (Safety Net)

Even with the correlated subquery fix, the database may have **actual duplicate `vendor_services` rows** (same `service_name` but different IDs). To handle this, we added a **deduplication function** that filters duplicates at the application level.

**Location**: `service-discovery.ts` lines 536-552

**Implementation**:
```typescript
/** Deduplicate services array by service name + style (safety measure) */
function deduplicateServices(services: any[]): any[] {
  const seen = new Map<string, any>();
  for (const service of services) {
    // Use service_name + service_style as key (not ID, because database may have duplicate rows with different IDs)
    const serviceName = service.name || service.service_name || service.serviceName || '';
    const serviceStyle = service.serviceStyle || service.service_style || '';
    const key = `${serviceName}_${serviceStyle}`.toLowerCase().trim();
    
    if (key && !seen.has(key)) {
      seen.set(key, service);
    } else if (key && seen.has(key)) {
      // Duplicate found - log warning but keep first occurrence
      console.warn(`[Deduplication] Duplicate service detected: ${key} (ID: ${service.id || service.serviceId || 'unknown'}). Keeping first occurrence.`);
    } else if (!key) {
      // No key available - use ID as fallback
      const fallbackKey = service.id || service.serviceId || `unknown_${Math.random()}`;
      if (!seen.has(fallbackKey)) {
        seen.set(fallbackKey, service);
      }
    }
  }
  return Array.from(seen.values());
}
```

**Key Points**:
- Deduplicates by `service_name + service_style` (not ID)
- Handles cases where database has multiple `vendor_services` rows with same name
- Keeps first occurrence, logs warning for duplicates
- Applied to all service arrays before returning in API response

**Where Applied**:
- Individual provider services (line 5795)
- Staff provider services (line 6004)
- Vendor identity services (line 6153)
- Fallback vendor services (line 6420)
- At-center vendor services (line 5427)

---

## All Implementation Locations

### Location 1: Platform Services Fallback Query

**File**: `service-discovery.ts`  
**Line**: 853  
**Endpoint**: `GET /customer/services/platform` (fallback query)

**Before**:
```sql
-- Had LEFT JOIN service_catalog (removed)
```

**After**:
```sql
SELECT DISTINCT 
  vs.id,
  vs.service_id,
  vs.service_name,
  vs.service_name as display_name,
  COALESCE(vs.custom_description, 
    (SELECT sc.description FROM service_catalog sc 
     WHERE sc.service_name = vs.service_name 
     AND sc.service_style = vs.service_style 
     LIMIT 1)
  ) as description,
  vs.category as category_name,
  vs.service_style,
  vs.price as base_price,
  vs.duration_minutes
FROM vendor_services vs
```

**Key Points**:
- Uses correlated subquery for description
- `DISTINCT` is a safety measure (though subquery prevents duplicates)

---

### Location 2: Discover Services Query

**File**: `service-discovery.ts`  
**Line**: 1699  
**Endpoint**: `GET /customer/discover-services`

**Before**:
```sql
-- Had LEFT JOIN service_catalog (removed)
```

**After**:
```sql
SELECT 
  vs.id,
  vs.service_id,
  vs.service_name as name,
  COALESCE(vs.custom_description, 
    (SELECT sc.description FROM service_catalog sc 
     WHERE sc.service_name = vs.service_name 
     AND sc.service_style = vs.service_style 
     LIMIT 1)
  ) as description,
  vs.custom_price as price,
  COALESCE(vs.custom_duration, vs.duration_minutes) as duration_minutes,
  vs.service_style,
  vs.is_enabled,
  vs.publish_status
FROM vendor_services vs
```

**Key Points**:
- Correlated subquery for description
- No DISTINCT needed (subquery prevents duplicates)

---

### Location 3: Vendor Profile Services Query

**File**: `service-discovery.ts`  
**Line**: 5092  
**Endpoint**: `GET /vendor/:vendorId/profile` (services section)

**Before**:
```sql
-- Had LEFT JOIN service_catalog (removed)
```

**After**:
```sql
SELECT 
  vs.id,
  vs.service_id,
  vs.service_name,
  vs.price,
  COALESCE(vs.custom_duration, vs.duration_minutes) as duration,
  COALESCE(
    vs.custom_description, 
    (SELECT sc.description FROM service_catalog sc 
     WHERE sc.service_name = vs.service_name 
     AND sc.service_style = vs.service_style 
     LIMIT 1), 
    s.description  -- Legacy fallback to services table
  ) as description,
  vs.is_enabled,
  vs.publish_status,
  vs.category as category_name
FROM vendor_services vs
LEFT JOIN services s ON vs.service_id = s.id  -- Safe: unique join
```

**Key Points**:
- **Three-level fallback**: `custom_description` → `service_catalog` → `services.description`
- `LEFT JOIN services` is **safe** because it joins on UUID (`vs.service_id = s.id`), which is unique
- Only the `service_catalog` join was problematic (joined on `service_name + service_style`)

---

### Location 4: At-Center Vendor Services Query

**File**: `service-discovery.ts`  
**Line**: 5324  
**Endpoint**: `GET /customer/services/by-style` (for `at_center` vendors)

**Before**:
```sql
-- Had LEFT JOIN service_catalog (removed)
```

**After**:
```sql
SELECT 
  vs.id,
  vs.service_id,
  vs.service_name,
  vs.price,
  COALESCE(vs.custom_duration, vs.duration_minutes) as duration,
  COALESCE(vs.custom_description, 
    (SELECT sc.description FROM service_catalog sc 
     WHERE sc.service_name = vs.service_name 
     AND sc.service_style = vs.service_style 
     LIMIT 1)
  ) as description,
  vs.category as category_name
FROM vendor_services vs
WHERE vs.vendor_id = $1 
  AND vs.service_style = ANY($2::text[])
  AND vs.service_style != 'at_home'
```

**Key Points**:
- Used in `/customer/services/by-style` endpoint
- Filters `at_center` vendors only
- Correlated subquery prevents duplicates

---

### Location 5: Individual Provider Services Query

**File**: `service-discovery.ts`  
**Line**: 5719  
**Endpoint**: `GET /customer/services/by-style` (for individual providers)

**Before**:
```sql
-- Had LEFT JOIN service_catalog (removed)
```

**After**:
```sql
SELECT 
  vs.id,
  vs.service_id,
  vs.price,
  COALESCE(vs.custom_duration, vs.duration_minutes) as duration,
  vs.service_name,
  COALESCE(vs.custom_description, 
    (SELECT sc.description FROM service_catalog sc 
     WHERE sc.service_name = vs.service_name 
     AND sc.service_style = vs.service_style 
     LIMIT 1)
  ) as description,
  vs.category
FROM vendor_services vs
WHERE vs.vendor_id = $1 
  AND vs.service_style = $2
  AND vs.is_enabled = true
  AND (vs.publish_status = 'published' OR vs.publish_status = 'draft')
ORDER BY vs.price ASC
```

**Key Points**:
- Used for individual providers (solo vendors)
- Fallback query when `staff_services` is empty
- Correlated subquery prevents duplicates

---

### Location 6: Staff Provider Services Query

**File**: `service-discovery.ts`  
**Line**: 5914  
**Endpoint**: `GET /customer/services/by-style` (for staff providers)

**Before**:
```sql
-- Had LEFT JOIN service_catalog (removed)
```

**After**:
```sql
SELECT 
  vs.id,
  vs.service_id,
  vs.price,
  COALESCE(vs.custom_duration, vs.duration_minutes) as duration,
  vs.service_name,
  COALESCE(vs.custom_description, 
    (SELECT sc.description FROM service_catalog sc 
     WHERE sc.service_name = vs.service_name 
     AND sc.service_style = vs.service_style 
     LIMIT 1)
  ) as description,
  vs.category
FROM vendor_services vs
WHERE vs.vendor_id = $1 
  AND vs.service_style = ANY($2::text[])
  AND vs.is_enabled = true
  AND (vs.publish_status = 'published' OR vs.publish_status = 'draft')
ORDER BY vs.price ASC
```

**Key Points**:
- Used for staff members from business/clinic vendors
- Correlated subquery prevents duplicates

---

### Location 7: Vendor Identity Services Query

**File**: `service-discovery.ts`  
**Line**: 6073  
**Endpoint**: `GET /customer/services/by-style` (for vendor_identity providers)

**Before**:
```sql
-- Had LEFT JOIN service_catalog (removed)
```

**After**:
```sql
SELECT 
  vs.id,
  vs.service_id,
  vs.price,
  COALESCE(vs.custom_duration, vs.duration_minutes) as duration,
  vs.service_name,
  COALESCE(vs.custom_description, 
    (SELECT sc.description FROM service_catalog sc 
     WHERE sc.service_name = vs.service_name 
     AND sc.service_style = vs.service_style 
     LIMIT 1)
  ) as description,
  vs.category
FROM vendor_services vs
WHERE vs.vendor_id::text = $1 
  AND vs.service_style = ANY($2::text[])
  AND vs.is_enabled = true
  AND (vs.publish_status = 'published' OR vs.publish_status = 'draft')
ORDER BY vs.price ASC
```

**Key Points**:
- Used for vendor_identity providers
- Note: `vendor_id::text` cast (different from other queries)
- Correlated subquery prevents duplicates

---

### Location 8: Fallback Vendors Services Query

**File**: `service-discovery.ts`  
**Line**: 6326  
**Endpoint**: `GET /customer/services/by-style` (for fallback vendors)

**Before**:
```sql
-- Had LEFT JOIN service_catalog (removed)
```

**After**:
```sql
SELECT 
  vs.id,
  vs.service_id,
  vs.price,
  COALESCE(vs.custom_duration, vs.duration_minutes) as duration,
  vs.service_name,
  COALESCE(vs.custom_description, 
    (SELECT sc.description FROM service_catalog sc 
     WHERE sc.service_name = vs.service_name 
     AND sc.service_style = vs.service_style 
     LIMIT 1)
  ) as description,
  vs.category
FROM vendor_services vs
WHERE vs.vendor_id = $1 
  AND vs.service_style = ANY($2::text[])
  AND vs.is_enabled = true
  AND (vs.publish_status = 'published' OR vs.publish_status = 'draft')
ORDER BY vs.price ASC
```

**Key Points**:
- Used as fallback when other provider types don't match
- Correlated subquery prevents duplicates

---

### Location 9: Problem Grid Services Query

**File**: `problem-grid.ts`  
**Line**: 718  
**Endpoint**: `GET /customer/services/by-problem`

**Before**:
```sql
-- Had LEFT JOIN service_catalog (removed)
```

**After**:
```sql
SELECT 
  vs.id as service_id,
  vs.service_name as name,
  COALESCE(
    vs.custom_description, 
    (SELECT sc.description FROM service_catalog sc 
     WHERE sc.service_name = vs.service_name 
     AND sc.service_style = vs.service_style 
     LIMIT 1), 
    vs.service_name  -- Final fallback to service name itself
  ) as description,
  vs.price,
  vs.duration_minutes as duration,
  vs.service_style
FROM vendor_services vs
```

**Key Points**:
- Used in problem-based service discovery
- **Three-level fallback**: `custom_description` → `service_catalog` → `service_name`
- Correlated subquery prevents duplicates

---

## Before & After Code Comparison

### Example: Individual Provider Services Query

#### ❌ BEFORE (Causes Duplicates)

```sql
SELECT 
  vs.id,
  vs.service_id,
  vs.service_name,
  vs.price,
  COALESCE(vs.custom_description, sc.description) as description
FROM vendor_services vs
LEFT JOIN service_catalog sc 
  ON sc.service_name = vs.service_name 
  AND sc.service_style = vs.service_style
WHERE vs.vendor_id = $1 
  AND vs.service_style = $2
```

**Problem**:
- If `service_catalog` has 14 rows for "Home Visit Consultation", the service appears 14 times
- Each duplicate has a different `description` from `service_catalog`

#### ✅ AFTER (No Duplicates)

```sql
SELECT 
  vs.id,
  vs.service_id,
  vs.service_name,
  vs.price,
  COALESCE(
    vs.custom_description, 
    (SELECT sc.description 
     FROM service_catalog sc 
     WHERE sc.service_name = vs.service_name 
       AND sc.service_style = vs.service_style 
     LIMIT 1)
  ) as description
FROM vendor_services vs
WHERE vs.vendor_id = $1 
  AND vs.service_style = $2
```

**Solution**:
- Subquery returns exactly one description
- Service appears exactly once
- Description is selected from one of the matching catalog entries (non-deterministic, but acceptable)

---

## Database Schema Context

### Why service_catalog Has Multiple Rows

**`service_catalog` table structure**:
```sql
CREATE TABLE service_catalog (
  id UUID PRIMARY KEY,
  service_id TEXT,              -- Unique identifier (e.g., "vet_home_visit")
  service_name TEXT,             -- Service name (e.g., "Home Visit Consultation")
  service_style VARCHAR(50),    -- Service style: at_home, at_center, tele
  description TEXT,              -- Service description
  applicable_roles TEXT[]        -- Array of roles this service applies to
);
```

**Why Multiple Rows?**:
- Same `service_name` exists for different roles
- Example: "Home Visit Consultation" for:
  - `applicable_roles = ["vet_solo", "veterinarian"]` → Row 1
  - `applicable_roles = ["pet_sitter"]` → Row 2
  - `applicable_roles = ["pet_walker"]` → Row 3
  - ... 11 more roles

**Result**: 14 rows for "Home Visit Consultation" with `service_style = "at_home"`

### Why vendor_services Has One Row

**`vendor_services` table structure**:
```sql
CREATE TABLE vendor_services (
  id UUID PRIMARY KEY,
  vendor_id UUID,
  service_id UUID,              -- Foreign key to service_catalog.id
  service_name TEXT,            -- Service name (denormalized)
  service_style VARCHAR(50),    -- Service style
  custom_description TEXT,      -- Vendor's custom description (optional)
  price DECIMAL,
  duration_minutes INTEGER
);
```

**Why One Row?**:
- Each vendor adds a service **once**
- `service_id` (UUID) points to **one** `service_catalog.id`
- But `service_name` (TEXT) can match **multiple** `service_catalog` rows

**The Mismatch**:
- `vendor_services.service_id` → `service_catalog.id` (1:1, unique)
- `vendor_services.service_name` → `service_catalog.service_name` (1:many, causes duplicates)

**Why We Join on service_name?**:
- Sometimes `vendor_services.service_id` is NULL or points to wrong catalog entry
- `service_name` is more reliable for matching
- But causes duplicates because multiple catalog rows match

---

## Testing & Verification

### Manual Testing Steps

1. **Test Production API**:
   ```bash
   curl "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/customer/services/by-style?style=at_home&category=vet&roleId=veterinarian" \
     | jq '.providers[0].services | length'
   ```

2. **Check for Duplicates**:
   ```bash
   curl "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/customer/services/by-style?style=at_home&category=vet" \
     | jq '[.providers[0].services[] | select(.name == "Home Visit Consultation")] | length'
   ```

   **Expected**: Should return `1` (not 14)

3. **Verify Service IDs are Unique**:
   ```bash
   curl "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/customer/services/by-style?style=at_home&category=vet" \
     | jq '.providers[0].services | [.[].id] | unique | length'
   ```

   **Expected**: Should equal total services count (no duplicate IDs)

### Test Cases

| Scenario | Expected Result |
|----------|----------------|
| Service with custom_description | Appears once, uses custom_description |
| Service without custom_description, has catalog entry | Appears once, uses one catalog description |
| Service without custom_description, multiple catalog entries | Appears once, uses one catalog description (LIMIT 1) |
| Service without custom_description, no catalog entry | Appears once, description is NULL or empty |
| Multiple services for same vendor | Each service appears exactly once |

### Database Verification Queries

```sql
-- Check how many catalog entries exist for a service
SELECT COUNT(*) 
FROM service_catalog 
WHERE service_name = 'Home Visit Consultation' 
AND service_style = 'at_home';

-- Expected: 14 rows (or similar, multiple rows)

-- Check vendor_services for a vendor
SELECT id, service_name, service_style 
FROM vendor_services 
WHERE vendor_id = 'vendor-uuid' 
AND service_name = 'Home Visit Consultation';

-- Expected: 1 row (vendor adds service once)

-- Verify the subquery would return one description
SELECT 
  vs.id,
  vs.service_name,
  (SELECT sc.description 
   FROM service_catalog sc 
   WHERE sc.service_name = vs.service_name 
   AND sc.service_style = vs.service_style 
   LIMIT 1) as description
FROM vendor_services vs
WHERE vs.vendor_id = 'vendor-uuid'
AND vs.service_name = 'Home Visit Consultation';

-- Expected: 1 row with one description
```

---

## Dev/UAT Implementation Guide

### Problem: Duplicate Services in Dev/UAT

**Symptom**: Dev/UAT API returns duplicate services (same service appearing multiple times)

**Root Cause**: Dev/UAT Lambda functions may not have the latest code with correlated subquery pattern

### Step 1: Verify Current State

#### Check Dev API for Duplicates

```powershell
# Test dev API endpoint
$response = Invoke-RestMethod -Uri "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/services/by-style?style=at_home&category=vet" -Method GET

# Count services for first provider
$services = $response.providers[0].services
Write-Host "Total services: $($services.Count)"

# Check for duplicates
$duplicates = $services | Group-Object name | Where-Object { $_.Count -gt 1 }
if ($duplicates) {
    Write-Host "DUPLICATES FOUND:"
    $duplicates | ForEach-Object {
        Write-Host "  $($_.Name): $($_.Count) times"
    }
} else {
    Write-Host "No duplicates found"
}
```

**Expected**: Should show "No duplicates found"

**If Duplicates Found**: Dev Lambda needs to be updated

#### Check Service IDs

```powershell
# Check if service IDs are unique
$serviceIds = $response.providers[0].services | ForEach-Object { $_.id }
$uniqueIds = $serviceIds | Select-Object -Unique
Write-Host "Total services: $($serviceIds.Count)"
Write-Host "Unique IDs: $($uniqueIds.Count)"

if ($serviceIds.Count -ne $uniqueIds.Count) {
    Write-Host "WARNING: Duplicate service IDs found!"
}
```

**Expected**: Total services should equal unique IDs

### Step 2: Identify Dev Lambda Function

```powershell
# Get API Gateway integrations
$apiId = "z0b3obweb6"
$integrations = aws apigatewayv2 get-integrations --api-id $apiId --region ap-south-1 --output json | ConvertFrom-Json
$lambdaArn = $integrations.Items[0].IntegrationUri
$lambdaName = $lambdaArn -replace '.*function:', ''
Write-Host "Dev Lambda Function: $lambdaName"
```

**Expected Output**: `warmpawz-api-dev-api` or similar

### Step 3: Verify Code in Dev Lambda

#### Check if Correlated Subquery Pattern Exists

The fix should be present in all 9 locations listed above. To verify:

1. **Check service-discovery.ts**:
   - Search for: `(SELECT sc.description FROM service_catalog sc`
   - Should find 8 occurrences (lines 853, 1699, 5092, 5324, 5719, 5914, 6073, 6326)

2. **Check problem-grid.ts**:
   - Search for: `(SELECT sc.description FROM service_catalog sc`
   - Should find 1 occurrence (line 718)

3. **Check for OLD pattern**:
   - Search for: `LEFT JOIN service_catalog sc ON sc.service_name`
   - Should find **0 occurrences** (all removed)

### Step 4: Deploy to Dev Lambda

#### Build Lambda

```powershell
cd D:\WFTPL\warmpawzApp\warmpawzaws\backend\lambda
npm run build:bundle
```

#### Create Deployment Package

```powershell
Compress-Archive -Path dist\handler.js -DestinationPath dist\lambda-dev.zip -Force
```

#### Deploy to Dev Lambda

```powershell
aws lambda update-function-code `
  --function-name warmpawz-api-dev-api `
  --zip-file fileb://dist/lambda-dev.zip `
  --region ap-south-1
```

### Step 5: Verify Deployment

#### Test API After Deployment

```powershell
# Wait for Lambda to propagate
Start-Sleep -Seconds 10

# Test with cache-busting parameter
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$response = Invoke-RestMethod -Uri "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/services/by-style?style=at_home&category=vet&_t=$timestamp"

# Check for duplicates
$services = $response.providers[0].services
$duplicates = $services | Group-Object name | Where-Object { $_.Count -gt 1 }

if ($duplicates) {
    Write-Host "❌ STILL HAS DUPLICATES:"
    $duplicates | ForEach-Object {
        Write-Host "  $($_.Name): $($_.Count) times"
    }
} else {
    Write-Host "✅ NO DUPLICATES - FIXED!"
}

# Verify service IDs are unique
$serviceIds = $services | ForEach-Object { $_.id }
$uniqueIds = $serviceIds | Select-Object -Unique
Write-Host "Total services: $($serviceIds.Count)"
Write-Host "Unique IDs: $($uniqueIds.Count)"

if ($serviceIds.Count -eq $uniqueIds.Count) {
    Write-Host "✅ All service IDs are unique"
} else {
    Write-Host "❌ Duplicate service IDs found"
}
```

### Step 6: Verify Frontend Display

1. Open dev customer web app: `http://localhost:3001` (or dev URL)
2. Navigate to service provider
3. Check services list
4. Verify each service appears **exactly once**
5. Check browser console for API calls to dev endpoint

---

## Troubleshooting Guide

### Problem: Still Seeing Duplicates After Deployment

**Possible Causes**:
1. API Gateway caching (wait 5-10 minutes)
2. Lambda cold start (first request may use old code)
3. Code not actually deployed (check Lambda last modified time)
4. Different code path being used

**Debug Steps**:
```powershell
# Check Lambda last modified time
aws lambda get-function --function-name warmpawz-api-dev-api --region ap-south-1 --query 'Configuration.LastModified'

# Test with cache-busting
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
Invoke-RestMethod -Uri "https://dev-api/customer/services/by-style?style=at_home&_t=$timestamp"

# Check Lambda logs
aws logs tail /aws/lambda/warmpawz-api-dev-api --follow
```

### Problem: Services Missing After Fix

**Symptom**: After fix, some services don't appear at all

**Possible Causes**:
1. Subquery returning NULL for all catalog entries
2. Service name mismatch between `vendor_services` and `service_catalog`
3. Service style mismatch

**Debug Steps**:
```sql
-- Check if service exists in vendor_services
SELECT * FROM vendor_services 
WHERE vendor_id = 'vendor-uuid' 
AND service_name = 'Service Name';

-- Check if catalog has matching entry
SELECT * FROM service_catalog 
WHERE service_name = 'Service Name' 
AND service_style = 'at_home';

-- Test the subquery directly
SELECT 
  (SELECT sc.description 
   FROM service_catalog sc 
   WHERE sc.service_name = 'Service Name' 
   AND sc.service_style = 'at_home' 
   LIMIT 1) as description;
```

### Problem: Wrong Description Shown

**Symptom**: Description doesn't match the service

**Possible Causes**:
1. Multiple catalog entries, wrong one selected (LIMIT 1 picks first)
2. Service name mismatch
3. Service style mismatch

**Debug Steps**:
```sql
-- Check all catalog entries for service
SELECT id, service_name, service_style, description, applicable_roles
FROM service_catalog 
WHERE service_name = 'Service Name' 
AND service_style = 'at_home';

-- Check which one would be selected (LIMIT 1)
SELECT description 
FROM service_catalog 
WHERE service_name = 'Service Name' 
AND service_style = 'at_home' 
ORDER BY id ASC  -- Same order as LIMIT 1
LIMIT 1;
```

### Problem: Performance Degradation

**Symptom**: API is slower after fix

**Possible Causes**:
1. Subquery executes once per row (N queries for N services)
2. Missing index on `service_catalog(service_name, service_style)`

**Fix**:
```sql
-- Create index for subquery performance
CREATE INDEX IF NOT EXISTS idx_service_catalog_name_style 
ON service_catalog(service_name, service_style);
```

---

## Why Two Fixes Are Needed

### Problem 1: JOIN Cartesian Product (Fixed with Correlated Subquery)

**Issue**: `LEFT JOIN service_catalog` on `service_name + service_style` creates cartesian product
- `vendor_services`: 1 row
- `service_catalog`: 14 rows (same service_name, different roles)
- Result: 1 × 14 = 14 duplicate rows

**Fix**: Correlated subquery returns exactly one description per service

### Problem 2: Database Duplicate Rows (Fixed with Deduplication)

**Issue**: Database may have **actual duplicate `vendor_services` rows** with:
- Same `service_name` and `service_style`
- Different `id` (UUID)
- Different `service_id` (catalog reference)

**Example**:
```sql
-- vendor_services table may have:
id: abc-123, service_name: "Home Visit Consultation", service_style: "at_home"
id: def-456, service_name: "Home Visit Consultation", service_style: "at_home"  -- Duplicate!
id: ghi-789, service_name: "Home Visit Consultation", service_style: "at_home"  -- Duplicate!
```

**Why This Happens**:
- Vendor may have added the same service multiple times
- Data migration issues
- Manual database edits

**Fix**: `deduplicateServices()` function filters duplicates by `service_name + service_style`

**Result**: Even if database has duplicates, API returns each service exactly once

---

## Important Implementation Notes

### 1. Why Correlated Subquery, Not JOIN?

**JOIN Problem**:
- `LEFT JOIN` on `service_name + service_style` creates cartesian product
- Multiple catalog rows → multiple result rows

**Subquery Solution**:
- Scalar subquery returns one value
- No cartesian product
- Slight performance cost (N subqueries), but ensures correctness

### 2. Why LIMIT 1?

**Reason**:
- `service_catalog` may have multiple rows for same `service_name + service_style`
- We only need **one** description
- `LIMIT 1` ensures exactly one row is returned
- PostgreSQL picks first matching row (order is non-deterministic, but acceptable)

### 3. Safe LEFT JOINs (Not Changed)

**These LEFT JOINs are SAFE and were NOT changed**:
```sql
LEFT JOIN services s ON vs.service_id = s.id  -- UUID to UUID, unique
LEFT JOIN service_catalog sc ON vs.service_id = sc.id  -- UUID to UUID, unique
```

**Why Safe?**:
- Join on UUID (`service_id = id`) is **1:1** relationship
- No cartesian product possible
- Only joins on `service_name + service_style` were problematic

### 4. Performance Considerations

**Subquery Cost**:
- Executes **once per row** in `vendor_services`
- For 10 services, subquery runs 10 times
- Acceptable trade-off for correctness

**Optimization**:
- Index on `service_catalog(service_name, service_style)` improves subquery performance
- Consider adding this index if not exists

### 5. Description Selection (Non-Deterministic)

**Note**: When multiple catalog entries match, `LIMIT 1` picks one (non-deterministic order).

**Impact**: 
- Description may vary between API calls
- But service appears only once (correct behavior)
- Acceptable trade-off

**If Deterministic Order Needed**:
```sql
(SELECT sc.description 
 FROM service_catalog sc 
 WHERE sc.service_name = vs.service_name 
   AND sc.service_style = vs.service_style 
 ORDER BY sc.id ASC  -- Or other deterministic order
 LIMIT 1)
```

---

## Code References

### Backend Files

1. **Service Discovery**: `warmpawzApp/warmpawzaws/backend/lambda/src/endpoints/service-discovery.ts`
   - Platform services fallback: Line 853
   - Discover services: Line 1699
   - Vendor profile services: Line 5092
   - At-center vendor services: Line 5324
   - Individual provider services: Line 5719
   - Staff provider services: Line 5914
   - Vendor identity services: Line 6073
   - Fallback vendor services: Line 6326

2. **Problem Grid**: `warmpawzApp/warmpawzaws/backend/lambda/src/endpoints/problem-grid.ts`
   - Problem grid services: Line 718

### Database Tables

1. **vendor_services**: Core vendor services table
   - `service_name` column (TEXT)
   - `service_style` column (VARCHAR)
   - `custom_description` column (TEXT, nullable)

2. **service_catalog**: Platform service catalog
   - `service_name` column (TEXT)
   - `service_style` column (VARCHAR)
   - `description` column (TEXT)
   - **Multiple rows per service_name** (one per role)

---

## Summary Checklist for Re-implementation

If this fix needs to be re-implemented, ensure:

- [ ] All `LEFT JOIN service_catalog` on `service_name + service_style` are removed
- [ ] All service queries use **correlated subquery** pattern for description
- [ ] Subquery includes `LIMIT 1` to prevent multiple matches
- [ ] `deduplicateServices()` function is implemented (deduplicates by service_name + service_style)
- [ ] `deduplicateServices()` is applied to all service arrays before returning in API
- [ ] `cleanDescription()` is applied to all description fields
- [ ] Frontend handles descriptions correctly (no duplicate rendering)
- [ ] Database has `service_catalog` table with multiple rows per service_name
- [ ] Index on `service_catalog(service_name, service_style)` exists for performance
- [ ] Dev/UAT Lambda functions are deployed with latest code
- [ ] API returns each service exactly once (no duplicates)
- [ ] Service names are unique per provider in API response
- [ ] Service IDs may differ, but service names should be unique

---

## Dev/UAT Deployment Checklist

- [ ] Identify dev Lambda function name
- [ ] Build Lambda code (`npm run build:bundle`)
- [ ] Create deployment package (`Compress-Archive`)
- [ ] Deploy to dev Lambda (`aws lambda update-function-code`)
- [ ] Wait for Lambda propagation (10 seconds)
- [ ] Test API with cache-busting parameter
- [ ] Verify no duplicate services in response
- [ ] Verify service IDs are unique
- [ ] Verify descriptions are present
- [ ] Test frontend display (each service appears once)
- [ ] Check browser console for API calls
- [ ] Verify no errors in Lambda logs

---

## Related Issues

- **Service Description Implementation**: Related feature that also uses correlated subqueries
- **Vendor-Side Toggle Bug**: Separate issue (fixed in vendor service configuration screen)
- **Next Available Slot**: Unrelated feature (availability display)

---

## Contact & Maintenance

**Last Updated**: 2026-02-22

**Related Issues**:
- Duplicate services in customer-side API (fixed with correlated subquery)
- Service descriptions not showing (fixed with same pattern)
- Performance optimization (index on service_catalog)

**Dependencies**:
- `service_catalog` table (must have multiple rows per service_name)
- `vendor_services` table (one row per vendor service)
- Correlated subquery pattern in all service queries
- `cleanDescription()` function

**Deployment Status**:
- ✅ Production: Deployed with deduplication fix (2026-02-22T16:26:55)
- ✅ Dev Lambda: Deployed with deduplication fix (2026-02-22T16:24:50)
- ⚠️ UAT: Needs deployment (use same Lambda function name or identify UAT Lambda)

### Dev/UAT Deployment Completed: 2026-02-22

**Dev Lambda Function**: `warmpawz-api-dev-api`  
**Deployment Time**: 2026-02-22T16:24:50.000+0000  
**Code Size**: 1,765,566 bytes

**Fixes Applied**:
1. ✅ Correlated subquery pattern (replaces LEFT JOIN)
2. ✅ `deduplicateServices()` function (application-level safety net)
3. ✅ Applied to all service mapping locations

**Verification Results**:
- **Before Fix**: 5 services (3 duplicates of "Home Visit Consultation", 2 duplicates of "Home Service")
- **After Fix**: 2 unique services (duplicates removed)
- **Status**: ✅ FIXED - No duplicates in dev API response

**Test Command**:
```powershell
$response = Invoke-RestMethod -Uri "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/services/by-style?style=at_home&category=vet"
$services = $response.providers[0].services
$duplicates = $services | Group-Object name | Where-Object { $_.Count -gt 1 }
# Expected: $duplicates should be empty
```

---

**End of Document**
