# Immediate Next Steps - Quick Start Guide

**Date:** 2026-01-28  
**Status:** 🚀 **READY TO EXECUTE**

---

## 🎯 Step 1: Local Testing (30-60 min)

### Quick Start

**Terminal 1 - Start Server:**
```bash
cd backend/lambda
./test-local.sh
```

**Terminal 2 - Test Endpoints:**
```bash
cd backend/lambda
./test-endpoints.sh
```

---

### Manual Testing

#### 1. Health Check
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

#### 2. Send OTP
```bash
curl -X POST http://localhost:3000/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210"}'
```

#### 3. Verify OTP (UAT Mode: OTP = 123456)
```bash
curl -X POST http://localhost:3000/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210", "otp": "123456"}'
```

**Expected:** JWT token in response

#### 4. Test Validation (Should Fail)
```bash
curl -X POST http://localhost:3000/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "invalid"}'
```

**Expected:** HTTP 400 with validation error

---

### What to Verify

- [ ] Server starts on port 3000
- [ ] Health endpoint responds
- [ ] Send OTP works
- [ ] Verify OTP works (gets token)
- [ ] Validation errors return proper format
- [ ] Request IDs in all responses
- [ ] Structured JSON logs visible
- [ ] CORS headers present

---

## 🎯 Step 2: Database Migration 050 (30 min)

### Apply Migration

```bash
# Review migration first
cat db/migrations/050_additional_indexes_optimization.sql

# Apply to database
psql -h <your-db-host> -U <your-db-user> -d <your-db-name> \
  -f db/migrations/050_additional_indexes_optimization.sql
```

### Verify Indexes

```sql
-- Check indexes created
SELECT indexname, tablename 
FROM pg_indexes 
WHERE indexname LIKE 'idx_%' 
ORDER BY tablename, indexname;

-- Should see new indexes like:
-- idx_bookings_vendor_status_date
-- idx_bookings_customer_status_date
-- idx_vendors_status_tier_active
-- etc.
```

### Test Performance

```sql
-- Before migration
EXPLAIN ANALYZE 
SELECT * FROM bookings 
WHERE vendor_id = 'xxx' AND status = 'confirmed' 
ORDER BY booking_date DESC;

-- After migration - should be faster
-- Check execution time in EXPLAIN ANALYZE output
```

---

## ✅ Success Criteria

### Local Testing Complete When:
- [x] Server starts successfully
- [x] All test endpoints respond
- [x] Validation works correctly
- [x] Structured responses present
- [x] Logs are visible

### Migration Complete When:
- [x] Migration applied successfully
- [x] Indexes created (verify with \di)
- [x] No errors in database logs
- [x] Query performance improved

---

## 🐛 Troubleshooting

### Server Won't Start
```bash
# Check if port 3000 is in use
lsof -i :3000

# Change port in serverless.local.yml
# httpPort: 3001
```

### Database Connection Error
```bash
# Check PostgreSQL is running
pg_isready

# Test connection
psql -h localhost -U postgres -d warmpawz
```

### Build Issues
```bash
cd backend/lambda
npm run build:bundle
```

---

## 📊 Progress Tracking

### Step 1: Local Testing
- [ ] Server started
- [ ] Health check passed
- [ ] Auth endpoints tested
- [ ] Validation verified
- [ ] Logs checked

### Step 2: Database Migration
- [ ] Migration reviewed
- [ ] Migration applied
- [ ] Indexes verified
- [ ] Performance tested

---

## 🚀 After Completing These Steps

**Next:** Proceed to AWS deployment (Step 3-5)
- Create AWS resources
- Configure SSM parameters
- Deploy to AWS dev
- Integration testing

---

**Ready?** Start with Step 1: `cd backend/lambda && ./test-local.sh` 🚀

