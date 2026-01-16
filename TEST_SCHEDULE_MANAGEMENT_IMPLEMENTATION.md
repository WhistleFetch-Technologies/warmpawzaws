# Test Schedule Management Implementation

## 🧪 Testing Guide

This guide provides step-by-step instructions to test the schedule management functionality with policy enforcement.

## 📋 Prerequisites

1. **API Endpoint**: Know your API Gateway URL or local server URL
2. **Vendor ID**: Have a valid vendor ID for testing
3. **Admin Access**: Have admin credentials for policy management
4. **Testing Tool**: Use curl, Postman, or similar tool

---

## 🔧 Test Setup

### Step 1: Get API Base URL

Check your environment configuration:
- **Production**: `https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com`
- **Local**: `http://localhost:3000/api`

### Step 2: Get Test Vendor ID

Use an existing vendor ID or create a test vendor first.

---

## 🧪 Test Cases

### Test Case 1: Create Valid Schedule ✅

**Endpoint**: `POST /vendor/:vendorId/schedule`

**Request**:
```bash
curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/vendor/VENDOR_ID/schedule" \
  -H "Content-Type: application/json" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin" \
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

**Expected Response** (200):
```json
{
  "success": true,
  "slots": [
    {
      "id": "uuid",
      "vendor_id": "vendor-id",
      "day_of_week": 1,
      "service_style": "at_center",
      "time_window_start": "09:00",
      "time_window_end": "17:00",
      "slot_duration_minutes": 30,
      "max_capacity": 2,
      "is_enabled": true
    }
  ],
  "message": "Schedule updated successfully"
}
```

---

### Test Case 2: Create Past Schedule (Should Fail) ❌

**Endpoint**: `POST /vendor/:vendorId/schedule`

**Request** (assuming current time is 14:00 on Sunday):
```bash
curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/vendor/VENDOR_ID/schedule" \
  -H "Content-Type: application/json" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin" \
  -d '{
    "slots": [
      {
        "dayOfWeek": 0,
        "serviceStyle": "at_center",
        "timeWindowStart": "13:00",
        "timeWindowEnd": "14:00",
        "maxCapacity": 1
      }
    ]
  }'
```

**Expected Response** (400):
```json
{
  "success": false,
  "error": "Schedule validation failed",
  "validationErrors": [
    "Slot 13:00-14:00 (at_center): Cannot set schedule in the past. Time must be at least 30 minutes from now"
  ],
  "message": "Please fix validation errors before saving schedule"
}
```

---

### Test Case 3: Create Overlapping Slots (Should Fail) ❌

**Endpoint**: `POST /vendor/:vendorId/schedule`

**Request**:
```bash
curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/vendor/VENDOR_ID/schedule" \
  -H "Content-Type: application/json" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin" \
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
```

**Expected Response** (400):
```json
{
  "success": false,
  "error": "Schedule validation failed",
  "validationErrors": [
    "Slot 11:00-14:00 (at_center): Time window overlaps with existing schedule (09:00 - 12:00)"
  ],
  "message": "Please fix validation errors before saving schedule"
}
```

---

### Test Case 4: Exceed Capacity Policy (Should Fail) ❌

**Endpoint**: `POST /vendor/:vendorId/schedule`

**Request** (assuming policy max is 10):
```bash
curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/vendor/VENDOR_ID/schedule" \
  -H "Content-Type: application/json" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin" \
  -d '{
    "slots": [
      {
        "dayOfWeek": 1,
        "serviceStyle": "at_center",
        "timeWindowStart": "09:00",
        "timeWindowEnd": "17:00",
        "maxCapacity": 15
      }
    ]
  }'
```

**Expected Response** (400):
```json
{
  "success": false,
  "error": "Schedule validation failed",
  "validationErrors": [
    "Slot 09:00-17:00 (at_center): Maximum capacity per slot cannot exceed 10 (policy limit)"
  ],
  "message": "Please fix validation errors before saving schedule"
}
```

---

### Test Case 5: Get Available Slots (Policy Enforcement) ✅

**Endpoint**: `GET /vendor/:vendorId/slots/:date`

**Request**:
```bash
DATE=$(date -d "+1 day" +%Y-%m-%d) # Tomorrow

curl -X GET "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/vendor/VENDOR_ID/slots/${DATE}?serviceStyle=at_center" \
  -H "Content-Type: application/json" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin"
```

**Expected Response** (200):
```json
{
  "success": true,
  "slots": [
    {
      "time": "09:00",
      "available": true,
      "bookedCount": 0,
      "maxCapacity": 2,
      "isPast": false
    },
    {
      "time": "09:30",
      "available": true,
      "bookedCount": 0,
      "maxCapacity": 2,
      "isPast": false
    }
    // ... more slots (past slots filtered out)
  ],
  "date": "2025-01-27",
  "onVacation": false,
  "totalAvailable": 16,
  "totalSlots": 16
}
```

**Verification**:
- ✅ Past slots should be filtered out
- ✅ Cancelled/completed bookings should be excluded
- ✅ Capacity limits should be respected
- ✅ Policy buffer time should be used

---

### Test Case 6: Get Scheduling Policies ✅

**Endpoint**: `GET /admin/scheduling-policies`

**Request**:
```bash
curl -X GET "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/admin/scheduling-policies" \
  -H "Content-Type: application/json" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin"
```

**Expected Response** (200):
```json
{
  "success": true,
  "policies": [
    {
      "id": "uuid",
      "policy_name": "Buffer Time Policy",
      "policy_type": "buffer_time",
      "policy_config": {
        "minBufferTime": 30,
        "bufferTimePerServiceType": {
          "at_center": 30,
          "at_home": 120,
          "tele": 15
        }
      },
      "is_active": true
    }
    // ... more policies
  ],
  "total": 12
}
```

---

### Test Case 7: Create/Update Policy ✅

**Endpoint**: `POST /admin/scheduling-policies`

**Request**:
```bash
curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/admin/scheduling-policies" \
  -H "Content-Type: application/json" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin" \
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
```

**Expected Response** (200):
```json
{
  "success": true,
  "message": "Policy created successfully",
  "policy": {
    "id": "uuid",
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
}
```

---

### Test Case 8: Booking Creation (Past Booking Prevention) ❌

**Endpoint**: `POST /bookings/create`

**Request** (assuming current time is 14:00):
```bash
curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/bookings/create" \
  -H "Content-Type: application/json" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin" \
  -d '{
    "customerId": "customer-123",
    "vendorId": "vendor-123",
    "serviceId": "service-123",
    "bookingDate": "2025-01-26",
    "bookingTime": "13:00"
  }'
```

**Expected Response** (400):
```json
{
  "error": "Booking must be at least 1 hour(s) in the future"
}
```

---

### Test Case 9: Booking Creation (Double Booking Prevention) ❌

**Endpoint**: `POST /bookings/create`

**Request** (create first booking):
```bash
curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/bookings/create" \
  -H "Content-Type: application/json" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin" \
  -d '{
    "customerId": "customer-123",
    "vendorId": "vendor-123",
    "serviceId": "service-123",
    "bookingDate": "2025-01-27",
    "bookingTime": "10:00",
    "staffId": "staff-123"
  }'
```

**Request** (create duplicate booking - should fail):
```bash
curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/bookings/create" \
  -H "Content-Type: application/json" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin" \
  -d '{
    "customerId": "customer-456",
    "vendorId": "vendor-123",
    "serviceId": "service-123",
    "bookingDate": "2025-01-27",
    "bookingTime": "10:00",
    "staffId": "staff-123"
  }'
```

**Expected Response** (Error):
- First booking: ✅ Success (200)
- Second booking: ❌ Error - "SLOT_CONFLICT" (row-level locking prevents double booking)

---

## ✅ Test Checklist

### Schedule Management
- [ ] Create valid schedule → Success
- [ ] Create past schedule → Error (400)
- [ ] Create overlapping slots → Error (400)
- [ ] Exceed capacity policy → Error (400)
- [ ] Get available slots → Past slots filtered
- [ ] Get available slots → Capacity respected
- [ ] Get available slots → Cancelled bookings excluded

### Admin Policies
- [ ] Get all policies → Returns policies
- [ ] Get policy by type → Returns specific policy
- [ ] Create/update policy → Policy saved
- [ ] Update policy → Policy updated
- [ ] Deactivate policy → Policy deactivated

### Booking Endpoints
- [ ] Create past booking → Error (400)
- [ ] Create double booking → Error (SLOT_CONFLICT)

---

## 🐛 Debugging Tips

1. **Check Logs**: Look for console.log/console.error messages in Lambda logs
2. **Verify Policies**: Ensure policies exist in `scheduling_policies` table
3. **Check Timezone**: Ensure dates/times are in correct timezone
4. **Verify Vendor**: Ensure vendor exists and is active
5. **Check Status**: Ensure bookings have correct status values

---

## 📝 Test Results Template

```
Test Case: [Name]
Date: [Date]
Status: [Pass/Fail]
Response: [Actual response]
Expected: [Expected response]
Notes: [Any observations]
```

---

## 🚀 Quick Test Script

Save this as `test-schedule-management.sh`:

```bash
#!/bin/bash

# Configuration
API_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
VENDOR_ID="your-vendor-id"
HEADERS="-H 'Content-Type: application/json' -H 'X-UAT-Mode: true' -H 'X-UAT-Token: uat-token-admin'"

echo "🧪 Testing Schedule Management..."

# Test 1: Create Valid Schedule
echo "Test 1: Create Valid Schedule"
curl -X POST "${API_URL}/vendor/${VENDOR_ID}/schedule" \
  ${HEADERS} \
  -d '{
    "slots": [
      {
        "dayOfWeek": 1,
        "serviceStyle": "at_center",
        "timeWindowStart": "09:00",
        "timeWindowEnd": "17:00",
        "slotDurationMinutes": 30,
        "maxCapacity": 2
      }
    ]
  }'
echo -e "\n\n"

# Test 2: Get Available Slots
echo "Test 2: Get Available Slots"
DATE=$(date -d "+1 day" +%Y-%m-%d)
curl -X GET "${API_URL}/vendor/${VENDOR_ID}/slots/${DATE}?serviceStyle=at_center" \
  ${HEADERS}
echo -e "\n\n"

# Test 3: Get Policies
echo "Test 3: Get Scheduling Policies"
curl -X GET "${API_URL}/admin/scheduling-policies" \
  ${HEADERS}
echo -e "\n\n"

echo "✅ Tests Complete"
```

Make it executable and run:
```bash
chmod +x test-schedule-management.sh
./test-schedule-management.sh
```
