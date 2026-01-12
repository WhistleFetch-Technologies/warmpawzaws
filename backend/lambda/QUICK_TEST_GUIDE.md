# Quick Test Guide - Region Seeding API

## 🚀 Quick Start

### Step 1: Start Backend Server

The server needs to be running before testing. Choose the appropriate option:

#### Option A: If backend/lambda exists
```bash
cd backend/lambda
npm install  # If needed
npm run start:local
```

The server should start on `http://localhost:3000`

#### Option B: If using a different backend setup
Make sure your API server is running on port 3000 or update `API_URL` in the test script.

### Step 2: Run Tests

Once the server is running, open a new terminal and run:

```bash
# From project root
./test-region-seeding-enhanced.sh
```

---

## 🧪 Manual Testing (Alternative)

If you prefer manual testing, here are the curl commands:

### 1. Health Check
```bash
curl http://localhost:3000/health
```

### 2. Get All Regions (Before Seeding)
```bash
curl http://localhost:3000/regions \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin-123"
```

### 3. Seed All Regions
```bash
curl -X POST http://localhost:3000/admin/regions/seed-all \
  -H "Content-Type: application/json" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin-123" \
  -d '{}'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Region seeding completed",
  "stats": {
    "created": 7,
    "updated": 0,
    "skipped": 0,
    "errors": []
  },
  "totalTemplates": 7
}
```

### 4. Get All Regions (After Seeding)
```bash
curl http://localhost:3000/regions \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin-123"
```

### 5. Get Specific Region (India)
```bash
curl http://localhost:3000/regions/india \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin-123"
```

### 6. Create Individual Region (USA)
```bash
curl -X POST http://localhost:3000/admin/regions/init-usa \
  -H "Content-Type: application/json" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin-123" \
  -d '{}'
```

### 7. Toggle Region Status
```bash
curl -X PATCH http://localhost:3000/admin/regions/usa/status \
  -H "Content-Type: application/json" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin-123" \
  -d '{"isActive": true}'
```

---

## ✅ Expected Results

After seeding, you should see:
- **7 regions** created (India, USA, UAE, Singapore, UK, Australia, EMEA)
- Each region with complete configuration
- India region is **active** by default
- Other regions are **inactive** by default

---

## 🐛 Troubleshooting

### Server Won't Start
- Check if port 3000 is already in use: `lsof -i :3000`
- Check backend dependencies: `cd backend/lambda && npm install`
- Check for TypeScript errors: `npm run build:ts`

### Database Connection Issues
- Verify database credentials in environment variables
- Check if RDS/PostgreSQL is accessible
- Verify `regions` table exists with `region_config` JSONB column

### Tests Fail
- Ensure server is running before running tests
- Check server logs for errors
- Verify UAT mode is enabled (X-UAT-Mode header)

---

## 📝 Test Script Options

The test script supports environment variables:

```bash
# Use different API URL
API_URL=http://localhost:4000 ./test-region-seeding-enhanced.sh

# Use different backend directory
BACKEND_DIR=./my-backend ./test-region-seeding-enhanced.sh
```

---

**Ready to test!** Start the server first, then run the test script. 🚀
