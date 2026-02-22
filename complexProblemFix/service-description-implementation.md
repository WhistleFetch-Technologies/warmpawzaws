# Service Description Implementation - Comprehensive Documentation

## Overview

This document provides a complete implementation guide for the "Service Description" feature that displays rich, informative service descriptions on the customer-side booking interface. This feature ensures customers see detailed information about services (what's included, what's excluded, duration, etc.) when selecting services for booking.

**Objective**: Enable Cursor AI agents to understand, maintain, and re-implement this feature if needed in the future, especially for dev/UAT environments.

---

## Table of Contents

1. [Feature Description](#feature-description)
2. [Problem Statement](#problem-statement)
3. [Database Schema](#database-schema)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [API Endpoints](#api-endpoints)
7. [Data Flow](#data-flow)
8. [Key Algorithms](#key-algorithms)
9. [Critical Fix: Correlated Subquery Pattern](#critical-fix-correlated-subquery-pattern)
10. [Edge Cases & Error Handling](#edge-cases--error-handling)
11. [Testing & Verification](#testing--verification)
12. [Dev/UAT Implementation Guide](#devuat-implementation-guide)
13. [Troubleshooting Guide](#troubleshooting-guide)

---

## Feature Description

### What It Does

- **Fetches service descriptions**: Retrieves rich descriptions from `service_catalog` table when vendor services don't have custom descriptions
- **Fallback chain**: Uses `vendor_services.custom_description` → `service_catalog.description` → `services.description` (in order of priority)
- **Cleans descriptions**: Strips wrapping quotes and unescapes special characters for proper display
- **Displays in UI**: Shows multi-line descriptions with proper formatting (line breaks, spacing) on service cards and booking forms

### User Experience

When a customer views services:
- Service cards show detailed descriptions like:
  ```
  "Administration of preventive vaccines for infectious diseases.
  
  Includes:
  Vaccine dose
  Administration
  Vaccination record update
  
  Excludes:
  Consultation (if separate)
  Treatment of vaccine reactions"
  ```
- Descriptions are properly formatted with line breaks
- Long descriptions are truncated with "line-clamp" CSS for better UX

---

## Problem Statement

### Original Issue: Duplicate Services in API Response

**Symptom**: The `/customer/services/by-style` API was returning the same service multiple times (e.g., "Home Visit Consultation" appeared 14 times for a single vendor).

**Root Cause**: A `LEFT JOIN service_catalog` was causing a **cartesian product** because `service_catalog` has multiple rows per `service_name` (one for each role - Veterinarian, Pet Sitter, Pet Walker, etc.).

**Example**:
- `vendor_services` has 1 row: "Home Visit Consultation" (service_id = `abc-123`)
- `service_catalog` has 14 rows: "Home Visit Consultation" for 14 different roles
- `LEFT JOIN` on `service_name + service_style` → 1 × 14 = **14 duplicate rows**

### Solution: Correlated Subquery Pattern

Instead of `LEFT JOIN`, use a **correlated subquery** in the `SELECT` clause:

```sql
-- ❌ OLD (causes duplicates):
LEFT JOIN service_catalog sc ON sc.service_name = vs.service_name AND sc.service_style = vs.service_style
COALESCE(vs.custom_description, sc.description) as description

-- ✅ NEW (returns exactly one description):
COALESCE(vs.custom_description, 
  (SELECT sc.description FROM service_catalog sc 
   WHERE sc.service_name = vs.service_name 
   AND sc.service_style = vs.service_style 
   LIMIT 1)
) as description
```

**Why This Works**: The subquery executes **once per row** and returns **exactly one** description, preventing duplicates.

---

## Database Schema

### Primary Tables

#### 1. `vendor_services`

**Location**: Core vendor services table

**Key Columns**:
| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `vendor_id` | UUID | Foreign key to vendors |
| `service_id` | UUID | Foreign key to service_catalog.id |
| `service_name` | TEXT | Service name (e.g., "Home Visit Consultation") |
| `service_style` | VARCHAR(50) | Service style: `at_home`, `at_center`, `tele` |
| `custom_description` | TEXT | Vendor's custom description (optional) |
| `price` | DECIMAL | Service price |
| `duration_minutes` | INTEGER | Service duration |

**Note**: `custom_description` is NULL for most services, which is why we need the fallback to `service_catalog`.

#### 2. `service_catalog`

**Location**: Platform-wide service catalog with rich descriptions

**Key Columns**:
| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `service_id` | TEXT | Unique service identifier (e.g., "vet_home_visit") |
| `service_name` | TEXT | Service name (e.g., "Home Visit Consultation") |
| `service_style` | VARCHAR(50) | Service style: `at_home`, `at_center`, `tele` |
| `description` | TEXT | Rich service description (multi-line, formatted) |
| `applicable_roles` | TEXT[] | Array of roles this service applies to |

**Critical Note**: `service_catalog` has **multiple rows per `service_name`** because the same service exists for different roles (e.g., "Home Visit Consultation" for Veterinarian, Pet Sitter, Pet Walker, etc.). This is why `LEFT JOIN` causes duplicates.

**Example Data**:
```sql
-- service_catalog has 14 rows for "Home Visit Consultation":
id: 61d286f2, service_name: "Home Visit Consultation", service_style: "at_home", applicable_roles: ["vet_solo", "veterinarian"]
id: ea4c4c05, service_name: "Home Visit Consultation", service_style: "at_home", applicable_roles: ["vet_solo", "veterinarian"]
id: f1e45e14, service_name: "Home Visit Consultation", service_style: "at_home", applicable_roles: ["vet_solo", "veterinarian"]
-- ... 11 more rows
```

#### 3. `services` (Legacy Table)

**Location**: Legacy services table (fallback)

**Key Columns**:
| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `name` | TEXT | Service name |
| `description` | TEXT | Service description (legacy) |

**Note**: This table is used as a final fallback in some queries (e.g., vendor profile services).

---

## Backend Implementation

### Core Function: `cleanDescription`

**Location**: 
- `warmpawzApp/warmpawzaws/backend/lambda/src/endpoints/service-discovery.ts` (lines 525-535)
- `warmpawzApp/warmpawzaws/backend/lambda/src/endpoints/problem-grid.ts` (lines 25-33)

#### Function Signature

```typescript
function cleanDescription(desc: string | null | undefined): string | undefined
```

#### Complete Implementation

```typescript
/** Clean service description: strip wrapping quotes, trim whitespace */
function cleanDescription(desc: string | null | undefined): string | undefined {
  if (!desc || typeof desc !== 'string') return undefined;
  let cleaned = desc.trim();
  // Strip wrapping double-quotes from catalog descriptions
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }
  // Unescape internal escaped quotes
  cleaned = cleaned.replace(/\\"/g, '"');
  // Unescape newlines (service_catalog stores \n as \\n)
  cleaned = cleaned.replace(/\\n/g, '\n');
  return cleaned || undefined;
}
```

#### Purpose

1. **Strip wrapping quotes**: `service_catalog.description` sometimes has wrapping quotes: `"Description text"` → `Description text`
2. **Unescape quotes**: Internal escaped quotes `\"` → `"`
3. **Unescape newlines**: Database stores newlines as `\\n` → converts to actual newline `\n` for proper display

#### Why Needed

- `service_catalog.description` is stored as JSONB or TEXT, which may include escaped characters
- Frontend needs clean text with actual newlines for `whitespace-pre-line` CSS to work

---

## Correlated Subquery Pattern

### The Critical Fix

**Problem**: `LEFT JOIN service_catalog` causes duplicate services because `service_catalog` has multiple rows per `service_name`.

**Solution**: Use a **correlated subquery** in the `SELECT` clause instead of `JOIN`.

### Pattern Template

```sql
COALESCE(
  vs.custom_description,  -- Priority 1: Vendor's custom description
  (SELECT sc.description 
   FROM service_catalog sc 
   WHERE sc.service_name = vs.service_name 
     AND sc.service_style = vs.service_style 
   LIMIT 1)  -- Priority 2: Catalog description (exactly one)
) as description
```

### Why LIMIT 1?

- `service_catalog` may have multiple rows for the same `service_name + service_style` (different roles)
- We only need **one** description, so `LIMIT 1` ensures we get exactly one row
- PostgreSQL will pick the first matching row (order is non-deterministic, but that's acceptable)

---

## Implementation Locations

### 1. Platform Services Fallback Query

**Location**: `service-discovery.ts` line 853

**Context**: `/customer/services/platform` endpoint fallback query

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
-- ... rest of query
```

**Why DISTINCT**: Even with subquery, `DISTINCT` is a safety measure.

### 2. Discover Services Query

**Location**: `service-discovery.ts` line 1699

**Context**: `/customer/discover-services` endpoint

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
  vs.service_style
FROM vendor_services vs
-- ... rest of query
```

### 3. Vendor Profile Services Query

**Location**: `service-discovery.ts` line 5092

**Context**: Vendor profile endpoint (includes legacy `services` table fallback)

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
LEFT JOIN services s ON vs.service_id = s.id  -- Legacy table (unique join, safe)
-- ... rest of query
```

**Note**: This query has **three** fallback levels:
1. `vs.custom_description` (vendor custom)
2. `service_catalog.description` (catalog)
3. `s.description` (legacy services table)

### 4. At-Center Vendor Services Query

**Location**: `service-discovery.ts` line 5324

**Context**: `/customer/services/by-style` endpoint for `at_center` vendors

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
-- ... rest of query
```

### 5. Individual Provider Services Query

**Location**: `service-discovery.ts` line 5719

**Context**: `/customer/services/by-style` endpoint for individual providers

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
  vs.category
FROM vendor_services vs
WHERE vs.vendor_id = $1 
-- ... rest of query
```

### 6. Staff Provider Services Query

**Location**: `service-discovery.ts` line 5914

**Context**: `/customer/services/by-style` endpoint for staff providers

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
  vs.category
FROM vendor_services vs
WHERE vs.vendor_id = $1 
-- ... rest of query
```

### 7. Vendor Identity Services Query

**Location**: `service-discovery.ts` line 6073

**Context**: `/customer/services/by-style` endpoint for vendor_identity providers

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
  vs.category
FROM vendor_services vs
WHERE vs.vendor_id::text = $1 
-- ... rest of query
```

### 8. Fallback Vendors Services Query

**Location**: `service-discovery.ts` line 6326

**Context**: `/customer/services/by-style` endpoint for fallback vendors

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
  vs.category
FROM vendor_services vs
WHERE vs.vendor_id = $1 
-- ... rest of query
```

### 9. Problem Grid Services Query

**Location**: `problem-grid.ts` line 718

**Context**: `/customer/services/by-problem` endpoint

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
-- ... rest of query
```

**Note**: This query has a **third fallback** to `vs.service_name` if both `custom_description` and `service_catalog.description` are NULL.

---

## Description Cleaning in Response Mapping

### Where `cleanDescription` is Applied

After fetching descriptions from the database, they are cleaned before being returned in API responses:

#### 1. Vendor Profile Services

**Location**: `service-discovery.ts` line 5126

```typescript
description: cleanDescription(s.description) || cleanDescription(s.base_description) || '',
```

**Context**: Vendor profile endpoint response mapping

#### 2. At-Center Vendor Services

**Location**: `service-discovery.ts` line 5416

```typescript
description: cleanDescription(s.description),
```

**Context**: `/customer/services/by-style` response for at_center vendors

#### 3. Individual Provider Services

**Location**: `service-discovery.ts` line 5784

```typescript
description: cleanDescription(s.description),
```

**Context**: `/customer/services/by-style` response for individual providers

#### 4. Staff Provider Services

**Location**: `service-discovery.ts` line 5993

```typescript
description: cleanDescription(s.description),
```

**Context**: `/customer/services/by-style` response for staff providers

#### 5. Vendor Identity Services

**Location**: `service-discovery.ts` line 6142

```typescript
description: cleanDescription(s.description),
```

**Context**: `/customer/services/by-style` response for vendor_identity providers

#### 6. Fallback Vendor Services

**Location**: `service-discovery.ts` line 6409

```typescript
description: cleanDescription(s.description),
```

**Context**: `/customer/services/by-style` response for fallback vendors

#### 7. Problem Grid Services

**Location**: `problem-grid.ts` line 1151

```typescript
description: cleanDescription(service.description),
```

**Context**: `/customer/services/by-problem` response

---

## Frontend Implementation

### Component: `UniversalProviderProfile`

**Location**: `warmpawzApp/warmpawzaws/apps/customer-web/components/customer/shared/UniversalProviderProfile.tsx`

### Interface Definition

```typescript
interface Service {
  id: string;
  name: string;
  description?: string;  // Optional description field
  price: number;
  duration: number;
  // ... other fields
}
```

### Display Location 1: Booking Summary (Lines 575-577)

**Context**: Service selection summary in booking flow

```tsx
{service.description && (
  <p className="text-xs text-gray-600 mt-1 whitespace-pre-line line-clamp-4">
    {service.description}
  </p>
)}
```

**CSS Classes**:
- `whitespace-pre-line`: Preserves line breaks and wraps text
- `line-clamp-4`: Truncates to 4 lines with ellipsis
- `text-xs`: Small text size
- `text-gray-600`: Gray color

**Why `whitespace-pre-line`**: 
- Preserves newlines from database (`\n` characters)
- Wraps long lines automatically
- Better than `whitespace-pre-wrap` (which doesn't wrap)

### Display Location 2: Services Tab (Lines 797-799)

**Context**: Services list in provider profile

```tsx
{service.description && (
  <p className="text-sm text-gray-500 mt-1 whitespace-pre-line line-clamp-3">
    {service.description}
  </p>
)}
```

**CSS Classes**:
- `whitespace-pre-line`: Preserves line breaks
- `line-clamp-3`: Truncates to 3 lines (shorter than summary)
- `text-sm`: Slightly larger than summary
- `text-gray-500`: Lighter gray color

### Display Location 3: Address Overflow Fix (Lines 716-729)

**Context**: Address selection in booking form

**Note**: This was fixed separately but uses similar `whitespace-pre-wrap` pattern for address text wrapping.

---

## API Endpoints

### 1. GET `/customer/services/by-style`

**Query Parameters**:
- `style`: Service style (`at_home`, `at_center`, `tele`)
- `category`: Optional category filter
- `roleId`: Optional role filter

**Response Format**:
```json
{
  "success": true,
  "style": "at_home",
  "providers": [
    {
      "providerId": "uuid",
      "services": [
        {
          "id": "uuid",
          "serviceId": "uuid",
          "name": "Home Visit Consultation",
          "description": "Administration of preventive vaccines...\n\nIncludes:\nVaccine dose\n...",
          "price": 500,
          "duration": 30,
          "category": "63d34efd-76b0-4e2e-8aa0-4465ddef6620"
        }
      ]
    }
  ]
}
```

**Key Behavior**:
- `description` field is always present (may be empty string if no description available)
- Descriptions are cleaned (no wrapping quotes, newlines unescaped)
- Each service appears **exactly once** (no duplicates)

### 2. GET `/customer/services/by-problem`

**Query Parameters**:
- `problemId`: Problem identifier
- `serviceStyle`: Optional service style filter

**Response Format**: Similar to `/by-style`, includes `description` in service objects.

### 3. GET `/customer/discover-services`

**Query Parameters**:
- `serviceStyle`: Service style filter
- `category`: Optional category

**Response Format**: Similar to `/by-style`, includes `description` in service objects.

### 4. GET `/vendor/:vendorId/profile`

**Response Format**:
```json
{
  "success": true,
  "vendor": {
    "services": [
      {
        "id": "uuid",
        "name": "Service Name",
        "description": "Service description...",
        "price": 500,
        "duration": 30
      }
    ]
  }
}
```

---

## Data Flow

### Complete Flow Diagram

```
1. Customer views service provider
   ↓
2. Frontend calls GET /customer/services/by-style?style=at_home
   ↓
3. Backend queries vendor_services for matching services
   ↓
4. For each service:
   a. Check vs.custom_description (Priority 1)
   b. If NULL, query service_catalog via correlated subquery (Priority 2)
   c. If NULL, use services.description (Priority 3, some queries only)
   ↓
5. Apply cleanDescription() to strip quotes and unescape newlines
   ↓
6. Return services array with description field
   ↓
7. Frontend receives description string with \n characters
   ↓
8. UI renders with whitespace-pre-line CSS
   ↓
9. Browser displays multi-line description with proper formatting
```

### Step-by-Step Example

**Input**: Customer views "Home Visit Consultation" service

1. **API Call**: `GET /customer/services/by-style?style=at_home&category=vet`

2. **Backend Processing**:
   ```sql
   -- Query vendor_services
   SELECT 
     vs.id,
     vs.service_name,
     COALESCE(
       vs.custom_description,  -- NULL (vendor hasn't customized)
       (SELECT sc.description FROM service_catalog sc 
        WHERE sc.service_name = 'Home Visit Consultation' 
        AND sc.service_style = 'at_home' 
        LIMIT 1)  -- Returns: "Administration of preventive vaccines...\n\nIncludes:\n..."
     ) as description
   FROM vendor_services vs
   WHERE vs.vendor_id = 'vendor-uuid'
   ```

3. **Description Cleaning**:
   ```typescript
   const raw = "Administration of preventive vaccines...\\n\\nIncludes:\\n...";
   const cleaned = cleanDescription(raw);
   // Result: "Administration of preventive vaccines...\n\nIncludes:\n..."
   ```

4. **Response**:
   ```json
   {
     "services": [
       {
         "name": "Home Visit Consultation",
         "description": "Administration of preventive vaccines...\n\nIncludes:\nVaccine dose\n...",
         "price": 500
       }
     ]
   }
   ```

5. **Frontend Rendering**:
   ```tsx
   <p className="whitespace-pre-line">
     {service.description}
   </p>
   ```

6. **Browser Display**:
   ```
   Administration of preventive vaccines...
   
   Includes:
   Vaccine dose
   Administration
   ...
   ```

---

## Key Algorithms

### Algorithm 1: Description Fallback Chain

```typescript
const description = 
  vendorService.custom_description ||           // Priority 1
  serviceCatalog.description ||                // Priority 2
  legacyService.description ||                 // Priority 3 (some queries)
  serviceName;                                 // Priority 4 (problem-grid only)
```

**Priority Order**:
1. Vendor's custom description (highest priority - vendor-specific)
2. Service catalog description (platform-wide, rich descriptions)
3. Legacy services table description (fallback for old data)
4. Service name itself (last resort, only in problem-grid)

### Algorithm 2: Description Cleaning

```typescript
function cleanDescription(desc: string | null | undefined): string | undefined {
  if (!desc || typeof desc !== 'string') return undefined;
  
  let cleaned = desc.trim();                    // Step 1: Trim whitespace
  
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);        // Step 2: Strip wrapping quotes
  }
  
  cleaned = cleaned.replace(/\\"/g, '"');     // Step 3: Unescape quotes
  cleaned = cleaned.replace(/\\n/g, '\n');    // Step 4: Unescape newlines
  
  return cleaned || undefined;
}
```

**Steps**:
1. **Trim**: Remove leading/trailing whitespace
2. **Strip quotes**: Remove `"..."` wrapper if present
3. **Unescape quotes**: Convert `\"` to `"`
4. **Unescape newlines**: Convert `\\n` to `\n`

### Algorithm 3: Correlated Subquery Execution

```sql
(SELECT sc.description 
 FROM service_catalog sc 
 WHERE sc.service_name = vs.service_name      -- Correlated: uses outer query value
   AND sc.service_style = vs.service_style 
 LIMIT 1)
```

**How It Works**:
1. For each row in `vendor_services`, the subquery executes
2. It uses the **current row's** `service_name` and `service_style` values
3. Finds matching rows in `service_catalog`
4. Returns **exactly one** description (LIMIT 1)
5. No cartesian product because it's a scalar subquery (returns one value)

---

## Critical Fix: Correlated Subquery Pattern

### The Problem: LEFT JOIN Causes Duplicates

**Before Fix**:
```sql
SELECT 
  vs.id,
  vs.service_name,
  COALESCE(vs.custom_description, sc.description) as description
FROM vendor_services vs
LEFT JOIN service_catalog sc 
  ON sc.service_name = vs.service_name 
  AND sc.service_style = vs.service_style
```

**Result**: If `service_catalog` has 14 rows for "Home Visit Consultation", the vendor service appears **14 times** in results.

### The Solution: Correlated Subquery

**After Fix**:
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
```

**Result**: Vendor service appears **exactly once**, with one description.

### Why This Works

1. **Scalar Subquery**: Returns a single value (not a row set)
2. **Correlated**: Uses values from the outer query (`vs.service_name`, `vs.service_style`)
3. **LIMIT 1**: Ensures exactly one row is returned (even if multiple matches exist)
4. **No JOIN**: No cartesian product because it's not a JOIN operation

### Performance Considerations

- **Subquery executes once per row**: For 10 services, subquery runs 10 times
- **Index on service_catalog**: Should have index on `(service_name, service_style)` for performance
- **Acceptable trade-off**: Slight performance cost for correctness (no duplicates)

---

## Edge Cases & Error Handling

### Edge Case 1: No Description Available

**Scenario**: Service has no `custom_description` and no matching `service_catalog` row

**Handling**:
```typescript
description: cleanDescription(s.description) || ''  // Returns empty string
```

**Result**: Description field is empty string, UI doesn't display description section

### Edge Case 2: Multiple Catalog Entries

**Scenario**: `service_catalog` has multiple rows for same `service_name + service_style` (different roles)

**Handling**:
```sql
LIMIT 1  -- Returns first matching row
```

**Result**: One description is selected (non-deterministic, but acceptable)

### Edge Case 3: Description with Wrapping Quotes

**Scenario**: `service_catalog.description` = `"Description text"`

**Handling**:
```typescript
if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
  cleaned = cleaned.slice(1, -1);
}
```

**Result**: `"Description text"` → `Description text`

### Edge Case 4: Escaped Newlines

**Scenario**: Database stores newlines as `\\n` (escaped)

**Handling**:
```typescript
cleaned = cleaned.replace(/\\n/g, '\n');
```

**Result**: `"Line 1\\nLine 2"` → `"Line 1\nLine 2"` (actual newline)

### Edge Case 5: NULL Description

**Scenario**: `custom_description` is NULL and subquery returns NULL

**Handling**:
```typescript
COALESCE(vs.custom_description, subquery) || ''  // Returns empty string
```

**Result**: Empty string, UI doesn't show description

### Error Handling

**Try-Catch**: Not needed - SQL COALESCE handles NULL gracefully

**Fallback Chain**: Multiple fallback levels ensure description is always available (even if empty)

---

## Testing & Verification

### Manual Testing Steps

1. **Test Service with Custom Description**:
   ```sql
   -- Update vendor service with custom description
   UPDATE vendor_services 
   SET custom_description = 'Custom vendor description'
   WHERE id = 'service-uuid';
   ```

2. **Call API**:
   ```bash
   curl "https://api.example.com/customer/services/by-style?style=at_home"
   ```

3. **Verify Response**:
   - Service appears **once** (not duplicated)
   - `description` field contains custom description
   - Description is clean (no wrapping quotes)

4. **Test Service with Catalog Description**:
   ```sql
   -- Remove custom description
   UPDATE vendor_services 
   SET custom_description = NULL
   WHERE id = 'service-uuid';
   ```

5. **Verify Response**:
   - Service appears **once**
   - `description` field contains catalog description
   - Description is clean and properly formatted

### Test Cases

| Scenario | Expected Result |
|----------|----------------|
| Service with custom_description | Uses custom_description |
| Service without custom_description, has catalog entry | Uses catalog description |
| Service without custom_description, no catalog entry | Empty description or service name |
| Multiple catalog entries for same service | One description selected (LIMIT 1) |
| Description with wrapping quotes | Quotes stripped |
| Description with escaped newlines | Newlines unescaped |
| Description with escaped quotes | Quotes unescaped |

### Database Verification Queries

```sql
-- Check if service has custom description
SELECT id, service_name, custom_description 
FROM vendor_services 
WHERE id = 'service-uuid';

-- Check catalog descriptions for service
SELECT service_name, service_style, description 
FROM service_catalog 
WHERE service_name = 'Home Visit Consultation' 
AND service_style = 'at_home';

-- Count catalog entries (should be multiple)
SELECT COUNT(*) 
FROM service_catalog 
WHERE service_name = 'Home Visit Consultation' 
AND service_style = 'at_home';
```

---

## Dev/UAT Implementation Guide

### Problem: Changes Not Reflected in Dev/UAT

**Symptom**: Service descriptions work in **production** but not in **dev/UAT** environments.

**Root Cause**: Dev/UAT Lambda functions may not have the latest code with:
- Correlated subquery pattern (instead of LEFT JOIN)
- `cleanDescription()` function
- Description cleaning in response mapping

### Step 1: Verify Current State

#### Check Dev API Response

```bash
# Test dev API endpoint
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/services/by-style?style=at_home&category=vet" \
  | jq '.providers[0].services[0] | {name, description}'
```

**Expected**: Should return service with `description` field (may be empty if no description available)

**If Missing**: Dev Lambda needs to be updated

#### Check for Duplicate Services

```bash
# Count services for a vendor
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/services/by-style?style=at_home&category=vet" \
  | jq '[.providers[0].services[] | select(.name == "Home Visit Consultation")] | length'
```

**Expected**: Should return `1` (one service, not multiple)

**If > 1**: Dev Lambda still uses old LEFT JOIN pattern

### Step 2: Identify Dev Lambda Function

```powershell
# Get API Gateway integrations
$apiId = "z0b3obweb6"
$integrations = aws apigatewayv2 get-integrations --api-id $apiId --region ap-south-1 --output json | ConvertFrom-Json
$lambdaArn = $integrations.Items[0].IntegrationUri
$lambdaName = $lambdaArn -replace '.*function:', ''
Write-Host "Dev Lambda Function: $lambdaName"
```

**Expected Output**: `warmpawz-dev-api-handler` or similar

### Step 3: Verify Code in Dev Lambda

#### Check if cleanDescription Exists

```bash
# Download and check Lambda code (if possible)
# Or check Lambda logs for function execution
aws logs tail /aws/lambda/warmpawz-dev-api-handler --follow
```

#### Check API Response for Description Field

```bash
# Call dev API and check response structure
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/services/by-style?style=at_home" \
  | jq '.providers[0].services[0]'
```

**Check For**:
- `description` field exists
- Description is clean (no wrapping quotes)
- Service appears only once (no duplicates)

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
  --function-name warmpawz-dev-api-handler `
  --zip-file fileb://dist/lambda-dev.zip `
  --region ap-south-1
```

### Step 5: Verify Deployment

#### Test API Response

```bash
# Test dev API after deployment
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/services/by-style?style=at_home&category=vet" \
  | jq '.providers[0].services[] | {name, description: (.description | .[0:50])}'
```

**Expected**:
- Each service appears **once**
- `description` field is present
- Descriptions are clean (no quotes, newlines work)

#### Check Frontend Display

1. Open dev customer web app: `http://localhost:3001` (or dev URL)
2. Navigate to service provider
3. Verify service descriptions are displayed
4. Check that descriptions are properly formatted (line breaks work)

### Step 6: Verify Database Schema

#### Check service_catalog Table

```sql
-- Connect to dev database
SELECT COUNT(*) FROM service_catalog;

-- Check if descriptions exist
SELECT service_name, service_style, 
       LENGTH(description) as desc_length 
FROM service_catalog 
WHERE description IS NOT NULL 
LIMIT 10;
```

**Expected**: Should have rows with descriptions

#### Check vendor_services Table

```sql
-- Check custom descriptions
SELECT COUNT(*) 
FROM vendor_services 
WHERE custom_description IS NOT NULL;
```

---

## Troubleshooting Guide

### Problem: Descriptions Not Showing in UI

**Possible Causes**:
1. API not returning `description` field
2. Frontend not mapping `description` correctly
3. CSS `whitespace-pre-line` not applied
4. Description is empty string

**Debug Steps**:
```javascript
// Check API response in browser console
fetch('/customer/services/by-style?style=at_home')
  .then(r => r.json())
  .then(data => console.log(data.providers[0].services[0].description));

// Check if description exists in service object
console.log(service.description);

// Check CSS classes
document.querySelector('.service-description').classList;
```

### Problem: Duplicate Services in API Response

**Symptom**: Same service appears multiple times (e.g., "Home Visit Consultation" appears 14 times)

**Root Cause**: Dev Lambda still uses old `LEFT JOIN service_catalog` pattern

**Fix**: Deploy latest Lambda code with correlated subquery pattern

**Verification**:
```bash
# Count duplicates
curl "https://dev-api/customer/services/by-style?style=at_home" \
  | jq '[.providers[0].services[] | select(.name == "Home Visit Consultation")] | length'
```

**Expected**: Should return `1` (not 14)

### Problem: Descriptions Have Wrapping Quotes

**Symptom**: Description shows as `"Description text"` instead of `Description text`

**Root Cause**: `cleanDescription()` not being called or not working correctly

**Fix**: Verify `cleanDescription()` is applied in response mapping

**Debug**:
```typescript
// Add logging in cleanDescription
console.log('Before:', desc);
console.log('After:', cleaned);
```

### Problem: Newlines Not Working

**Symptom**: Description shows `\n` as text instead of line breaks

**Possible Causes**:
1. `cleanDescription()` not unescaping `\\n` to `\n`
2. Frontend CSS missing `whitespace-pre-line`
3. React not rendering newlines

**Fix**:
1. Verify `cleanDescription()` includes: `cleaned.replace(/\\n/g, '\n')`
2. Verify CSS: `className="whitespace-pre-line"`
3. Check React rendering: `{service.description}` (not `{JSON.stringify(service.description)}`)

### Problem: Empty Descriptions

**Symptom**: Description field is empty or missing

**Possible Causes**:
1. No `custom_description` in `vendor_services`
2. No matching row in `service_catalog`
3. Subquery returning NULL

**Debug**:
```sql
-- Check vendor service
SELECT custom_description FROM vendor_services WHERE id = 'service-uuid';

-- Check catalog
SELECT description FROM service_catalog 
WHERE service_name = 'Service Name' AND service_style = 'at_home';
```

### Problem: Wrong Description Shown

**Symptom**: Description doesn't match the service

**Possible Causes**:
1. Subquery matching wrong `service_name` or `service_style`
2. Multiple catalog entries, wrong one selected

**Debug**:
```sql
-- Check what subquery would return
SELECT sc.description 
FROM service_catalog sc 
WHERE sc.service_name = 'Home Visit Consultation' 
AND sc.service_style = 'at_home' 
LIMIT 1;
```

---

## Important Implementation Notes

### 1. Correlated Subquery vs JOIN

**Why Subquery?**
- `LEFT JOIN` causes cartesian product when `service_catalog` has multiple rows per `service_name`
- Correlated subquery returns exactly one value per row
- Slight performance cost, but ensures correctness

### 2. LIMIT 1 in Subquery

**Why Needed?**
- `service_catalog` may have multiple rows for same `service_name + service_style` (different roles)
- `LIMIT 1` ensures exactly one description is returned
- PostgreSQL picks first matching row (order is non-deterministic, but acceptable)

### 3. Description Cleaning Order

**Processing Order**:
1. Fetch from database (may have quotes, escaped chars)
2. Apply `cleanDescription()` (strip quotes, unescape)
3. Return to frontend (clean string with actual newlines)
4. Frontend renders with `whitespace-pre-line` (preserves newlines)

### 4. Fallback Chain Priority

**Priority Order** (highest to lowest):
1. `vendor_services.custom_description` (vendor-specific)
2. `service_catalog.description` (platform-wide)
3. `services.description` (legacy table, some queries only)
4. `service_name` (last resort, problem-grid only)

### 5. Frontend CSS: whitespace-pre-line

**Why `whitespace-pre-line`?**
- Preserves newlines (`\n` characters)
- Wraps long lines automatically
- Better than `whitespace-pre-wrap` (which doesn't wrap)
- Better than `whitespace-normal` (which collapses newlines)

---

## Code References

### Backend Files

1. **Core Function**: `warmpawzApp/warmpawzaws/backend/lambda/src/endpoints/service-discovery.ts`
   - `cleanDescription()`: Lines 525-535
   - Correlated subquery implementations: Lines 853, 1699, 5092, 5324, 5719, 5914, 6073, 6326
   - Description cleaning in responses: Lines 5126, 5416, 5784, 5993, 6142, 6409

2. **Problem Grid**: `warmpawzApp/warmpawzaws/backend/lambda/src/endpoints/problem-grid.ts`
   - `cleanDescription()`: Lines 25-33
   - Correlated subquery: Line 718
   - Description cleaning: Line 1151

### Frontend Files

1. **Provider Profile**: `warmpawzApp/warmpawzaws/apps/customer-web/components/customer/shared/UniversalProviderProfile.tsx`
   - Booking summary display: Lines 575-577
   - Services tab display: Lines 797-799
   - CSS: `whitespace-pre-line line-clamp-4` and `whitespace-pre-line line-clamp-3`

### Database Tables

1. **vendor_services**: Core vendor services table
   - `custom_description` column (TEXT, nullable)

2. **service_catalog**: Platform service catalog
   - `description` column (TEXT, nullable)
   - Multiple rows per `service_name` (one per role)

3. **services**: Legacy services table
   - `description` column (TEXT, nullable)
   - Used as fallback in some queries

---

## Summary Checklist for Re-implementation

If this feature needs to be re-implemented, ensure:

- [ ] `cleanDescription()` function exists in both `service-discovery.ts` and `problem-grid.ts`
- [ ] All service queries use **correlated subquery** pattern (not LEFT JOIN)
- [ ] Subquery includes `LIMIT 1` to prevent multiple matches
- [ ] `cleanDescription()` is applied to all description fields in response mapping
- [ ] Frontend uses `whitespace-pre-line` CSS class for description display
- [ ] Frontend checks `service.description` exists before rendering
- [ ] Fallback chain is implemented: `custom_description` → `service_catalog` → `services` → `service_name`
- [ ] Database has `service_catalog` table with `description` column
- [ ] Database has `vendor_services` table with `custom_description` column
- [ ] Dev/UAT Lambda functions are deployed with latest code

---

## Dev/UAT Deployment Checklist

- [ ] Identify dev Lambda function name
- [ ] Build Lambda code (`npm run build:bundle`)
- [ ] Create deployment package (`Compress-Archive`)
- [ ] Deploy to dev Lambda (`aws lambda update-function-code`)
- [ ] Verify API returns `description` field
- [ ] Verify no duplicate services in response
- [ ] Verify descriptions are clean (no quotes)
- [ ] Verify frontend displays descriptions correctly
- [ ] Test with services that have custom descriptions
- [ ] Test with services that use catalog descriptions
- [ ] Test with services that have no descriptions

---

## Related Features

- **Service Discovery**: Service descriptions are part of service discovery flow
- **Vendor Profile**: Descriptions shown in vendor profile services list
- **Booking Flow**: Descriptions shown in service selection summary
- **Problem Grid**: Descriptions shown in problem-based service discovery

---

## Dev/UAT Deployment Status

### Deployment Completed: 2026-02-22

**Dev Lambda Function**: `warmpawz-api-dev-api`  
**Deployment Time**: 2026-02-22T16:11:28.000+0000  
**Code Size**: 1,765,360 bytes

### Deployment Steps Executed

1. ✅ Built Lambda: `npm run build:bundle`
2. ✅ Created deployment package: `lambda-dev.zip`
3. ✅ Deployed to dev Lambda: `warmpawz-api-dev-api`
4. ⚠️ **Verification Pending**: API still shows duplicates (may need database verification)

### Next Steps for Dev/UAT

1. **Verify Database Schema**:
   ```sql
   -- Check if service_catalog table exists and has data
   SELECT COUNT(*) FROM service_catalog;
   SELECT COUNT(*) FROM service_catalog WHERE description IS NOT NULL;
   ```

2. **Verify service_catalog has descriptions**:
   ```sql
   -- Check if descriptions exist for common services
   SELECT service_name, service_style, 
          LENGTH(description) as desc_length 
   FROM service_catalog 
   WHERE service_name = 'Home Visit Consultation' 
   AND service_style = 'at_home'
   LIMIT 5;
   ```

3. **If descriptions are missing in dev database**:
   - Copy `service_catalog` data from production to dev
   - Or run migrations to populate service_catalog

4. **Re-test API**:
   ```bash
   curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/services/by-style?style=at_home&category=vet" \
     | jq '.providers[0].services[] | {name, description: (.description | .[0:50])}'
   ```

### Known Issues

- **Issue**: Dev API still shows duplicate services after deployment
- **Possible Causes**:
  1. API Gateway caching (wait 5-10 minutes)
  2. Lambda cold start (first request may use old code)
  3. Database missing `service_catalog` data
  4. Different code path in dev environment

- **Issue**: Dev API not returning descriptions
- **Possible Causes**:
  1. `service_catalog` table empty in dev database
  2. No matching rows for service_name + service_style
  3. Descriptions are NULL in dev database

### Verification Commands

```powershell
# Check Lambda deployment
aws lambda get-function --function-name warmpawz-api-dev-api --region ap-south-1 --query 'Configuration.LastModified'

# Test API with cache-busting
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
Invoke-RestMethod -Uri "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/services/by-style?style=at_home&_t=$timestamp"

# Check for duplicates
$response = Invoke-RestMethod -Uri "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/services/by-style?style=at_home"
$response.providers[0].services | Group-Object name | Where-Object { $_.Count -gt 1 }
```

---

## Contact & Maintenance

**Last Updated**: 2026-02-22

**Related Issues**:
- Duplicate services in API response (fixed with correlated subquery)
- Missing service descriptions (fixed with fallback chain)
- Description formatting issues (fixed with cleanDescription)
- Dev/UAT deployment (completed, verification pending)

**Dependencies**:
- `service_catalog` table (must have descriptions)
- `vendor_services.custom_description` column
- `cleanDescription()` function
- Frontend `whitespace-pre-line` CSS

**Deployment Status**:
- ✅ Production: Fully deployed and working
- ✅ Dev Lambda: Deployed (2026-02-22T16:11:28)
- ⚠️ Dev Database: Verification needed (service_catalog data)

---

**End of Document**
