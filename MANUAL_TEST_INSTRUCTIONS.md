# Manual Testing Instructions

**Status:** ✅ **READY - Start Server Manually**

---

## 🚀 Quick Start (2 Terminals)

### Terminal 1: Start Server

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

### Terminal 2: Test Endpoints

#### Option A: Quick Health Check
```bash
curl http://localhost:3000/health
```

#### Option B: Full Test Suite
```bash
cd backend/lambda
./test-endpoints.sh
```

#### Option C: Manual Testing

**1. Health Check**
```bash
curl http://localhost:3000/health
```

**Expected:**
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

**3. Verify OTP (UAT Mode: OTP = 123456)**
```bash
curl -X POST http://localhost:3000/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210", "otp": "123456"}'
```

**Expected:** JWT token in response

**4. Test Validation (Should Return 400)**
```bash
curl -X POST http://localhost:3000/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "invalid"}'
```

**Expected:** HTTP 400 with validation error

---

## ✅ What to Verify

- [ ] Server starts on port 3000
- [ ] Health endpoint returns 200
- [ ] Send OTP works
- [ ] Verify OTP returns token
- [ ] Validation errors return 400
- [ ] Request IDs in responses
- [ ] Structured JSON format
- [ ] Logs visible in Terminal 1

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

### Connection Refused
- Wait 20-30 seconds for server to fully start
- Check Terminal 1 for errors
- Verify build exists: `ls -lh dist/handler.js`

### Build Issues
```bash
cd backend/lambda
npm run build:bundle
```

---

## 📊 Expected Results

### ✅ Success Indicators
- HTTP 200/201 for valid requests
- HTTP 400 for validation errors
- Structured JSON responses
- Request IDs in meta field
- JWT tokens from verify-otp
- Logs show structured JSON

---

## 🎯 Next Steps After Testing

### If Tests Pass ✅
1. Apply database migration 050
2. Proceed to AWS deployment
3. Set up monitoring

### If Issues Found ⚠️
1. Check server logs in Terminal 1
2. Verify build output
3. Test individual endpoints
4. Fix issues before deployment

---

**Ready?** Start server: `cd backend/lambda && npm run start:local` 🚀

