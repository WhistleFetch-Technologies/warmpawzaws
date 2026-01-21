# Test Schedule Management Functionality

## 🧪 Test Plan

This document outlines manual and automated tests for schedule management with policy enforcement.

## 📋 Test Scenarios

### 1. Schedule Creation with Policy Enforcement

#### Test 1.1: Create Valid Schedule
**Endpoint**: `POST /vendor/:vendorId/schedule`
**Request**:
```json
{
  "slots": [
    {
      "dayOfWeek": 1,
      "serviceStyle": "at_center",
      "timeWindowStart": "09:00",
      "timeWindowEnd": "17:00",
      "slotDurationMinutes": 30,
      "maxCapacity": 2,
      "isEnabled": true
    }
  ]
}
```
**Expected**: ✅ Success (200) - Schedule created

#### Test 1.2: Create Schedule in Past (Should Fail)
**Endpoint**: `POST /vendor/:vendorId/schedule`
**Request** (assuming current time is 14:00):
```json
{
  "slots": [
    {
      "dayOfWeek": 0, // Today (Sunday)
      "serviceStyle": "at_center",
      "timeWindowStart": "13:00", // 1 hour ago
      "timeWindowEnd": "14:00",
      "maxCapacity": 1
    }
  ]
}
```
**Expected**: ❌ Error (400) - "Cannot set schedule in the past"

#### Test 1.3: Create Overlapping Slots (Should Fail)
**Endpoint**: `POST /vendor/:vendorId/schedule`
**Request**:
```json
{
  "slots": [
    {
      "dayOfWeek": 1,
      "serviceStyle": "at_center",
      "timeWindowStart": "09:00",
      "timeWindowEnd": "12:00",
      "maxCapacity": 1
    },
    {
      "dayOfWeek": 1,
      "serviceStyle": "at_center",
      "timeWindowStart": "11:00", // Overlaps with first slot
      "timeWindowEnd": "14:00",
      "maxCapacity": 1
    }
  ]
}
```
**Expected**: ❌ Error (400) - "Time window overlaps with existing schedule"

#### Test 1.4: Exceed Capacity Policy (Should Fail)
**Endpoint**: `POST /vendor/:vendorId/schedule`
**Request** (assuming policy max is 10):
```json
{
  "slots": [
    {
      "dayOfWeek": 1,
      "serviceStyle": "at_center",
      "timeWindowStart": "09:00",
      "timeWindowEnd": "17:00",
      "maxCapacity": 15 // Exceeds policy limit of 10
    }
  ]
}
```
**Expected**: ❌ Error (400) - "Maximum capacity per slot cannot exceed 10"

#### Test 1.5: Violate Buffer Time Policy (Should Fail)
**Endpoint**: `POST /vendor/:vendorId/schedule`
**Request** (assuming buffer policy is 30 minutes):
```json
{
  "slots": [
    {
      "dayOfWeek": 1,
      "serviceStyle": "at_center",
      "timeWindowStart": "09:00",
      "timeWindowEnd": "12:00",
      "maxCapacity": 1
    },
    {
      "dayOfWeek": 1,
      "serviceStyle": "at_center",
      "timeWindowStart": "12:15", // Only 15 min gap (policy requires 30 min)
      "timeWindowEnd": "14:00",
      "maxCapacity": 1
    }
  ]
}
```
**Expected**: ❌ Error (400) - "Minimum buffer time of 30 minutes required"

---

### 2. Slot Availability with Policy Enforcement

#### Test 2.1: Get Available Slots (Past Slots Filtered)
**Endpoint**: `GET /vendor/:vendorId/slots/:date`
**Request**: `GET /vendor/{vendorId}/slots/2025-01-26?serviceStyle=at_center`
**Expected**: ✅ Returns only future slots (filtered by buffer policy)

#### Test 2.2: Get Available Slots (Respects Capacity)
**Endpoint**: `GET /vendor/:vendorId/slots/:date`
**Request**: `GET /vendor/{vendorId}/slots/2025-01-26?serviceStyle=at_center`
**Setup**: Create booking for 10:00 slot (maxCapacity = 1)
**Expected**: ✅ Slot 10:00 shows `available: false`, `bookedCount: 1`

#### Test 2.3: Get Available Slots (Excludes Cancelled Bookings)
**Endpoint**: `GET /vendor/:vendorId/slots/:date`
**Request**: `GET /vendor/{vendorId}/slots/2025-01-26?serviceStyle=at_center`
**Setup**: Create cancelled booking for 10:00 slot
**Expected**: ✅ Slot 10:00 shows `available: true` (cancelled booking excluded)

---

### 3. Admin Policy Management

#### Test 3.1: Get All Policies
**Endpoint**: `GET /admin/scheduling-policies`
**Expected**: ✅ Returns all active scheduling policies

#### Test 3.2: Get Policy by Type
**Endpoint**: `GET /admin/scheduling-policies/buffer_time`
**Expected**: ✅ Returns buffer_time policy configuration

#### Test 3.3: Create/Update Policy
**Endpoint**: `POST /admin/scheduling-policies`
**Request**:
```json
{
  "policy_name": "Test Buffer Policy",
  "policy_type": "buffer_time",
  "policy_config": {
    "minBufferTime": 45,
    "bufferTimePerServiceType": {
      "at_center": 30,
      "at_home": 120,
      "tele": 15
    }
  },
  "is_active": true
}
```
**Expected**: ✅ Policy created/updated successfully

#### Test 3.4: Update Policy
**Endpoint**: `PUT /admin/scheduling-policies/:id`
**Request**:
```json
{
  "policy_config": {
    "minBufferTime": 60
  }
}
```
**Expected**: ✅ Policy updated successfully

#### Test 3.5: Deactivate Policy
**Endpoint**: `DELETE /admin/scheduling-policies/:id`
**Expected**: ✅ Policy deactivated (soft delete)

---

### 4. Booking Endpoints (Verification)

#### Test 4.1: Create Booking (Past Booking Prevention)
**Endpoint**: `POST /bookings/create`
**Request** (assuming current time is 14:00):
```json
{
  "customerId": "customer-123",
  "vendorId": "vendor-123",
  "serviceId": "service-123",
  "bookingDate": "2025-01-26",
  "bookingTime": "13:00" // 1 hour ago
}
```
**Expected**: ❌ Error (400) - "Booking must be at least 1 hour(s) in the future"

#### Test 4.2: Create Booking (Double Booking Prevention)
**Endpoint**: `POST /bookings/create`
**Request**:
```json
{
  "customerId": "customer-123",
  "vendorId": "vendor-123",
  "serviceId": "service-123",
  "bookingDate": "2025-01-27",
  "bookingTime": "10:00",
  "staffId": "staff-123"
}
```
**Setup**: Create existing booking for same vendor/date/time/staff
**Expected**: ❌ Error - "SLOT_CONFLICT" (row-level locking prevents double booking)

---

## 🔧 Manual Testing Scripts

### Prerequisites
1. API Gateway URL or local server URL
2. Valid vendor ID
3. Valid admin credentials
4. Testing tool (curl, Postman, or similar)

### Test Script 1: Create Valid Schedule

```bash
# Set variables
VENDOR_ID="your-vendor-id"
API_URL="https://your-api-gateway-url"

# Create valid schedule
curl -X POST "${API_URL}/vendor/${VENDOR_ID}/schedule" \
  -H "Content-Type: application/json" \
  -d '{
    "slots": [
      {
        "dayOfWeek": 1,
        "serviceStyle": "at_center",
        "timeWindowStart": "09:00",
        "timeWindowEnd": "17:00",
        "slotDurationMinutes": 30,
        "maxCapacity": 2,
        "isEnabled": true
      }
    ]
  }'
```

### Test Script 2: Create Past Schedule (Should Fail)

```bash
# Get current day of week (0=Sunday, 6=Saturday)
CURRENT_DAY=$(date +%w)
PAST_TIME="08:00" # Earlier than current time

curl -X POST "${API_URL}/vendor/${VENDOR_ID}/schedule" \
  -H "Content-Type: application/json" \
  -d "{
    \"slots\": [
      {
        \"dayOfWeek\": ${CURRENT_DAY},
        \"serviceStyle\": \"at_center\",
        \"timeWindowStart\": \"${PAST_TIME}\",
        \"timeWindowEnd\": \"09:00\",
        \"maxCapacity\": 1
      }
    ]
  }"
# Expected: 400 error with "Cannot set schedule in the past"
```

### Test Script 3: Create Overlapping Schedule (Should Fail)

```bash
curl -X POST "${API_URL}/vendor/${VENDOR_ID}/schedule" \
  -H "Content-Type: application/json" \
  -d '{
    "slots": [
      {
        "dayOfWeek": 1,
        "serviceStyle": "at_center",
        "timeWindowStart": "09:00",
        "timeWindowEnd": "12:00",
        "maxCapacity": 1
      },
      {
        "dayOfWeek": 1,
        "serviceStyle": "at_center",
        "timeWindowStart": "11:00",
        "timeWindowEnd": "14:00",
        "maxCapacity": 1
      }
    ]
  }'
# Expected: 400 error with overlap message
```

### Test Script 4: Get Available Slots

```bash
DATE=$(date -d "+1 day" +%Y-%m-%d) # Tomorrow

curl -X GET "${API_URL}/vendor/${VENDOR_ID}/slots/${DATE}?serviceStyle=at_center" \
  -H "Content-Type: application/json"
# Expected: List of available slots (past slots filtered)
```

### Test Script 5: Get Scheduling Policies

```bash
curl -X GET "${API_URL}/admin/scheduling-policies" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"
# Expected: List of all active policies
```

### Test Script 6: Create/Update Policy

```bash
curl -X POST "${API_URL}/admin/scheduling-policies" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -d '{
    "policy_name": "Test Buffer Policy",
    "policy_type": "buffer_time",
    "policy_config": {
      "minBufferTime": 45,
      "bufferTimePerServiceType": {
        "at_center": 30,
        "at_home": 120,
        "tele": 15
      }
    },
    "is_active": true
  }'
# Expected: Policy created/updated
```

---

## ✅ Expected Results Summary

### Schedule Creation
- ✅ Valid schedule → Success (200)
- ❌ Past schedule → Error (400) - "Cannot set schedule in the past"
- ❌ Overlapping slots → Error (400) - "Time window overlaps"
- ❌ Exceed capacity → Error (400) - "Maximum capacity exceeded"
- ❌ Buffer time violation → Error (400) - "Minimum buffer time required"

### Slot Availability
- ✅ Past slots filtered out
- ✅ Cancelled bookings excluded
- ✅ Capacity limits respected
- ✅ Policy configs used

### Admin Policies
- ✅ Get all policies → Returns policies
- ✅ Get by type → Returns specific policy
- ✅ Create/update → Policy saved
- ✅ Deactivate → Policy deactivated

### Booking Endpoints (Already Enforced)
- ❌ Past booking → Error (400) - "Booking must be at least X hours in the future"
- ❌ Double booking → Error - "SLOT_CONFLICT"

---

## 🔍 Code Review Checklist

- [x] Utility functions created (`scheduling-policy-enforcer.ts`)
- [x] Schedule endpoints updated with enforcement
- [x] Admin policy endpoints created and registered
- [x] Booking endpoints verified (already enforced)
- [x] All policies wired and enforced
- [x] No linter errors
- [x] Endpoints registered in handler

---

## 📝 Notes

1. **Policy Defaults**: If policies don't exist, system uses fail-safe defaults
2. **Transaction Safety**: All validations happen before any DB changes
3. **Error Messages**: Detailed validation errors returned for debugging
4. **Booking Endpoints**: Already have proper enforcement (row-level locking)

---

## 🚀 Next Steps

1. Run manual tests using curl/Postman
2. Verify policies are enforced correctly
3. Test edge cases (timezone, DST, etc.)
4. Monitor logs for any issues
5. Consider adding automated unit tests
