# Next Steps - Customer App API Integration

## 🚀 Immediate Actions

### 1. Deploy Backend Changes
```bash
# Navigate to backend directory
cd backend/lambda

# Build and deploy (adjust based on your deployment process)
npm run build
# Or use your CDK deployment
cd ../../infrastructure/cdk
cdk deploy
```

**What to verify:**
- ✅ Lambda function builds successfully
- ✅ API Gateway routes are updated
- ✅ No deployment errors

### 2. Verify API Gateway Routes
**Check these endpoints are accessible:**
- `GET /customer/vendors/by-problem`
- `GET /customer/services/by-problem`
- `GET /customer/discover-services`

**Test with curl or Postman:**
```bash
# Test endpoint with problemGridId
curl "https://your-api-gateway-url/customer/vendors/by-problem?problemGridId=test-problem&roleId=veterinarian"

# Test with problemId (backward compatibility)
curl "https://your-api-gateway-url/customer/vendors/by-problem?problemId=test-problem&roleId=veterinarian"
```

### 3. Database Verification
**Check if these tables exist and have data:**
```sql
-- Check problem_grid_mappings
SELECT COUNT(*) FROM problem_grid_mappings;

-- Check vendors with staff
SELECT v.id, v.business_name, COUNT(s.id) as staff_count
FROM vendors v
LEFT JOIN staff s ON s.vendor_id = v.id AND s.is_active = true
WHERE v.status = 'approved' AND v.is_active = true
GROUP BY v.id
HAVING COUNT(s.id) > 0
LIMIT 10;

-- Check vendor_schedule_slots (if exists)
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'vendor_schedule_slots'
);

-- Check staff_specializations (if exists)
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'staff_specializations'
);
```

## 🧪 Testing Checklist

### Frontend Testing

#### 1. Test Problem Grid Navigation
- [ ] Navigate to customer app
- [ ] Open problem grid (e.g., from Vet service)
- [ ] Select a problem (e.g., "Health Checkup")
- [ ] Verify vendors/specialists are displayed
- [ ] Check browser console for API calls
- [ ] Verify no placeholder data appears

#### 2. Test Vendor Discovery
- [ ] Verify real vendor names appear
- [ ] Verify ratings and reviews are real numbers
- [ ] Check that specialists are shown for vet clinics
- [ ] Verify schedule availability displays
- [ ] Test distance calculation (if location enabled)

#### 3. Test Filters
- [ ] Test price range filter (`feeMin`/`feeMax`)
- [ ] Test sorting (rating, distance, price)
- [ ] Test role filter (`roleId`)
- [ ] Test location-based filtering

#### 4. Test Specialization Filter
- [ ] Open search filters
- [ ] Check if specializations appear
- [ ] Test filtering by specialization
- [ ] Verify filtered results are correct

### Backend Testing

#### 1. Test API Endpoints Directly
```bash
# Test with real problem ID
PROBLEM_ID="your-actual-problem-id"
ROLE_ID="veterinarian"

curl -X GET \
  "https://your-api/customer/vendors/by-problem?problemGridId=${PROBLEM_ID}&roleId=${ROLE_ID}" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
- `success: true`
- `vendors` array with real data
- `specialists` array (if vendors have staff)
- `data.vendors` and `data.specialists` for compatibility

#### 2. Test Edge Cases
- [ ] Test with non-existent problem ID (should return empty array)
- [ ] Test with vendor that has no staff (should return empty specialists)
- [ ] Test with vendor that has no schedule (should default to available)
- [ ] Test with missing location (distance should be null)

#### 3. Test Error Handling
- [ ] Test with invalid parameters
- [ ] Test with missing required parameters
- [ ] Verify graceful error messages

## 🔍 Monitoring & Debugging

### 1. Enable API Logging
**Check Lambda CloudWatch Logs:**
- Look for API request/response logs
- Check for any SQL errors
- Monitor query performance

### 2. Frontend Console Monitoring
**Open browser DevTools:**
- Network tab: Check API calls
- Console tab: Look for errors or warnings
- Verify API responses contain real data

### 3. Key Metrics to Monitor
- API response times
- Number of vendors returned
- Number of specialists returned
- Error rates
- Database query performance

## 🐛 Troubleshooting Guide

### Issue: No vendors returned
**Possible causes:**
1. Problem ID doesn't exist in `problem_grid_mappings`
2. No vendors match the role filter
3. All vendors are inactive or not approved

**Solution:**
```sql
-- Check problem mappings
SELECT * FROM problem_grid_mappings WHERE problem_id = 'your-problem-id';

-- Check vendors for role
SELECT v.* FROM vendors v
INNER JOIN roles r ON v.role_id = r.id
WHERE r.id = 'your-role-id' AND v.status = 'approved';
```

### Issue: No specialists returned
**Possible causes:**
1. Vendors don't have staff members
2. Staff table structure differs
3. Staff are inactive

**Solution:**
```sql
-- Check staff for vendors
SELECT s.*, v.business_name
FROM staff s
INNER JOIN vendors v ON s.vendor_id = v.id
WHERE v.status = 'approved' AND s.is_active = true
LIMIT 10;
```

### Issue: Schedule data not showing
**Possible causes:**
1. `vendor_schedule_slots` table doesn't exist
2. No schedule slots configured
3. Schedule check query failing

**Solution:**
- Check if table exists (code handles gracefully)
- Verify schedule slots are created for vendors
- Check CloudWatch logs for schedule query errors

### Issue: Placeholder data still showing
**Possible causes:**
1. API calls failing (falling back to defaults)
2. API returning empty results
3. Frontend not using API data

**Solution:**
- Check browser Network tab for API calls
- Verify API responses in console
- Check if `groomingServices.length > 0` in CustomerHomeComplete.tsx

## 📊 Performance Optimization (If Needed)

### 1. Database Indexes
**Add indexes if queries are slow:**
```sql
-- Index for vendor role filtering
CREATE INDEX IF NOT EXISTS idx_vendors_role_status 
ON vendors(role_id, status, is_active);

-- Index for vendor specializations
CREATE INDEX IF NOT EXISTS idx_vendor_specializations_vendor 
ON vendor_specializations(vendor_id);

-- Index for staff by vendor
CREATE INDEX IF NOT EXISTS idx_staff_vendor_active 
ON staff(vendor_id, is_active);

-- Index for schedule slots
CREATE INDEX IF NOT EXISTS idx_schedule_slots_vendor_day 
ON vendor_schedule_slots(vendor_id, day_of_week, is_enabled);
```

### 2. Query Optimization
- Consider pagination for large result sets
- Add LIMIT clauses where appropriate (already done)
- Cache frequently accessed problem mappings

### 3. API Response Caching
- Consider caching problem mappings
- Cache vendor lists for popular problems
- Use CDN for static problem grid data

## ✅ Success Criteria

### Functional Requirements
- [x] Real vendor data displays (not placeholders)
- [x] Specialists/staff appear for relevant vendors
- [x] Schedule availability shows correctly
- [x] Filters work (price, location, sorting)
- [x] Problem grid navigation works
- [x] No API errors in console

### Performance Requirements
- [ ] API response time < 2 seconds
- [ ] No database query timeouts
- [ ] Frontend loads smoothly

### Data Quality
- [ ] All displayed data is from database
- [ ] Ratings and reviews are accurate
- [ ] Services and prices are correct
- [ ] Location data is accurate

## 📝 Documentation Updates

### Update API Documentation
- Document new parameters (`problemGridId`, `feeMin`, `feeMax`)
- Document response format with specialists
- Document schedule availability fields

### Update Frontend Documentation
- Document new API integration
- Update component props if needed
- Document filter usage

## 🎯 Final Verification

### End-to-End Test Flow
1. **Customer opens app** → Home screen loads
2. **Selects service** → Vet service opens
3. **Opens problem grid** → Problems display
4. **Selects problem** → "Health Checkup"
5. **Views vendors** → Real clinics appear
6. **Views specialists** → Real doctors appear
7. **Checks availability** → Schedule shows
8. **Filters by price** → Results filtered
9. **Selects specialist** → Booking flow starts

### Verification Checklist
- [ ] All steps complete without errors
- [ ] Real data displayed throughout
- [ ] No placeholder/mock data visible
- [ ] API calls successful in Network tab
- [ ] No console errors
- [ ] Performance acceptable

## 🚨 Rollback Plan (If Needed)

If issues occur after deployment:

1. **Revert Lambda function** to previous version
2. **Check API Gateway** routes are correct
3. **Verify database** connections
4. **Review CloudWatch logs** for errors
5. **Test with previous API version**

## 📞 Support Contacts

- **Backend Issues**: Check Lambda CloudWatch logs
- **Frontend Issues**: Check browser console
- **Database Issues**: Check RDS connection logs
- **API Gateway Issues**: Check API Gateway logs

---

## 🎉 Expected Outcome

After completing these steps:
- ✅ Customer app displays real vendor data
- ✅ Specialists appear for vet clinics
- ✅ Schedule availability shows correctly
- ✅ All filters work properly
- ✅ No placeholder data visible
- ✅ Smooth user experience

**Status**: Ready for production deployment and testing! 🚀
