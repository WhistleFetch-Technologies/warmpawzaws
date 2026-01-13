# 🚀 DEPLOY NOW - Loyalty Segmentation System

## ✅ Pre-Deployment Status

All code is complete and ready. Follow these steps in order.

---

## STEP 1: Database Migrations (REQUIRED - Do This First)

### Run Migrations

```bash
# Connect to your database and run:

# Migration 064: Creates the segmentation system
psql -h YOUR_DB_HOST -U YOUR_DB_USER -d YOUR_DB_NAME \
  -f db/migrations/064_loyalty_segments_system.sql

# Migration 065: Updates existing rules to use segments
psql -h YOUR_DB_HOST -U YOUR_DB_USER -d YOUR_DB_NAME \
  -f db/migrations/065_update_loyalty_rules_with_segments.sql
```

### Verify Success

```sql
-- Connect to database and run:
SELECT COUNT(*) as segment_count FROM loyalty_segments;
-- Expected: 14

SELECT segment_name, segment_type, is_active 
FROM loyalty_segments 
ORDER BY priority DESC 
LIMIT 5;
-- Should show: Medicine Buyers, Grooming Service Users, etc.
```

**✅ If you see 14 segments, migrations are successful!**

---

## STEP 2: Deploy Backend (If Needed)

### Check if Already Deployed

The code is already in your codebase. If you need to rebuild:

```bash
cd backend/lambda
npm install  # If dependencies changed
npm run build
```

### Deploy to AWS Lambda

```bash
# Using your deployment method (CDK, Serverless, etc.)
cd infrastructure/cdk
# Run your deployment command
```

### Test API Endpoint

```bash
# Replace with your actual API URL
curl https://your-api.com/admin/loyalty-segments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Expected: JSON with 14 segments
```

**✅ If API returns segments, backend is working!**

---

## STEP 3: Deploy Frontend (If Needed)

### Build Frontend

```bash
cd apps/admin-web
npm install  # If dependencies changed
npm run build
```

### Test Locally (Development)

```bash
npm run dev
# Navigate to: http://localhost:3000/loyalty
```

### Deploy to Production

```bash
# Use your deployment method (Vercel, AWS, etc.)
npm run build
# Deploy the build output
```

**✅ If you see "Segments" tab in UI, frontend is working!**

---

## STEP 4: Quick Test

### Test 1: View Segments via API

```bash
curl http://localhost:3000/admin/loyalty-segments
# Should return 14 segments
```

### Test 2: View Segments via UI

1. Go to: `http://localhost:3000/loyalty`
2. Click **"Segments"** tab
3. Should see 14 default segments listed

### Test 3: Create a Segment

1. Click **"Create Segment"** button
2. Fill in:
   - Name: "Test Segment"
   - Type: Customer
   - Criteria: Service Categories = "Medicine"
3. Click **"Create"**
4. Should appear in the list

**✅ If all tests pass, system is fully operational!**

---

## STEP 5: Use Segments in Rules

### Example: Update a Rule to Use Segment

```bash
# Get segment ID first
SEGMENT_ID=$(curl -s http://localhost:3000/admin/loyalty-segments | \
  jq '.segments[] | select(.segment_name=="Medicine Buyers") | .id')

# Update a rule to use this segment
curl -X PUT http://localhost:3000/admin/loyalty-action-rules/RULE_ID \
  -H "Content-Type: application/json" \
  -d "{
    \"conditions\": {
      \"segment_ids\": [\"$SEGMENT_ID\"]
    }
  }"
```

### Test Rule Matching

1. Create a booking/order in Medicine category
2. Verify points are awarded
3. Check logs for segment matching

---

## 🎯 What You Get

### ✅ 14 Pre-Built Segments:
- Medicine Buyers
- Grooming Service Users
- Vet Consultation Users
- Pet Food Buyers
- Insurance Buyers
- Gold/Platinum Tier Customers
- First Time Buyers
- Birthday Month Customers
- Regular Customers (5+ purchases)
- High Value Customers (₹10,000+)
- Service Type Segments (Doorstep, In-Clinic, Online)

### ✅ Full Features:
- Create/Edit/Delete segments via UI
- Segment criteria builder
- Customer segment lookup
- Rules can reference segments
- Automatic segment caching
- Database query-based evaluation

---

## 🔧 Troubleshooting

### Migration Fails?
```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('loyalty_segments', 'customer_segment_assignments');

-- If they exist, check structure
\d loyalty_segments
```

### API Returns 404?
- Check handler registration: `grep "registerLoyaltySegmentsManagementEndpoints" backend/lambda/src/handler/index.ts`
- Verify API Gateway routes
- Check authentication headers

### UI Not Showing?
- Check browser console for errors
- Verify component import
- Rebuild frontend: `npm run build`

### Segments Not Matching?
```sql
-- Check segment criteria
SELECT segment_name, criteria FROM loyalty_segments WHERE segment_name = 'Your Segment';

-- Manually test customer
SELECT * FROM customers WHERE id = 'CUSTOMER_ID';
SELECT * FROM bookings WHERE customer_id = 'CUSTOMER_ID';
```

---

## ✅ Success Checklist

After deployment, verify:
- [ ] Migrations completed (14 segments in database)
- [ ] API endpoint responds (`/admin/loyalty-segments`)
- [ ] UI shows "Segments" tab
- [ ] Can create/edit/delete segments
- [ ] Can view customer segments
- [ ] Rules can use segments
- [ ] Points awarded correctly for segment-based rules

---

## 📚 Documentation

- **Quick Start**: `LOYALTY_SEGMENTATION_QUICK_START.md`
- **Next Steps**: `LOYALTY_SEGMENTATION_NEXT_STEPS.md`
- **Full Docs**: `LOYALTY_SEGMENTATION_SYSTEM_IMPLEMENTATION.md`
- **Deployment**: `LOYALTY_SEGMENTATION_DEPLOYMENT_CHECKLIST.md`

---

## 🎉 You're Ready!

**Start with STEP 1 (Database Migrations)** and you'll be live in minutes!

All code is complete, tested, and ready to deploy. The system is backward compatible, so existing rules will continue to work.
