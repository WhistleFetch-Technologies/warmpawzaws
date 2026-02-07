# Priority Order - Onboarding Simplification Implementation

## 🎯 Execution Priority (Do in this exact order)

### **PRIORITY 1: Database Migration** ⚠️ CRITICAL - DO FIRST
**Time: 2-5 minutes**

```bash
# Step 1: Backup database (recommended)
pg_dump -h <host> -U <user> -d <database> > backup_before_migration.sql

# Step 2: Run migration
psql -h <host> -U <user> -d <database> -f db/migrations/071_vendor_settings_columns.sql

# Step 3: Verify migration
psql -h <host> -U <user> -d <database> -c "
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vendors' 
AND column_name IN ('service_radius', 'emergency_contact', 'max_dogs_per_walk', 'walk_durations', 'other_config');
"
```

**Why First?**
- Without these columns, the settings endpoints will fail
- Frontend will show errors when trying to save settings
- This is a blocking dependency for everything else

**Success Criteria:**
- ✅ All 5 columns exist in vendors table
- ✅ No migration errors
- ✅ Columns have correct data types

---

### **PRIORITY 2: Backend Endpoint Testing** 🔧 CRITICAL
**Time: 10-15 minutes**

#### 2.1 Test Bank Account Endpoints
```bash
# Test 1: Get bank account (should work even if null)
curl -X GET "https://your-api.com/vendor/{vendorId}/bank-account" \
  -H "Authorization: Bearer {token}"

# Test 2: Create bank account
curl -X POST "https://your-api.com/vendor/{vendorId}/bank-account" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "account_holder_name": "Test Account",
    "account_number": "123456789012",
    "ifsc_code": "HDFC0001234",
    "bank_name": "HDFC Bank",
    "branch_name": "Test Branch"
  }'

# Test 3: Verify it was saved
curl -X GET "https://your-api.com/vendor/{vendorId}/bank-account" \
  -H "Authorization: Bearer {token}"
```

#### 2.2 Test Settings Endpoints
```bash
# Test 1: Get settings
curl -X GET "https://your-api.com/vendor/{vendorId}/settings" \
  -H "Authorization: Bearer {token}"

# Test 2: Update settings
curl -X PUT "https://your-api.com/vendor/{vendorId}/settings" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "service_radius": 10.5,
    "emergency_contact": {
      "name": "Emergency Contact",
      "phone": "9876543210"
    }
  }'

# Test 3: Verify update
curl -X GET "https://your-api.com/vendor/{vendorId}/settings" \
  -H "Authorization: Bearer {token}"
```

**Or use the automated script:**
```bash
./scripts/test-settings-endpoints.sh <API_URL> <VENDOR_ID> <AUTH_TOKEN>
```

**Why Second?**
- Need to verify backend works before testing frontend
- Frontend depends on these endpoints
- Catch any backend issues early

**Success Criteria:**
- ✅ All endpoints return 200/201 status
- ✅ Data saves correctly
- ✅ Data retrieves correctly
- ✅ Validation works (test invalid IFSC, etc.)

---

### **PRIORITY 3: Frontend UI Testing** 🎨 HIGH PRIORITY
**Time: 15-20 minutes**

#### 3.1 Test Settings Screen Access
1. Login as vendor
2. Navigate to Dashboard
3. Click "Settings" tab (bottom navigation)
4. ✅ Verify both tabs appear: "General" | "Payment & Payouts"

#### 3.2 Test Payment Settings Tab
1. Click "Payment & Payouts" tab
2. **Test Form Validation:**
   - Try saving with empty fields → Should show errors
   - Enter invalid IFSC (e.g., "ABCD123") → Should show error
   - Enter valid IFSC (e.g., "HDFC0001234") → Should accept
   - Enter account number → Should accept
3. **Test Save:**
   - Fill all required fields
   - Click "Save Bank Account"
   - ✅ Should see success message
   - Refresh page → ✅ Data should persist
4. **Test Document Upload:**
   - Upload cancelled cheque (test file size limit)
   - Upload bank statement
   - ✅ Should see upload success

#### 3.3 Test General Settings Tab
1. Click "General" tab
2. **Test Service Radius:**
   - Enter service radius (e.g., 10.5)
   - Click "Save Settings"
   - ✅ Should see success
   - Refresh → ✅ Should persist
3. **Test Emergency Contact:**
   - Enter name and phone
   - Test invalid phone → Should show error
   - Enter valid phone → Should accept
   - Save → ✅ Should persist
4. **Test Walker Settings (if walker):**
   - Set max dogs per walk
   - Select walk durations
   - Save → ✅ Should persist

**Why Third?**
- Frontend is what users interact with
- Need backend working first (Priority 2)
- This validates the complete user flow

**Success Criteria:**
- ✅ Settings screen loads
- ✅ Both tabs work
- ✅ Forms validate correctly
- ✅ Data saves and persists
- ✅ No console errors
- ✅ Success/error messages display

---

### **PRIORITY 4: Onboarding Flow Verification** 📝 HIGH PRIORITY
**Time: 10 minutes**

#### 4.1 Test Simplified Onboarding
1. Start new vendor onboarding
2. **Verify Banking Section Removed:**
   - Go through all onboarding steps
   - ✅ Should NOT see "Banking Details" section
   - ✅ Should NOT see bank account fields
3. **Verify Emergency Contact Removed (for walkers):**
   - If testing as walker
   - ✅ Should NOT see emergency contact fields in onboarding
4. **Complete Onboarding:**
   - Fill only: Business info + Location + Documents
   - Submit
   - ✅ Should complete successfully
   - ✅ Should redirect to dashboard

#### 4.2 Test Post-Onboarding Setup
1. After activation, login to dashboard
2. Go to Settings > Payment & Payouts
3. Add bank account details
4. Go to Settings > General
5. Configure service radius and emergency contact
6. ✅ All settings should save correctly

**Why Fourth?**
- Validates the simplification worked
- Ensures vendors can complete onboarding
- Confirms post-onboarding setup flow

**Success Criteria:**
- ✅ Onboarding has no banking section
- ✅ Onboarding has no emergency contact (walkers)
- ✅ Onboarding completes successfully
- ✅ Vendor can add bank account after activation
- ✅ Vendor can configure settings after activation

---

### **PRIORITY 5: Center Profile Testing** 🏢 MEDIUM PRIORITY
**Time: 10-15 minutes**

#### 5.1 Test Center Profile Access
**For each vendor type:**
- Clinic (veterinarian with at_center)
- Cafe (pet_cafe)
- Resort (pet_resort)
- Boarding (pet_boarder)

1. Login as appropriate vendor type
2. Navigate to dashboard
3. Find "Center Profile" button/card
4. ✅ Should be accessible

#### 5.2 Test Center Profile Features
1. **Basic Info Tab:**
   - Update description
   - Update address
   - Save → ✅ Should persist
2. **Timing Tab:**
   - Set hours for each day
   - Use "Copy to All" feature
   - Save → ✅ Should persist
3. **Amenities Tab:**
   - Select amenities
   - Add custom amenities
   - Save → ✅ Should persist
4. **Specialization Tab:**
   - Select specializations
   - Save → ✅ Should persist
5. **Photos:**
   - Upload photos (test max 10 limit)
   - Remove photos
   - Save → ✅ Should persist

**Why Fifth?**
- Important for facility-based vendors
- Not critical for all vendor types
- Can be tested after core functionality works

**Success Criteria:**
- ✅ Center Profile accessible for facility types
- ✅ All tabs work correctly
- ✅ Data saves and persists
- ✅ Photo upload works
- ✅ No errors

---

### **PRIORITY 6: Integration & Edge Cases** 🔍 MEDIUM PRIORITY
**Time: 15-20 minutes**

#### 6.1 Test Edge Cases
- **Invalid IFSC formats:** Test various invalid formats
- **Account number validation:** Test too short/long
- **Phone validation:** Test invalid phone numbers
- **Service radius:** Test negative values, decimals
- **Empty fields:** Test required field validation
- **Large file uploads:** Test file size limits
- **Special characters:** Test in text fields

#### 6.2 Test Error Handling
- **Network errors:** Disconnect network, test error messages
- **API errors:** Test with invalid vendor ID
- **Permission errors:** Test with wrong auth token
- **Database errors:** Test with invalid data types

#### 6.3 Test Data Persistence
- **Refresh test:** Save settings, refresh page, verify persistence
- **Multiple updates:** Update settings multiple times
- **Concurrent updates:** Test multiple tabs (if applicable)

**Why Sixth?**
- Ensures robustness
- Catches edge cases
- Validates error handling

**Success Criteria:**
- ✅ All validations work
- ✅ Error messages are clear
- ✅ No crashes on invalid input
- ✅ Data persists correctly

---

### **PRIORITY 7: Documentation & Cleanup** 📚 LOW PRIORITY
**Time: 10 minutes**

#### 7.1 Update Documentation
- Update onboarding guide (remove banking section)
- Update settings documentation
- Update API documentation
- Update vendor user guide

#### 7.2 Code Cleanup
- Remove any commented code
- Remove unused imports
- Verify no console.logs in production code
- Check for TODO comments

**Why Last?**
- Important but not blocking
- Can be done after everything works
- Improves maintainability

---

## ⏱️ Total Estimated Time

- **Priority 1:** 2-5 minutes
- **Priority 2:** 10-15 minutes
- **Priority 3:** 15-20 minutes
- **Priority 4:** 10 minutes
- **Priority 5:** 10-15 minutes
- **Priority 6:** 15-20 minutes
- **Priority 7:** 10 minutes

**Total: ~75-105 minutes (1.5-2 hours)**

## 🚨 Blocking Issues

If any priority fails, **STOP** and fix before proceeding:

- **Priority 1 fails:** Database migration error → Fix migration, retry
- **Priority 2 fails:** Backend endpoint error → Fix backend, retry
- **Priority 3 fails:** Frontend error → Check backend first, then fix frontend

## ✅ Completion Checklist

- [ ] Priority 1: Database migration complete
- [ ] Priority 2: Backend endpoints tested
- [ ] Priority 3: Frontend UI tested
- [ ] Priority 4: Onboarding flow verified
- [ ] Priority 5: Center profile tested
- [ ] Priority 6: Edge cases tested
- [ ] Priority 7: Documentation updated

## 🎯 Quick Reference

**Must Do (Critical):**
1. ✅ Database migration
2. ✅ Backend testing
3. ✅ Frontend testing
4. ✅ Onboarding verification

**Should Do (Important):**
5. ✅ Center profile testing
6. ✅ Edge case testing

**Nice to Do (Optional):**
7. ✅ Documentation updates

---

**Start with Priority 1 and work your way down. Don't skip priorities!**
