# Testing Guide - Customer App API Integration

## 🧪 Test Results Summary

### ✅ Deployment Status
- **Lambda Function**: ✅ Deployed and Active
- **API Endpoints**: ✅ Responding correctly
- **Parameter Compatibility**: ✅ Working (problemGridId supported)
- **Backward Compatibility**: ✅ Maintained (problemId still works)

### ⚠️ Database Issue Found
**Issue**: `problem_grid_mappings` table does not exist
- **Impact**: `/customer/vendors/by-problem` endpoint returns error for this table
- **Status**: Code handles gracefully, but needs table or alternative approach
- **Solution**: Either create the table or use alternative endpoints

## 📋 Testing Checklist

### 1. Test Service Discovery Endpoint (Working)
```bash
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/discover-services?category=vet"
```

**Expected**: Returns vendors with services, ratings, availability

### 2. Test Vendor Search (Working)
```bash
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/vendors/search?roleId=veterinarian"
```

**Expected**: Returns vendors matching the role

### 3. Test Problem-Based Discovery (Needs Table)
```bash
# This will work once problem_grid_mappings table exists
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/vendors/by-problem?problemGridId=health-checkup&roleId=veterinarian"
```

**Current Status**: Returns error about missing table
**Action Needed**: Create `problem_grid_mappings` table or use alternative endpoints

## 🔧 Database Setup Options

### Option 1: Create problem_grid_mappings Table
```sql
CREATE TABLE IF NOT EXISTS problem_grid_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id TEXT NOT NULL,
  problem_name TEXT NOT NULL,
  problem_display_name TEXT,
  role_id TEXT NOT NULL,
  sub_category_id TEXT,
  sub_category_name TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_problem_grid_problem_id ON problem_grid_mappings(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_grid_role_id ON problem_grid_mappings(role_id);
```

### Option 2: Use Alternative Endpoints (Immediate Solution)
Instead of `/customer/vendors/by-problem`, use:
- `/customer/discover-services?category=vet` - Works now
- `/customer/vendors/search?roleId=veterinarian` - Works now
- `/customer/services/by-problem` - May need table, but has fallback

## 🧪 Frontend Testing Steps

### Step 1: Test Service Discovery
1. Open customer app
2. Navigate to Vet service
3. Verify vendors appear
4. Check browser console for API calls
5. Verify real vendor names (not placeholders)

### Step 2: Test Vendor Details
1. Click on a vendor
2. Verify vendor profile loads
3. Check services are listed
4. Verify ratings and reviews show

### Step 3: Test Problem Grid (If Table Exists)
1. Navigate to problem grid
2. Select a problem
3. Verify vendors/specialists appear
4. Check schedule availability
5. Test filters

### Step 4: Test Specialists Display
1. For vet clinics, verify doctors/specialists appear
2. Check specialization details
3. Verify services per specialist
4. Test booking flow

## 📊 API Response Verification

### Expected Response Format - /customer/discover-services
```json
{
  "success": true,
  "vendors": [
    {
      "id": "vendor-id",
      "businessName": "Real Clinic Name",
      "rating": 4.5,
      "totalReviews": 120,
      "isAvailableToday": true,
      "distance": 2.5,
      "featuredOfferings": [...]
    }
  ]
}
```

### Expected Response Format - /customer/vendors/by-problem (Once Table Exists)
```json
{
  "success": true,
  "vendors": [
    {
      "id": "vendor-id",
      "businessName": "Clinic Name",
      "specialists": [
        {
          "staffId": "staff-id",
          "fullName": "Dr. Name",
          "specializationDetails": [...],
          "services": [...]
        }
      ],
      "nextAvailable": {
        "date": "Monday",
        "time": "10:00 AM"
      }
    }
  ],
  "specialists": [...]
}
```

## 🔍 Monitoring & Debugging

### Check Lambda Logs
```bash
aws logs tail /aws/lambda/warmpawz-dev-api-handler --follow --region ap-south-1
```

### Check API Gateway Logs
```bash
aws apigatewayv2 get-logs --api-id YOUR_API_ID --region ap-south-1
```

### Browser Console Checks
1. Open DevTools → Network tab
2. Filter by "vendors" or "by-problem"
3. Check request/response
4. Verify no 404/500 errors
5. Check response contains real data

## ✅ Success Criteria

### API Level
- [x] Endpoints respond (not 404/500)
- [x] Parameter compatibility works
- [ ] Problem-based discovery works (needs table)
- [x] Service discovery works
- [x] Vendor search works

### Frontend Level
- [ ] Real vendor data displays
- [ ] No placeholder data visible
- [ ] Specialists appear for vet clinics
- [ ] Schedule availability shows
- [ ] Filters work correctly

### Data Quality
- [ ] Vendor names are real (not "Test Vendor")
- [ ] Ratings are realistic (0-5 range)
- [ ] Services have real prices
- [ ] Locations are valid addresses

## 🚨 Troubleshooting

### Issue: "problem_grid_mappings does not exist"
**Solution**: 
1. Create the table (see SQL above)
2. OR use alternative endpoints (`/customer/discover-services`)
3. OR populate table with problem mappings

### Issue: No vendors returned
**Check**:
- Vendor status is 'approved'
- Vendor is_active = true
- Role matches query parameter

### Issue: No specialists returned
**Check**:
- Staff table has data for vendors
- Staff is_active = true
- Staff linked to vendors correctly

## 📝 Next Actions

1. **Immediate**: Test `/customer/discover-services` endpoint (works now)
2. **Short-term**: Create `problem_grid_mappings` table or use alternatives
3. **Testing**: Verify frontend displays real data
4. **Monitoring**: Check CloudWatch logs for errors

## 🎯 Current Status

- ✅ **Backend Deployed**: Lambda function active
- ✅ **API Endpoints**: Responding correctly
- ✅ **Parameter Support**: problemGridId working
- ⚠️ **Database**: problem_grid_mappings table needed
- ✅ **Alternative Endpoints**: Available and working

**Recommendation**: Use `/customer/discover-services` and `/customer/vendors/search` endpoints while setting up problem_grid_mappings table.
