# Vendor Onboarding Endpoints - Test Guide

## Overview

This guide explains how to test all the newly implemented vendor onboarding endpoints.

## Prerequisites

1. **Environment Variables:**
   ```bash
   export SUPABASE_PROJECT_ID="your-project-id"
   export SUPABASE_ANON_KEY="your-anon-key"
   ```

2. **Dependencies:**
   - Bash (for shell script)
   - Node.js (for JavaScript test)
   - `jq` (optional, for JSON parsing in bash)

## Test Scripts

### 1. Bash Script (test-vendor-onboarding-endpoints.sh)

**Usage:**
```bash
./test-vendor-onboarding-endpoints.sh
```

**Features:**
- Comprehensive endpoint testing
- Color-coded output
- Detailed error messages
- Test summary

### 2. Node.js Script (test-vendor-onboarding-endpoints.js)

**Usage:**
```bash
node test-vendor-onboarding-endpoints.js
```

**Features:**
- Cross-platform compatibility
- Better error handling
- JSON response parsing
- Promise-based async operations

## Test Coverage

### ✅ Test 1: Create Application
- Creates a test vendor application
- Validates response structure
- Captures vendor ID and application ID

### ✅ Test 2: Check Status
- Verifies status endpoint works
- Checks application is in pending state

### ✅ Test 3: Get History (Initial)
- Tests history endpoint accessibility
- Verifies empty/minimal history for new application

### ✅ Test 4: Edit Application
- Tests editing with valid status (pending_approval)
- Verifies data updates correctly
- Checks edit is saved

### ✅ Test 5: Get History (After Edit)
- Verifies history contains edit entry
- Checks action type is recorded

### ✅ Test 6: Edit Validation
- Approves application first
- Attempts to edit approved application
- Verifies edit is rejected correctly

### ✅ Test 7: Withdraw Application
- Creates new application
- Withdraws it
- Verifies status updates to withdrawn

### ✅ Test 8: Withdraw Validation
- Attempts to withdraw approved application
- Verifies withdrawal is rejected

### ✅ Test 9: Bank Validation (Valid IFSC)
- Tests IFSC validation endpoint
- Verifies bank details are returned

### ✅ Test 10: Bank Validation (Invalid IFSC)
- Tests with invalid IFSC code
- Verifies rejection

### ✅ Test 11: Application with Bank Validation
- Creates application with IFSC code
- Verifies bank validation runs during submission
- Checks auto-fill functionality

### ✅ Test 12: History After Multiple Actions
- Creates application
- Performs multiple edits
- Verifies all actions in history

## Manual Testing

### 1. Edit Application Endpoint

```bash
curl -X PUT "https://YOUR_PROJECT.supabase.co/functions/v1/make-server-3dd53475/vendor/application/VENDOR_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "formData": {
      "businessName": "Updated Business Name",
      "city": "Updated City"
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "vendorId": "vendor_...",
  "applicationId": "APP...",
  "status": "pending_approval",
  "message": "Application updated successfully."
}
```

### 2. Withdraw Application Endpoint

```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/make-server-3dd53475/vendor/application/VENDOR_ID/withdraw" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "reason": "Found another platform"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "vendorId": "vendor_...",
  "applicationId": "APP...",
  "status": "withdrawn",
  "message": "Application withdrawn successfully."
}
```

### 3. Get History Endpoint

```bash
curl -X GET "https://YOUR_PROJECT.supabase.co/functions/v1/make-server-3dd53475/vendor/application/VENDOR_ID/history" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**Expected Response:**
```json
{
  "success": true,
  "vendorId": "vendor_...",
  "history": [
    {
      "action": "application_updated",
      "previousStatus": "pending_approval",
      "newStatus": "resubmitted",
      "actionBy": "vendor",
      "notes": "Application updated by vendor",
      "timestamp": "2024-12-17T..."
    }
  ],
  "total": 1
}
```

### 4. Bank Validation Endpoint

```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/make-server-3dd53475/vendor/validate-ifsc" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "ifscCode": "HDFC0000001"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "ifscDetails": {
    "bank": "HDFC Bank",
    "branch": "Mumbai Branch",
    "address": "...",
    "city": "Mumbai",
    "state": "Maharashtra",
    "valid": true
  },
  "message": "IFSC code validated successfully"
}
```

## Test Scenarios

### Scenario 1: Complete Edit Flow
1. Create application → Status: `pending_approval`
2. Edit application → Status: `pending_approval` (or `resubmitted` if was `more_info_required`)
3. Check history → Should contain edit entry
4. Verify data → Updated fields should be saved

### Scenario 2: Withdrawal Flow
1. Create application → Status: `pending_approval`
2. Withdraw application → Status: `withdrawn`
3. Check status → Should show `withdrawn`
4. Try to edit → Should fail (invalid status)

### Scenario 3: Bank Validation Flow
1. Create application with IFSC → Bank details auto-filled
2. Check vendor record → `bankDetails.validated` should be `true`
3. Check `bankDetails.validationDetails` → Should contain bank info

### Scenario 4: Status Validation
1. Approve application → Status: `approved`
2. Try to edit → Should fail with `cannot_edit` error
3. Try to withdraw → Should fail with `cannot_withdraw` error

## Expected Behaviors

### ✅ Valid Operations
- Edit when status is `pending_approval` or `more_info_required`
- Withdraw when status is `pending_approval` or `more_info_required`
- View history at any time
- Validate IFSC codes

### ❌ Invalid Operations
- Edit when status is `approved`, `rejected`, or `withdrawn`
- Withdraw when status is `approved`, `rejected`, or `withdrawn`
- Edit/withdraw non-existent vendor

## Error Responses

### Edit with Invalid Status
```json
{
  "error": "cannot_edit",
  "message": "Application cannot be edited in current status: approved",
  "currentStatus": "approved"
}
```

### Withdraw with Invalid Status
```json
{
  "error": "cannot_withdraw",
  "message": "Application cannot be withdrawn in current status: approved",
  "currentStatus": "approved"
}
```

### Vendor Not Found
```json
{
  "error": "vendor_not_found",
  "message": "Vendor application not found."
}
```

## Troubleshooting

### Issue: Tests fail with authentication error
**Solution:** Check that `SUPABASE_ANON_KEY` is set correctly

### Issue: Tests fail with 404 errors
**Solution:** Verify `SUPABASE_PROJECT_ID` matches your project

### Issue: Bank validation fails
**Solution:** 
- Check Razorpay IFSC API is accessible
- Verify IFSC code format (11 characters)
- Some IFSC codes may not be in Razorpay database

### Issue: Edit/Withdraw fails unexpectedly
**Solution:**
- Check vendor status before operation
- Ensure vendor exists in database
- Verify vendor ID format is correct

## Performance Testing

### Load Test (Optional)
```bash
# Test edit endpoint with multiple concurrent requests
for i in {1..10}; do
  curl -X PUT "..." &
done
wait
```

### Response Time Expectations
- Create application: < 2s
- Edit application: < 1s
- Withdraw application: < 1s
- Get history: < 500ms
- Bank validation: < 1s

## Integration Testing

### Frontend Integration
1. Test `VendorApplicationEdit` component
2. Verify form pre-fills correctly
3. Check status validation in UI
4. Test history display

### Admin Integration
1. Test approval workflow
2. Verify history is visible to admins
3. Check withdrawal tracking

## Continuous Testing

### Add to CI/CD
```yaml
# .github/workflows/test-onboarding.yml
- name: Test Onboarding Endpoints
  run: |
    export SUPABASE_PROJECT_ID=${{ secrets.SUPABASE_PROJECT_ID }}
    export SUPABASE_ANON_KEY=${{ secrets.SUPABASE_ANON_KEY }}
    ./test-vendor-onboarding-endpoints.sh
```

## Next Steps

1. ✅ Run automated tests
2. ✅ Manual testing with real data
3. ✅ Frontend integration testing
4. ✅ Performance testing
5. ✅ Security testing (auth, validation)

---

**Last Updated:** December 17, 2024

