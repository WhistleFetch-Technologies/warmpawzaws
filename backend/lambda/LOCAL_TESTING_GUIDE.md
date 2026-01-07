# Local Testing Guide

**Date:** 2026-01-28  
**Purpose:** Test Lambda function locally before AWS deployment

---

## 🚀 Quick Start

### Option 1: Automated Script (Recommended)
```bash
cd backend/lambda
./test-local.sh
```

### Option 2: Manual Steps
```bash
cd backend/lambda
npm run start:local
```

---

## 📋 Prerequisites

### 1. Local PostgreSQL (Optional)
If testing database connections:
```bash
# Install PostgreSQL
brew install postgresql  # macOS
# or
sudo apt-get install postgresql  # Linux

# Start PostgreSQL
brew services start postgresql  # macOS
# or
sudo service postgresql start  # Linux

# Create database
createdb warmpawz
```

### 2. Environment Variables
Create `.env.local` file:
```bash
cp .env.local.example .env.local
# Edit .env.local with your values
```

---

## 🔧 Configuration

### Environment Variables (.env.local)
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=warmpawz
DB_USER=postgres
DB_PASSWORD=postgres

# Cognito (test values)
COGNITO_USER_POOL_ID=ap-south-1_TEST123
COGNITO_CLIENT_ID=test-client-id

# Feature Flags
UAT_MODE=true  # Enables test mode (OTP: 123456)
```

---

## 🧪 Testing Endpoints

### 1. Health Check
```bash
curl http://localhost:3000/health
```

### 2. Send OTP (Auth)
```bash
curl -X POST http://localhost:3000/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210"}'
```

### 3. Verify OTP (Auth)
```bash
# In UAT_MODE=true, OTP is always "123456"
curl -X POST http://localhost:3000/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210", "otp": "123456"}'
```

### 4. Create Booking
```bash
curl -X POST http://localhost:3000/bookings/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "customerId": "customer-uuid",
    "vendorId": "vendor-uuid",
    "serviceId": "service-uuid",
    "bookingDate": "2026-01-30",
    "bookingTime": "10:00",
    "serviceType": "at_home"
  }'
```

### 5. Get Customer Profile
```bash
curl http://localhost:3000/customer/CUSTOMER_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 🔍 Testing Features

### UAT Mode
When `UAT_MODE=true`:
- OTP is always `123456` (no SMS sent)
- Cognito authentication is bypassed (fallback tokens)
- Easier testing without AWS services

### JWT Tokens
For testing authenticated endpoints:
1. Use `/auth/verify-otp` to get a token
2. Include token in `Authorization: Bearer <token>` header

### Database Testing
- Connect to local PostgreSQL
- Or use remote RDS (update DB_HOST in .env.local)
- Run migrations if needed

---

## 📊 Expected Responses

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-01-28T...",
    "requestId": "req-...",
    "version": "v1"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": { ... }
  },
  "meta": {
    "timestamp": "2026-01-28T...",
    "requestId": "req-...",
    "version": "v1"
  }
}
```

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Change port in serverless.local.yml
custom:
  serverless-offline:
    httpPort: 3001  # Change to different port
```

### Database Connection Error
```bash
# Check PostgreSQL is running
pg_isready

# Check connection string in .env.local
# Verify database exists
psql -l | grep warmpawz
```

### Module Not Found
```bash
# Rebuild bundle
npm run build:bundle

# Check dist/handler.js exists
ls -lh dist/handler.js
```

### CORS Issues
CORS is configured in `serverless.local.yml`. If issues persist:
- Check `custom.serverless-offline.cors` settings
- Verify request headers

---

## 📝 Testing Checklist

### Basic Functionality
- [ ] Server starts on port 3000
- [ ] Health endpoint responds
- [ ] CORS headers present

### Auth Endpoints
- [ ] Send OTP works
- [ ] Verify OTP works (UAT mode)
- [ ] JWT token generated
- [ ] Error handling works

### Enhanced Handlers
- [ ] Auth handler (JWT validation)
- [ ] Booking handler (API contracts)
- [ ] Payment handler (validation)
- [ ] Customer handler (enhanced)
- [ ] Vendor onboarding handler

### API Contracts
- [ ] Validation errors return proper format
- [ ] Required fields enforced
- [ ] Type validation works

### Logging
- [ ] Structured JSON logs visible
- [ ] Request IDs in responses
- [ ] Error logs include stack traces

---

## 🎯 Next Steps After Local Testing

1. **Fix Issues Found**
   - Update handlers if needed
   - Fix validation errors
   - Improve error messages

2. **Deploy to AWS Dev**
   ```bash
   ./deploy.sh dev ap-south-1
   ```

3. **Integration Testing**
   - Test with real AWS services
   - Verify RDS connection
   - Test Cognito JWT validation

---

## 📚 Additional Resources

- **Serverless Offline Docs:** https://www.serverless.com/plugins/serverless-offline
- **Hono Framework:** https://hono.dev/
- **API Contracts:** `packages/api-contracts/`

---

**Ready to test?** Run `./test-local.sh` 🚀

