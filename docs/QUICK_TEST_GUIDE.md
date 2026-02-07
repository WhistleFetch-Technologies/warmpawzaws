# Quick Test Guide - Settings Migration

## 🚀 Quick Start (5 minutes)

### 1. Run Database Migration
```bash
# Connect to your database and run:
psql -f db/migrations/071_vendor_settings_columns.sql
```

### 2. Test as Vendor

#### Step 1: Login as Vendor
- Go to vendor login page
- Login with test vendor credentials

#### Step 2: Access Settings
- Click "Settings" tab in bottom navigation
- You should see two tabs: "General" and "Payment & Payouts"

#### Step 3: Test Payment Settings
1. Click "Payment & Payouts" tab
2. Fill in bank account form:
   - Account Holder: "Test Account"
   - Account Number: "123456789012"
   - IFSC Code: "HDFC0001234"
   - Bank Name: "HDFC Bank"
3. Click "Save Bank Account"
4. ✅ Should see success message

#### Step 4: Test General Settings
1. Click "General" tab
2. Fill in:
   - Service Radius: "10"
   - Emergency Contact Name: "John Doe"
   - Emergency Contact Phone: "9876543210"
3. Click "Save Settings"
4. ✅ Should see success message
5. Refresh page - settings should persist

### 3. Test Onboarding (Simplified)
1. Start new vendor onboarding
2. ✅ Should NOT see banking section
3. ✅ Should NOT see emergency contact fields (for walkers)
4. Complete onboarding with only business info + location + documents
5. ✅ Onboarding should complete successfully

## ✅ Success Indicators

- Settings screen loads with two tabs
- Bank account form validates correctly
- Settings save and persist
- Onboarding is simplified (no banking)
- No console errors
- No API errors

## 🐛 Quick Troubleshooting

**Settings tab not showing?**
- Check VendorDashboard.tsx imports
- Verify VendorSettingsScreen component exists

**Bank account not saving?**
- Check backend logs
- Verify database migration ran
- Check API endpoint is accessible

**Settings not persisting?**
- Check database columns exist
- Verify API endpoint returns correct data
- Check browser network tab for errors

## 📞 Need Help?

Check:
1. Browser console (F12)
2. Network tab for API calls
3. Backend logs
4. Database migration status
