# AWS Serverless Deployment Guide

**Architecture:** AWS Lambda + CloudFront + RDS + Cognito

---

## 🏗️ Architecture Overview

```
┌─────────────┐
│  CloudFront  │ (CDN)
└──────┬───────┘
       │
┌──────▼───────┐
│ API Gateway  │ (HTTP API v2)
└──────┬───────┘
       │
┌──────▼───────┐
│ Lambda       │ (Node.js 18)
└──────┬───────┘
       │
   ┌───┴───┬──────────┬──────────┐
   │       │          │          │
┌──▼──┐ ┌─▼───┐  ┌───▼──┐  ┌───▼──┐
│ RDS │ │Cognito│ │  SNS │ │Secrets│
│PostgreSQL│ │JWT Auth│ │  SMS  │ │Manager│
└─────┘ └─────┘  └─────┘  └──────┘
```

---

## 📋 Prerequisites

### 1. AWS Account Setup
- [ ] AWS Account with appropriate permissions
- [ ] AWS CLI configured (`aws configure`)
- [ ] Serverless Framework installed (`npm install -g serverless`)

### 2. AWS Resources
- [ ] RDS PostgreSQL instance (in VPC)
- [ ] Cognito User Pool created
- [ ] SNS Topic for SMS
- [ ] VPC with subnets (for RDS access)
- [ ] Security Groups configured
- [ ] CloudFront Distribution (optional, for CDN)

### 3. Local Setup
- [ ] Node.js 18+ installed
- [ ] npm dependencies installed
- [ ] Environment variables configured

---

## 🚀 Deployment Steps

### Step 1: Configure AWS Resources

#### 1.1 RDS PostgreSQL
```bash
# Create RDS instance (via AWS Console or CLI)
aws rds create-db-instance \
  --db-instance-identifier warmpawz-db \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --master-username warmpawz_user \
  --master-user-password <secure-password> \
  --allocated-storage 100 \
  --vpc-security-group-ids sg-xxxxxxxxx \
  --db-subnet-group-name warmpawz-subnet-group
```

#### 1.2 Cognito User Pool
```bash
# Create Cognito User Pool (via AWS Console)
# Note: Configure custom attributes for user_type
```

#### 1.3 Store Secrets in SSM Parameter Store
```bash
# Database credentials
aws ssm put-parameter \
  --name "/warmpawz/dev/db/host" \
  --value "warmpawz-db.xxxxx.rds.amazonaws.com" \
  --type "String"

aws ssm put-parameter \
  --name "/warmpawz/dev/db/password" \
  --value "your-password" \
  --type "SecureString"

# Cognito configuration
aws ssm put-parameter \
  --name "/warmpawz/dev/cognito/userPoolId" \
  --value "ap-south-1_XXXXXXXXX" \
  --type "String"
```

---

### Step 2: Build and Deploy

#### 2.1 Install Dependencies
```bash
cd backend/lambda
npm install
```

#### 2.2 Build Lambda Function
```bash
# Build API contracts first
cd ../../packages/api-contracts
npm install && npm run build
cd ../../backend/lambda

# Build Lambda with esbuild
npm run build
```

#### 2.3 Deploy with Serverless Framework
```bash
# Deploy to dev
./deploy.sh dev ap-south-1

# Or manually
serverless deploy --stage dev --region ap-south-1
```

---

## 🔧 Configuration

### Environment Variables (SSM Parameter Store)

Store all sensitive values in AWS Systems Manager Parameter Store:

```bash
# Database
/warmpawz/{stage}/db/host
/warmpawz/{stage}/db/port
/warmpawz/{stage}/db/name
/warmpawz/{stage}/db/user
/warmpawz/{stage}/db/password (SecureString)

# Cognito
/warmpawz/{stage}/cognito/userPoolId
/warmpawz/{stage}/cognito/clientId

# SNS
/warmpawz/{stage}/sns/smsTopicArn

# Razorpay
/warmpawz/{stage}/razorpay/keyId
/warmpawz/{stage}/razorpay/keySecret (SecureString)
/warmpawz/{stage}/razorpay/webhookSecret (SecureString)

# VPC
/warmpawz/{stage}/vpc/securityGroupId
/warmpawz/{stage}/vpc/subnetId1
/warmpawz/{stage}/vpc/subnetId2

# CloudFront
/warmpawz/{stage}/cloudfront/distributionId
```

---

## 🔐 Security Best Practices

### 1. IAM Roles
- Lambda execution role with minimal permissions
- RDS connection via IAM authentication (optional)
- Secrets Manager for sensitive data

### 2. VPC Configuration
- Lambda in VPC for RDS access
- Security groups with least privilege
- Private subnets for RDS

### 3. Cognito JWT Validation
- JWT verification in `BaseHandlerEnhanced`
- Token expiration checks
- Role-based access control

### 4. API Gateway
- CORS configuration
- Rate limiting
- Request validation

---

## 📊 Monitoring

### CloudWatch Logs
```bash
# View logs
aws logs tail /aws/lambda/warmpawz-api-dev-api --follow

# Search for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/warmpawz-api-dev-api \
  --filter-pattern "ERROR"
```

### CloudWatch Metrics
- Request count
- Error rate
- Latency (p50, p95, p99)
- Lambda duration
- Database connection pool

---

## 🧪 Testing

### Local Testing
```bash
# Test with SAM Local or serverless-offline
npm install -g serverless-offline
serverless offline
```

### Integration Testing
```bash
# Test API endpoint
curl https://your-api-id.execute-api.ap-south-1.amazonaws.com/auth/send-otp \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210"}'
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions Example
```yaml
name: Deploy Lambda

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - uses: serverless/github-action@v3
        with:
          args: deploy --stage prod
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

---

## 🐛 Troubleshooting

### Common Issues

#### 1. RDS Connection Timeout
- Check VPC configuration
- Verify security groups
- Check subnet routing

#### 2. Cognito JWT Validation Fails
- Verify User Pool ID
- Check token expiration
- Validate custom attributes

#### 3. Module Resolution Errors
- Ensure esbuild bundles correctly
- Check external dependencies
- Verify API contracts package

#### 4. CloudFront Cache Issues
- Invalidate cache after deployment
- Check cache headers
- Verify origin configuration

---

## 📚 Additional Resources

- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Serverless Framework Docs](https://www.serverless.com/framework/docs)
- [RDS Connection Pooling](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.html)
- [Cognito JWT Validation](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-with-identity-providers.html)

---

## ✅ Deployment Checklist

- [ ] AWS resources created (RDS, Cognito, SNS)
- [ ] SSM parameters configured
- [ ] VPC and security groups set up
- [ ] Lambda function built successfully
- [ ] Serverless deployment successful
- [ ] API Gateway endpoint working
- [ ] CloudFront distribution configured
- [ ] CloudWatch logs visible
- [ ] Integration tests passing
- [ ] Monitoring alerts configured

---

**Ready to deploy?** Run `./deploy.sh dev ap-south-1` 🚀

