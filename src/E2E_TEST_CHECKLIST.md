# 🧪 WARMPAWZ E2E TEST CHECKLIST
## Quick Reference for Manual Testing

---

## 🎯 **NEWLY REGISTERED ENDPOINTS - TEST FIRST**

### **1. Staff Service Endpoints**
```bash
# Base URL
BASE="https://{projectId}.supabase.co/functions/v1/make-server-3dd53475"

# Test 1: Get Staff Services
GET ${BASE}/staff/{staffId}/services

# Test 2: Add Clinic Service to Staff
POST ${BASE}/staff/{staffId}/services/add-clinic-service
{
  "serviceId": "svc_xxx",
  "serviceName": "Vaccination",
  "category": "medical",
  "categoryName": "Medical Care",
  "price": 500,
  "duration": 30,
  "description": "Pet vaccination service",
  "serviceStyle": "at_center"
}

# Test 3: Create Custom Service
POST ${BASE}/staff/{staffId}/services/create-custom
{
  "serviceName": "Emergency Home Visit",
  "category": "emergency",
  "price": 2000,
  "duration": 60,
  "description": "Urgent care at home"
}
```

**✅ Expected Results:**
- Services persist to KV store
- Console shows "✅ PERSISTENCE VERIFIED"
- Service style auto-enabled for staff
- Services appear in GET request

---

### **2. Staff Discovery Endpoints**
```bash
# Test: Discover Staff by Service Style
GET ${BASE}/staff/discover
  ?serviceStyle=at_home
  &roleId=veterinarian
  &latitude=28.6139
  &longitude=77.2090
  &radius=10

# Test: Discover Staff for Vendor
GET ${BASE}/vendor/{vendorId}/staff/discover
  ?serviceStyle=at_center
```

**✅ Expected Results:**
- Returns staff with enabled service styles
- Filters by location correctly
- Shows staff services in response
- Distance calculated from customer location

---

### **3. Universal Staff Search**
```bash
# Test: Search All Staff
GET ${BASE}/customer/staff/search
  ?query=vaccination
  &roleId=veterinarian
  &serviceStyle=at_center
  &feeMin=0
  &feeMax=1000
  &sortBy=rating

# Test: Search with Availability
GET ${BASE}/customer/staff/search
  ?roleId=pet_groomer
  &availableToday=true
```

**✅ Expected Results:**
- Returns staff across all vendors
- Filters by specialization correctly
- Sorts by rating/fee/experience
- Shows service count per staff

---

### **4. Universal Staff Problem Search**
```bash
# Test: Search Staff by Problem
GET ${BASE}/customer/staff-by-problem/vet_clinic/skin-infections
  ?lat=28.6139
  &lng=77.2090
  &radius=50

# Test: Staff by Specialization
GET ${BASE}/customer/staff-by-problem/grooming_salon/matted-fur
```

**✅ Expected Results:**
- Returns only staff with matching specialization
- Shows clinic information for each staff
- Filters by problem grid mapping
- Includes at least 1 active service per staff

---

## 🔄 **CRITICAL E2E FLOWS TO TEST**

### **Flow #1: Service Creation → Staff Assignment → Customer Discovery**

#### **Step 1: Create Service (Vendor Dashboard)**
```bash
POST ${BASE}/vendor/services/add
{
  "vendorId": "vendor_123",
  "serviceData": {
    "name": "Dental Cleaning",
    "type": "at_center",
    "category": "dental",
    "price": 800,
    "duration": 45,
    "description": "Professional dental cleaning"
  }
}
```
**Check Console:** Look for "✅ PERSISTENCE VERIFIED"

#### **Step 2: Assign to Staff**
```bash
POST ${BASE}/staff/staff_456/services/add-clinic-service
{
  "serviceId": "svc_xxx",
  "serviceName": "Dental Cleaning",
  "category": "dental",
  "categoryName": "Dental Care",
  "price": 800,
  "duration": 45,
  "description": "Professional dental cleaning",
  "serviceStyle": "at_center"
}
```
**Check Console:** Look for "🎨 Auto-enabled at_center"

#### **Step 3: Customer Discovers Service**
```bash
GET ${BASE}/customer/discover-services
  ?category=vet
  &location=Bangalore
```
**Verify:**
- Service appears in vendor's offerings
- Staff is listed as provider
- Price matches (800)
- Service style is at_center

#### **Step 4: Customer Discovers Staff**
```bash
GET ${BASE}/customer/staff/search
  ?query=dental
  &roleId=veterinarian
  &serviceStyle=at_center
```
**Verify:**
- Staff appears in results
- "Dental Cleaning" in their services
- at_center badge shown
- Available for booking

---

### **Flow #2: At-Home Service E2E**

#### **Step 1: Create At-Home Service**
```bash
POST ${BASE}/vendor/services/add
{
  "vendorId": "vendor_123",
  "serviceData": {
    "name": "Home Vaccination",
    "type": "at_home",
    "category": "medical",
    "price": 700,
    "travelCharge": 100,
    "maxDistance": 15
  }
}
```

#### **Step 2: Assign to Staff with At-Home Enabled**
```bash
POST ${BASE}/staff/staff_456/services/add-clinic-service
{
  "serviceId": "svc_yyy",
  "serviceName": "Home Vaccination",
  "serviceStyle": "at_home",
  ...
}
```

#### **Step 3: Verify Staff Service Style Preferences**
```bash
GET ${BASE}/staff/staff_456/style-preferences
```
**Verify:**
```json
{
  "at_home": {
    "enabled": true,
    "available": true,
    "maxDistance": 15
  }
}
```

#### **Step 4: Customer Discovers At-Home Staff**
```bash
GET ${BASE}/staff/discover
  ?serviceStyle=at_home
  &roleId=veterinarian
  &latitude=28.6139
  &longitude=77.2090
  &radius=20
```
**Verify:**
- Staff appears only if within maxDistance
- Shows travel charge
- at_home badge displayed

#### **Step 5: Create Booking**
```bash
POST ${BASE}/booking/create
{
  "serviceType": "at_home",
  "vendorId": "vendor_123",
  "staffId": "staff_456",
  "serviceId": "svc_yyy",
  "customerLocation": {
    "lat": 28.6200,
    "lng": 77.2100,
    "address": "123 Home St"
  }
}
```
**Verify:**
- Booking created successfully
- Travel charge calculated
- Distance validated
- GPS tracking enabled

---

### **Flow #3: Tele Consultation E2E**

#### **Step 1: Create Tele Service**
```bash
POST ${BASE}/vendor/services/add
{
  "vendorId": "vendor_123",
  "serviceData": {
    "name": "Video Consultation",
    "type": "tele",
    "category": "consultation",
    "price": 300,
    "duration": 20
  }
}
```

#### **Step 2: Assign to Doctor with Tele Enabled**
```bash
POST ${BASE}/staff/staff_789/services/add-clinic-service
{
  "serviceStyle": "tele",
  ...
}
```

#### **Step 3: Verify Tele Preferences**
```bash
GET ${BASE}/staff/staff_789/style-preferences
```
**Verify:**
```json
{
  "tele": {
    "enabled": true,
    "available": true,
    "videoEnabled": true,
    "acceptInstantBooking": true
  }
}
```

#### **Step 4: Customer Books Tele Consultation**
```bash
POST ${BASE}/booking/create-tele
{
  "serviceType": "tele",
  "staffId": "staff_789",
  "bookingType": "instant"
}
```
**Verify:**
- Booking created with type "tele"
- AWS Chime session initiated
- Video link generated
- Both parties receive notification

---

## 🔍 **PERSISTENCE VERIFICATION TESTS**

### **Test 1: Service Persistence**
```bash
# 1. Create service
POST ${BASE}/vendor/services/add {...}

# 2. Immediately fetch it
GET ${BASE}/vendor/services/{vendorId}

# 3. Check KV directly (if access available)
# Should find:
# - service:{serviceId}
# - vendor:{vendorId}:services (contains serviceId)
```

### **Test 2: Staff Service Persistence**
```bash
# 1. Assign service to staff
POST ${BASE}/staff/{staffId}/services/add-clinic-service {...}

# 2. Fetch staff services
GET ${BASE}/staff/{staffId}/services

# 3. Check KV:
# - staff:{staffId}:service:{staffServiceId}
# - staff:{staffId}:style_preferences (updated)
```

### **Test 3: Orphaned Data Recovery**
```bash
# 1. Manually break service list (simulate bug)
# Delete vendor:{vendorId}:services

# 2. Fetch services
GET ${BASE}/vendor/services/{vendorId}

# 3. Check console for:
# "🔍 No services found in index"
# "🔧 Found X orphaned services. Rebuilding index..."
# "✅ Self-healing successful"
```

---

## 📊 **LOG PATTERNS TO WATCH**

### **✅ SUCCESS PATTERNS:**
```
💾 [SERVICE-PERSISTENCE] Creating service...
   Service ID: svc_xxx
   ✅ Service object saved to KV: service:svc_xxx
   ✅ Service ID added to vendor's service list
   ✅ PERSISTENCE VERIFIED: Service successfully persisted

➕ [STAFF-SERVICE] Adding clinic service to staff...
   ✅ PERSISTENCE VERIFIED: Staff service successfully persisted
   🎨 Auto-enabled at_home for staff staff_456

✅ Registering staff service endpoints...
✅ Registering staff discovery endpoints...
✅ Registering universal staff search...
✅ Registering universal staff problem search...
```

### **❌ ERROR PATTERNS TO INVESTIGATE:**
```
❌ PERSISTENCE FAILED: Service not found after save
   - Service object exists: false
   - Service in vendor list: false

⚠️ Staff Discovery Endpoints module undefined, skipping

❌ [STAFF-SERVICE] Error adding clinic service: [error details]

🔍 No services found in index for vendor_xxx
   (If not followed by "🔧 Found X orphaned services")
```

---

## 🎯 **QUICK SMOKE TEST (5 Minutes)**

Run these in sequence to verify basic functionality:

```bash
# 1. Health Check
GET ${BASE}/health

# 2. Create Test Vendor (if not exists)
# 3. Create Test Service
POST ${BASE}/vendor/services/add {...}

# 4. Create Test Staff
# 5. Assign Service to Staff
POST ${BASE}/staff/{staffId}/services/add-clinic-service {...}

# 6. Discover Services
GET ${BASE}/customer/discover-services?category=vet

# 7. Discover Staff
GET ${BASE}/customer/staff/search?roleId=veterinarian

# 8. Check Logs
# Look for all "✅ PERSISTENCE VERIFIED" messages
```

**Time:** ~5 minutes  
**Expected:** All endpoints return 200, services persist, logs show success

---

## 📝 **TEST RESULT TEMPLATE**

```markdown
### Test: [Test Name]
**Date:** [Date]
**Tester:** [Name]
**Environment:** Production/Staging

#### Steps Executed:
1. [ ] Step 1
2. [ ] Step 2
3. [ ] Step 3

#### Results:
- **Status:** ✅ PASS / ❌ FAIL
- **Response Time:** Xms
- **Data Persisted:** YES / NO
- **Logs Clean:** YES / NO

#### Issues Found:
- [List any issues]

#### Notes:
- [Any additional observations]
```

---

## 🚨 **KNOWN ISSUES TO WATCH**

1. **Service Style Mismatch**
   - Symptom: Staff has services but all styles disabled
   - Check: `staff:{staffId}:style_preferences`
   - Fix: Re-assign service to auto-enable

2. **Orphaned Services**
   - Symptom: Services in KV but not in vendor list
   - Check: Console for "🔍 No services found in index"
   - Fix: Self-healing triggers automatically

3. **Double Booking**
   - Symptom: Same slot booked twice
   - Check: Staff schedule not updated
   - Fix: TBD (Gap #13 from comprehensive analysis)

---

## 📞 **SUPPORT CONTACTS**

**For Test Issues:**
- Check `/E2E_GAP_ANALYSIS_COMPREHENSIVE.md` for known gaps
- Review server console logs for detailed errors
- Verify all 4 new endpoints registered on startup

**Server Startup Verification:**
```
Should see in logs:
✅ Registering staff service endpoints...
✅ Registering staff discovery endpoints...
✅ Registering universal staff search...
✅ Registering universal staff problem search...
```

---

**Last Updated:** December 9, 2025  
**Version:** 1.0 - Post Option B Implementation
