# 🔍 Debug Doctor Search Issue - Investigation Guide

## Problem
Newly added doctors (like "Nimish Jain" at Cura Pet Hospital) are not appearing in the customer app's doctor list.

## Debug Endpoints Created

### 1. Comprehensive Investigation
**GET** `/make-server-3dd53475/debug/doctors/investigation`

This endpoint shows:
- All veterinary vendors in the system
- For each vendor, the staff array (`vendor:{id}:staff`)
- For each staff member, full details and validation
- What the customer search would return
- Data integrity checks (vendorId matching, required fields, etc.)

**How to test:**
Open in browser or use curl:
```
https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/debug/doctors/investigation
```

### 2. Find Specific Doctor
**GET** `/make-server-3dd53475/debug/doctors/find?name=Nimish`

Search for a specific doctor by name to see:
- If the staff record exists
- If the vendor record exists
- If the staff is in the vendor's staff array
- Why they might not be appearing

**How to test:**
```
https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/debug/doctors/find?name=Nimish
```

## Console Logs

The enhanced search endpoint now logs:
- Each vendor being processed
- Staff IDs in each vendor's staff array
- Each staff member's details (name, phone, isActive status)
- Whether each staff member will be included in results

## Common Issues & Fixes

### Issue 1: Staff Not in Vendor Array
**Symptom:** Staff record exists but not in `vendor:{id}:staff` array  
**Cause:** Staff creation didn't add to array  
**Fix:** Backend should automatically add to array (lines 237-241 in staff-auth-endpoints.tsx)

### Issue 2: Vendor ID Mismatch
**Symptom:** `staff.vendorId` doesn't match `vendor.id`  
**Cause:** Different vendor ID formats (vendor_phone vs vendor_timestamp_random)  
**Fix:** Ensure consistent vendor ID when creating staff

### Issue 3: Staff Inactive
**Symptom:** Staff exists but `isActive: false`  
**Cause:** Staff was deactivated or created with wrong status  
**Fix:** Update staff record: `staff.isActive = true`

### Issue 4: Wrong Field Names
**Symptom:** Experience showing as 0  
**Cause:** Using `experience` vs `yearsOfExperience`  
**Fix:** Now supports both field names (line 115 in customer-search-endpoints.tsx)

## Data Flow

### Staff Creation:
1. Vendor dashboard calls `POST /staff/create`
2. Backend creates `staff:{staffId}` record
3. Backend adds staffId to `vendor:{vendorId}:staff` array ✅
4. Staff can now login with phone number

### Doctor Search:
1. Customer app calls `GET /customer/doctors/search?roleId=pet_clinic`
2. Backend gets all vendors with `roleId=pet_clinic`
3. For each vendor, gets `vendor:{vendor.id}:staff` array
4. For each staffId, gets `staff:{staffId}` record
5. Filters by `staff.isActive === true`
6. Returns doctor list

## Next Steps

1. **Call the investigation endpoint** to see all data
2. **Search for "Nimish Jain"** to see their specific situation
3. **Check the console logs** when loading doctors in customer app
4. **Compare vendor IDs** - ensure staff.vendorId matches the vendor's actual ID

## Enhanced Features

✅ Doctors now include their **services** for booking selection
✅ Support for both `experience` and `yearsOfExperience` fields
✅ Comprehensive logging for debugging
✅ Validation of data integrity (vendorId matching, required fields)
