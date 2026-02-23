# Next Available Slot Implementation - Comprehensive Documentation

## Overview

This document provides a complete implementation guide for the "Next Available Slot" feature that displays vendor availability on the customer-side booking interface. This feature shows customers when a vendor is next available for booking, with intelligent formatting based on proximity (today, tomorrow, this week, or next week).

**Objective**: Enable Cursor AI agents to understand, maintain, and re-implement this feature if needed in the future.

---

## Table of Contents

1. [Feature Description](#feature-description)
2. [Database Schema](#database-schema)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Implementation](#frontend-implementation)
5. [API Endpoints](#api-endpoints)
6. [Data Flow](#data-flow)
7. [Key Algorithms](#key-algorithms)
8. [Edge Cases & Error Handling](#edge-cases--error-handling)
9. [Testing & Verification](#testing--verification)
10. [Troubleshooting Guide](#troubleshooting-guide)

---

## Feature Description

### What It Does

- **Filters vendors**: Only vendors with availability configured in `vendor_availability_v2` appear in search results
- **Calculates next slot**: Determines the earliest available time slot for each vendor
- **Formats display**: Shows user-friendly text like "Today 2:00 PM", "Tomorrow 10:00 AM", "Mon 3:00 PM", or "Feb 25 9:00 AM"
- **Service style filtering**: Only considers availability slots that match the requested service style (at_home, at_center, tele)

### User Experience

When a customer searches for services (e.g., "Veterinarian at home"), they see:
- Only vendors who have availability configured
- Each vendor card displays: "Next: Today 2:00 PM" (or similar)
- Vendors without availability are completely hidden from results

---

## Database Schema

### Primary Table: `vendor_availability_v2`

**Location**: `warmpawzApp/warmpawzaws/db/migrations/057_vendor_capabilities_tables.sql`

```sql
CREATE TABLE IF NOT EXISTS vendor_availability_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  service_type VARCHAR(100),
  service_style VARCHAR(50),  -- Added in migration 500
  service_styles TEXT[],      -- Added in migration 500 (array of styles)
  time_window_start TIME,     -- Optional: specific window start
  time_window_end TIME,       -- Optional: specific window end
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Key Columns Explained

| Column | Type | Purpose | Notes |
|--------|------|---------|-------|
| `vendor_id` | UUID | Links to vendor | Can also match via `vendor_identity` table |
| `staff_id` | UUID | Links to staff member | NULL for vendor-level availability |
| `day_of_week` | INTEGER | 0=Sunday, 1=Monday, ..., 6=Saturday | Used to calculate days until next slot |
| `start_time` | TIME | Slot start time | Fallback if `time_window_start` is NULL |
| `time_window_start` | TIME | Specific window start | Preferred over `start_time` |
| `service_style` | VARCHAR(50) | Single service style | Legacy column |
| `service_styles` | TEXT[] | Array of service styles | Preferred: supports multiple styles per slot |
| `is_available` | BOOLEAN | Slot availability flag | NULL or true = available |
| `is_enabled` | BOOLEAN | Slot enabled flag | false = slot disabled |

### Supporting Tables

#### `vendor_identity`
**Purpose**: Maps vendor identity IDs to actual vendor IDs and phone numbers

```sql
-- Used in query to resolve vendor_id from identity or phone
SELECT id FROM vendor_identity WHERE vendor_id = $1 OR phone = $2
```

#### `staff`
**Purpose**: Staff members can have their own availability separate from vendor

**Note**: Staff availability is queried via `staff_id` in `vendor_availability_v2`

---

## Backend Implementation

### Core Function: `getNextAvailableSlot`

**Location**: `warmpawzApp/warmpawzaws/backend/lambda/src/endpoints/service-discovery.ts` (lines 445-522)

#### Function Signature

```typescript
async function getNextAvailableSlot(
  vendorId: string,
  phone: string,
  serviceStyleFilter?: string[]
): Promise<{ date: string; time: string; display: string } | null>
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `vendorId` | string | Yes | Vendor UUID or identity ID |
| `phone` | string | Yes | Vendor phone number (for identity lookup) |
| `serviceStyleFilter` | string[] | No | Filter by service styles: `['at_home']`, `['at_center']`, `['tele']`, etc. |

#### Return Value

```typescript
{
  date: "2026-02-22",        // ISO date string (YYYY-MM-DD)
  time: "14:00",              // 24-hour format (HH:MM)
  display: "Today 2:00 PM"    // User-friendly display string
} | null  // null if no availability found
```

#### Complete Implementation

```typescript
async function getNextAvailableSlot(
  vendorId: string,
  phone: string,
  serviceStyleFilter?: string[]
): Promise<{ date: string; time: string; display: string } | null> {
  try {
    const now = new Date();
    const currentDayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    // Build query conditionally based on whether we have service style filter
    let va2Query = `
      SELECT day_of_week, COALESCE(time_window_start, start_time) as start_time
      FROM vendor_availability_v2
      WHERE (vendor_id = $1 OR vendor_id IN (SELECT id FROM vendor_identity WHERE vendor_id = $1 OR phone = $2))
        AND (is_available IS NULL OR is_available = true)
    `;
    const params: any[] = [vendorId, phone || ''];
    
    if (serviceStyleFilter && serviceStyleFilter.length > 0) {
      va2Query += ` AND (COALESCE(service_styles, ARRAY[]::text[]) && $3::text[] OR service_style = ANY($3::text[]) OR service_type = ANY($3::text[]))`;
      params.push(serviceStyleFilter);
    }
    
    va2Query += ` ORDER BY day_of_week ASC, COALESCE(time_window_start, start_time) ASC`;
    
    const va2 = await query(va2Query, params);
    if (!va2.rows || va2.rows.length === 0) return null;
    
    // Find the next available slot considering current time
    let bestSlot: { daysToAdd: number; timeStr: string } | null = null;
    
    for (const row of va2.rows) {
      const slotDay = Number(row.day_of_week);
      const slotTime = (row.start_time || '09:00').toString().substring(0, 5);
      let daysToAdd = slotDay - currentDayOfWeek;
      
      if (daysToAdd < 0) daysToAdd += 7;
      
      // If it's today, check if the time has already passed
      if (daysToAdd === 0 && slotTime <= currentHHMM) {
        // This slot is today but already passed - try next week same day
        daysToAdd = 7;
      }
      
      if (!bestSlot || daysToAdd < bestSlot.daysToAdd || (daysToAdd === bestSlot.daysToAdd && slotTime < bestSlot.timeStr)) {
        bestSlot = { daysToAdd, timeStr: slotTime };
      }
    }
    
    if (!bestSlot) return null;
    
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + bestSlot.daysToAdd);
    const formatted = new Date(`2000-01-01T${bestSlot.timeStr}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    
    let display: string;
    if (bestSlot.daysToAdd === 0) {
      display = `Today ${formatted}`;
    } else if (bestSlot.daysToAdd === 1) {
      display = `Tomorrow ${formatted}`;
    } else if (bestSlot.daysToAdd <= 6) {
      // This week - show weekday
      display = `${targetDate.toLocaleDateString('en-US', { weekday: 'short' })} ${formatted}`;
    } else {
      // Next week or later - show date
      display = `${targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${formatted}`;
    }
    
    return {
      date: targetDate.toISOString().split('T')[0],
      time: bestSlot.timeStr,
      display,
    };
  } catch (_) {
    return null;
  }
}
```

#### Algorithm Breakdown

1. **Get Current Time Context**
   - `currentDayOfWeek`: 0-6 (Sunday-Saturday)
   - `currentHHMM`: "14:30" format for time comparison

2. **Query Availability Slots**
   - Match vendor by `vendor_id` OR via `vendor_identity` lookup (by vendor_id or phone)
   - Filter: `is_available IS NULL OR is_available = true`
   - If `serviceStyleFilter` provided: match against `service_styles` array, `service_style`, or `service_type`
   - Order by `day_of_week ASC, start_time ASC` to get earliest slots first

3. **Find Best Slot**
   - For each slot, calculate `daysToAdd` (days until slot day)
   - If slot is today but time has passed, add 7 days (next week)
   - Select slot with minimum `daysToAdd`, breaking ties by earliest time

4. **Format Display String**
   - `daysToAdd === 0`: "Today 2:00 PM"
   - `daysToAdd === 1`: "Tomorrow 2:00 PM"
   - `daysToAdd <= 6`: "Mon 2:00 PM" (this week)
   - `daysToAdd >= 7`: "Feb 25 2:00 PM" (next week or later)

---

## Integration Points

### CRITICAL: Service Style Filter Must Always Be Passed

**Bug Fixed (2026-02-22)**: The `getNextAvailableSlot` function accepts an optional `serviceStyleFilter` parameter. Previously, most call sites in the `by-style` endpoint did NOT pass this parameter, causing the function to return the earliest slot from ANY service style (e.g., returning a 9:00 AM at_home slot when the user searched for `tele` which starts at 4:00 PM).

**Rule**: Every call to `getNextAvailableSlot` **MUST** pass `acceptableStyles` (or equivalent) as the third parameter. Without this, vendors will show incorrect "next available" times that don't match the service style being browsed.

**Example of the bug**:
- Vendor has `at_home` availability starting at 9:00 AM and `tele` availability starting at 4:00 PM
- User searches for `tele` services
- Without service style filter: `getNextAvailableSlot` returns "9:00 AM" (from at_home - WRONG)
- With service style filter: `getNextAvailableSlot` returns "4:00 PM" (from tele - CORRECT)

### Where `getNextAvailableSlot` is Called

#### 1. `/customer/services/by-style` Endpoint

**Location**: `service-discovery.ts`

**Usage Pattern** (all calls MUST include `acceptableStyles`):
```typescript
// acceptableStyles is defined earlier in the endpoint as:
const acceptableStyles: string[] = acceptableStylesForService(serviceStyle);

const nextAvailable = await getNextAvailableSlot(vendorId, phone, acceptableStyles);

// Filter out vendors without availability
if (!nextAvailable) {
  console.log(`[by-style] vendor ${vendorId} filtered - no availability set`);
  continue; // Skip this vendor
}

// Add to provider object
providers.push({
  // ... other fields
  nextAvailable: nextAvailable,
  // ...
});
```

**Called For** (ALL with `acceptableStyles` filter):
- At-center vendors (line ~5288): `getNextAvailableSlot(vendor.vendor_id, phone, acceptableStyles)`
- Individual providers (line ~5690): `getNextAvailableSlot(indVendorId, ind.phone, acceptableStyles)`
- Staff providers (line ~5894): `getNextAvailableSlot(staff.vendor_id, staff.phone, acceptableStyles)`
- Vendor identity providers (line ~6032): `getNextAvailableSlot(vi.vendor_id, vi.phone, acceptableStyles)`
- Fallback vendors (line ~6310): `getNextAvailableSlot(vendor.vendor_id, vendor.phone, acceptableStyles)`

#### 2. `/customer/discover-services` Endpoint

**Location**: `service-discovery.ts` (lines ~1218, ~1785)

**Usage Pattern** (uses centralized function instead of inline code):
```typescript
// Section 1: tele/at_home solo vendors
const nextAvailableResult = await getNextAvailableSlot(vendor.id, vendor.phone || '', acceptableServiceStyles);
const nextAvailableSlot = nextAvailableResult ? {
  date: nextAvailableResult.date,
  time: nextAvailableResult.time,
  formattedDisplay: nextAvailableResult.display,
} : null;

// Section 2: at_center vendors
const acceptableStylesLocal = serviceStyle ? acceptableStylesForService(serviceStyle) : [];
const nextAvailableResult2 = await getNextAvailableSlot(vendor.id, vendor.phone || '', acceptableStylesLocal.length > 0 ? acceptableStylesLocal : undefined);
const nextAvailableSlot = nextAvailableResult2 ? {
  date: nextAvailableResult2.date,
  time: nextAvailableResult2.time,
  formattedDisplay: nextAvailableResult2.display,
} : null;
```

**Why centralized**: Previously, discover-services had inline availability calculation code that didn't account for "today's slots already passed" edge case. Now it uses `getNextAvailableSlot` which handles this correctly.

### How `acceptableStylesForService` Works

```typescript
function acceptableStylesForService(serviceStyle: string | null | undefined): string[] {
  // Returns normalized style + legacy aliases
  // 'at_center' → ['at_center', 'at_vendor']
  // 'tele' → ['tele', 'online', 'video_consultation']
  // 'at_home' → ['at_home']
}
```

This ensures that vendor availability stored with legacy style names (e.g., `at_vendor` instead of `at_center`) is still matched correctly.

---

## Frontend Implementation

### Component: `UniversalServiceProviderList`

**Location**: `warmpawzApp/warmpawzaws/apps/customer-web/components/customer/shared/UniversalServiceProviderList.tsx`

### Interface Definition

```typescript
interface Provider {
  // ... other fields
  nextAvailableSlot?: string;  // Display string: "Today 2:00 PM"
  // ...
}
```

### Data Mapping (Lines 620-631)

The API returns `nextAvailable` as an object, but the UI expects `nextAvailableSlot` as a string:

```typescript
// ✅ FIX: Map nextAvailable object to nextAvailableSlot string for display
nextAvailableSlot: (() => {
  if (typeof p.nextAvailableSlot === 'string') return p.nextAvailableSlot;
  if (p.nextAvailableSlot && typeof p.nextAvailableSlot === 'object') {
    return p.nextAvailableSlot.formattedDisplay || p.nextAvailableSlot.display || undefined;
  }
  if (typeof p.nextAvailability === 'string') return p.nextAvailability;
  if (p.nextAvailable && typeof p.nextAvailable === 'object') {
    return p.nextAvailable.display || p.nextAvailable.formattedDisplay || undefined;
  }
  return undefined;
})(),
```

**Why This Mapping?**
- API returns: `{ date: "2026-02-22", time: "14:00", display: "Today 2:00 PM" }`
- UI needs: `"Today 2:00 PM"` (string)
- Handles multiple possible field names for backward compatibility

### UI Display (Lines 426-431)

```tsx
{/* Next Available */}
{provider.nextAvailableSlot && (
  <div className="flex items-center gap-1 text-xs text-green-600 mb-2">
    <Clock className="w-3 h-3" />
    <span>Next: {provider.nextAvailableSlot}</span>
  </div>
)}
```

**Visual Design**:
- Green text (`text-green-600`)
- Clock icon from `lucide-react`
- Small text (`text-xs`)
- Only shown if `nextAvailableSlot` exists

### Sorting by Availability (Lines 817-820)

```typescript
case 'availability':
  if (a.nextAvailableSlot && !b.nextAvailableSlot) return -1;
  if (!a.nextAvailableSlot && b.nextAvailableSlot) return 1;
  return 0;
```

**Behavior**: Vendors with availability appear first when sorting by availability.

---

## API Endpoints

### 1. GET `/customer/services/by-style`

**Location**: `service-discovery.ts`

**Query Parameters**:
- `style`: Service style (`at_home`, `at_center`, `tele`)
- `category`: Optional category filter
- `roleId`: Optional role filter
- `lat`, `lng`: Optional location for distance calculation

**Response Format**:
```json
{
  "success": true,
  "style": "at_home",
  "providers": [
    {
      "providerId": "uuid",
      "vendorId": "uuid",
      "name": "Vendor Name",
      "nextAvailable": {
        "date": "2026-02-22",
        "time": "14:00",
        "display": "Today 2:00 PM"
      },
      "services": [...]
    }
  ],
  "total": 1
}
```

**Key Behavior**:
- Only returns providers with `nextAvailable` set (non-null)
- Providers without availability are filtered out before response

### 2. GET `/customer/discover-services`

**Location**: `service-discovery.ts`

**Query Parameters**:
- `serviceStyle`: Service style filter
- `category`: Optional category
- `lat`, `lng`: Optional location

**Response Format**: Similar to `/by-style`, includes `nextAvailable` in provider objects.

---

## Data Flow

### Complete Flow Diagram

```
1. Customer searches for services
   ↓
2. Frontend calls GET /customer/services/by-style?style=at_home
   ↓
3. Backend queries vendors with matching services
   ↓
4. For each vendor:
   a. Call getNextAvailableSlot(vendorId, phone, [serviceStyle])
   b. Query vendor_availability_v2 table
   c. Calculate next slot
   d. Format display string
   ↓
5. Filter: Skip vendors where getNextAvailableSlot returns null
   ↓
6. Return providers array with nextAvailable object
   ↓
7. Frontend maps nextAvailable.display → nextAvailableSlot string
   ↓
8. UI renders "Next: Today 2:00 PM" on provider card
```

### Step-by-Step Example

**Input**: Customer searches "Veterinarian at home"

1. **API Call**: `GET /customer/services/by-style?style=at_home&category=vet&roleId=veterinarian`

2. **Backend Processing**:
   ```typescript
   // Find vendors with at_home vet services
   const vendors = await query(/* vendor query */);
   
   // For each vendor
   for (const vendor of vendors) {
     const nextAvailable = await getNextAvailableSlot(
       vendor.id,
       vendor.phone,
       ['at_home']
     );
     
     if (!nextAvailable) continue; // Skip vendor
     
     providers.push({
       vendorId: vendor.id,
       name: vendor.name,
       nextAvailable: nextAvailable, // { date, time, display }
       // ...
     });
   }
   ```

3. **Response**:
   ```json
   {
     "providers": [
       {
         "vendorId": "abc-123",
         "name": "Dr. Smith",
         "nextAvailable": {
           "date": "2026-02-22",
           "time": "14:00",
           "display": "Today 2:00 PM"
         }
       }
     ]
   }
   ```

4. **Frontend Mapping**:
   ```typescript
   const provider = {
     ...apiProvider,
     nextAvailableSlot: apiProvider.nextAvailable.display // "Today 2:00 PM"
   };
   ```

5. **UI Render**:
   ```tsx
   <div>Next: Today 2:00 PM</div>
   ```

---

## Key Algorithms

### Algorithm 1: Days Until Next Slot

```typescript
let daysToAdd = slotDay - currentDayOfWeek;

if (daysToAdd < 0) daysToAdd += 7;  // Wrap to next week

// If today but time passed, move to next week
if (daysToAdd === 0 && slotTime <= currentHHMM) {
  daysToAdd = 7;
}
```

**Example**:
- Today: Wednesday (day 3)
- Slot: Monday (day 1)
- Calculation: `1 - 3 = -2` → `-2 + 7 = 5` days (next Monday)

### Algorithm 2: Best Slot Selection

```typescript
if (!bestSlot || 
    daysToAdd < bestSlot.daysToAdd || 
    (daysToAdd === bestSlot.daysToAdd && slotTime < bestSlot.timeStr)) {
  bestSlot = { daysToAdd, timeStr: slotTime };
}
```

**Priority**:
1. Earliest day (minimum `daysToAdd`)
2. If same day, earliest time (minimum `timeStr`)

### Algorithm 3: Display Format Selection

```typescript
if (daysToAdd === 0) {
  display = `Today ${formatted}`;           // "Today 2:00 PM"
} else if (daysToAdd === 1) {
  display = `Tomorrow ${formatted}`;        // "Tomorrow 2:00 PM"
} else if (daysToAdd <= 6) {
  display = `${weekday} ${formatted}`;       // "Mon 2:00 PM"
} else {
  display = `${month day} ${formatted}`;    // "Feb 25 2:00 PM"
}
```

---

## Edge Cases & Error Handling

### Edge Case 1: No Availability Records

**Scenario**: Vendor has no rows in `vendor_availability_v2`

**Handling**:
```typescript
const va2 = await query(va2Query, params);
if (!va2.rows || va2.rows.length === 0) return null;
```

**Result**: Vendor is filtered out from results (doesn't appear in search)

### Edge Case 2: All Slots Today Have Passed

**Scenario**: Current time is 6:00 PM, vendor has slots at 9:00 AM and 2:00 PM today

**Handling**:
```typescript
if (daysToAdd === 0 && slotTime <= currentHHMM) {
  daysToAdd = 7; // Move to next week same day
}
```

**Result**: Shows next week's slot (e.g., "Mon 9:00 AM" instead of "Today 9:00 AM")

### Edge Case 3: Vendor Identity Resolution

**Scenario**: Vendor ID might be identity ID, not actual vendor UUID

**Handling**:
```sql
WHERE (vendor_id = $1 OR vendor_id IN (
  SELECT id FROM vendor_identity 
  WHERE vendor_id = $1 OR phone = $2
))
```

**Result**: Matches availability via identity table if direct match fails

### Edge Case 4: Service Style Mismatch

**Scenario**: Vendor has availability for `at_center` but customer searches `at_home`

**Handling**:
```typescript
if (serviceStyleFilter && serviceStyleFilter.length > 0) {
  va2Query += ` AND (COALESCE(service_styles, ARRAY[]::text[]) && $3::text[] 
              OR service_style = ANY($3::text[]) 
              OR service_type = ANY($3::text[]))`;
}
```

**Result**: Only slots matching requested service style are considered

### Edge Case 5: Multiple Service Styles Per Slot

**Scenario**: Slot has `service_styles = ['at_home', 'tele']`

**Handling**: PostgreSQL array overlap operator `&&` matches if any style matches:
```sql
COALESCE(service_styles, ARRAY[]::text[]) && $3::text[]
```

**Result**: Slot is included if it supports any requested style

### Edge Case 6: Different Start Times Per Service Style (CRITICAL BUG FIX)

**Scenario**: Vendor has different availability windows for different service styles:
- `at_home`: 9:00 AM - 5:00 PM
- `tele`: 4:00 PM - 9:00 PM
- `at_center`: 10:00 AM - 6:00 PM

**Problem (Before Fix)**: `getNextAvailableSlot` was called without service style filter, so it returned the earliest slot across ALL styles. For a `tele` search, it would return "9:00 AM" (from at_home) instead of "4:00 PM" (from tele).

**Root Cause**: 4 out of 5 call sites in the `by-style` endpoint did not pass `acceptableStyles` to `getNextAvailableSlot`:
```typescript
// ❌ WRONG (no service style filter - returns ANY style's earliest slot)
const indNextAvailable = await getNextAvailableSlot(indVendorId, ind.phone || '');

// ✅ CORRECT (filters by service style - returns style-specific slot)
const indNextAvailable = await getNextAvailableSlot(indVendorId, ind.phone || '', acceptableStyles);
```

**Fix Applied**: All call sites now pass `acceptableStyles` as the third parameter.

**Verification Results** (2026-02-22):
- `tele` API → "Tomorrow 4:00 PM" ✅ (was "Tomorrow 9:00 AM" ❌)
- `at_home` API → "Tomorrow 1:00 PM" ✅ (different from tele)

**How to Prevent Regression**: 
- ALWAYS search for `getNextAvailableSlot(` and verify ALL calls pass service style filter
- If adding a new call, copy from existing pattern: `await getNextAvailableSlot(vendorId, phone, acceptableStyles)`

### Error Handling

**Try-Catch Block**:
```typescript
try {
  // ... calculation logic
} catch (_) {
  return null;  // Silent failure - vendor filtered out
}
```

**Rationale**: If availability calculation fails, vendor is simply not shown (graceful degradation)

---

## Testing & Verification

### Manual Testing Steps

1. **Test Vendor with Availability**:
   ```sql
   -- Insert test availability
   INSERT INTO vendor_availability_v2 (vendor_id, day_of_week, start_time, end_time, service_style)
   VALUES ('test-vendor-id', 3, '09:00', '17:00', 'at_home');
   ```

2. **Call API**:
   ```bash
   curl "https://api.example.com/customer/services/by-style?style=at_home"
   ```

3. **Verify Response**:
   - Vendor appears in `providers` array
   - `nextAvailable` object exists with `date`, `time`, `display`
   - `display` format matches current day/time

### Test Cases

| Scenario | Expected Result |
|----------|----------------|
| Slot today, time not passed | "Today 2:00 PM" |
| Slot today, time passed | Next week same day (e.g., "Mon 2:00 PM") |
| Slot tomorrow | "Tomorrow 2:00 PM" |
| Slot this week (not today/tomorrow) | "Wed 2:00 PM" |
| Slot next week | "Feb 25 2:00 PM" |
| No availability records | Vendor filtered out (not in response) |
| Availability for different service style | Vendor filtered out if no matching style |

### Database Verification Queries

```sql
-- Check if vendor has availability
SELECT COUNT(*) FROM vendor_availability_v2 
WHERE vendor_id = 'vendor-uuid' 
AND (is_available IS NULL OR is_available = true);

-- Check service style matching
SELECT * FROM vendor_availability_v2 
WHERE vendor_id = 'vendor-uuid'
AND (service_styles && ARRAY['at_home']::text[] 
     OR service_style = 'at_home');
```

---

## Troubleshooting Guide

### Problem: Vendor Not Appearing in Results

**Possible Causes**:
1. No availability records in `vendor_availability_v2`
2. All slots have `is_available = false`
3. Service style mismatch (vendor has `at_center` but search is `at_home`)
4. Vendor ID resolution failure

**Debug Steps**:
```sql
-- 1. Check availability records
SELECT * FROM vendor_availability_v2 WHERE vendor_id = 'vendor-uuid';

-- 2. Check service styles
SELECT service_style, service_styles FROM vendor_availability_v2 
WHERE vendor_id = 'vendor-uuid';

-- 3. Check vendor_identity mapping
SELECT * FROM vendor_identity WHERE vendor_id = 'vendor-uuid' OR phone = 'phone-number';
```

### Problem: Wrong Time Displayed

**Possible Causes**:
1. Timezone mismatch (server vs client)
2. `time_window_start` vs `start_time` confusion
3. Date calculation error

**Debug Steps**:
```typescript
// Add logging in getNextAvailableSlot
console.log('Current time:', now);
console.log('Current day of week:', currentDayOfWeek);
console.log('Slot day:', slotDay);
console.log('Days to add:', daysToAdd);
console.log('Best slot:', bestSlot);
```

### Problem: "Today" Showing for Tomorrow

**Possible Causes**:
1. Time comparison using string instead of Date
2. Timezone offset not accounted for

**Fix**: Ensure `currentHHMM` uses server timezone consistently

### Problem: Next Available Slot Shows Wrong Time For Service Style

**Symptom**: API shows "9:00 AM" for tele, but actual tele slots start at 4:00 PM.

**Root Cause**: `getNextAvailableSlot` was called without `serviceStyleFilter` parameter, so it returned the earliest slot from ANY service style.

**Fix**: Ensure ALL calls to `getNextAvailableSlot` pass `acceptableStyles` as the third parameter.

**Debug Steps**:
1. Search for `getNextAvailableSlot(` in `service-discovery.ts`
2. Verify every call includes the service style filter (third parameter)
3. If any call is missing it, add `acceptableStyles` as the third argument
4. Check `vendor_availability_v2` for the vendor to see different start times per service style:
```sql
SELECT service_styles, service_style, COALESCE(time_window_start, start_time) as start_time, day_of_week
FROM vendor_availability_v2
WHERE vendor_id = 'vendor-uuid'
ORDER BY day_of_week, start_time;
```

**Verification**: After fix, call the API for each service style and compare:
```powershell
# Should return DIFFERENT next available times for different styles
# Tele: "Tomorrow 4:00 PM"
Invoke-RestMethod "https://api/customer/services/by-style?style=tele&category=vet"
# At_home: "Tomorrow 1:00 PM"  
Invoke-RestMethod "https://api/customer/services/by-style?style=at_home&category=vet"
```

### Problem: Multiple Vendors with Same Next Available Time

**Expected Behavior**: This is normal - multiple vendors can have the same next available slot.

**If Unwanted**: Add secondary sorting by vendor rating or distance.

---

## Important Implementation Notes

### 1. Vendor Identity Resolution

The query supports multiple vendor ID formats:
- Direct `vendor_id` UUID
- Identity ID (resolved via `vendor_identity` table)
- Phone number lookup

**Why**: Vendors can be referenced by identity ID in some flows, but availability is stored by actual vendor UUID.

### 2. Service Style Filtering Priority

The query checks three fields in order:
1. `service_styles` array (preferred - supports multiple styles)
2. `service_style` single value (legacy)
3. `service_type` (legacy)

**Why**: Migration from single `service_style` to array `service_styles` required backward compatibility.

### 3. Time Window vs Start Time

The query uses:
```sql
COALESCE(time_window_start, start_time) as start_time
```

**Why**: `time_window_start` is optional and more specific; `start_time` is fallback.

### 4. Silent Failure Pattern

If `getNextAvailableSlot` returns `null`, the vendor is simply filtered out (not shown in results).

**Rationale**: 
- Better UX than showing "No availability"
- Vendors should configure availability before appearing in search
- Prevents customer frustration from seeing unavailable vendors

### 5. Service Style Filter Is MANDATORY (Bug Fix 2026-02-22)

**CRITICAL**: All calls to `getNextAvailableSlot` **MUST** pass the service style filter. Without it, the function returns slots from ANY service style, causing incorrect display.

**The Bug**: A vendor with `at_home` starting at 9:00 AM and `tele` starting at 4:00 PM would show "9:00 AM" for both, because the function was called without filtering by the requested style.

**Verification command to detect missing filters**:
```bash
# Search for calls without third parameter
grep -n "getNextAvailableSlot(" service-discovery.ts | grep -v "acceptableStyles\|serviceStyleFilter\|acceptableServiceStyles\|acceptableStylesLocal\|acceptableStylesFallback\|acceptableStylesForStaff"
```

If any results appear, those calls need the service style filter added.

### 6. Centralized vs Inline Implementation

**Rule**: Always use the `getNextAvailableSlot` function. Do NOT duplicate the availability logic inline.

**Why**: The centralized function handles edge cases (today's passed slots, service style filtering, vendor identity resolution) that inline code often misses.

**Before (BAD - inline code with bugs)**:
```typescript
const va2Result = await query(`SELECT ... FROM vendor_availability_v2 ... LIMIT 1`);
const slot = va2Result.rows[0]; // BUG: doesn't check if today's slot already passed
```

**After (GOOD - centralized function)**:
```typescript
const nextAvailableResult = await getNextAvailableSlot(vendor.id, vendor.phone, acceptableStyles);
const nextAvailableSlot = nextAvailableResult ? {
  date: nextAvailableResult.date,
  time: nextAvailableResult.time,
  formattedDisplay: nextAvailableResult.display,
} : null;
```

### 7. Frontend Mapping Flexibility

The frontend mapping handles multiple field names:
- `nextAvailableSlot` (string)
- `nextAvailable.display` (object property)
- `nextAvailability` (legacy string)
- `nextAvailable.formattedDisplay` (alternative property)

**Why**: API evolution and backward compatibility with different response formats.

---

## Database Indexes

### Recommended Indexes

```sql
-- For vendor_id lookups
CREATE INDEX IF NOT EXISTS idx_vendor_availability_v2_vendor_id 
ON vendor_availability_v2(vendor_id);

-- For service style filtering
CREATE INDEX IF NOT EXISTS idx_vendor_availability_service_styles 
ON vendor_availability_v2 USING GIN(service_styles);

-- For day_of_week sorting
CREATE INDEX IF NOT EXISTS idx_vendor_availability_day_time 
ON vendor_availability_v2(day_of_week, start_time);
```

**Location**: These indexes are created in migration `500_advanced_availability_system.sql`

---

## Migration History

### Migration 057: Initial Table Creation
- Created `vendor_availability_v2` table
- Basic columns: `vendor_id`, `day_of_week`, `start_time`, `end_time`

### Migration 500: Advanced Availability System
- Added `service_styles` array column
- Added `time_window_start` and `time_window_end`
- Added `buffer_time` and `max_capacity`
- Created GIN index on `service_styles`

---

## Future Enhancements

### Potential Improvements

1. **Real-time Availability**: Consider existing bookings when calculating next slot
2. **Holiday Handling**: Exclude holidays from availability calculation
3. **Break Times**: Account for vendor breaks (lunch, tea) in slot calculation
4. **Capacity Limits**: Check if slot is fully booked before showing as available
5. **Timezone Support**: Handle vendors in different timezones correctly

### Implementation Hints

- Use `bookings` table to check existing appointments
- Use `vendor_holidays_enhanced` table for holiday exclusion
- Use `vendor_breaks` table for break time exclusion
- Join with `vendor_slot_services` for capacity checking

---

## Code References

### Backend Files

1. **Core Function**: `warmpawzApp/warmpawzaws/backend/lambda/src/endpoints/service-discovery.ts`
   - `getNextAvailableSlot()`: Lines 445-522
   - Integration points: Lines 5344, 5746, 5950, 6088, 6366, 1368

2. **Database Schema**: `warmpawzApp/warmpawzaws/db/migrations/057_vendor_capabilities_tables.sql`
   - Table creation: Lines 145-156

3. **Schema Enhancements**: `warmpawzApp/warmpawzaws/db/migrations/500_advanced_availability_system.sql`
   - `service_styles` array: Lines 19-32
   - Indexes: Line 189

### Frontend Files

1. **Provider List Component (at_home/tele)**: `warmpawzApp/warmpawzaws/apps/customer-web/components/customer/shared/UniversalServiceProviderList.tsx`
   - Data mapping: Lines 620-631
   - UI display: Lines 426-431
   - Sorting: Lines 817-820

2. **Clinic List Component (at_center)**: `warmpawzApp/warmpawzaws/apps/customer-web/components/customer/vet/ClinicListView.tsx`
   - Interface: `Clinic` type with `nextAvailableSlot` and `operatingHours` fields
   - Data mapping: `loadClinics` function – maps `nextAvailableSlot` from API
   - UI display: Conditional render – green "Next: ..." or gray static timing

---

## Summary Checklist for Re-implementation

If this feature needs to be re-implemented, ensure:

- [ ] `vendor_availability_v2` table exists with required columns
- [ ] `getNextAvailableSlot()` function is implemented with correct algorithm
- [ ] **CRITICAL**: Service style filtering is applied in query (third parameter)
- [ ] **CRITICAL**: ALL call sites pass `acceptableStyles` to `getNextAvailableSlot` (search for all calls!)
- [ ] Different service styles (tele, at_home, at_center) return DIFFERENT next-available times
- [ ] Today's passed slots are correctly handled (skipped with `daysToAdd = 7`)
- [ ] Vendors without availability are filtered out (not shown)
- [ ] Display format logic handles today/tomorrow/this week/next week
- [ ] Frontend maps `nextAvailable.display` to `nextAvailableSlot` string
- [ ] UI component displays "Next: {slot}" with Clock icon
- [ ] Error handling returns `null` on failure (silent filtering)
- [ ] Vendor identity resolution supports multiple ID formats
- [ ] Database indexes are created for performance
- [ ] Inline availability code in `discover-services` uses `getNextAvailableSlot` (not duplicated inline logic)
- [ ] No call to `getNextAvailableSlot` is missing the service style filter parameter
- [ ] `discover-services` at_center query includes `draft` in `publish_status` filter
- [ ] `discover-services` at_center post-query filter requires `hasNextAvailability`
- [ ] `ClinicListView.tsx` maps `nextAvailableSlot` from API and displays it with green styling
- [ ] `ClinicListView.tsx` falls back to static timing/open-closed when `nextAvailableSlot` is absent
- [ ] `getNextAvailableSlot` queries `bookings` table to skip booked slots (not just availability windows)
- [ ] `getNextAvailableSlot` resolves `vendor_identity.id` → `vendors.id` for bookings query
- [ ] Available-slots overlap check uses `slotDuration` (30 min) for `bEnd`, NOT stored `duration_minutes`
- [ ] Booking creation overlap check in `bookings-enhanced.ts` uses `SLOT_SIZE=30` (atomic)
- [ ] Booking creation overlap check in `bookings.ts` uses `SLOT_SIZE=30` (atomic)

---

## Bug Fix History

### Bug Fix 1: Service-Style-Specific Next Available Slot (2026-02-22)

**Symptom**: Tele API showed "Tomorrow 9:00 AM" but actual tele slots start at 4:00 PM.

**Root Cause**: 4 out of 5 calls to `getNextAvailableSlot` in the `by-style` endpoint did NOT pass `acceptableStyles` as the third parameter. Additionally, 2 inline implementations in `discover-services` had bugs (didn't check if today's slots had passed, duplicated logic).

**Fix Summary**:
1. Added `acceptableStyles` parameter to ALL `getNextAvailableSlot` calls in `by-style` endpoint
2. Replaced 2 inline availability calculations in `discover-services` with calls to centralized `getNextAvailableSlot`

**Files Changed**: `service-discovery.ts`

**Calls Fixed**:
| Call Site | Before | After |
|-----------|--------|-------|
| Individual providers (line ~5690) | `getNextAvailableSlot(id, phone)` | `getNextAvailableSlot(id, phone, acceptableStyles)` |
| Staff providers (line ~5894) | `getNextAvailableSlot(id, phone)` | `getNextAvailableSlot(id, phone, acceptableStyles)` |
| Vendor identity (line ~6032) | `getNextAvailableSlot(id, phone)` | `getNextAvailableSlot(id, phone, acceptableStyles)` |
| Fallback vendors (line ~6310) | `getNextAvailableSlot(id, phone)` | `getNextAvailableSlot(id, phone, acceptableStyles)` |
| discover-services section 1 (line ~1218) | Inline code (50 lines) | `getNextAvailableSlot(id, phone, acceptableServiceStyles)` |
| discover-services section 2 (line ~1785) | Inline code (45 lines) | `getNextAvailableSlot(id, phone, acceptableStylesLocal)` |

**Verification**:
```powershell
# Tele should show 4:00 PM, at_home should show different time
$tele = Invoke-RestMethod "https://api/customer/services/by-style?style=tele&category=vet"
$home = Invoke-RestMethod "https://api/customer/services/by-style?style=at_home&category=vet"
Write-Host "Tele: $($tele.providers[0].nextAvailable.display)"
Write-Host "Home: $($home.providers[0].nextAvailable.display)"
# Expected: Different times for different service styles
```

**Deployment**: Production Lambda `warmpawz-prod-api-handler` updated 2026-02-22T16:47:01.

### Bug Fix 2: at_center discover-services – Missing Vendors, No Availability Filter, No UI Slot Display (2026-02-22)

**Symptom**: Three issues with the `GET /customer/discover-services?category=vet&serviceStyle=at_center` endpoint and its UI:
1. `sandhya_vet_clinic` (a Veterinary Clinic with `at_center` services) was **not appearing** in API results.
2. Clinics **without availability** set (e.g., Healing Tails Pet Hospital, Friendly Tails Pet Hospital) were still returned by the API.
3. The `ClinicListView.tsx` frontend component was **not displaying** the `nextAvailableSlot` — it hardcoded `timing: '9 AM - 8 PM'` and `is_open: true`.

---

#### Sub-Fix 2a: `sandhya_vet_clinic` Missing from at_center Results

**Root Cause**: `sandhya_vet_clinic`'s `at_center` services had `publish_status = 'draft'`, but the `discover-services` SQL query only allowed `'published'` and `'auto_published'`:

```sql
-- BEFORE (line 1541 in service-discovery.ts):
AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
```

**Fix**: Added `'draft'` to the `publish_status` filter in **two** locations:

1. **Main vendor query** (line 1541):
```sql
-- AFTER:
AND (vs.publish_status IN ('published','auto_published', 'draft') OR vs.publish_status IS NULL)
```

2. **Services sub-query** (line 1700):
```typescript
// BEFORE:
servicesQuery += ` AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)`;
// AFTER:
servicesQuery += ` AND (vs.publish_status IN ('published','auto_published', 'draft') OR vs.publish_status IS NULL)`;
```

**Why `draft` is included**: During vendor onboarding, services may remain in `draft` status even though they are functional. Excluding them prevents legitimate vendors from appearing in discovery.

---

#### Sub-Fix 2b: Clinics Without Availability Not Filtered

**Root Cause**: The `at_center` post-query filter (line 1963) did **not** require `hasNextAvailability`:

```typescript
// BEFORE:
return hasBusinessName && hasServices;
```

**Fix**: Added `hasNextAvailability` to the filter condition:

```typescript
// AFTER:
return hasBusinessName && hasServices && hasNextAvailability;
```

**Context**: The `hasNextAvailability` variable is computed earlier in the processing loop by calling `getNextAvailableSlot`:

```typescript
const acceptableStylesLocal = serviceStyle ? acceptableStylesForService(serviceStyle) : [];
const nextAvailableResult2 = await getNextAvailableSlot(
  vendor.id, vendor.phone || '',
  acceptableStylesLocal.length > 0 ? acceptableStylesLocal : undefined
);
const hasNextAvailability = !!nextAvailableResult2;
```

**Result**: Vendors like "Healing Tails Pet Hospital" and "Friendly Tails Pet Hospital" that have no availability configured in `vendor_availability_v2` are now excluded from `at_center` discover-services results.

---

#### Sub-Fix 2c: ClinicListView.tsx UI – Display Next Available Slot

**File**: `warmpawzApp/warmpawzaws/apps/customer-web/components/customer/vet/ClinicListView.tsx`

**Root Cause**: The `ClinicListView` component was hardcoding timing and open/closed status:

```typescript
// BEFORE:
timing: '9 AM - 8 PM',
is_open: true,
```

And the rendering only showed static timing:

```tsx
// BEFORE:
<Clock className="w-3.5 h-3.5 text-gray-400" />
<span className="text-sm text-gray-500">{clinic.timing}</span>
```

**Fix – Interface Update**: Added new fields to the `Clinic` interface:

```typescript
interface Clinic {
  // ... existing fields
  nextAvailableSlot?: { date: string; time: string; display: string } | null;
  operatingHours?: any;
}
```

**Fix – Data Mapping**: Updated `loadClinics` to map `nextAvailableSlot` and `operatingHours` from the API response:

```typescript
vendorMap.set(vendorId, {
  // ... existing fields
  timing: service.operatingHours
    ? formatOperatingHours(service.operatingHours)
    : '9 AM - 8 PM',
  is_open: service.is_open !== undefined ? service.is_open : true,
  nextAvailableSlot: service.nextAvailableSlot || service.nextAvailable || null,
  operatingHours: service.operatingHours || null,
});
```

**Fix – UI Rendering**: Replaced the static timing display with conditional logic:

```tsx
<div className="flex items-center justify-between mt-3">
  <div className="flex items-center gap-2 flex-wrap">
    {clinic.nextAvailableSlot ? (
      <div className="flex items-center gap-1">
        <Clock className="w-3.5 h-3.5 text-green-600" />
        <span className="text-sm font-medium text-green-600">
          Next: {clinic.nextAvailableSlot.display}
        </span>
      </div>
    ) : (
      <div className="flex items-center gap-1">
        <Clock className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-sm text-gray-500">{clinic.timing}</span>
      </div>
    )}
    {!clinic.nextAvailableSlot && clinic.is_open !== undefined && (
      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
        clinic.is_open
          ? 'bg-[#EDFFEE] text-[#00C30C]'
          : 'bg-red-50 text-red-600'
      }`}>
        {clinic.is_open ? 'Open' : 'Closed'}
      </span>
    )}
  </div>
  <span className="text-sm font-bold text-[#FF8C42]">{clinic.price_range}</span>
</div>
```

**Visual Behavior**:
- If `nextAvailableSlot` is present: Shows green text "Next: Tomorrow 9:00 AM" with green clock icon.
- If `nextAvailableSlot` is absent: Falls back to static timing (e.g., "9 AM - 8 PM") with gray clock icon and Open/Closed badge.
- The Open/Closed badge is hidden when `nextAvailableSlot` is shown (since availability already implies open status).

---

#### Summary of All Changes for Bug Fix 2

| File | Line(s) | Change |
|------|---------|--------|
| `service-discovery.ts` | ~1541 | Added `'draft'` to `publish_status IN (...)` for at_center vendor query |
| `service-discovery.ts` | ~1700 | Added `'draft'` to `publish_status IN (...)` for at_center services sub-query |
| `service-discovery.ts` | ~1963 | Added `&& hasNextAvailability` to at_center post-query filter |
| `ClinicListView.tsx` | Interface | Added `nextAvailableSlot` and `operatingHours` fields |
| `ClinicListView.tsx` | `loadClinics` | Map `nextAvailableSlot` and `operatingHours` from API |
| `ClinicListView.tsx` | Render | Conditional display: green "Next: ..." or gray static timing |

**Verification**:
```powershell
$resp = Invoke-RestMethod "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/customer/discover-services?category=vet&serviceStyle=at_center"
# Expected:
#   - sandhya_vet_clinic appears with nextAvailable: "Tomorrow 9:00 AM"
#   - Healing Tails and Friendly Tails are NOT returned (no availability set)
Write-Host "Total vendors: $($resp.total)"
foreach ($v in $resp.vendors) {
    Write-Host "  $($v.businessName): NextAvailable=$($v.nextAvailable | ConvertTo-Json -Compress)"
}
```

**Deployment**: 
- Lambda `warmpawz-prod-api-handler` updated 2026-02-22.
- Customer-web frontend deployed to S3 bucket `warmpawz-customer-web-prod` and CloudFront invalidated.

### Bug Fix 3: getNextAvailableSlot Not Checking Bookings (2026-02-22)

**Symptom**: The `getNextAvailableSlot` function returned "Tomorrow 4:00 PM" for tele, but the available-slots API showed that 16:00 was already booked. The correct next available should have been "Tomorrow 4:30 PM" (or "Today 6:00 PM" if slots exist today).

**Root Cause**: `getNextAvailableSlot` only queried `vendor_availability_v2` (configured time windows) but did **NOT** check the `bookings` table. It returned the first slot in the availability window without verifying whether that slot was already booked.

**Fix**: Completely rewrote `getNextAvailableSlot` to:
1. Query availability windows (including `end_time` for slot generation)
2. Loop through the next 14 days
3. For each day with availability, query the `bookings` table for booked slot times
4. Generate 30-minute slots within each availability window
5. Skip past slots (for today) and booked slots
6. Return the first truly available slot

**Key Changes in the Enhanced Function**:

```typescript
// NEW: Also select end_time for slot generation
SELECT day_of_week,
       COALESCE(time_window_start, start_time) as start_time,
       COALESCE(time_window_end, end_time) as end_time
FROM vendor_availability_v2 ...

// NEW: Resolve vendor ID for bookings (bookings use vendors.id, not vendor_identity.id)
let bookingsVendorId = vendorId;
const viCheck = await query(
  `SELECT vendor_id FROM vendor_identity WHERE id = $1 LIMIT 1`,
  [vendorId]
);
if (viCheck.rows[0]?.vendor_id) bookingsVendorId = viCheck.rows[0].vendor_id;

// NEW: For each day, query booked slots
const bookResult = await query(
  `SELECT booking_time FROM bookings
   WHERE vendor_id = $1 AND booking_date = $2
     AND status NOT IN ('cancelled', 'rejected', 'no_show')`,
  [bookingsVendorId, dateStr]
);
const bookedTimes = new Set(bookResult.rows.map(b => normalize(b.booking_time)));

// NEW: Generate 30-min slots and skip booked ones
while (currentMinutes + SLOT_DURATION <= winEnd) {
  const timeStr = formatTime(currentMinutes);
  if (dayOffset === 0 && timeStr <= currentHHMM) { skip; }
  if (bookedTimes.has(timeStr)) { skip; }  // ← NEW CHECK
  return { date, time: timeStr, display };  // First truly available slot
}
```

**Verification Results** (2026-02-22):
- `tele` with 16:00 booked → "Today 6:00 PM" ✅ (was "Tomorrow 4:00 PM" ❌ — now skips booked 16:00 and past slots)
- `at_center` with 09:00 booked → "Tomorrow 9:30 AM" ✅ (was "Tomorrow 9:00 AM" ❌)
- `at_home` → "Tomorrow 1:00 PM" ✅

**Files Changed**: `service-discovery.ts` (lines 445-560)

**Deployment**: Production + Dev Lambda updated 2026-02-22.

---

## Contact & Maintenance

**Last Updated**: 2026-02-22 (Bug Fix 3: getNextAvailableSlot now checks bookings table)

**Related Features**:
- Vendor availability management (vendor-side)
- Booking slot selection (customer-side)
- Service discovery filtering

**Dependencies**:
- `vendor_availability_v2` table
- `vendor_identity` table (for ID resolution)
- `bookings` table (for checking booked slots)
- `service-discovery.ts` endpoint
- `bookings-enhanced.ts` endpoint (booking creation overlap check)
- `bookings.ts` endpoint (legacy booking creation overlap check)
- `UniversalServiceProviderList.tsx` component (at_home/tele provider cards)
- `ClinicListView.tsx` component (at_center clinic cards)

**Critical Rules**:
1. ALWAYS pass service style filter to `getNextAvailableSlot`
2. NEVER duplicate availability logic inline - use the centralized function
3. Different service styles MUST return different next-available times
4. `getNextAvailableSlot` MUST check bookings table (not just availability windows)
5. ALL overlap checks (available-slots, booking creation) MUST use atomic slot model (SLOT_SIZE=30)

---

**End of Document**
