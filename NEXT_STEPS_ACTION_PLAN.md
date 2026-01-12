# Next Steps Action Plan - Production Deployment

**Date:** 2026-01-28  
**Status:** ✅ **Code Ready** | ⚠️ **Deployment Needed**  
**Priority:** High

---

## 🎯 IMMEDIATE NEXT STEPS (This Week)

### **Step 1: Set SSM Parameters** 🔴 **CRITICAL**
**Time:** 1-2 hours  
**Blocks:** Infrastructure deployment

**Action:**
```bash
# Verify current state
./scripts/verify-ssm-parameters.sh dev ap-south-1

# Setup missing parameters (interactive)
./scripts/setup-ssm-parameters.sh dev ap-south-1

# Repeat for stage and prod
./scripts/setup-ssm-parameters.sh stage ap-south-1
./scripts/setup-ssm-parameters.sh prod ap-south-1
```

**Required Parameters (14 total):**
- Database (5): host, port, name, user, password
- Cognito (2): userPoolId, clientId
- Razorpay (3): keyId, keySecret, webhookSecret
- SNS (1): smsTopicArn
- VPC (3): securityGroupId, subnetId1, subnetId2
- CORS (1): allowedOrigins

**Documentation:** `SSM_PARAMETER_COMPLETE_GUIDE.md`

---

### **Step 2: Deploy CDK Infrastructure** 🔴 **CRITICAL**
**Time:** 2-4 hours  
**Blocks:** Everything else

**Action:**
```bash
cd infrastructure/cdk

# Install dependencies
npm install

# Bootstrap CDK (first time only)
cdk bootstrap

# Deploy all stacks
cdk deploy --all

# Or deploy individually
cdk deploy AuroraStack
cdk deploy CognitoStack
cdk deploy S3Stack
cdk deploy SqsStack
cdk deploy SnsStack
cdk deploy DynamoDbStack
cdk deploy LambdaStack
cdk deploy ApiGatewayStack
```

**Stacks to Deploy:**
1. AuroraStack (RDS PostgreSQL)
2. CognitoStack (3 user pools)
3. S3Stack (4 buckets)
4. SqsStack (5 queues)
5. SnsStack (5 topics)
6. DynamoDbStack (5 tables)
7. LambdaStack (Lambda functions + log retention)
8. ApiGatewayStack (API Gateway)

**Verification:**
```bash
# Check all resources created
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE

# Verify Lambda functions
aws lambda list-functions --query 'Functions[?contains(FunctionName, `warmpawz`)].FunctionName'

# Verify API Gateway
aws apigatewayv2 get-apis --query 'Items[?contains(Name, `warmpawz`)].ApiId'
```

---

### **Step 3: Run Database Migrations** 🔴 **CRITICAL**
**Time:** 1-2 hours  
**Blocks:** Functionality

**Action:**
```bash
# Get database connection string from SSM
export DB_HOST=$(aws ssm get-parameter --name "/warmpawz/dev/db/host" --region ap-south-1 --query 'Parameter.Value' --output text)
export DB_PORT=$(aws ssm get-parameter --name "/warmpawz/dev/db/port" --region ap-south-1 --query 'Parameter.Value' --output text)
export DB_NAME=$(aws ssm get-parameter --name "/warmpawz/dev/db/name" --region ap-south-1 --query 'Parameter.Value' --output text)
export DB_USER=$(aws ssm get-parameter --name "/warmpawz/dev/db/user" --region ap-south-1 --query 'Parameter.Value' --output text)
export DB_PASSWORD=$(aws ssm get-parameter --name "/warmpawz/dev/db/password" --region ap-south-1 --with-decryption --query 'Parameter.Value' --output text)

export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# Run schema
psql $DATABASE_URL -f db/schema.sql

# Run migrations in order
for file in db/migrations/*.sql; do
  echo "Running: $file"
  psql $DATABASE_URL -f "$file"
done
```

**Verification:**
```bash
# Check tables created
psql $DATABASE_URL -c "\dt"

# Check migration status
psql $DATABASE_URL -c "SELECT * FROM schema_migrations ORDER BY version;"
```

---

### **Step 4: Verify SQS Event Source Mappings** 🟡 **HIGH PRIORITY**
**Time:** 30 minutes  
**Status:** Already in code, needs verification

**Action:**
```bash
# Check event source mappings
aws lambda list-event-source-mappings --query 'EventSourceMappings[?contains(EventSourceArn, `warmpawz`)].{FunctionName:FunctionArn,Queue:EventSourceArn,State:State}'

# Verify all 5 queues have mappings:
# - warmpawz-notification-queue
# - warmpawz-email-queue
# - warmpawz-sms-queue
# - warmpawz-analytics-queue
# - warmpawz-settlement-queue
```

**If Missing:**
- Check `infrastructure/cdk/lib/lambda-stack.ts` (lines 307-349)
- Event source mappings are configured in CDK
- Redeploy LambdaStack if needed

---

### **Step 5: Enable Cognito Authorizers** 🟡 **HIGH PRIORITY**
**Time:** 2-3 hours  
**Blocks:** Security

**Action:**
1. Review guide: `docs/COGNITO_AUTHORIZER_PRODUCTION_ENABLEMENT.md`
2. Enable Cognito JWT authorizers on API Gateway
3. Configure routes with appropriate authorizers
4. Test authentication flow end-to-end

**Files:**
- `docs/COGNITO_AUTHORIZER_PRODUCTION_ENABLEMENT.md` (guide)
- `infrastructure/cdk/lib/api-gateway-stack.ts` (authorizers configured)

**Testing:**
```bash
# Test protected endpoint without token (should fail)
curl https://api.warmpawz.com/customer/profile

# Test with valid token (should succeed)
curl -H "Authorization: Bearer $TOKEN" https://api.warmpawz.com/customer/profile
```

---

### **Step 6: Test CloudWatch Error Tracking** 🟡 **HIGH PRIORITY**
**Time:** 30 minutes  
**Status:** ✅ Already configured

**Action:**
```bash
# Trigger a test error
curl -X POST https://api.warmpawz.com/test-error

# Check CloudWatch Logs
aws logs tail /aws/lambda/warmpawz-api-dev --follow

# Check CloudWatch Metrics
aws cloudwatch get-metric-statistics \
  --namespace Warmpawz/Errors \
  --metric-name ErrorCount \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum \
  --region ap-south-1
```

**Verification:**
- ✅ Logs appear in CloudWatch
- ✅ Error metrics published
- ✅ Structured JSON format
- ✅ Request context captured

---

## 📋 DEPLOYMENT SEQUENCE

### **Day 1: Infrastructure Setup** (5-9 hours)
1. ✅ Set SSM Parameters (1-2 hours)
2. ✅ Deploy CDK Infrastructure (2-4 hours)
3. ✅ Run Database Migrations (1-2 hours)
4. ✅ Verify SQS Event Source Mappings (30 min)

### **Day 2: Security & Testing** (3-5 hours)
5. ✅ Enable Cognito Authorizers (2-3 hours)
6. ✅ Test CloudWatch Error Tracking (30 min)
7. ✅ Integration Testing (2-3 hours)

### **Day 3: Frontend Deployment** (4-6 hours)
8. ✅ Build Next.js Apps (1-2 hours)
9. ✅ Deploy to S3/CloudFront (2-3 hours)
10. ✅ Update runtime-config.js (1 hour)

---

## ✅ VERIFICATION CHECKLIST

### Pre-Deployment
- [x] All builds pass
- [x] All modules imported
- [x] DB schema verified
- [x] RDS compatibility verified
- [x] AWS integrations verified
- [x] API routes verified
- [x] CDK stacks verified
- [x] Environment variables documented
- [x] CloudWatch error tracking configured
- [x] Log retention configured

### Post-Deployment
- [ ] SSM parameters set and verified
- [ ] Infrastructure deployed and verified
- [ ] Database migrations completed
- [ ] SQS event source mappings verified
- [ ] Cognito authorizers enabled
- [ ] CloudWatch error tracking tested
- [ ] API endpoints accessible
- [ ] Frontend apps deployed
- [ ] Integration tests passing

---

## 🚨 CRITICAL PATH

**Must Complete in Order:**
1. **SSM Parameters** → Blocks infrastructure deployment
2. **CDK Deployment** → Blocks everything
3. **Database Migrations** → Blocks functionality
4. **Cognito Authorizers** → Blocks production launch
5. **Integration Testing** → Validates everything

---

## 📊 CURRENT STATUS

| Task | Code Ready | Deployment Ready | Action |
|------|-----------|-----------------|--------|
| **SSM Parameters** | ✅ 100% | ⚠️ 0% | Run setup script |
| **Infrastructure** | ✅ 100% | ⚠️ 0% | Deploy CDK |
| **Database** | ✅ 100% | ⚠️ 0% | Run migrations |
| **SQS Mappings** | ✅ 100% | ⚠️ Verify | Check AWS Console |
| **Cognito Auth** | ✅ 100% | ⚠️ 0% | Enable in API Gateway |
| **CloudWatch** | ✅ 100% | ✅ 100% | Test after deploy |
| **Frontend** | ✅ 100% | ⚠️ 0% | Build & deploy |

---

## 🎯 SUCCESS CRITERIA

### Phase 1 Complete When:
- [ ] All SSM parameters set
- [ ] All CDK stacks deployed
- [ ] Database migrations completed
- [ ] SQS event source mappings verified
- [ ] Cognito authorizers enabled
- [ ] CloudWatch error tracking working

### Production Ready When:
- [ ] All Phase 1 items complete
- [ ] Integration tests passing
- [ ] Frontend apps deployed
- [ ] End-to-end flows tested
- [ ] Monitoring dashboards active

---

## 📚 REFERENCE DOCUMENTATION

### Setup Guides
- `SSM_PARAMETER_COMPLETE_GUIDE.md` - SSM parameter setup
- `SSM_QUICK_REFERENCE.md` - Quick SSM commands
- `CLOUDWATCH_SETUP_COMPLETE.md` - CloudWatch setup (done)
- `docs/CLOUDWATCH_ERROR_TRACKING_SETUP.md` - CloudWatch guide

### Deployment Guides
- `PRODUCTION_READINESS_FINAL_CHECKLIST.md` - Complete checklist
- `backend/lambda/aws-deployment-guide.md` - Lambda deployment
- `docs/COGNITO_AUTHORIZER_PRODUCTION_ENABLEMENT.md` - Cognito setup

### Scripts
- `scripts/verify-ssm-parameters.sh` - Verify SSM parameters
- `scripts/setup-ssm-parameters.sh` - Setup SSM parameters

---

## 🚀 QUICK START COMMANDS

### 1. Setup SSM Parameters
```bash
./scripts/setup-ssm-parameters.sh dev ap-south-1
```

### 2. Deploy Infrastructure
```bash
cd infrastructure/cdk
npm install
cdk bootstrap
cdk deploy --all
```

### 3. Run Migrations
```bash
# Get DB connection from SSM
export DATABASE_URL="postgresql://..."
psql $DATABASE_URL -f db/schema.sql
```

### 4. Verify Deployment
```bash
# Check Lambda functions
aws lambda list-functions --query 'Functions[?contains(FunctionName, `warmpawz`)].FunctionName'

# Check API Gateway
aws apigatewayv2 get-apis
```

---

## ⚠️ IMPORTANT NOTES

1. **SSM Parameters Must Be Set First**
   - Infrastructure deployment will fail without them
   - Use the setup script for interactive configuration

2. **Database Migrations**
   - Run after infrastructure is deployed
   - Migrations are idempotent (safe to re-run)

3. **Cognito Authorizers**
   - Enable before production launch
   - Test authentication flows thoroughly

4. **CloudWatch Error Tracking**
   - ✅ Already configured in code
   - Will be active after Lambda deployment
   - No additional setup needed

5. **Region: ap-south-1 (India)**
   - All resources must be in India region
   - CloudWatch is India-compliant (no Sentry needed)

---

## 📞 SUPPORT

**If You Encounter Issues:**

1. **SSM Parameter Issues**
   - Check: `SSM_PARAMETER_COMPLETE_GUIDE.md`
   - Verify: `./scripts/verify-ssm-parameters.sh dev ap-south-1`

2. **CDK Deployment Issues**
   - Check: `infrastructure/cdk/README.md`
   - Verify: `cdk diff` before deploying

3. **Database Migration Issues**
   - Check: `db/migrations/` directory
   - Verify: All migrations are idempotent

4. **CloudWatch Issues**
   - Check: `CLOUDWATCH_SETUP_COMPLETE.md`
   - Verify: Lambda logs appear in CloudWatch Console

---

**Last Updated:** 2026-01-28  
**Next Action:** Set SSM Parameters → Deploy Infrastructure → Run Migrations
