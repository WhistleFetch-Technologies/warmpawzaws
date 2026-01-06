# 🔐 Environment Variables Documentation

## Overview

This document provides comprehensive documentation for all environment variables used across the Warmpawz platform, including frontend applications, backend Lambda functions, and infrastructure components.

**Last Updated:** January 27, 2026

---

## 📱 Frontend Applications

### Admin Web (`apps/admin-web/.env.local`)

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Backend API base URL | ✅ Yes | - | `https://api.warmpawz.com` |
| `NEXT_PUBLIC_UAT_MODE` | Enable UAT mode (bypasses OTP) | ❌ No | `false` | `true` |
| `NEXT_PUBLIC_ADMIN_AUTH_REQUIRED` | Require admin authentication | ❌ No | `true` | `true` |
| `NEXT_PUBLIC_APP_NAME` | Application name | ❌ No | `Warmpawz Admin` | `Warmpawz Admin` |
| `NEXT_PUBLIC_APP_VERSION` | Application version | ❌ No | `1.0.0` | `1.0.0` |
| `NEXT_PUBLIC_ENVIRONMENT` | Environment name | ❌ No | `production` | `production` |
| `NEXT_PUBLIC_ANALYTICS_ID` | Analytics tracking ID | ❌ No | - | `UA-XXXXX-X` |

**Feature Flags:**
- `NEXT_PUBLIC_ENABLE_VENDOR_APPROVAL` - Enable vendor approval features
- `NEXT_PUBLIC_ENABLE_ROLE_MANAGEMENT` - Enable role management features
- `NEXT_PUBLIC_ENABLE_TIER_MANAGEMENT` - Enable tier management features
- `NEXT_PUBLIC_ENABLE_REPORTS` - Enable reports builder

---

### Vendor Web (`apps/vendor-web/.env.local`)

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Backend API base URL | ✅ Yes | - | `https://api.warmpawz.com` |
| `NEXT_PUBLIC_UAT_MODE` | Enable UAT mode | ❌ No | `false` | `true` |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay public key | ❌ No | - | `rzp_live_xxxxxxxxxxxx` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps API key | ❌ No | - | `AIza...` |
| `NEXT_PUBLIC_APP_NAME` | Application name | ❌ No | `Warmpawz Vendor` | `Warmpawz Vendor` |

**Feature Flags:**
- `NEXT_PUBLIC_ENABLE_GPS_TRACKING` - Enable GPS tracking features
- `NEXT_PUBLIC_ENABLE_VIDEO_CALL` - Enable video call features
- `NEXT_PUBLIC_ENABLE_BANK_VERIFICATION` - Enable bank verification

---

### Customer Web (`apps/customer-web/.env.local`)

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Backend API base URL | ✅ Yes | - | `https://api.warmpawz.com` |
| `NEXT_PUBLIC_UAT_MODE` | Enable UAT mode | ❌ No | `false` | `true` |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay public key | ❌ No | - | `rzp_live_xxxxxxxxxxxx` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps API key | ❌ No | - | `AIza...` |
| `NEXT_PUBLIC_APP_NAME` | Application name | ❌ No | `Warmpawz` | `Warmpawz` |

**Feature Flags:**
- `NEXT_PUBLIC_ENABLE_GPS_TRACKING` - Enable GPS tracking
- `NEXT_PUBLIC_ENABLE_VIDEO_CALL` - Enable video calls
- `NEXT_PUBLIC_ENABLE_WALLET` - Enable wallet features
- `NEXT_PUBLIC_ENABLE_ECOMMERCE` - Enable e-commerce features

---

## 🔧 Backend Lambda Functions

### Database Configuration

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `DB_HOST` | Database hostname | ✅ Yes* | - | `db.example.com` |
| `RDS_HOSTNAME` | RDS hostname (alternative) | ✅ Yes* | - | `db.example.com` |
| `DB_PORT` | Database port | ❌ No | `5432` | `5432` |
| `DB_NAME` | Database name | ✅ Yes* | - | `warmpawz` |
| `RDS_DB_NAME` | RDS database name (alternative) | ✅ Yes* | - | `warmpawz` |
| `DB_USER` | Database username | ✅ Yes* | - | `postgres` |
| `RDS_USERNAME` | RDS username (alternative) | ✅ Yes* | - | `postgres` |
| `DB_PASSWORD` | Database password | ✅ Yes* | - | `password123` |
| `RDS_PASSWORD` | RDS password (alternative) | ✅ Yes* | - | `password123` |
| `DB_SECRET_ARN` | AWS Secrets Manager ARN | ❌ No | - | `arn:aws:secretsmanager:...` |
| `DB_SSL` | Enable SSL connection | ❌ No | `false` | `true` |

*Either direct DB variables or RDS variables required. If `DB_SECRET_ARN` is provided, it takes precedence.

---

### AWS Configuration

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `AWS_REGION` | AWS region | ❌ No | `ap-south-1` | `ap-south-1` |
| `AWS_ACCESS_KEY_ID` | AWS access key | ❌ No* | - | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | ❌ No* | - | `secret...` |

*Not required if using IAM roles (recommended for Lambda)

---

### Authentication & Security

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID | ❌ No | - | `ap-south-1_xxxxx` |
| `COGNITO_CLIENT_ID` | Cognito Client ID | ❌ No | - | `xxxxxxxxxxxxx` |
| `UAT_MODE` | Enable UAT mode (bypasses OTP) | ❌ No | `false` | `true` |
| `NODE_ENV` | Node environment | ❌ No | `production` | `development` |

---

### Payment Integration

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `RAZORPAY_KEY_ID` | Razorpay key ID | ❌ No | - | `rzp_live_xxxxxxxxxxxx` |
| `RAZORPAY_KEY_SECRET` | Razorpay key secret | ❌ No | - | `xxxxxxxxxxxxx` |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook secret | ❌ No | - | `xxxxxxxxxxxxx` |

---

### SNS Topics (Notifications)

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `BOOKING_CREATED_TOPIC_ARN` | Booking created topic ARN | ❌ No | - | `arn:aws:sns:...` |
| `BOOKING_STATUS_UPDATED_TOPIC_ARN` | Booking status updated topic ARN | ❌ No | - | `arn:aws:sns:...` |
| `PAYMENT_CREATED_TOPIC_ARN` | Payment created topic ARN | ❌ No | - | `arn:aws:sns:...` |
| `PAYMENT_PROCESSED_TOPIC_ARN` | Payment processed topic ARN | ❌ No | - | `arn:aws:sns:...` |
| `VENDOR_APPROVED_TOPIC_ARN` | Vendor approved topic ARN | ❌ No | - | `arn:aws:sns:...` |
| `SETTLEMENT_CREATED_TOPIC_ARN` | Settlement created topic ARN | ❌ No | - | `arn:aws:sns:...` |

---

## 🏗️ Infrastructure (CDK/Terraform)

### CDK Environment Variables

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `CDK_DEFAULT_ACCOUNT` | AWS account ID | ✅ Yes | - | `123456789012` |
| `CDK_DEFAULT_REGION` | AWS region | ✅ Yes | - | `ap-south-1` |
| `ENVIRONMENT` | Deployment environment | ✅ Yes | - | `production` |

---

## 📝 Environment-Specific Configurations

### Development

```bash
# Frontend
NEXT_PUBLIC_API_BASE_URL=https://dev.api.warmpawz.com
NEXT_PUBLIC_UAT_MODE=true
NEXT_PUBLIC_ENVIRONMENT=development

# Backend
UAT_MODE=true
NODE_ENV=development
DB_SSL=false
```

### Staging

```bash
# Frontend
NEXT_PUBLIC_API_BASE_URL=https://staging.api.warmpawz.com
NEXT_PUBLIC_UAT_MODE=false
NEXT_PUBLIC_ENVIRONMENT=staging

# Backend
UAT_MODE=false
NODE_ENV=production
DB_SSL=true
```

### Production

```bash
# Frontend
NEXT_PUBLIC_API_BASE_URL=https://api.warmpawz.com
NEXT_PUBLIC_UAT_MODE=false
NEXT_PUBLIC_ENVIRONMENT=production

# Backend
UAT_MODE=false
NODE_ENV=production
DB_SSL=true
```

---

## 🔒 Security Best Practices

1. **Never commit `.env.local` files** - They are in `.gitignore`
2. **Use AWS Secrets Manager** - For sensitive credentials (recommended)
3. **Use IAM Roles** - For Lambda functions instead of access keys
4. **Rotate credentials regularly** - Especially for production
5. **Use different credentials** - For each environment
6. **Limit access** - Only grant necessary permissions

---

## 📋 Setup Checklist

### Frontend Setup
- [ ] Create `.env.local` file in each app directory
- [ ] Set `NEXT_PUBLIC_API_BASE_URL` to correct environment
- [ ] Configure feature flags as needed
- [ ] Set up API keys (Google Maps, Razorpay, etc.)

### Backend Setup
- [ ] Configure database connection variables
- [ ] Set up AWS credentials (or use IAM roles)
- [ ] Configure Cognito (if using)
- [ ] Set up SNS topics and ARNs
- [ ] Configure payment gateway credentials
- [ ] Set environment-specific flags

### Infrastructure Setup
- [ ] Set CDK environment variables
- [ ] Configure AWS account and region
- [ ] Set deployment environment name

---

## 🐛 Troubleshooting

### Common Issues

**Issue:** Database connection fails
- Check `DB_HOST`, `DB_PORT`, `DB_NAME` are correct
- Verify `DB_USER` and `DB_PASSWORD` are correct
- Check network security groups allow Lambda access
- Verify `DB_SSL` setting matches database configuration

**Issue:** API calls fail with CORS errors
- Verify `NEXT_PUBLIC_API_BASE_URL` is correct
- Check backend CORS configuration
- Ensure API Gateway is properly configured

**Issue:** Authentication fails
- Check `COGNITO_USER_POOL_ID` and `COGNITO_CLIENT_ID`
- Verify Cognito configuration matches
- Check `UAT_MODE` setting if in development

**Issue:** Payment integration fails
- Verify Razorpay credentials are correct
- Check webhook secret matches
- Ensure keys are for correct environment (test/live)

---

## 📚 Related Documentation

- [Setup Guide](./SETUP_GUIDE.md) - Development environment setup
- [API Endpoints](./API_ENDPOINTS.md) - API documentation
- [Deployment Guide](./DEPLOYMENT_GUIDE.md) - Deployment instructions

---

**Last Updated:** January 27, 2026

