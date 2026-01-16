# Vendor Profile Save Test

## Test Case: Vendor Profile Update with Metadata

### Purpose
Verify that the vendor profile save functionality works correctly after adding the `metadata` column to the `vendors` table.

### Pre-requisites
- ✅ Migration 138 applied (metadata column added)
- ✅ Vendor account exists in the database
- ✅ Lambda backend deployed with latest code

### Test Scenarios

#### 1. Update Non-Critical Fields
**Endpoint**: `PUT /vendor/:vendorId/profile`

**Request Body**:
```json
{
  "phone": "9876543210",
  "email": "updated@example.com",
  "alternate_phone": "9876543211",
  "operating_hours": "Mon-Fri: 9AM-6PM",
  "capacity": 50,
  "specialization": "Dog walking and grooming"
}
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "requiresReapproval": false,
  "status": "approved",
  "vendor": { ... }
}
```

**Expected Behavior**:
- Profile updated successfully
- No re-approval required
- Status remains "approved"
- No 500 error

#### 2. Update Critical Fields (Approved Vendor)
**Endpoint**: `PUT /vendor/:vendorId/profile`

**Request Body**:
```json
{
  "business_name": "New Business Name",
  "address": "New Address, Updated Location",
  "city": "New City",
  "pincode": "123456"
}
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Profile updated. Re-approval required for critical changes.",
  "requiresReapproval": true,
  "changedFields": ["business_name", "address", "city", "pincode"],
  "status": "pending",
  "vendor": {
    ...
    "metadata": {
      "previousStatus": "approved",
      "wasApprovedBefore": true,
      "reapprovalReason": "Critical profile fields updated: business_name, address, city, pincode",
      "reapprovalRequestedAt": "2026-01-16T..."
    }
  }
}
```

**Expected Behavior**:
- Profile updated successfully
- Requires re-approval
- Status changed to "pending"
- Metadata stored with re-approval info
- Admin notification created
- No 500 error

#### 3. Set Vacation Mode
**Endpoint**: `POST /vendor/:vendorId/vacation-mode`

**Request Body**:
```json
{
  "isActive": true,
  "startDate": "2026-01-20",
  "endDate": "2026-01-30",
  "message": "On vacation until end of January"
}
```

**Expected Response**:
```json
{
  "success": true,
  "vacationMode": {
    "isActive": true,
    "startDate": "2026-01-20",
    "endDate": "2026-01-30",
    "message": "On vacation until end of January"
  },
  "message": "Vacation mode updated successfully"
}
```

**Expected Behavior**:
- Vacation mode stored in metadata
- Vendor availability updated
- No 500 error

### Manual Testing Steps

1. **Login as Vendor**
   ```bash
   # Navigate to vendor dashboard
   https://vendor.warmpawz.com/dashboard
   ```

2. **Navigate to Profile Settings**
   - Click on "Profile" or "Settings" menu
   - Navigate to "Center Profile" or "Business Profile"

3. **Update Profile Information**
   - Change any field (e.g., phone, email, address)
   - Click "Save" button

4. **Verify Result**
   - ✅ Success message displayed
   - ✅ No 500 Internal Server Error
   - ✅ Changes reflected in profile
   - ✅ If critical field changed, re-approval message shown

5. **Test Vacation Mode**
   - Navigate to vacation mode settings
   - Toggle vacation mode ON
   - Set dates and message
   - Click "Save"
   - ✅ Vacation mode saved successfully

### Automated API Test

```bash
# Test non-critical field update
curl -X PUT https://api.warmpawz.com/vendor/{vendorId}/profile \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210",
    "email": "test@example.com"
  }'

# Expected: 200 OK, success: true

# Test vacation mode
curl -X POST https://api.warmpawz.com/vendor/{vendorId}/vacation-mode \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "isActive": true,
    "startDate": "2026-01-20",
    "endDate": "2026-01-30",
    "message": "On vacation"
  }'

# Expected: 200 OK, success: true
```

### Database Verification

```sql
-- Check vendor metadata
SELECT id, business_name, metadata 
FROM vendors 
WHERE id = '{vendorId}';

-- Should return metadata JSONB with vacation_mode or reapproval info
```

### Success Criteria
- ✅ All API calls return 200 OK (no 500 errors)
- ✅ Profile updates are saved to database
- ✅ Metadata column is populated correctly
- ✅ Critical field changes trigger re-approval
- ✅ Vacation mode is stored in metadata
- ✅ UI displays success messages
- ✅ No "column metadata does not exist" errors

---
**Date**: 2026-01-16
**Status**: Ready for Testing
**Migration**: 138_add_vendor_metadata_column.sql applied ✅
