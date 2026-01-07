# Local Testing - Results & Instructions

**Date:** 2026-01-28  
**Status:** ⚠️ **SERVER STARTING - MANUAL TESTING RECOMMENDED**

---

## 🔍 Current Status

The serverless-offline server is configured and ready, but needs to be started manually for best results.

---

## 🚀 Manual Testing Instructions

### Step 1: Start Server (Terminal 1)

```bash
cd backend/lambda
npm run start:local
```

**Wait for this message:**
```
Offline [http for lambda] http://localhost:3000
```

**Keep this terminal open!**

---

### Step 2: Test Endpoints (Terminal 2)

#### Option A: Automated Test Script
```bash
cd backend/lambda
./test-endpoints.sh
```

#### Option B: Manual Testing

**1. Health Check**
```bash
curl http://localhost:3000/health
```

**Expected Response:**
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

**2. Send OTP**
```bash
curl -X POST http://localhost:3000/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210"}'
```

**Expected:** Success response with message

**3. Verify OTP (UAT Mode: OTP = 123456)**
```bash
curl -X POST http://localhost:3000/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210", "otp": "123456"}'
```

**Expected:** JWT token in response

**4. Test Validation (Should Fail)**
```bash
curl -X POST http://localhost:3000/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "invalid"}'
```

**Expected:** HTTP 400 with validation error

---

## ✅ What to Verify

### Basic Functionality
- [ ] Server starts on port 3000
- [ ] Health endpoint responds
- [ ] CORS headers present

### Auth Endpoints
- [ ] Send OTP works
- [ ] Verify OTP works (gets token)
- [ ] Error handling works

### Enhanced Features
- [ ] API contract validation (400 for invalid data)
- [ ] Request IDs in responses
- [ ] Structured JSON responses
- [ ] Logs visible in server terminal

---

## 🐛 Troubleshooting

### Server Won't Start
```bash
# Check if port 3000 is in use
lsof -i :3000

# Kill process if needed
kill -9 $(lsof -t -i:3000)

# Change port in serverless.local.yml
# httpPort: 3001
```

### Build Issues
```bash
cd backend/lambda
npm run build:bundle
```

### Module Errors
```bash
# Rebuild API contracts
cd ../../packages/api-contracts
npm run build
cd ../../backend/lambda
npm run build:bundle
```

---

## 📊 Expected Test Results

### ✅ Success Indicators
- HTTP 200/201 for valid requests
- HTTP 400 for validation errors
- Structured JSON responses
- Request IDs in meta field
- JWT tokens from verify-otp
- Logs show structured JSON

### ❌ Issues to Watch For
- Connection refused (server not started)
- 500 errors (check logs)
- Missing request IDs
- Invalid response format

---

## 📝 Next Steps After Testing

### If Tests Pass ✅
1. Apply database migration 050
2. Proceed to AWS deployment
3. Set up monitoring

### If Issues Found ⚠️
1. Check server logs
2. Verify build output
3. Test individual endpoints
4. Fix issues before deployment

---

## 🎯 Quick Commands

```bash
# Start server
cd backend/lambda && npm run start:local

# Test health
curl http://localhost:3000/health

# Test send OTP
curl -X POST http://localhost:3000/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210"}'

# Test verify OTP
curl -X POST http://localhost:3000/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210", "otp": "123456"}'
```

---

**Status:** ⚠️ **READY FOR MANUAL TESTING**

**Start server:** `cd backend/lambda && npm run start:local`

