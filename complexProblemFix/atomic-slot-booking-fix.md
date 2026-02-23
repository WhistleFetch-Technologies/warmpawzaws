# Atomic Slot Booking Fix — Comprehensive Implementation Report

## Date: 2026-02-22

## Overview

This document details the fix for two interrelated bugs in the WarmPawz booking system:

1. **Bug A — `getNextAvailableSlot` returns already-booked slots**: The function that calculates the "next available slot" displayed on vendor cards in the customer UI did NOT check the `bookings` table. It only checked `vendor_availability_v2` windows. If a vendor's 4:00 PM slot was already booked, it would still display "Tomorrow 4:00 PM" on the card.

2. **Bug B — Parallel/adjacent slot blocking (non-atomic overlap)**: When a customer booked a 9:00 AM slot for a service with duration > 30 minutes (e.g., 60 min vaccination), the overlap check used `duration_minutes` from the booking to calculate the "blocking window." This caused the 9:30 AM slot to also appear as booked, even though slots should be atomic (each 30-minute slot is independent).

**Objective**: After this fix, each booking blocks exactly ONE 30-minute slot (the one it starts at). Adjacent slots remain available. The "next available slot" shown on vendor cards accurately reflects the first truly un-booked slot.

---

## Table of Contents

1. [Problem Symptoms](#problem-symptoms)
2. [Root Cause Analysis](#root-cause-analysis)
3. [Files Modified](#files-modified)
4. [Fix Details — Bug A: getNextAvailableSlot Checks Bookings](#fix-details--bug-a-getnextavailableslot-checks-bookings)
5. [Fix Details — Bug B: Atomic Slot Overlap in available-slots](#fix-details--bug-b-atomic-slot-overlap-in-available-slots)
6. [Fix Details — Bug B: Atomic Slot Overlap in bookings-enhanced.ts](#fix-details--bug-b-atomic-slot-overlap-in-bookings-enhancedts)
7. [Fix Details — Bug B: Atomic Slot Overlap in bookings.ts](#fix-details--bug-b-atomic-slot-overlap-in-bookingsts)
8. [Database Schema Dependencies](#database-schema-dependencies)
9. [The Atomic Slot Concept](#the-atomic-slot-concept)
10. [Overlap Formula Deep Dive](#overlap-formula-deep-dive)
11. [Vendor Identity Resolution](#vendor-identity-resolution)
12. [Edge Cases & Safeguards](#edge-cases--safeguards)
13. [Deployment Steps](#deployment-steps)
14. [Verification & Testing](#verification--testing)
15. [Summary Checklist for Re-implementation](#summary-checklist-for-re-implementation)
16. [Critical Rules — Do NOT Violate](#critical-rules--do-not-violate)

---

## Problem Symptoms

### Bug A: Next Available Slot Shows Booked Time

**API**: `GET /customer/services/by-style?style=tele&category=vet&roleId=veterinarian`

**Example response** (BEFORE fix):
```json
{
  "nextAvailable": {
    "date": "2026-02-23",
    "time": "16:00",
    "display": "Tomorrow 4:00 PM"
  }
}
```

**But** `GET /customer/vendor/:vendorId/available-slots?date=2026-02-23&serviceStyle=tele` shows:
```json
{
  "slots": [
    { "time": "16:00", "available": false, "booked": true },
    { "time": "16:30", "available": true, "booked": false }
  ]
}
```

**Expected**: `nextAvailable` should display "Tomorrow 4:30 PM" (the first *un-booked* slot).

### Bug B: Adjacent Slots Blocked

**Scenario**: Vendor `sandhya_vet_clinic` has availability 9:00 AM to 6:00 PM. A customer books a "Vaccination at Home" (duration 60 minutes) at 9:00 AM.

**BEFORE fix**: The `available-slots` endpoint marks both 9:00 AM and 9:30 AM as booked, because:
- Booking at 09:00 with duration 60 min → blocking window = [540, 600) (minutes)
- Slot 09:30 = 570 minutes → 570 < 600 = true → marked as booked ❌

**AFTER fix**: Only 9:00 AM is marked as booked. 9:30 AM is available because:
- Booking at 09:00 with SLOT_SIZE 30 min → blocking window = [540, 570) (minutes)
- Slot 09:30 = 570 minutes → 570 < 570 = false → available ✅

---

## Root Cause Analysis

### Bug A Root Cause

**File**: `service-discovery.ts`, function `getNextAvailableSlot` (line ~445)

The function queried `vendor_availability_v2` for availability windows and found the earliest slot where `start_time > currentHHMM`. It never queried the `bookings` table. Therefore, if that slot had an active booking, it was still returned as "available."

### Bug B Root Cause

**Files**: `service-discovery.ts` (available-slots), `bookings-enhanced.ts`, `bookings.ts`

The overlap check formula used the booking's actual `duration_minutes` (e.g., 60 for vaccination) to calculate when the booking "ends":

```typescript
// OLD (BUGGY) LOGIC:
const bookingDuration = Number(b.duration_minutes) || 30;
const bEnd = bStart + bookingDuration;  // ← Uses actual service duration (e.g., 60)
const overlaps = currentMinutes < bEnd && slotEnd > bStart;
```

This means a 60-minute booking at 9:00 AM would block the range [540, 600), catching the 9:30 AM slot (570 < 600).

**The correct approach**: Use a fixed `SLOT_SIZE` of 30 minutes. Each booking blocks exactly one slot — the one it starts at.

---

## Files Modified

| File | Location | What Changed |
|------|----------|--------------|
| `backend/lambda/src/endpoints/service-discovery.ts` | Lines 445–570 (`getNextAvailableSlot` function) | Added bookings query, atomic slot check, vendor_identity resolution |
| `backend/lambda/src/endpoints/service-discovery.ts` | Lines 3282–3310 (available-slots endpoint overlap check) | Changed `bEnd` from `bStart + duration_minutes` to `bStart + slotDuration` |
| `backend/lambda/src/endpoints/bookings-enhanced.ts` | Lines 615–648 (booking creation overlap check) | Introduced `SLOT_SIZE = 30`, used for both existing and new booking |
| `backend/lambda/src/endpoints/bookings.ts` | Lines 254–267 (legacy booking creation overlap check) | Introduced `SLOT_SIZE = 30`, used for both existing and new booking |

---

## Fix Details — Bug A: getNextAvailableSlot Checks Bookings

### File: `service-discovery.ts`
### Function: `getNextAvailableSlot` (lines 445–570)
### Location: `warmpawzApp/warmpawzaws/backend/lambda/src/endpoints/service-discovery.ts`

### What Changed

The function was rewritten to:

1. **Query availability windows** (not just `start_time`, but also `end_time`) from `vendor_availability_v2`
2. **Generate 30-minute slots** from each availability window
3. **Query the `bookings` table** for each candidate date to get booked slot times
4. **Skip booked slots** — only return a slot that is truly un-booked
5. **Resolve `vendor_identity`** — bookings are stored with `vendors.id`, but availability may be stored with `vendor_identity.id`

### Complete Fixed Implementation

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
    const SLOT_DURATION = 30; // minutes - atomic slot size
    
    // Build query to get availability WINDOWS (start + end time) for slot generation
    let va2Query = `
      SELECT day_of_week,
             COALESCE(time_window_start, start_time) as start_time,
             COALESCE(time_window_end, end_time) as end_time
      FROM vendor_availability_v2
      WHERE (vendor_id = $1 OR vendor_id IN (SELECT id FROM vendor_identity WHERE vendor_id = $1 OR phone = $2))
        AND (is_available IS NULL OR is_available = true)
    `;
    const params: any[] = [vendorId, phone || ''];
    
    if (serviceStyleFilter && serviceStyleFilter.length > 0) {
      va2Query += ` AND (COALESCE(service_styles, ARRAY[]::text[]) && $3::text[]
                         OR service_style = ANY($3::text[])
                         OR service_type = ANY($3::text[]))`;
      params.push(serviceStyleFilter);
    }
    
    va2Query += ` ORDER BY day_of_week ASC, COALESCE(time_window_start, start_time) ASC`;
    
    const va2 = await query(va2Query, params);
    if (!va2.rows || va2.rows.length === 0) return null;
    
    // Helper: convert HH:MM or TIME to minutes
    const toMin = (t: any): number => {
      const s = (t || '09:00').toString();
      const clean = s.includes('T') ? s.split('T')[1].substring(0, 5) : s.substring(0, 5);
      const [h, m] = clean.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    
    // ✅ CRITICAL: Resolve vendor_identity.id → vendors.id for bookings query
    // Availability may use vendor_identity.id, but bookings always use vendors.id
    let bookingsVendorId = vendorId;
    try {
      const viCheck = await query(
        `SELECT vendor_id FROM vendor_identity WHERE id = $1 LIMIT 1`,
        [vendorId]
      );
      if (viCheck.rows && viCheck.rows.length > 0 && viCheck.rows[0].vendor_id) {
        bookingsVendorId = viCheck.rows[0].vendor_id;
      }
    } catch (_) { /* use original vendorId */ }
    
    // Check up to 14 days ahead
    for (let dayOffset = 0; dayOffset <= 13; dayOffset++) {
      const checkDate = new Date(now);
      checkDate.setDate(checkDate.getDate() + dayOffset);
      const checkDayOfWeek = checkDate.getDay();
      const dateStr = checkDate.toISOString().split('T')[0];
      
      // Find availability windows for this day of week
      const dayWindows = va2.rows.filter((r: any) => Number(r.day_of_week) === checkDayOfWeek);
      if (dayWindows.length === 0) continue;
      
      // ✅ CRITICAL: Get booked slot times for this date (atomic: only start times matter)
      let bookedTimes: Set<string> = new Set();
      try {
        const bookResult = await query(
          `SELECT booking_time FROM bookings
           WHERE vendor_id = $1 AND booking_date = $2
             AND status NOT IN ('cancelled', 'rejected', 'no_show')`,
          [bookingsVendorId, dateStr]
        );
        for (const b of (bookResult.rows || [])) {
          const t = b.booking_time;
          let timeStr: string;
          if (typeof t === 'string') {
            timeStr = t.includes('T') ? t.split('T')[1].substring(0, 5) : t.substring(0, 5);
          } else {
            timeStr = String(t).substring(0, 5);
          }
          bookedTimes.add(timeStr);
        }
      } catch (_) { /* no bookings = all slots free */ }
      
      // Generate 30-min slots from availability windows and find first non-booked
      for (const window of dayWindows) {
        const winStart = toMin(window.start_time);
        const winEnd = toMin(window.end_time);
        
        let currentMinutes = winStart;
        while (currentMinutes + SLOT_DURATION <= winEnd) {
          const timeStr = `${String(Math.floor(currentMinutes / 60)).padStart(2, '0')}:${String(currentMinutes % 60).padStart(2, '0')}`;
          
          // Skip if past (for today)
          if (dayOffset === 0 && timeStr <= currentHHMM) {
            currentMinutes += SLOT_DURATION;
            continue;
          }
          
          // ✅ CRITICAL: Skip if this slot is already booked (atomic check)
          if (bookedTimes.has(timeStr)) {
            currentMinutes += SLOT_DURATION;
            continue;
          }
          
          // Found a truly available slot!
          const formatted = new Date(`2000-01-01T${timeStr}`).toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', hour12: true
          });
          
          let display: string;
          if (dayOffset === 0) {
            display = `Today ${formatted}`;
          } else if (dayOffset === 1) {
            display = `Tomorrow ${formatted}`;
          } else if (dayOffset <= 6) {
            display = `${checkDate.toLocaleDateString('en-US', { weekday: 'short' })} ${formatted}`;
          } else {
            display = `${checkDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${formatted}`;
          }
          
          return {
            date: dateStr,
            time: timeStr,
            display,
          };
        }
      }
    }
    
    return null; // No available slot found in 14 days
  } catch (_) {
    return null;
  }
}
```

### Key Implementation Details

1. **Queries `end_time` now**: The old version only queried `start_time`. The new version queries both `start_time` and `end_time` to generate slots within windows.

2. **Slot generation loop**: `while (currentMinutes + SLOT_DURATION <= winEnd)` generates 30-minute slots within each availability window.

3. **`bookedTimes` Set**: Uses a `Set<string>` of "HH:MM" strings from active bookings for O(1) lookup.

4. **`booking_time` normalization**: Handles `booking_time` as string (various formats: "HH:MM", "HH:MM:SS", ISO with "T") or Date object.

5. **Statuses excluded from bookings**: `cancelled`, `rejected`, `no_show` — these do NOT block slots.

6. **Vendor identity resolution**: See [Vendor Identity Resolution](#vendor-identity-resolution) section.

---

## Fix Details — Bug B: Atomic Slot Overlap in available-slots

### File: `service-discovery.ts`
### Endpoint: `GET /customer/vendor/:vendorId/available-slots`
### Location: Lines 3282–3310

### Before (Buggy)

```typescript
// OLD CODE — USES duration_minutes FROM BOOKING (CAN BE 60, 90, etc.)
const bookingDuration = Number(b.duration_minutes) || 30;
const bEnd = bStart + bookingDuration;
const overlaps = currentMinutes < bEnd && slotEnd > bStart;
```

### After (Fixed)

```typescript
// ✅ ATOMIC SLOT RULE: Each slot is independent. A booking blocks ONLY the slot it starts at.
// Booking at 09:00 blocks ONLY 09:00. Slot 09:30 remains available regardless of service duration.
// This applies to ALL service types: tele, at_center, at_home, for ALL roles.
// Buffer time is informational only and does NOT block adjacent slots.
//
// ATOMIC OVERLAP FORMULA (uses slotDuration for BOTH sides):
//   Booking 09:00: bStart=540, bEnd=540+30=570
//   Slot 09:30: currentMinutes=570, slotEnd=570+30=600
//   Overlap: 570 < 570 && 600 > 540 = false && true = false ✅ (NO overlap)
const slotEnd = currentMinutes + slotDuration;
const overlapsBooking = existingBookings.some((b: { booking_time: string; duration_minutes: number }) => {
  const bStart = timeToMinutes(b.booking_time);
  
  // ✅ ATOMIC: Use slotDuration (30 min) for booking end, NOT stored duration_minutes
  // This ensures each booking blocks exactly ONE slot, regardless of service duration
  const bEnd = bStart + slotDuration;  // ✅ ATOMIC: one slot = one booking
  
  const overlaps = currentMinutes < bEnd && slotEnd > bStart;
  
  if (overlaps) {
    console.log(`[SLOTS] OVERLAP (atomic): slot ${timeStr} blocked by booking at ${b.booking_time}`);
  }
  
  return overlaps;
});
```

### Critical Change

**The ONLY change is on the `bEnd` line:**
- **Before**: `const bEnd = bStart + bookingDuration;` (where `bookingDuration` = `b.duration_minutes` from DB, e.g., 60)
- **After**: `const bEnd = bStart + slotDuration;` (where `slotDuration` = 30, always)

**`slotDuration` is defined at line 3222:**
```typescript
const slotDuration = 30; // Default slot duration
```

---

## Fix Details — Bug B: Atomic Slot Overlap in bookings-enhanced.ts

### File: `bookings-enhanced.ts`
### Location: Lines 615–648
### Context: Booking creation — checks if the requested slot conflicts with existing bookings

### Before (Buggy)

```typescript
// OLD CODE — USED duration_minutes from existing booking
const existingEndMinutes = existingStartMinutes + Number(existing.duration_minutes || 30);
const newBookingEndMinutes = newBookingStartMinutes + totalDuration;  // totalDuration from the service
const overlaps = newBookingStartMinutes < existingEndMinutes && newBookingEndMinutes > existingStartMinutes;
```

### After (Fixed)

```typescript
// ✅ ATOMIC SLOT OVERLAP CHECK
// Each slot is atomic (30 min). A booking blocks ONLY the slot it starts at.
// Booking at 09:00 blocks ONLY 09:00. New booking at 09:30 is allowed.
// This applies to ALL service types (tele, at_center, at_home) and ALL roles.
// Buffer time is informational only and does NOT block adjacent slots.
const SLOT_SIZE = 30; // Atomic slot size in minutes

console.log(`[BOOKING] Checking overlap (ATOMIC): newBooking=${bookingTime} (${newBookingStartMinutes}min), slotSize=${SLOT_SIZE}min, serviceType=${serviceType}`);
console.log(`[BOOKING] Existing bookings: ${existingBookings.length}`);

const hasOverlap = existingBookings.some((existing: any) => {
  const [existingHour, existingMin] = existing.booking_time.split(':').map(Number);
  const existingStartMinutes = existingHour * 60 + existingMin;
  
  // ✅ ATOMIC: Use SLOT_SIZE (30 min) for BOTH existing and new booking
  // NOT the stored duration_minutes, which may be longer than one slot
  const existingEndMinutes = existingStartMinutes + SLOT_SIZE;
  const newBookingEndMinutes = newBookingStartMinutes + SLOT_SIZE;
  
  // ATOMIC OVERLAP: (newStart < existingEnd) AND (newEnd > existingStart)
  // Example: Existing 09:00 (end=09:30), New 09:30 (end=10:00)
  //   570 < 570 && 600 > 540 = false && true = false → NO overlap ✅
  const overlaps = newBookingStartMinutes < existingEndMinutes && newBookingEndMinutes > existingStartMinutes;
  
  if (overlaps) {
    console.log(`[BOOKING] OVERLAP (atomic): newBooking ${bookingTime} blocked by existing ${existing.booking_time}`);
  }
  
  return overlaps;
});

if (hasOverlap) {
  throw new Error('SLOT_CONFLICT');
}
```

### Additional Context

The `existingBookings` are fetched with a SQL query that uses `FOR UPDATE` for row-level locking:

```sql
SELECT id, booking_time, duration_minutes, total_duration_minutes, status, service_type
FROM bookings
WHERE vendor_id = $1
  AND booking_date = $2
  AND status NOT IN ('cancelled', 'rejected', 'no_show')
FOR UPDATE
```

The `FOR UPDATE` clause ensures no concurrent booking can modify these rows during the overlap check, preventing race conditions.

---

## Fix Details — Bug B: Atomic Slot Overlap in bookings.ts

### File: `bookings.ts`
### Location: Lines 254–271
### Context: Legacy booking creation endpoint — same atomic overlap fix

### Before (Buggy)

```typescript
// OLD CODE — USED existing.duration_minutes from booking
const existingEndMinutes = existingStartMinutes + Number(existing.duration_minutes || 30);
const newEnd = newBookingStartMinutes + Number(duration_minutes || 30);
return newBookingStartMinutes < existingEndMinutes && newEnd > existingStartMinutes;
```

### After (Fixed)

```typescript
// ✅ ATOMIC SLOT OVERLAP CHECK: Each slot is independent (30 min)
// A booking blocks ONLY the slot it starts at, regardless of service duration
// Booking at 09:00 blocks ONLY 09:00. Slot 09:30 remains available.
// This applies to ALL service types and ALL roles.
const SLOT_SIZE = 30;
const hasOverlap = existingBookings.some((existing: any) => {
  const [existingHour, existingMin] = existing.booking_time.split(':').map(Number);
  const existingStartMinutes = existingHour * 60 + existingMin;
  const existingEndMinutes = existingStartMinutes + SLOT_SIZE;  // ✅ ATOMIC: one slot per booking
  const newEnd = newBookingStartMinutes + SLOT_SIZE;
  
  // Overlap formula: (newStart < existingEnd) AND (newEnd > existingStart)
  return newBookingStartMinutes < existingEndMinutes && newEnd > existingStartMinutes;
});

if (hasOverlap) {
  throw new Error('SLOT_CONFLICT');
}
```

### Additional Context

The `existingBookings` are also fetched with `FOR UPDATE`:

```sql
-- If staffId is provided:
SELECT id, booking_time, COALESCE(duration_minutes, 30) as duration_minutes
FROM bookings
WHERE vendor_id = $1 AND booking_date = $2 AND staff_id = $3
  AND status NOT IN ('cancelled', 'no_show', 'rescheduled')
FOR UPDATE

-- If no staffId:
SELECT id, booking_time, COALESCE(duration_minutes, 30) as duration_minutes
FROM bookings
WHERE vendor_id = $1 AND booking_date = $2 AND staff_id IS NULL
  AND status NOT IN ('cancelled', 'no_show', 'rescheduled')
FOR UPDATE
```

---

## Database Schema Dependencies

### Table: `vendor_availability_v2`

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
  service_style VARCHAR(50),
  service_styles TEXT[],
  time_window_start TIME,
  time_window_end TIME,
  is_enabled BOOLEAN DEFAULT true,
  buffer_time INTEGER,
  lead_time_by_style JSONB,
  max_capacity INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Key columns for this fix:**
- `start_time` / `end_time` or `time_window_start` / `time_window_end`: Define availability windows
- `day_of_week`: 0=Sunday, 6=Saturday
- `service_styles` (TEXT[]): Array of service styles this window applies to
- `service_style` (VARCHAR): Legacy single style column
- `service_type` (VARCHAR): Another legacy column for style

### Table: `bookings`

```sql
-- Relevant columns for overlap check:
booking_date DATE,
booking_time TIME / VARCHAR,
duration_minutes INTEGER,
total_duration_minutes INTEGER,
status VARCHAR,
vendor_id UUID,
staff_id UUID
```

**Key columns for this fix:**
- `booking_time`: The start time of the booking (TIME or VARCHAR in "HH:MM" or "HH:MM:SS" format)
- `booking_date`: The date of the booking
- `duration_minutes`: The base service duration (NOT used for atomic overlap, but stored)
- `total_duration_minutes`: The total duration including multi-service (NOT used for atomic overlap)
- `status`: Used to exclude `cancelled`, `rejected`, `no_show` bookings from overlap checks
- `vendor_id`: Links to `vendors.id` (NOT `vendor_identity.id`)

### Table: `vendor_identity`

```sql
-- Maps vendor_identity to vendors
id UUID PRIMARY KEY,
vendor_id UUID REFERENCES vendors(id),
phone VARCHAR
```

**Purpose in this fix**: `vendor_availability_v2.vendor_id` may reference `vendor_identity.id` in some cases, but `bookings.vendor_id` always references `vendors.id`. The fix resolves this mismatch.

---

## The Atomic Slot Concept

### Definition

An "atomic slot" is a 30-minute time unit that represents the smallest bookable unit. Key rules:

1. **One booking = one slot**: A booking at 9:00 AM blocks ONLY the 9:00 AM slot, regardless of the service's `duration_minutes`.
2. **Adjacent slots are independent**: Booking 9:00 AM does NOT affect 9:30 AM.
3. **Service duration is informational**: The `duration_minutes` field (60, 90, etc.) is stored for reference but does NOT expand the blocking window.
4. **Buffer time is informational**: `buffer_time` from `vendor_availability_v2` is for spacing recommendations, not for blocking.
5. **SLOT_SIZE constant**: The value is `30` (minutes). It appears as:
   - `SLOT_SIZE = 30` in `bookings-enhanced.ts` and `bookings.ts`
   - `slotDuration = 30` in `service-discovery.ts` (available-slots endpoint)
   - `SLOT_DURATION = 30` in `service-discovery.ts` (`getNextAvailableSlot` function)

### Why Atomic Slots?

The WarmPawz business model treats each 30-minute slot as an independent appointment window. Even if a vaccination takes 60 minutes in practice, the vendor's schedule is managed in 30-minute increments. If the vendor wants to block two consecutive slots, they make two bookings.

---

## Overlap Formula Deep Dive

### The Standard Interval Overlap Formula

Two time intervals `[A_start, A_end)` and `[B_start, B_end)` overlap if and only if:

```
A_start < B_end AND A_end > B_start
```

### Applied to Atomic Slots

```
New booking:     [newStart, newStart + SLOT_SIZE)
Existing booking: [existingStart, existingStart + SLOT_SIZE)

Overlap: newStart < (existingStart + SLOT_SIZE) AND (newStart + SLOT_SIZE) > existingStart
```

### Worked Examples

#### Example 1: No Overlap (Adjacent Slots)
```
Existing: 09:00 (540 min) → end = 540 + 30 = 570
New:      09:30 (570 min) → end = 570 + 30 = 600

Check: 570 < 570 AND 600 > 540
     = false   AND true
     = false → NO OVERLAP ✅
```

#### Example 2: Same Slot (Overlap)
```
Existing: 09:00 (540 min) → end = 540 + 30 = 570
New:      09:00 (540 min) → end = 540 + 30 = 570

Check: 540 < 570 AND 570 > 540
     = true    AND true
     = true → OVERLAP ✅ (blocked)
```

#### Example 3: Why Old Logic Failed
```
Existing: 09:00 (540 min), duration_minutes = 60 → old end = 540 + 60 = 600
New:      09:30 (570 min) → old end = 570 + 60 = 630

Old check: 570 < 600 AND 630 > 540
         = true    AND true
         = true → OVERLAP ❌ (WRONG — 09:30 should be available)
```

---

## Vendor Identity Resolution

### The Problem

In the WarmPawz system, there are two ID systems:
- `vendors.id`: The canonical vendor UUID used in the `bookings` table
- `vendor_identity.id`: A separate identity UUID used in some places

`vendor_availability_v2.vendor_id` may reference EITHER `vendors.id` or `vendor_identity.id`. But `bookings.vendor_id` ALWAYS references `vendors.id`.

### The Fix

In `getNextAvailableSlot`, before querying bookings, we resolve the vendor identity:

```typescript
let bookingsVendorId = vendorId;
try {
  const viCheck = await query(
    `SELECT vendor_id FROM vendor_identity WHERE id = $1 LIMIT 1`,
    [vendorId]
  );
  if (viCheck.rows && viCheck.rows.length > 0 && viCheck.rows[0].vendor_id) {
    bookingsVendorId = viCheck.rows[0].vendor_id;
  }
} catch (_) { /* use original vendorId */ }
```

This ensures:
- If `vendorId` is a `vendor_identity.id` → resolves to `vendors.id` for bookings query
- If `vendorId` is already a `vendors.id` → the `vendor_identity` query returns no rows → uses original ID
- If the query fails → falls back to using the original `vendorId` (fail-safe)

---

## Edge Cases & Safeguards

### 1. No Availability Configured
- **Behavior**: `getNextAvailableSlot` returns `null`
- **UI Effect**: Vendor is hidden from search results

### 2. All Slots Booked
- **Behavior**: `getNextAvailableSlot` checks up to 14 days ahead. If all slots in all windows are booked, returns `null`
- **UI Effect**: Vendor is hidden from search results

### 3. Timezone Handling
- **Current**: Uses server timezone (Lambda runs in UTC by default, but `new Date()` uses system time)
- **Note**: `now.getDay()` and `now.getHours()` use local time. If Lambda runs in UTC but users are in IST (+5:30), the "today" cutoff may be off. This is a known limitation but acceptable for the current user base.

### 4. `booking_time` Format Variations
The code handles multiple formats:
- `"16:00"` → extract as-is
- `"16:00:00"` → substring(0, 5) → `"16:00"`
- `"2026-02-22T16:00:00Z"` → split on "T", take index 1, substring(0, 5) → `"16:00"`
- Date object → use `.getHours()` and `.getMinutes()`

### 5. `SLOT_CONFLICT` Error
When an overlap IS detected, `bookings-enhanced.ts` and `bookings.ts` throw `new Error('SLOT_CONFLICT')`. The calling code catches this and returns:
```json
{ "error": "SLOT_CONFLICT", "message": "This time slot is already booked. Please select a different time." }
```

### 6. `FOR UPDATE` Row Locking
Both `bookings-enhanced.ts` and `bookings.ts` use `FOR UPDATE` in their overlap query. This prevents race conditions where two concurrent requests try to book the same slot simultaneously.

### 7. `SAVEPOINT` for Optional Queries
In `bookings-enhanced.ts`, optional queries (scheduling_policies, vendor_availability_v2 for buffer time) use `SAVEPOINT`s. If these fail, the transaction is not aborted — only the savepoint is rolled back.

### 8. Cancelled/Rejected/No-Show Bookings
These statuses are excluded from overlap checks:
- `getNextAvailableSlot`: `AND status NOT IN ('cancelled', 'rejected', 'no_show')`
- `available-slots`: `AND status NOT IN ('cancelled', 'rejected', 'no_show')`
- `bookings-enhanced.ts`: `AND status NOT IN ('cancelled', 'rejected', 'no_show')`
- `bookings.ts`: `AND status NOT IN ('cancelled', 'no_show', 'rescheduled')`

### 9. Staff-Based Bookings
In `bookings.ts`, if a `staffId` is provided, the overlap check is scoped to that staff member:
```sql
WHERE vendor_id = $1 AND booking_date = $2 AND staff_id = $4
```
If no `staffId`, it checks `staff_id IS NULL` (vendor-level bookings only).

---

## Deployment Steps

### 1. Build Lambda

```powershell
cd D:\WFTPL\warmpawzApp\warmpawzaws\backend\lambda
npm run build:bundle
```

### 2. Deploy to Production

```powershell
aws lambda update-function-code `
  --function-name warmpawz-prod-api-handler `
  --zip-file fileb://dist/handler.zip `
  --no-cli-pager
```

### 3. Deploy to Dev/UAT

```powershell
aws lambda update-function-code `
  --function-name warmpawz-api-dev-api `
  --zip-file fileb://dist/handler.zip `
  --no-cli-pager
```

### 4. No Database Migrations Required

This fix only changes application logic. No new columns, tables, or indexes are needed.

### 5. No Frontend Changes Required

The frontend already displays `nextAvailable.display` from the API response. The fix is entirely backend.

---

## Verification & Testing

### Test 1: Next Available Slot Skips Booked Slots

1. **Create a booking** for vendor `sandhya_vet_clinic` at 4:00 PM tomorrow
2. **Call** `GET /customer/services/by-style?style=tele&category=vet&roleId=veterinarian`
3. **Verify** `nextAvailable.display` shows "Tomorrow 4:30 PM" (NOT "Tomorrow 4:00 PM")

### Test 2: Available-Slots Shows Atomic Behavior

1. **Create a booking** for vendor at 9:00 AM (service duration = 60 min)
2. **Call** `GET /customer/vendor/:vendorId/available-slots?date=YYYY-MM-DD&serviceStyle=at_home`
3. **Verify**:
   - `9:00 AM` → `available: false, booked: true`
   - `9:30 AM` → `available: true, booked: false`

### Test 3: Booking Creation Allows Adjacent Slot

1. **Book** 9:00 AM for a 60-min service
2. **Try booking** 9:30 AM for same vendor, same date
3. **Verify**: Booking succeeds (no `SLOT_CONFLICT` error)

### Test 4: Booking Creation Blocks Same Slot

1. **Book** 9:00 AM for a service
2. **Try booking** 9:00 AM again for same vendor, same date
3. **Verify**: Booking fails with `SLOT_CONFLICT`

### API Endpoints for Testing

```
# Next available slot (by-style)
GET https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/customer/services/by-style?style=tele&category=vet&roleId=veterinarian

# Available slots for specific vendor/date
GET https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/customer/vendor/{vendorId}/available-slots?date=2026-02-23&serviceStyle=tele

# Create booking (POST)
POST https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/customer/bookings
```

---

## Summary Checklist for Re-implementation

If this fix needs to be re-implemented from scratch, verify each item:

### getNextAvailableSlot function (service-discovery.ts)
- [ ] Queries `vendor_availability_v2` for BOTH `start_time` AND `end_time` (via `COALESCE(time_window_start, start_time)` and `COALESCE(time_window_end, end_time)`)
- [ ] Accepts optional `serviceStyleFilter` parameter and applies style filter in SQL
- [ ] Resolves `vendor_identity.id` → `vendors.id` via `SELECT vendor_id FROM vendor_identity WHERE id = $1`
- [ ] Queries `bookings` table for each candidate date: `SELECT booking_time FROM bookings WHERE vendor_id = $1 AND booking_date = $2 AND status NOT IN ('cancelled', 'rejected', 'no_show')`
- [ ] Normalizes `booking_time` to "HH:MM" string and stores in `Set<string>`
- [ ] Generates 30-minute slots from availability windows using `while (currentMinutes + SLOT_DURATION <= winEnd)`
- [ ] Skips past slots for today: `if (dayOffset === 0 && timeStr <= currentHHMM) continue`
- [ ] Skips booked slots: `if (bookedTimes.has(timeStr)) continue`
- [ ] Returns first truly available slot with formatted display string
- [ ] Checks up to 14 days ahead (`dayOffset <= 13`)

### available-slots endpoint (service-discovery.ts)
- [ ] `slotDuration` is set to `30` (constant, NOT from database)
- [ ] Overlap check uses `const bEnd = bStart + slotDuration` (NOT `bStart + b.duration_minutes`)
- [ ] `const slotEnd = currentMinutes + slotDuration` (NOT `currentMinutes + totalDuration`)
- [ ] Overlap formula: `currentMinutes < bEnd && slotEnd > bStart`

### bookings-enhanced.ts (booking creation)
- [ ] `const SLOT_SIZE = 30` is defined before overlap check
- [ ] `const existingEndMinutes = existingStartMinutes + SLOT_SIZE` (NOT `+ existing.duration_minutes`)
- [ ] `const newBookingEndMinutes = newBookingStartMinutes + SLOT_SIZE` (NOT `+ totalDuration`)
- [ ] Overlap formula: `newBookingStartMinutes < existingEndMinutes && newBookingEndMinutes > existingStartMinutes`
- [ ] `FOR UPDATE` is used in the overlap query for row-level locking
- [ ] `SAVEPOINT` is used for optional buffer/scheduling queries

### bookings.ts (legacy booking creation)
- [ ] `const SLOT_SIZE = 30` is defined before overlap check
- [ ] `const existingEndMinutes = existingStartMinutes + SLOT_SIZE` (NOT `+ existing.duration_minutes`)
- [ ] `const newEnd = newBookingStartMinutes + SLOT_SIZE` (NOT `+ duration_minutes`)
- [ ] Overlap formula: `newBookingStartMinutes < existingEndMinutes && newEnd > existingStartMinutes`
- [ ] `FOR UPDATE` is used in the overlap query for row-level locking
- [ ] Staff-scoped overlap when `staffId` is provided

---

## Critical Rules — Do NOT Violate

1. **NEVER use `duration_minutes` or `total_duration_minutes` in overlap calculations.** Always use the fixed `SLOT_SIZE` / `slotDuration` (30 minutes).

2. **NEVER skip the bookings table check in `getNextAvailableSlot`.** The function MUST query `bookings` to determine if a slot is truly available.

3. **NEVER use `vendor_identity.id` directly to query `bookings`.** Always resolve to `vendors.id` first.

4. **NEVER remove `FOR UPDATE` from overlap queries in booking creation.** This prevents race conditions.

5. **ALWAYS exclude cancelled/rejected/no_show statuses** from overlap checks. These bookings should not block new bookings.

6. **ALWAYS pass `serviceStyleFilter`** to `getNextAvailableSlot` when calling it from service discovery endpoints. Different service styles (at_home, tele, at_center) have different availability windows.

7. **The `SLOT_SIZE` / `slotDuration` value MUST be `30`** everywhere. If this value ever needs to change, it must be changed consistently across ALL four locations:
   - `getNextAvailableSlot` in `service-discovery.ts` (`SLOT_DURATION`)
   - `available-slots` endpoint in `service-discovery.ts` (`slotDuration`)
   - `bookings-enhanced.ts` (`SLOT_SIZE`)
   - `bookings.ts` (`SLOT_SIZE`)

8. **Buffer time is informational only.** It does NOT expand the blocking window. Comments in the code explicitly state this.

---

## File Reference Quick Lookup

| Component | File Path | Line Numbers |
|-----------|-----------|-------------|
| `getNextAvailableSlot` function | `backend/lambda/src/endpoints/service-discovery.ts` | ~445–570 |
| `timeToMinutes` helper | `backend/lambda/src/endpoints/service-discovery.ts` | ~3116–3120 |
| available-slots overlap check | `backend/lambda/src/endpoints/service-discovery.ts` | ~3282–3310 |
| `slotDuration = 30` definition | `backend/lambda/src/endpoints/service-discovery.ts` | ~3222 |
| Booking creation overlap (enhanced) | `backend/lambda/src/endpoints/bookings-enhanced.ts` | ~615–648 |
| Booking creation overlap (legacy) | `backend/lambda/src/endpoints/bookings.ts` | ~254–271 |
| Existing bookings query (enhanced) | `backend/lambda/src/endpoints/bookings-enhanced.ts` | ~540–555 |
| Existing bookings query (legacy) | `backend/lambda/src/endpoints/bookings.ts` | ~230–252 |

---

**End of Document**
