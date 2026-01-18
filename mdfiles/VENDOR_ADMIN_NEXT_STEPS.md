# Vendor Administration - Next Steps

## 🎯 Immediate Actions (Now)

### 1. Wait for CloudFront Propagation
- **Time**: 5-15 minutes
- **Status**: CloudFront invalidation `I4Y3YUAT3PRH6ODNCW2TYHQDNB` is in progress
- **Action**: Wait before testing the frontend

### 2. Verify Backend Endpoints
Test that the backend endpoints are accessible:

```bash
# Set your API base URL
export API_BASE_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"

# Get your admin token (from Cognito)
export ADMIN_TOKEN="your-cognito-id-token"

# Run the test script
./test-vendor-admin-deployment.sh
```

### 3. Check CloudWatch Logs
Monitor for any errors in Lambda execution:

```bash
# View recent Lambda logs
aws logs tail /aws/lambda/warmpawz-dev-api-handler --follow --region ap-south-1
```

---

## 🧪 Testing Checklist

### Frontend UI Testing

#### A. Access the Application
- [ ] Navigate to: `https://dfof7mguaa0a5.cloudfront.net/vendors`
- [ ] Verify page loads without errors
- [ ] Check browser console for any errors

#### B. Verify Components
- [ ] **Stats Cards**: Verify all 4 stats cards display correctly
  - Active Vendors
  - Pending Applications
  - Compliance Issues
  - Support Tickets
- [ ] **Sidebar Navigation**: Click "Vendor Administration" and verify it navigates to `/vendors`
- [ ] **Quality Alerts Panel**: Verify it displays (may be empty if no alerts)

#### C. Test Applications Tab
- [ ] **Load Applications**: Verify pending applications load
- [ ] **View Details**: Click "View Details" on an application
  - Verify `ApplicationDetailModal` opens
  - Verify all application data displays
- [ ] **Approve Action**: 
  - Click "Approve" on an application
  - Verify success message
  - Verify application status updates
- [ ] **Reject Action**:
  - Click "Reject" on an application
  - Enter rejection reason
  - Verify success message
  - Verify application status updates
- [ ] **Request Clarification**:
  - Click "Request Info" on an application
  - Enter clarification message
  - Verify success message
  - Verify application status updates

#### D. Test Other Tabs
- [ ] **Active Vendors Tab**: Verify active vendors list loads
- [ ] **Compliance Tab**: Verify compliance issues display
- [ ] **Reverification Tab**: Verify reverification requests display
- [ ] **Deactivation Tab**: Verify deactivation requests display

### Backend Endpoint Testing

#### A. Vendor Statistics
```bash
curl -X GET "${API_BASE_URL}/admin/vendors/stats" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json"
```

**Expected**: JSON response with stats object

#### B. Pending Applications
```bash
curl -X GET "${API_BASE_URL}/admin/vendors/pending-applications-fixed" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json"
```

**Expected**: JSON response with applications array

#### C. Quality Alerts
```bash
curl -X GET "${API_BASE_URL}/quality/alerts" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json"
```

**Expected**: JSON response with alerts array

#### D. Application Review (Test with valid applicationId)
```bash
# Get a valid applicationId from pending applications first
APPLICATION_ID="your-application-id"

# Test Approve
curl -X POST "${API_BASE_URL}/admin/vendor/onboarding/${APPLICATION_ID}/review" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "APPROVE",
    "admin_id": "test-admin",
    "comments": "Test approval"
  }'
```

**Expected**: Success response with status update

---

## 🔍 Verification Steps

### 1. Verify Admin ID Extraction
- [ ] Check browser console for any errors related to `getAdminId()`
- [ ] Verify admin actions include correct admin_id in API calls
- [ ] Check Network tab to see if admin_id is being sent correctly

### 2. Verify Stats Loading
- [ ] Check that stats cards display numbers (not "0" or "undefined")
- [ ] Verify stats update when refreshing the page
- [ ] Check browser console for any API errors

### 3. Verify Endpoint Calls
- [ ] Open browser DevTools → Network tab
- [ ] Navigate through the vendor admin pages
- [ ] Verify all API calls return 200 status codes
- [ ] Check for any 404 or 500 errors

### 4. Verify Quality Alerts
- [ ] Check if Quality Alerts panel displays
- [ ] Verify alerts load from `/quality/alerts` endpoint
- [ ] Check if empty state displays correctly when no alerts

---

## 📊 Monitoring

### CloudWatch Metrics
Monitor these metrics for the next 24 hours:

1. **Lambda Invocations**
   ```bash
   aws cloudwatch get-metric-statistics \
     --namespace AWS/Lambda \
     --metric-name Invocations \
     --dimensions Name=FunctionName,Value=warmpawz-dev-api-handler \
     --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
     --period 300 \
     --statistics Sum \
     --region ap-south-1
   ```

2. **Lambda Errors**
   ```bash
   aws cloudwatch get-metric-statistics \
     --namespace AWS/Lambda \
     --metric-name Errors \
     --dimensions Name=FunctionName,Value=warmpawz-dev-api-handler \
     --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
     --period 300 \
     --statistics Sum \
     --region ap-south-1
   ```

3. **API Gateway 4xx/5xx Errors**
   - Check API Gateway console for error rates
   - Monitor for any spike in errors

### CloudWatch Logs
Check for errors in Lambda logs:

```bash
# View recent errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/warmpawz-dev-api-handler \
  --filter-pattern "ERROR" \
  --region ap-south-1 \
  --max-items 50
```

---

## 🐛 Troubleshooting

### If Frontend Doesn't Load
1. **Check CloudFront Status**:
   ```bash
   aws cloudfront get-invalidation \
     --distribution-id E1WPXL8WBOWOE8 \
     --id I4Y3YUAT3PRH6ODNCW2TYHQDNB \
     --region ap-south-1
   ```
   - Wait if status is "InProgress"

2. **Clear Browser Cache**: Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

3. **Check S3 Files**:
   ```bash
   aws s3 ls s3://warmpawz-dev-admin-frontend-ap-south-1/vendors.html
   ```

### If API Calls Fail
1. **Check Lambda Logs**:
   ```bash
   aws logs tail /aws/lambda/warmpawz-dev-api-handler --follow
   ```

2. **Verify API Gateway Routes**:
   - Check API Gateway console
   - Verify routes are configured correctly

3. **Test Endpoint Directly**:
   ```bash
   curl -X GET "${API_BASE_URL}/admin/vendors/stats" \
     -H "Authorization: Bearer ${ADMIN_TOKEN}"
   ```

### If Admin ID is Missing
1. **Check Cognito Token**:
   - Verify user is logged in
   - Check localStorage for `adminCognitoTokens`
   - Verify token is not expired

2. **Check Browser Console**:
   - Look for errors in `getAdminId()` function
   - Verify JWT token decoding works

---

## 📝 Documentation Updates

After testing, update:

1. **Test Results**: Document any issues found
2. **Performance**: Note any slow endpoints or UI lag
3. **User Feedback**: Collect feedback from admin users
4. **Known Issues**: Document any bugs or limitations

---

## ✅ Success Criteria

The deployment is successful if:

- [x] Backend Lambda deployed without errors
- [x] Frontend deployed to S3 and CloudFront
- [ ] Frontend loads at CloudFront URL
- [ ] All stats cards display correctly
- [ ] Applications tab loads and displays data
- [ ] Approve/Reject/Clarification actions work
- [ ] Quality Alerts panel displays (even if empty)
- [ ] No console errors in browser
- [ ] No errors in CloudWatch logs
- [ ] API endpoints return correct responses

---

## 🚀 Future Enhancements

Based on user feedback, consider:

1. **Performance Optimizations**
   - Add pagination for large vendor lists
   - Implement virtual scrolling
   - Add caching for stats

2. **Additional Features**
   - Export vendor data to CSV
   - Bulk actions (approve/reject multiple)
   - Advanced filtering and search
   - Vendor activity timeline

3. **UI Improvements**
   - Better loading states
   - Toast notifications instead of alerts
   - Improved error messages
   - Mobile responsiveness

---

**Last Updated**: January 14, 2025  
**Status**: Ready for Testing
