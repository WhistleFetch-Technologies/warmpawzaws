# Next Steps - Onboarding Simplification

## 🎯 Immediate Actions

### 1. Run Database Migration ⚠️ REQUIRED

```bash
# Run the migration to add settings columns to vendors table
psql -h <db-host> -U <db-user> -d <db-name> -f db/migrations/071_vendor_settings_columns.sql
```

**Or via your database management tool:**
- Execute `db/migrations/071_vendor_settings_columns.sql`
- Verify columns were added:
  ```sql
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'vendors' 
  AND column_name IN ('service_radius', 'emergency_contact', 'max_dogs_per_walk', 'walk_durations', 'other_config');
  ```

### 2. Test Backend Endpoints

#### Test Bank Account Endpoints

```bash
# 1. Get bank account (should return null for new vendor)
curl -X GET "https://your-api.com/vendor/{vendorId}/bank-account" \
  -H "Authorization: Bearer {token}"

# 2. Create bank account
curl -X POST "https://your-api.com/vendor/{vendorId}/bank-account" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "account_holder_name": "John Doe",
    "account_number": "123456789012",
    "ifsc_code": "HDFC0001234",
    "bank_name": "HDFC Bank",
    "branch_name": "Main Branch"
  }'

# 3. Request verification
curl -X POST "https://your-api.com/vendor/{vendorId}/bank-account/verify" \
  -H "Authorization: Bearer {token}"

# 4. Upload document
curl -X POST "https://your-api.com/vendor/{vendorId}/bank-account/document" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "document_type": "cancelled_cheque",
    "document_url": "https://storage.example.com/doc.pdf"
  }'
```

#### Test Settings Endpoints

```bash
# 1. Get settings
curl -X GET "https://your-api.com/vendor/{vendorId}/settings" \
  -H "Authorization: Bearer {token}"

# 2. Update settings
curl -X PUT "https://your-api.com/vendor/{vendorId}/settings" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "service_radius": 10.5,
    "emergency_contact": {
      "name": "Jane Doe",
      "phone": "9876543210"
    },
    "max_dogs_per_walk": 3,
    "walk_durations": ["30", "60"]
  }'
```

### 3. Test Frontend Components

#### Test Settings Screen Access
1. Login as vendor
2. Navigate to Dashboard
3. Click "Settings" tab (bottom navigation)
4. Verify both tabs appear: "General" and "Payment & Payouts"

#### Test Payment Settings
1. Go to Settings > Payment & Payouts
2. **Test Bank Account Form:**
   - Enter account holder name
   - Enter account number (test with valid/invalid)
   - Enter IFSC code (test format validation)
   - Enter bank name
   - Click "Save Bank Account"
   - Verify success message
3. **Test Document Upload:**
   - Upload cancelled cheque (PDF/JPG/PNG, max 5MB)
   - Upload bank statement
   - Verify upload success
4. **Test Verification:**
   - Click "Request Verification"
   - Verify message appears

#### Test General Settings
1. Go to Settings > General
2. **Test Service Radius:**
   - Enter service radius (e.g., 10.5 km)
   - Click "Save Settings"
   - Refresh page, verify value persists
3. **Test Emergency Contact:**
   - Enter contact name
   - Enter phone number (test validation)
   - Save and verify persistence
4. **Test Walker Settings (if walker):**
   - Set max dogs per walk
   - Select walk durations
   - Save and verify

#### Test Center Profile (for clinics/cafes/resorts/boarding)
1. Navigate to Center Profile from dashboard
2. **Test Basic Info:**
   - Update description
   - Update address
   - Save and verify
3. **Test Operating Hours:**
   - Set hours for each day
   - Use "Copy to All" feature
   - Save and verify
4. **Test Amenities:**
   - Select amenities
   - Add custom amenities
   - Save and verify
5. **Test Photos:**
   - Upload photos (max 10)
   - Remove photos
   - Save and verify

### 4. Verify Onboarding Flow

#### Test Simplified Onboarding
1. Start new vendor onboarding
2. Verify **NO** banking section appears
3. Verify **NO** emergency contact fields for walkers
4. Complete onboarding with only:
   - Business information
   - Location information
   - Documents
5. Verify onboarding completes successfully

#### Test Post-Onboarding Setup
1. After vendor activation, login to dashboard
2. Go to Settings > Payment & Payouts
3. Add bank account details
4. Go to Settings > General
5. Configure service radius and emergency contact
6. Verify all settings save correctly

## 🧪 Testing Checklist

### Backend Testing
- [ ] Database migration runs successfully
- [ ] All columns added to vendors table
- [ ] GET /vendor/:vendorId/bank-account returns correct data
- [ ] POST /vendor/:vendorId/bank-account creates/updates correctly
- [ ] IFSC validation works (valid/invalid formats)
- [ ] Account number validation works
- [ ] POST /vendor/:vendorId/bank-account/verify works
- [ ] POST /vendor/:vendorId/bank-account/document works
- [ ] GET /vendor/:vendorId/settings returns correct data
- [ ] PUT /vendor/:vendorId/settings updates correctly
- [ ] Emergency contact validation works
- [ ] Walker-specific settings save correctly

### Frontend Testing
- [ ] Settings screen loads correctly
- [ ] Tab navigation works (General ↔ Payment)
- [ ] Bank account form displays correctly
- [ ] IFSC validation shows errors
- [ ] Account number validation shows errors
- [ ] Bank account saves successfully
- [ ] Document upload works
- [ ] Verification request works
- [ ] General settings form displays correctly
- [ ] Service radius saves correctly
- [ ] Emergency contact saves correctly
- [ ] Walker settings show only for walkers
- [ ] Settings persist after page refresh
- [ ] Error messages display correctly
- [ ] Success messages display correctly

### Integration Testing
- [ ] New vendor can complete onboarding without bank details
- [ ] Vendor can add bank account after activation
- [ ] Vendor can configure settings after activation
- [ ] Center profile accessible for clinic/cafe/resort/boarding
- [ ] All settings persist correctly
- [ ] No errors in browser console
- [ ] No errors in backend logs

## 🔍 Verification Steps

### 1. Database Verification
```sql
-- Check if columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'vendors'
AND column_name IN (
  'service_radius',
  'emergency_contact',
  'max_dogs_per_walk',
  'walk_durations',
  'other_config'
);

-- Check vendor_bank_details table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'vendor_bank_details';
```

### 2. API Verification
- Test all endpoints with Postman/curl
- Verify response formats
- Check error handling
- Verify validation rules

### 3. UI Verification
- Check all components render correctly
- Verify form validations
- Test error states
- Test success states
- Check responsive design

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] All tests pass
- [ ] Database migration tested on staging
- [ ] Backend endpoints tested
- [ ] Frontend components tested
- [ ] No console errors
- [ ] No linting errors
- [ ] Documentation updated

### Deployment Steps
1. **Database Migration:**
   ```bash
   # Run on staging first
   psql -f db/migrations/071_vendor_settings_columns.sql
   
   # Verify, then run on production
   ```

2. **Backend Deployment:**
   ```bash
   # Deploy Lambda function
   ./scripts/deploy-lambda-direct.sh
   ```

3. **Frontend Deployment:**
   ```bash
   # Deploy vendor web
   ./scripts/deploy-vendor-web.sh
   ```

### Post-Deployment
- [ ] Verify migration ran successfully
- [ ] Test endpoints on production
- [ ] Test UI on production
- [ ] Monitor error logs
- [ ] Check analytics

## 📋 Additional Tasks

### 1. Update Onboarding Completion Logic
- Remove `bank_account_completed` from required steps
- Update `vendor_setup_completion` logic
- Update go-live readiness checks

### 2. Admin Panel Updates
- Add bank account verification interface
- Add settings management view
- Add verification workflow

### 3. Notifications
- Add notification when bank account verification requested
- Add notification when bank account verified
- Add notification when settings updated

### 4. Documentation Updates
- Update vendor onboarding guide
- Update settings documentation
- Update API documentation

## 🐛 Known Issues / Notes

- Bank account verification requires admin approval (manual process for now)
- UPI and Wallet payment methods show "Coming Soon"
- Settings columns need to be added via migration
- Existing vendors will need to re-enter bank details in settings

## 📞 Support

If you encounter any issues:
1. Check browser console for errors
2. Check backend logs
3. Verify database migration ran
4. Verify API endpoints are accessible
5. Check network requests in browser dev tools

## ✅ Success Criteria

Implementation is successful when:
- ✅ Vendors can complete onboarding without bank details
- ✅ Vendors can add bank account in settings
- ✅ Vendors can configure service radius and emergency contacts
- ✅ Settings persist correctly
- ✅ Center profile works for all facility types
- ✅ No errors in console or logs
- ✅ All validations work correctly
