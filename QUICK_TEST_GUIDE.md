# Quick Test Guide - Schedule Management

## 🚀 Quick Start

### Option 1: Use the Test Script

```bash
# Make script executable (if not already)
chmod +x test-schedule-management.sh

# Run tests (replace VENDOR_ID with your test vendor ID)
./test-schedule-management.sh YOUR_VENDOR_ID

# Or set API_URL if different
API_URL="https://your-api-url" ./test-schedule-management.sh YOUR_VENDOR_ID
```

### Option 2: Manual Testing with curl

#### 1. Get Scheduling Policies

```bash
curl -X GET "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/admin/scheduling-policies" \
  -H "Content-Type: application/json" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin"
```

#### 2. Create Valid Schedule

```bash
curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/vendor/YOUR_VENDOR_ID/schedule" \
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

**Expected**: ✅ `{"success": true, ...}`

#### 3. Create Past Schedule (Should Fail)

```bash
# Get current day of week (0=Sunday, 6=Saturday)
CURRENT_DAY=$(date +%w)

curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/vendor/YOUR_VENDOR_ID/schedule" \
  -H "Content-Type: application/json" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin" \
  -d "{
    \"slots\": [
      {
        \"dayOfWeek\": ${CURRENT_DAY},
        \"serviceStyle\": \"at_center\",
        \"timeWindowStart\": \"08:00\",
        \"timeWindowEnd\": \"09:00\",
        \"maxCapacity\": 1
      }
    ]
  }"
```

**Expected**: ❌ `{"success": false, "error": "Schedule validation failed", "validationErrors": [...]}`

#### 4. Get Available Slots

```bash
# Get tomorrow's date
DATE=$(date -d "+1 day" +%Y-%m-%d)

curl -X GET "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/vendor/YOUR_VENDOR_ID/slots/${DATE}?serviceStyle=at_center" \
  -H "Content-Type: application/json" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin"
```

**Expected**: ✅ `{"success": true, "slots": [...], ...}`

#### 5. Get Schedule Configuration

```bash
curl -X GET "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/vendor/YOUR_VENDOR_ID/schedule" \
  -H "Content-Type: application/json" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin"
```

**Expected**: ✅ `{"success": true, "schedule": {...}, ...}`

---

## 📋 Test Checklist

### ✅ Positive Tests (Should Pass)
- [ ] Create valid schedule
- [ ] Get available slots
- [ ] Get schedule configuration
- [ ] Get all policies
- [ ] Get policy by type
- [ ] Create/update policy

### ❌ Negative Tests (Should Fail)
- [ ] Create past schedule → Error 400
- [ ] Create overlapping slots → Error 400
- [ ] Exceed capacity policy → Error 400
- [ ] Violate buffer time → Error 400

---

## 🐛 Common Issues

### Issue: "Vendor not found"
**Solution**: Ensure you're using a valid vendor ID

### Issue: "Policy not found"
**Solution**: Policies should be seeded. Check `scheduling_policies` table

### Issue: "Cannot set schedule in the past"
**Solution**: This is expected behavior! Use future times for testing

### Issue: "Time window overlaps"
**Solution**: Ensure time windows don't overlap for the same day/service style

---

## 📝 Test Results

After running tests, document results:

```
✅ Test 1: Create Valid Schedule - PASSED
❌ Test 2: Create Past Schedule - PASSED (correctly rejected)
✅ Test 3: Get Available Slots - PASSED
✅ Test 4: Get Policies - PASSED
```

---

## 🎯 Next Steps

1. Run the test script
2. Verify all tests pass
3. Check Lambda logs for any errors
4. Verify policies are enforced correctly
5. Test edge cases (timezone, DST, etc.)
