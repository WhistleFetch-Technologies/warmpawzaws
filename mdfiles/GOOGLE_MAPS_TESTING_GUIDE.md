# Google Maps Integration - Testing & Verification Guide

## ✅ Setup Complete

- ✅ Secret created in AWS Secrets Manager
- ✅ IAM policy updated with correct permissions
- ✅ Lambda code deployed
- ✅ VPC endpoint configured
- ✅ Frontend code ready

## 🧪 Step-by-Step Testing

### Step 1: Verify Secret is Accessible

```bash
# Test secret retrieval
aws secretsmanager get-secret-value \
  --secret-id "warmpawz/dev/google-maps/api-key" \
  --region ap-south-1 \
  --query 'SecretString' \
  --output text

# Expected output: AIzaSyC6iwRfS_r1zRtjiGyLjgueZ_rDV_l7yo0
```

### Step 2: Test API Endpoint (Wait for Lambda Warm-up)

```bash
# Test the endpoint (may timeout on first call due to cold start)
curl -X GET "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/config/google-maps-key" \
  -H "Content-Type: application/json" \
  --max-time 15

# Expected response after warm-up:
# {"apiKey":"AIzaSyC6iwRfS_r1zRtjiGyLjgueZ_rDV_l7yo0"}
```

**Note:** First request may timeout (30+ seconds) due to Lambda cold start. Subsequent requests should be faster.

### Step 3: Test in Browser - Vendor Onboarding Form

1. **Navigate to Vendor Web App:**
   ```
   https://d1s6ykkj381k58.cloudfront.net
   ```

2. **Start Vendor Onboarding:**
   - Enter phone number: `9611377119` (or any test number)
   - Complete OTP verification
   - Select a role (e.g., "Pet Groomer", "Veterinarian")
   - Proceed through onboarding steps

3. **Reach the "Complete Profile" Form:**
   - This is where `VendorDetailsFormNew.tsx` is used
   - Look for the Address section

4. **Test Map Preview:**
   - **Check Browser Console** (F12 → Console tab):
     - Look for: `🔑 [API KEY] Fetching Google Maps API key...`
     - Should see: `✅ [API KEY] Found API key`
     - Or error: `❌ Error loading Google Maps API key: Error: Not Found`
   
   - **Click "Show Map" button:**
     - Map should load in the preview area
     - Should be interactive (can click to set location)
     - Marker should be draggable

5. **Expected Console Logs:**
   ```
   📊 [VendorApp] Fetching onboarding status for phone: 9611377119
   🌐 [UAT] API Request: GET /config/google-maps-key
   ✅ [API KEY] Found API key
   🗺️ [GOOGLE MAPS] loadGoogleMapsScript called
   ✅ [GOOGLE MAPS] Map class now available!
   🗺️ [MAP INIT] Map instance created successfully
   ```

### Step 4: Verify Map Functionality

Once the map loads, test these features:

1. **Map Display:**
   - ✅ Map should render in the preview area
   - ✅ Default center: India (20.5937, 78.9629)
   - ✅ Zoom controls visible

2. **Location Selection:**
   - ✅ Click on map to set location
   - ✅ Marker appears at clicked position
   - ✅ Coordinates update in form state

3. **Marker Dragging:**
   - ✅ Marker is draggable
   - ✅ Coordinates update when marker is dragged
   - ✅ Toast notification: "Location updated!"

4. **Current Location Detection:**
   - ✅ Click "Detect" button
   - ✅ Browser prompts for location permission
   - ✅ Map centers on current location
   - ✅ Marker placed at current location

## 🔍 Troubleshooting

### Issue: Endpoint Returns 404

**Symptoms:**
- Browser console: `Error loading Google Maps API key: Error: Not Found`
- Network tab shows 404 for `/config/google-maps-key`

**Solution:**
1. Verify Lambda is deployed:
   ```bash
   aws lambda get-function --function-name warmpawz-dev-api-handler --region ap-south-1
   ```

2. Check if endpoint is registered:
   ```bash
   # Check CloudWatch logs for endpoint registration
   aws logs filter-log-events \
     --log-group-name /aws/lambda/warmpawz-dev-api-handler \
     --filter-pattern "google-maps-key" \
     --max-items 10
   ```

### Issue: Endpoint Times Out (503 Service Unavailable)

**Symptoms:**
- Request takes 30+ seconds
- Returns: `{"message":"Service Unavailable"}`

**Causes & Solutions:**

1. **Lambda Cold Start:**
   - **Solution:** Wait 1-2 minutes, then retry
   - Subsequent requests should be faster

2. **VPC Networking Issue:**
   - **Check:** VPC endpoint for Secrets Manager
   ```bash
   aws ec2 describe-vpc-endpoints \
     --filters "Name=service-name,Values=com.amazonaws.ap-south-1.secretsmanager" \
     --query 'VpcEndpoints[*].{State:State,VpcEndpointId:VpcEndpointId}'
   ```
   - **Solution:** Ensure VPC endpoint is in "available" state

3. **IAM Permissions:**
   - **Check:** Verify policy includes the secret ARN
   ```bash
   ROLE_NAME=$(aws lambda get-function --function-name warmpawz-dev-api-handler --region ap-south-1 --query 'Configuration.Role' --output text | awk -F'/' '{print $NF}')
   aws iam get-role-policy --role-name "$ROLE_NAME" --policy-name "warmpawz-dev-lambda-custom-*" --query 'PolicyDocument.Statement[?contains(Resource[], `google-maps`)].Resource'
   ```
   - **Solution:** Policy should include: `warmpawz/dev/google-maps/api-key-*`

### Issue: Map Doesn't Load in Browser

**Symptoms:**
- API key fetched successfully
- But map doesn't render
- Console shows: `Google Maps API not ready`

**Solutions:**

1. **Check API Key Validity:**
   - Verify key is active in Google Cloud Console
   - Check API restrictions (should allow Maps JavaScript API)
   - Verify billing is enabled

2. **Check Browser Console:**
   - Look for Google Maps API errors
   - Common errors:
     - `RefererNotAllowedMapError`: Add domain to API key restrictions
     - `ApiNotActivatedMapError`: Enable Maps JavaScript API
     - `InvalidKeyMapError`: API key is invalid

3. **Verify Script Loading:**
   ```javascript
   // In browser console:
   console.log('Google Maps loaded:', !!window.google);
   console.log('Map class available:', !!window.google?.maps?.Map);
   ```

### Issue: Secret Not Found

**Symptoms:**
- Endpoint returns: `{"error":"Google Maps API key not configured"}`

**Solution:**
1. Verify secret exists:
   ```bash
   aws secretsmanager describe-secret \
     --secret-id "warmpawz/dev/google-maps/api-key" \
     --region ap-south-1
   ```

2. Check IAM policy includes the secret ARN pattern

3. Verify Lambda can access Secrets Manager:
   ```bash
   # Check CloudWatch logs for access denied errors
   aws logs filter-log-events \
     --log-group-name /aws/lambda/warmpawz-dev-api-handler \
     --filter-pattern "AccessDenied" \
     --max-items 5
   ```

## 📊 Monitoring

### CloudWatch Logs

Monitor Lambda execution:

```bash
# Watch logs in real-time
aws logs tail /aws/lambda/warmpawz-dev-api-handler --follow

# Filter for Google Maps related logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/warmpawz-dev-api-handler \
  --filter-pattern "google-maps" \
  --start-time $(($(date +%s) - 3600))000
```

### Browser Network Tab

1. Open DevTools (F12)
2. Go to Network tab
3. Filter by: `google-maps-key`
4. Check:
   - Request URL: Should be `/config/google-maps-key`
   - Status: Should be 200 (after warm-up)
   - Response: Should contain `{"apiKey":"AIza..."}`

### Browser Console

Watch for these log messages:

**Success Flow:**
```
🔑 [API KEY] Fetching Google Maps API key from backend...
✅ [API KEY] Found API key
🗺️ [GOOGLE MAPS] loadGoogleMapsScript called
✅ [GOOGLE MAPS] Map class now available!
🗺️ [MAP INIT] Map instance created successfully
```

**Error Flow:**
```
❌ [API KEY] Error fetching Google Maps key: Error: Not Found
⚠️ [API KEY] No Google Maps API key found in backend settings
```

## ✅ Success Criteria

The integration is working correctly when:

1. ✅ API endpoint returns API key: `{"apiKey":"AIza..."}`
2. ✅ Browser console shows successful API key fetch
3. ✅ Google Maps script loads without errors
4. ✅ Map renders in the preview area
5. ✅ Map is interactive (clickable, draggable marker)
6. ✅ Location detection works
7. ✅ Coordinates are saved in form state

## 🚀 Production Checklist

Before deploying to production:

- [ ] Update secret for production stage: `warmpawz/prod/google-maps/api-key`
- [ ] Verify IAM policy includes production secret ARN
- [ ] Test API key restrictions in Google Cloud Console
- [ ] Enable Maps JavaScript API billing
- [ ] Set up CloudWatch alarms for endpoint errors
- [ ] Test with production domain restrictions
- [ ] Verify VPC endpoint exists in production VPC
- [ ] Test end-to-end onboarding flow in production

## 📝 Quick Test Commands

```bash
# 1. Verify secret
aws secretsmanager get-secret-value \
  --secret-id "warmpawz/dev/google-maps/api-key" \
  --region ap-south-1 \
  --query 'SecretString' \
  --output text

# 2. Test endpoint (after warm-up)
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/config/google-maps-key"

# 3. Check Lambda logs
aws logs tail /aws/lambda/warmpawz-dev-api-handler --follow

# 4. Verify IAM policy
ROLE_NAME=$(aws lambda get-function --function-name warmpawz-dev-api-handler --region ap-south-1 --query 'Configuration.Role' --output text | awk -F'/' '{print $NF}')
aws iam get-role-policy --role-name "$ROLE_NAME" --policy-name "warmpawz-dev-lambda-custom-*" | grep google-maps
```

## 🎯 Expected User Experience

1. User enters onboarding flow
2. Reaches "Complete Profile" step
3. Sees Address field with "Detect" and "Show Map" buttons
4. Clicks "Show Map" → Map loads instantly
5. Clicks on map or drags marker → Location is set
6. Coordinates are saved with form submission
7. No errors in console, smooth experience

---

**Last Updated:** 2026-01-12
**Status:** ✅ Setup Complete - Ready for Testing
