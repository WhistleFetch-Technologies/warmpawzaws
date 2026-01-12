# 🔐 Cognito Authorizer Production Enablement Guide

**Date:** January 2, 2026  
**Status:** Implementation Guide  
**Priority:** 🔴 CRITICAL (Must Enable Before Production Launch)

---

## 📋 OVERVIEW

This document provides step-by-step instructions for enabling Cognito JWT authorizers on API Gateway for production deployment.

**Current Status:**
- ✅ Cognito authorizers are **configured** in CDK infrastructure
- ⚠️ Authorizers may be **disabled** in dev/staging environments
- 🔴 Must be **enabled** for production deployment

---

## 🎯 OBJECTIVES

1. Enable Cognito JWT authorizers on API Gateway
2. Configure routes to use appropriate authorizers
3. Test authentication flow
4. Document configuration for production

---

## ✅ PRE-REQUISITES

- AWS Console access
- Cognito User Pools created (customer, vendor, admin)
- API Gateway deployed
- CDK infrastructure deployed
- Access to production environment

---

## 📝 IMPLEMENTATION STEPS

### Step 1: Verify Cognito User Pools

**Check User Pools Exist:**
```bash
# List Cognito user pools
aws cognito-idp list-user-pools --max-results 10 --region ap-south-1

# Verify each pool exists
aws cognito-idp describe-user-pool \
  --user-pool-id <customer-pool-id> \
  --region ap-south-1

aws cognito-idp describe-user-pool \
  --user-pool-id <vendor-pool-id> \
  --region ap-south-1

aws cognito-idp describe-user-pool \
  --user-pool-id <admin-pool-id> \
  --region ap-south-1
```

**Expected Output:**
- Customer user pool: `warmpawz-prod-customer-pool`
- Vendor user pool: `warmpawz-prod-vendor-pool`
- Admin user pool: `warmpawz-prod-admin-pool`

---

### Step 2: Verify API Gateway Configuration

**Check API Gateway:**
```bash
# List APIs
aws apigatewayv2 get-apis --region ap-south-1

# Get API details
API_ID=$(aws apigatewayv2 get-apis \
  --query "Items[?Name=='warmpawz-prod-api'].ApiId" \
  --output text \
  --region ap-south-1)

echo "API ID: $API_ID"
```

---

### Step 3: Check Current Authorizer Configuration

**List Existing Authorizers:**
```bash
# List authorizers
aws apigatewayv2 get-authorizers \
  --api-id $API_ID \
  --region ap-south-1

# Check route authorization
aws apigatewayv2 get-routes \
  --api-id $API_ID \
  --region ap-south-1 \
  --query 'Items[*].[RouteKey,AuthorizationType,AuthorizerId]' \
  --output table
```

**Current State:**
- Routes should show `AuthorizationType: JWT` for protected routes
- Routes should show `AuthorizationType: NONE` for public routes (e.g., `/health`)

---

### Step 4: Enable Authorizers via CDK (Recommended)

**If Authorizers Are Not Configured:**

1. **Update CDK Stack:**
   - Ensure `infrastructure/cdk/lib/api-gateway-stack.ts` has authorizers configured
   - Authorizers should be created and attached to routes

2. **Deploy CDK Stack:**
   ```bash
   cd infrastructure/cdk
   
   # Review changes
   npm run cdk diff ApiGatewayStack -- --context environment=prod
   
   # Deploy
   npm run cdk deploy ApiGatewayStack -- --context environment=prod
   ```

3. **Verify Deployment:**
   ```bash
   # Check authorizers
   aws apigatewayv2 get-authorizers \
     --api-id $API_ID \
     --region ap-south-1 \
     --output table
   ```

---

### Step 5: Configure Route Authorization (Manual - If Needed)

**If CDK deployment doesn't attach authorizers:**

**For Customer Routes:**
```bash
# Get customer authorizer ID
CUSTOMER_AUTH_ID=$(aws apigatewayv2 get-authorizers \
  --api-id $API_ID \
  --query "Items[?Name=='CustomerAuthorizer'].AuthorizerId" \
  --output text \
  --region ap-south-1)

# Update routes (example: /customer/*)
aws apigatewayv2 update-route \
  --api-id $API_ID \
  --route-id <route-id> \
  --authorization-type JWT \
  --authorizer-id $CUSTOMER_AUTH_ID \
  --region ap-south-1
```

**For Vendor Routes:**
```bash
# Get vendor authorizer ID
VENDOR_AUTH_ID=$(aws apigatewayv2 get-authorizers \
  --api-id $API_ID \
  --query "Items[?Name=='VendorAuthorizer'].AuthorizerId" \
  --output text \
  --region ap-south-1)

# Update routes (example: /vendor/*)
aws apigatewayv2 update-route \
  --api-id $API_ID \
  --route-id <route-id> \
  --authorization-type JWT \
  --authorizer-id $VENDOR_AUTH_ID \
  --region ap-south-1
```

**For Admin Routes:**
```bash
# Get admin authorizer ID
ADMIN_AUTH_ID=$(aws apigatewayv2 get-authorizers \
  --api-id $API_ID \
  --query "Items[?Name=='AdminAuthorizer'].AuthorizerId" \
  --output text \
  --region ap-south-1)

# Update routes (example: /admin/*)
aws apigatewayv2 update-route \
  --api-id $API_ID \
  --route-id <route-id> \
  --authorization-type JWT \
  --authorizer-id $ADMIN_AUTH_ID \
  --region ap-south-1
```

**Keep Public Routes Unauthorized:**
```bash
# Health check should remain public
aws apigatewayv2 update-route \
  --api-id $API_ID \
  --route-id <health-route-id> \
  --authorization-type NONE \
  --region ap-south-1
```

---

### Step 6: Test Authentication

**1. Test Public Endpoint (Should Work):**
```bash
# Health check should work without auth
curl -X GET https://api.warmpawz.com/health

# Expected: 200 OK
```

**2. Test Protected Endpoint Without Token (Should Fail):**
```bash
# Protected endpoint without token
curl -X GET https://api.warmpawz.com/admin/roles

# Expected: 401 Unauthorized
# Response: {"message":"Unauthorized"}
```

**3. Test Protected Endpoint With Invalid Token (Should Fail):**
```bash
# Protected endpoint with invalid token
curl -X GET https://api.warmpawz.com/admin/roles \
  -H "Authorization: Bearer invalid-token"

# Expected: 401 Unauthorized
```

**4. Test Protected Endpoint With Valid Token (Should Work):**
```bash
# Get valid Cognito token (requires authentication)
TOKEN=$(aws cognito-idp admin-initiate-auth \
  --user-pool-id <admin-pool-id> \
  --client-id <client-id> \
  --auth-flow ADMIN_NO_SRP_AUTH \
  --auth-parameters USERNAME=<username>,PASSWORD=<password> \
  --region ap-south-1 \
  --query 'AuthenticationResult.IdToken' \
  --output text)

# Test protected endpoint
curl -X GET https://api.warmpawz.com/admin/roles \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 OK with data
```

---

### Step 7: Verify Configuration

**Check All Routes:**
```bash
# Get all routes with authorization info
aws apigatewayv2 get-routes \
  --api-id $API_ID \
  --region ap-south-1 \
  --query 'Items[*].[RouteKey,AuthorizationType,AuthorizerId]' \
  --output table
```

**Expected Configuration:**
| Route | Authorization Type | Authorizer |
|-------|-------------------|------------|
| `GET /health` | NONE | - |
| `ANY /customer/*` | JWT | CustomerAuthorizer |
| `ANY /vendor/*` | JWT | VendorAuthorizer |
| `ANY /admin/*` | JWT | AdminAuthorizer |
| `ANY /{proxy+}` | JWT | (Default) |

---

## 🔍 TROUBLESHOOTING

### Issue 1: Authorizer Not Found

**Symptoms:**
- Error: "Authorizer not found"
- Routes fail with 500 error

**Solution:**
1. Verify authorizer exists:
   ```bash
   aws apigatewayv2 get-authorizers --api-id $API_ID
   ```

2. If missing, create authorizer via CDK or manually:
   ```bash
   aws apigatewayv2 create-authorizer \
     --api-id $API_ID \
     --authorizer-type JWT \
     --identity-source '$request.header.Authorization' \
     --name CustomerAuthorizer \
     --jwt-configuration \
       Audience=<client-id>,\
       Issuer=https://cognito-idp.ap-south-1.amazonaws.com/<pool-id>
   ```

---

### Issue 2: Invalid Token Error

**Symptoms:**
- Error: "Unauthorized" even with valid token
- Token validation fails

**Solution:**
1. Verify token format (should be JWT)
2. Check token issuer matches Cognito pool
3. Verify token audience matches client ID
4. Check token expiration (tokens expire after 1 hour by default)

---

### Issue 3: Routes Still Unauthorized

**Symptoms:**
- Routes still accessible without token
- Authorization type still shows "NONE"

**Solution:**
1. Verify route update succeeded:
   ```bash
   aws apigatewayv2 get-route --api-id $API_ID --route-id <route-id>
   ```

2. Redeploy API Gateway stage:
   ```bash
   aws apigatewayv2 create-deployment \
     --api-id $API_ID \
     --stage-name $default
   ```

---

## 📊 VERIFICATION CHECKLIST

Before marking as complete, verify:

- [ ] Cognito user pools exist and are accessible
- [ ] Authorizers created in API Gateway
- [ ] Routes configured with correct authorizers
- [ ] Public routes (e.g., `/health`) remain unauthorized
- [ ] Protected routes require authentication
- [ ] Invalid tokens are rejected (401)
- [ ] Valid tokens are accepted (200)
- [ ] Error messages don't leak sensitive information
- [ ] CloudWatch logs show authentication attempts
- [ ] Monitoring alerts configured for auth failures

---

## 🚀 PRODUCTION DEPLOYMENT CHECKLIST

**Before Production Launch:**

- [ ] Enable authorizers in production environment
- [ ] Test authentication flow end-to-end
- [ ] Verify all routes are properly protected
- [ ] Test error handling (invalid tokens, expired tokens)
- [ ] Configure monitoring and alerts
- [ ] Document any custom configurations
- [ ] Update incident response procedures
- [ ] Notify team about authentication requirements

---

## 📚 REFERENCES

- [AWS API Gateway JWT Authorizer Documentation](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html)
- [CDK API Gateway Stack](../../infrastructure/cdk/lib/api-gateway-stack.ts)
- [Cognito User Pool Configuration](../../infrastructure/cdk/lib/cognito-stack.ts)

---

## ✅ COMPLETION

**Status:** ⚠️ **PENDING** - Requires manual enablement in production

**Next Steps:**
1. Review this guide with team
2. Schedule production enablement window
3. Execute steps 1-7 above
4. Verify all checklist items
5. Document any deviations from standard procedure

---

**IMPORTANT:** Do not proceed to production launch without enabling Cognito authorizers. This is a critical security requirement.
