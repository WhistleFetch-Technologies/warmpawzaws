# Quick Start - Local Testing

**Status:** ✅ **READY TO TEST**

---

## 🚀 Start Testing (2 Steps)

### Step 1: Start Server

**Open Terminal 1:**
```bash
cd backend/lambda
npm run start:local
```

**Wait for:**
```
Offline [http for lambda] http://localhost:3000
```

**Keep this terminal open!**

---

### Step 2: Test Endpoints

**Open Terminal 2:**

#### Quick Health Check
```bash
curl http://localhost:3000/health
```

#### Full Test Suite
```bash
cd backend/lambda
./test-endpoints.sh
```

---

## ✅ Expected Results

### Health Check
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

### Send OTP
```json
{
  "success": true,
  "data": {
    "message": "OTP sent successfully"
  },
  "meta": { ... }
}
```

### Verify OTP (UAT Mode: OTP = 123456)
```json
{
  "success": true,
  "data": {
    "token": {
      "accessToken": "...",
      "idToken": "...",
      "refreshToken": "..."
    },
    "user": { ... }
  },
  "meta": { ... }
}
```

---

## 🎯 What to Check

- [ ] Server starts successfully
- [ ] Health endpoint returns 200
- [ ] Send OTP works
- [ ] Verify OTP returns token
- [ ] Validation errors return 400
- [ ] Request IDs in all responses
- [ ] Structured JSON format

---

## 🐛 Quick Fixes

### Port 3000 in Use
```bash
# Change port in serverless.local.yml
# httpPort: 3001
```

### Server Won't Start
```bash
# Check logs
tail -f /tmp/warmpawz-server.log

# Rebuild if needed
npm run build:bundle
```

---

**Ready?** Run `npm run start:local` in Terminal 1! 🚀

