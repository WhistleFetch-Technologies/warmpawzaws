# Vendor Profile Fixes Test Script

This test script verifies that all the fixes for vendor profile data (profile_photo_url, pincode, service_radius, profile completion) are working correctly in both dev and production environments.

## What It Tests

1. **Database Schema**: Verifies that all required columns exist (`profile_photo_url`, `pincode`, `service_radius`, `qualifications`, `service_area`, `description`)
2. **Vendor Auto-Creation**: Checks if vendors are being created with all profile data when auto-created from vendor_identity
3. **Profile Completion**: Calculates profile completion percentage for existing vendors (matching frontend logic)
4. **Data Completeness**: Identifies vendors missing profile data that should be fixed

## Usage

### Prerequisites

1. Install dependencies:
   ```bash
   cd warmpawzApp/warmpawzaws
   npm install
   ```

2. Set environment variables:
   ```bash
   # For dev environment
   export DATABASE_URL="postgresql://user:password@host:5432/dbname"
   export STAGE="dev"
   
   # For prod environment
   export DATABASE_URL="postgresql://user:password@prod-host:5432/dbname"
   export STAGE="prod"
   export API_BASE_URL="https://your-prod-api.execute-api.region.amazonaws.com"
   ```

### Running the Test

**Option 1: Using npm script (TypeScript version)**
```bash
npm run test:vendor-profile-fixes
```

**Option 2: Using Node.js directly (JavaScript version)**
```bash
node scripts/test-vendor-profile-fixes.js
```

**Option 3: With environment variables inline**
```bash
DATABASE_URL="postgresql://..." STAGE="prod" node scripts/test-vendor-profile-fixes.js
```

## Test Output

The script will output:
- ✅ Green checkmarks for passed tests
- ❌ Red X marks for failed tests
- Detailed information about what was tested
- A summary at the end showing total tests, passed, and failed

### Example Output

```
🧪 Starting Vendor Profile Fixes Test Suite...
Environment: prod
API Base URL: https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com
Database: Connected

📊 Testing Database Schema...
✅ Schema: profile_photo_url column exists: Type: text, Nullable: YES
✅ Schema: pincode column exists: Type: text, Nullable: YES
✅ Schema: service_radius column exists: Type: numeric, Nullable: YES
...

🏗️  Testing Vendor Auto-Creation Paths...
✅ Auto-Creation: Recent vendors data completeness: 8/10 vendors have all profile data

📈 Testing Profile Completion Calculation...
✅ Profile Completion: Vendor ABC: 12/13 fields filled (92%)

📊 Test Summary:
   Total Tests: 15
   Passed: 14
   Failed: 1
```

## What to Look For

### ✅ Good Signs
- All schema columns exist and are nullable (for pincode)
- Most vendors have complete profile data
- Profile completion percentages are accurate
- No approved/activated identities without vendor records

### ⚠️ Warning Signs
- Missing database columns (run migration 560)
- Many vendors missing profile data (may need to run fix endpoints)
- Pincode column is NOT NULL (should be nullable)
- Approved identities without vendor records (auto-creation not working)

## Troubleshooting

### "DATABASE_URL not set"
Set the `DATABASE_URL` environment variable with your PostgreSQL connection string.

### "Failed to connect"
- Check your database credentials
- Verify network connectivity
- Ensure your IP is whitelisted (for RDS)

### "Column does not exist"
Run migration 560 to ensure all columns exist:
```bash
cd db
npm run migrate:up
```

### "Many vendors missing data"
The fixes should automatically extract and save data for new vendors. For existing vendors, you may need to:
1. Use the `/vendor/onboarding/fix-profile-photo` endpoint
2. Use the `/vendor/onboarding/fix-pincode` endpoint
3. Update service_radius via `/vendor/:vendorId/settings`

## Next Steps After Testing

1. **If schema tests fail**: Run migration 560
2. **If auto-creation tests fail**: Check CloudWatch logs for vendor creation
3. **If profile completion is low**: Verify frontend is using the correct calculation
4. **If data is missing**: Use the fix endpoints or re-run vendor activation

## Integration with CI/CD

You can add this test to your CI/CD pipeline:

```yaml
- name: Test Vendor Profile Fixes
  run: |
    export DATABASE_URL="${{ secrets.PROD_DATABASE_URL }}"
    export STAGE="prod"
    npm run test:vendor-profile-fixes
  continue-on-error: true  # Don't fail the build, just report
```
