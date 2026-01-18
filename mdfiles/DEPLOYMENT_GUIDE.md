# 🚀 Warmpawz Deployment Guide

Complete guide for deploying the Warmpawz platform to production.

---

## 📋 Prerequisites

Before deployment, ensure you have:

1. **AWS Account** with appropriate permissions
2. **AWS CLI** configured (`aws configure`)
3. **Node.js 18+** installed
4. **CDK CLI** installed (`npm install -g aws-cdk`)
5. **PostgreSQL client** (psql) for migrations
6. **Razorpay Account** with API credentials

---

## 🔧 Step 1: Environment Setup

### 1.1 Create Environment File

```bash
cp .env.example .env.production
```

Edit `.env.production` with your actual values:

```bash
# Required values to configure:
- AWS_REGION
- DB_HOST, DB_USER, DB_PASSWORD
- RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
- COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID
- S3_BUCKET_NAME
- SNS topic ARNs
- SQS queue URLs
```

### 1.2 Verify AWS Credentials

```bash
aws sts get-caller-identity
```

---

## 🗄️ Step 2: Database Setup

### 2.1 Create RDS Instance

Via AWS Console or CLI:

```bash
aws rds create-db-instance \
  --db-instance-identifier warmpawz-production \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --master-username warmpawz_admin \
  --master-user-password "your-secure-password" \
  --allocated-storage 100 \
  --vpc-security-group-ids sg-xxxxx \
  --db-subnet-group-name your-subnet-group \
  --publicly-accessible false \
  --storage-encrypted \
  --backup-retention-period 7
```

### 2.2 Run Migrations

```bash
# Set DATABASE_URL
export DATABASE_URL="postgresql://user:pass@host:5432/warmpawz?sslmode=require"

# Apply main schema
psql $DATABASE_URL -f db/schema.sql

# Apply migrations
psql $DATABASE_URL -f db/migrations/030_missing_tables.sql

# Apply indexes
psql $DATABASE_URL -f db/indexes.sql
```

### 2.3 Verify Schema

```bash
psql $DATABASE_URL -c "\dt" | head -20
```

---

## ☁️ Step 3: Deploy Infrastructure (CDK)

### 3.1 Bootstrap CDK

```bash
cd infrastructure/cdk
npm install
cdk bootstrap aws://ACCOUNT_ID/ap-south-1
```

### 3.2 Deploy All Stacks

```bash
cdk deploy --all --require-approval never
```

This deploys:
- API Gateway
- Lambda functions
- SQS queues
- SNS topics
- Cognito user pools
- S3 buckets
- CloudFront distributions

### 3.3 Get Outputs

```bash
cdk list
aws cloudformation describe-stacks --stack-name WarmpawzApiStack --query 'Stacks[0].Outputs'
```

---

## λ Step 4: Deploy Lambda Functions

### 4.1 Build Lambda Package

```bash
cd backend/lambda
npm install
npm run build

# Package
zip -r lambda-package.zip dist node_modules
```

### 4.2 Upload to S3

```bash
aws s3 cp lambda-package.zip s3://warmpawz-deployments/lambda/
```

### 4.3 Update Lambda Function

```bash
aws lambda update-function-code \
  --function-name warmpawz-api-handler \
  --s3-bucket warmpawz-deployments \
  --s3-key lambda/lambda-package.zip
```

### 4.4 Configure Environment Variables

```bash
aws lambda update-function-configuration \
  --function-name warmpawz-api-handler \
  --environment "Variables={
    DB_HOST=warmpawz-db.xxxxx.rds.amazonaws.com,
    DB_NAME=warmpawz,
    DB_USER=warmpawz_admin,
    DB_PASSWORD=xxxxx,
    RAZORPAY_KEY_ID=rzp_live_xxxxx,
    RAZORPAY_KEY_SECRET=xxxxx
  }"
```

---

## 🌐 Step 5: Deploy Frontend Apps

### 5.1 Build Apps

```bash
# Customer Web
cd apps/customer-web
npm install
NEXT_PUBLIC_API_BASE_URL=https://api.warmpawz.com npm run build

# Vendor Web
cd ../vendor-web
npm install
NEXT_PUBLIC_API_BASE_URL=https://api.warmpawz.com npm run build

# Admin Web
cd ../admin-web
npm install
NEXT_PUBLIC_API_BASE_URL=https://api.warmpawz.com npm run build
```

### 5.2 Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy each app
cd apps/customer-web && vercel --prod
cd ../vendor-web && vercel --prod
cd ../admin-web && vercel --prod
```

### 5.3 Alternative: AWS Amplify

```bash
amplify init
amplify add hosting
amplify publish
```

---

## 💳 Step 6: Configure Razorpay

### 6.1 Set Up Webhooks

In Razorpay Dashboard:

1. Go to **Settings → Webhooks**
2. Add webhook URL: `https://api.warmpawz.com/razorpay/webhook`
3. Select events:
   - `payment.captured`
   - `payment.failed`
   - `refund.created`
   - `refund.processed`
   - `transfer.processed`
4. Copy webhook secret to `.env`

### 6.2 Enable Route API (Marketplace)

1. Apply for Route API access in Razorpay Dashboard
2. Enable linked accounts
3. Configure commission rates

---

## 🔐 Step 7: Configure Cognito

### 7.1 Create User Pool

Via AWS Console or CDK (already deployed).

### 7.2 Configure App Client

```bash
aws cognito-idp create-user-pool-client \
  --user-pool-id ap-south-1_XXXXX \
  --client-name warmpawz-web \
  --no-generate-secret \
  --explicit-auth-flows ALLOW_USER_SRP_AUTH ALLOW_REFRESH_TOKEN_AUTH
```

### 7.3 Set Up Custom Domain

```bash
aws cognito-idp create-user-pool-domain \
  --user-pool-id ap-south-1_XXXXX \
  --domain warmpawz
```

---

## 📱 Step 8: Deploy Mobile Apps

### 8.1 iOS (App Store)

```bash
cd apps/WarmpawzCustomer
npm install
npx react-native run-ios --configuration Release

# Archive and upload to App Store Connect
```

### 8.2 Android (Play Store)

```bash
cd apps/WarmpawzCustomer/android
./gradlew assembleRelease

# Upload APK/AAB to Google Play Console
```

---

## ✅ Step 9: Post-Deployment Verification

### 9.1 Health Check

```bash
curl https://api.warmpawz.com/health
# Expected: {"status":"ok","timestamp":"..."}
```

### 9.2 Test Key Endpoints

```bash
# Auth
curl -X POST https://api.warmpawz.com/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"+919999999999"}'

# Search
curl https://api.warmpawz.com/search/universal?q=vet

# Roles
curl https://api.warmpawz.com/roles
```

### 9.3 Run E2E Tests

```bash
TEST_API_URL=https://api.warmpawz.com npx ts-node tests/run-all-tests.ts
```

---

## 📊 Step 10: Set Up Monitoring

### 10.1 CloudWatch Alarms

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "API-5xx-Errors" \
  --metric-name "5XXError" \
  --namespace "AWS/ApiGateway" \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:ap-south-1:ACCOUNT:alerts
```

### 10.2 Lambda Insights

Enable in Lambda console or via CDK.

### 10.3 X-Ray Tracing

```bash
aws lambda update-function-configuration \
  --function-name warmpawz-api-handler \
  --tracing-config Mode=Active
```

---

## 🔒 Step 11: Security Hardening

### 11.1 Enable WAF

```bash
# Create WAF rules for API Gateway
aws wafv2 create-web-acl \
  --name warmpawz-api-waf \
  --scope REGIONAL \
  --default-action Allow={} \
  --rules file://waf-rules.json
```

### 11.2 Enable AWS Shield (DDoS Protection)

Enable in AWS Console for CloudFront distributions.

### 11.3 Rotate Secrets

```bash
# Use AWS Secrets Manager
aws secretsmanager create-secret \
  --name warmpawz/production/db \
  --secret-string '{"username":"admin","password":"xxx"}'
```

---

## 📋 Deployment Checklist

- [ ] Environment variables configured
- [ ] RDS instance created and accessible
- [ ] Database migrations applied
- [ ] CDK infrastructure deployed
- [ ] Lambda functions deployed
- [ ] API Gateway configured
- [ ] Frontend apps deployed
- [ ] Custom domains configured
- [ ] SSL certificates valid
- [ ] Razorpay webhooks configured
- [ ] Cognito user pool set up
- [ ] S3 buckets configured
- [ ] CloudFront distributions active
- [ ] SNS topics created
- [ ] SQS queues created
- [ ] CloudWatch alarms set up
- [ ] WAF rules enabled
- [ ] Health checks passing
- [ ] E2E tests passing

---

## 🆘 Troubleshooting

### Lambda Timeout

Increase timeout in function configuration:
```bash
aws lambda update-function-configuration \
  --function-name warmpawz-api-handler \
  --timeout 30
```

### Database Connection Issues

1. Check security group rules
2. Verify VPC configuration
3. Test connection from Lambda VPC

### CORS Errors

Verify API Gateway CORS settings:
```bash
aws apigateway update-rest-api \
  --rest-api-id xxxxx \
  --patch-operations op=replace,path=/~1cors,value='true'
```

---

## 📞 Support

For deployment issues:
- Check CloudWatch Logs
- Review X-Ray traces
- Contact AWS Support

**Deployment complete! 🎉**

