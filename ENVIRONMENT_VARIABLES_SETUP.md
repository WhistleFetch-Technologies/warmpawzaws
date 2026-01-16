# 🔐 ENVIRONMENT VARIABLES SETUP GUIDE

This document provides templates for all environment variable configurations across the Warmpawz platform.

---

## 📱 CUSTOMER WEB APP

**File**: `apps/customer-web/.env.local`

```bash
# API Configuration
NEXT_PUBLIC_API_BASE_URL=https://api.warmpawz.com

# Razorpay Configuration (Public Key only)
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx

# Maps API
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# App Configuration
NEXT_PUBLIC_APP_NAME="Warmpawz"
NEXT_PUBLIC_APP_VERSION="1.0.0"
NEXT_PUBLIC_ENVIRONMENT=production

# Feature Flags
NEXT_PUBLIC_ENABLE_GPS_TRACKING=true
NEXT_PUBLIC_ENABLE_VIDEO_CALL=true
NEXT_PUBLIC_ENABLE_WALLET=true
NEXT_PUBLIC_ENABLE_ECOMMERCE=true

# Support Contact
NEXT_PUBLIC_SUPPORT_EMAIL=support@warmpawz.com
NEXT_PUBLIC_SUPPORT_PHONE=+91-XXXXXXXXXX
```

---

## 🏪 VENDOR WEB APP

**File**: `apps/vendor-web/.env.local`

```bash
# API Configuration
NEXT_PUBLIC_API_BASE_URL=https://api.warmpawz.com

# Razorpay Configuration (Public Key only)
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx

# Maps API
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# App Configuration
NEXT_PUBLIC_APP_NAME="Warmpawz Vendor"
NEXT_PUBLIC_APP_VERSION="1.0.0"
NEXT_PUBLIC_ENVIRONMENT=production

# Feature Flags
NEXT_PUBLIC_ENABLE_GPS_TRACKING=true
NEXT_PUBLIC_ENABLE_VIDEO_CALL=true
NEXT_PUBLIC_ENABLE_BANK_VERIFICATION=true

# Support Contact
NEXT_PUBLIC_SUPPORT_EMAIL=vendor-support@warmpawz.com
NEXT_PUBLIC_SUPPORT_PHONE=+91-XXXXXXXXXX
```

---

## 👨‍💼 ADMIN WEB APP

**File**: `apps/admin-web/.env.local`

```bash
# API Configuration
NEXT_PUBLIC_API_BASE_URL=https://api.warmpawz.com

# Admin Authentication
NEXT_PUBLIC_ADMIN_AUTH_REQUIRED=true

# App Configuration
NEXT_PUBLIC_APP_NAME="Warmpawz Admin"
NEXT_PUBLIC_APP_VERSION="1.0.0"
NEXT_PUBLIC_ENVIRONMENT=production

# Feature Flags
NEXT_PUBLIC_ENABLE_VENDOR_APPROVAL=true
NEXT_PUBLIC_ENABLE_ROLE_MANAGEMENT=true
NEXT_PUBLIC_ENABLE_TIER_MANAGEMENT=true
NEXT_PUBLIC_ENABLE_REPORTS=true
```

---

## 📱 CUSTOMER MOBILE APP (React Native)

**File**: `apps/WarmpawzCustomer/.env`

```bash
# API Configuration
API_BASE_URL=https://api.warmpawz.com

# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx

# Maps API
GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# App Configuration
APP_NAME=Warmpawz
APP_VERSION=1.0.0
ENVIRONMENT=production

# AWS Cognito (if used)
AWS_REGION=ap-south-1
AWS_COGNITO_USER_POOL_ID=your-user-pool-id
AWS_COGNITO_CLIENT_ID=your-client-id

# Feature Flags
ENABLE_GPS_TRACKING=true
ENABLE_VIDEO_CALL=true
ENABLE_WALLET=true
ENABLE_PUSH_NOTIFICATIONS=true
```

---

## 🏪 VENDOR MOBILE APP (React Native)

**File**: `apps/WarmpawzVendor/.env`

```bash
# API Configuration
API_BASE_URL=https://api.warmpawz.com

# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx

# Maps API
GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# App Configuration
APP_NAME=Warmpawz Vendor
APP_VERSION=1.0.0
ENVIRONMENT=production

# AWS Cognito (if used)
AWS_REGION=ap-south-1
AWS_COGNITO_USER_POOL_ID=your-user-pool-id
AWS_COGNITO_CLIENT_ID=your-client-id

# Feature Flags
ENABLE_GPS_TRACKING=true
ENABLE_VIDEO_CALL=true
ENABLE_BANK_VERIFICATION=true
ENABLE_PUSH_NOTIFICATIONS=true
```

---

## 🔧 BACKEND LAMBDA FUNCTIONS

**File**: `backend/lambda/.env`

```bash
# AWS Configuration
AWS_REGION=ap-south-1
AWS_ACCOUNT_ID=your-aws-account-id

# Database Configuration
RDS_HOST=warmpawz-prod.xxxxx.ap-south-1.rds.amazonaws.com
RDS_PORT=5432
RDS_DATABASE=warmpawz_prod
RDS_USERNAME=warmpawz_admin
RDS_PASSWORD=your-secure-password-here

# AWS Services
SQS_QUEUE_URL=https://sqs.ap-south-1.amazonaws.com/your-account/warmpawz-queue
SNS_TOPIC_ARN=arn:aws:sns:ap-south-1:your-account:warmpawz-notifications
S3_BUCKET_NAME=warmpawz-prod-uploads
OPENSEARCH_ENDPOINT=https://search-warmpawz-xxxxx.ap-south-1.es.amazonaws.com

# Razorpay Configuration (PRIVATE - Server Side Only)
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your-razorpay-secret-here

# AWS Chime Configuration
CHIME_APP_INSTANCE_ARN=arn:aws:chime:us-east-1:your-account:app-instance/xxxxx

# SMS Configuration (AWS SNS or external provider)
SMS_SENDER_ID=WARMPZ
SMS_PROVIDER=aws_sns

# Email Configuration (AWS SES)
SES_FROM_EMAIL=noreply@warmpawz.com
SES_REGION=ap-south-1

# Application Settings
NODE_ENV=production
LOG_LEVEL=info
API_VERSION=v1

# JWT Configuration
JWT_SECRET=your-jwt-secret-here-minimum-32-characters
JWT_EXPIRY=24h

# Rate Limiting
RATE_LIMIT_REQUESTS_PER_MINUTE=60

# Feature Flags (Backend)
ENABLE_OPENSEARCH=true
ENABLE_AUTO_SETTLEMENTS=true
ENABLE_SMS_NOTIFICATIONS=true
ENABLE_EMAIL_NOTIFICATIONS=true
```

---

## 🚀 DEPLOYMENT ENVIRONMENTS

### **Development**
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
NEXT_PUBLIC_ENVIRONMENT=development
```

### **Staging**
```bash
NEXT_PUBLIC_API_BASE_URL=https://staging-api.warmpawz.com
NEXT_PUBLIC_ENVIRONMENT=staging
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
```

### **Production**
```bash
NEXT_PUBLIC_API_BASE_URL=https://api.warmpawz.com
NEXT_PUBLIC_ENVIRONMENT=production
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
```

---

## 📋 SETUP INSTRUCTIONS

### **1. Web Apps (Next.js)**

```bash
# Navigate to each app directory
cd apps/customer-web
cp .env.example .env.local
# Edit .env.local with your values
nano .env.local

# Repeat for vendor-web and admin-web
```

### **2. Mobile Apps (React Native)**

```bash
# Navigate to each mobile app directory
cd apps/WarmpawzCustomer
touch .env
# Add environment variables from template above
nano .env

# For iOS, you may need to:
cd ios && pod install && cd ..

# Repeat for WarmpawzVendor
```

### **3. Backend Lambda**

```bash
# Lambda environment variables are typically set via:
# 1. AWS Systems Manager Parameter Store (recommended)
# 2. AWS Secrets Manager (for sensitive data)
# 3. Environment variables in Lambda console
# 4. CDK/CloudFormation stack parameters

# For local development:
cd backend/lambda
touch .env
# Add backend environment variables
nano .env
```

---

## 🔒 SECURITY BEST PRACTICES

### **DO:**
✅ Use AWS Secrets Manager for sensitive credentials  
✅ Use different keys for dev/staging/production  
✅ Rotate credentials regularly  
✅ Use IAM roles for Lambda instead of hardcoded credentials  
✅ Enable encryption at rest for RDS  
✅ Use VPC for database and Lambda functions  

### **DON'T:**
❌ Commit `.env` files to git  
❌ Use production credentials in development  
❌ Share Razorpay secret keys via Slack/email  
❌ Hardcode API keys in source code  
❌ Use the same JWT secret across environments  

---

## 📊 ENVIRONMENT VARIABLE VALIDATION

Each application should validate required environment variables on startup:

```typescript
// Example validation (apps/customer-web/lib/env.ts)
export function validateEnv() {
  const required = [
    'NEXT_PUBLIC_API_BASE_URL',
    'NEXT_PUBLIC_RAZORPAY_KEY_ID',
  ];
  
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}
```

---

## 🆘 TROUBLESHOOTING

### **Issue**: API calls fail with "undefined" URL
**Solution**: Ensure `NEXT_PUBLIC_API_BASE_URL` is set in `.env.local`

### **Issue**: Razorpay payment fails
**Solution**: Verify you're using the correct key ID (test vs live)

### **Issue**: Maps not loading
**Solution**: Check `GOOGLE_MAPS_API_KEY` is valid and has billing enabled

### **Issue**: Lambda can't connect to database
**Solution**: Verify RDS security group allows Lambda security group access

---

## 📞 SUPPORT

For environment setup assistance:
- **DevOps Team**: devops@warmpawz.com
- **Backend Team**: backend@warmpawz.com
- **Documentation**: https://docs.warmpawz.com/deployment

---

**Last Updated**: January 2, 2026  
**Version**: 1.0.0

