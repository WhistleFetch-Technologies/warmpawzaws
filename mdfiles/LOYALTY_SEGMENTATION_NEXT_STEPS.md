# Loyalty Segmentation System - Next Steps

## 🚀 Immediate Actions Required

### Step 1: Run Database Migrations

**Prerequisites:**
- PostgreSQL database connection
- Database credentials configured

**Run migrations in order:**

```bash
# Navigate to project root
cd /Users/ketan/Documents/warmpawzecodev

# Option 1: Using psql directly
psql -h your-host -U your-user -d your-database -f db/migrations/044_loyalty_segments_system.sql
psql -h your-host -U your-user -d your-database -f db/migrations/045_update_loyalty_rules_with_segments.sql

# Option 2: Using your existing migration runner (if you have one)
# Check if you have a migration script in scripts/ directory
```

**Verify migration success:**
```sql
-- Connect to your database and run:
SELECT COUNT(*) FROM loyalty_segments;
-- Should return 14 (default segments)

SELECT COUNT(*) FROM customer_segment_assignments;
-- Should return 0 initially (will populate as customers match segments)

-- Check if rules were updated
SELECT action_name, conditions->>'segment_ids' as segment_ids
FROM loyalty_action_rules
WHERE conditions->>'segment_ids' IS NOT NULL
LIMIT 5;
```

### Step 2: Verify Backend Code is Deployed

**Check if endpoints are registered:**
```bash
# Check handler registration
grep -r "registerLoyaltySegmentsManagementEndpoints" backend/lambda/src/handler/index.ts
# Should show the import and registration

# Verify service files exist
ls -la backend/lambda/src/lib/services/loyalty-segmentation-service.ts
ls -la backend/lambda/src/endpoints/loyalty-segments-management.ts
```

**If using AWS Lambda, deploy:**
```bash
cd backend/lambda
npm run build
# Then deploy using your CDK/Serverless framework
cd ../infrastructure/cdk
# Run your deployment command
```

### Step 3: Verify Frontend Code is Built

**Check if UI component exists:**
```bash
ls -la apps/admin-web/components/admin/loyalty/LoyaltySegmentsManagement.tsx
```

**Build frontend:**
```bash
cd apps/admin-web
npm install  # If needed
npm run build
# Or for development:
npm run dev
```

### Step 4: Test the System

#### A. Test Backend API (using curl or Postman)

```bash
# Set your API base URL
API_URL="https://your-api-domain.com"  # or http://localhost:3000 for local

# 1. List all segments
curl -X GET "${API_URL}/admin/loyalty-segments" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Expected: Returns array of 14 default segments

# 2. Create a test segment
curl -X POST "${API_URL}/admin/loyalty-segments" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "segment_name": "Test High Value Customers",
    "segment_type": "customer",
    "description": "Customers with ₹50,000+ lifetime spend",
    "criteria": {
      "purchase_history": {
        "min_amount": 50000
      }
    },
    "match_type": "all",
    "is_active": true,
    "priority": 150
  }'

# Expected: Returns created segment with ID

# 3. Get a customer's segments (replace CUSTOMER_ID)
curl -X GET "${API_URL}/admin/customers/CUSTOMER_ID/segments" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Expected: Returns segments the customer belongs to
```

#### B. Test Frontend UI

1. **Start the admin web app:**
   ```bash
   cd apps/admin-web
   npm run dev
   ```

2. **Navigate to Loyalty page:**
   - Go to `http://localhost:3000/loyalty` (or your dev URL)
   - You should see two tabs: "Rules" and "Segments"

3. **Test Segments Tab:**
   - Click "Segments" tab
   - Should see list of default segments
   - Click "Create Segment"
   - Fill in the form:
     - Name: "Premium Medicine Buyers"
     - Type: Customer
     - Criteria: Service Categories = "Medicine"
     - Match Type: All
   - Click "Create"
   - Verify segment appears in list

4. **Test Rules with Segments:**
   - Go to "Rules" tab
   - Create or edit a rule
   - In the conditions, you can now reference segments by ID
   - (Note: Full segment selector in rule form can be added later)

#### C. Test End-to-End Flow

1. **Create a segment:**
   - Name: "Medicine Buyers"
   - Criteria: `service_categories: ["Medicine"]`

2. **Create/Update a loyalty rule:**
   ```json
   {
     "action_name": "buy_medicine",
     "conditions": {
       "segment_ids": ["SEGMENT_ID_FROM_STEP_1"]
     },
     "points_type": "per_amount",
     "points_value": 10,
     "base_amount": 1000
   }
   ```

3. **Make a test transaction:**
   - Create a booking/order for Medicine category
   - Verify points are awarded
   - Check logs for segment matching

### Step 5: Monitor and Verify

**Check logs for segment evaluation:**
```bash
# Look for these log messages:
# ✅ [Rule Engine] Matched rule: buy_medicine (priority: 100)
# ✅ Segment evaluation successful
```

**Verify segment assignments:**
```sql
-- Check which customers are in segments
SELECT 
  c.full_name,
  ls.segment_name,
  csa.assigned_at
FROM customer_segment_assignments csa
JOIN loyalty_segments ls ON csa.segment_id = ls.id
JOIN customers c ON csa.customer_id = c.id
WHERE csa.is_active = true
LIMIT 20;
```

**Check points awarded:**
```sql
-- Verify points were awarded for segment-based rules
SELECT 
  lt.*,
  lar.action_name,
  lar.conditions->>'segment_ids' as segment_ids
FROM loyalty_transactions lt
LEFT JOIN loyalty_action_rules lar ON lt.reference_type = lar.action_name
WHERE lar.conditions->>'segment_ids' IS NOT NULL
ORDER BY lt.created_at DESC
LIMIT 10;
```

## 🔧 Troubleshooting

### Issue: Migrations fail

**Solution:**
```sql
-- Check if tables already exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('loyalty_segments', 'customer_segment_assignments');

-- If they exist, check structure
\d loyalty_segments
```

### Issue: API endpoints return 404

**Check:**
1. Verify handler registration:
   ```bash
   grep -A 5 "registerLoyaltySegmentsManagementEndpoints" backend/lambda/src/handler/index.ts
   ```

2. Check API Gateway routes (if using AWS)
3. Verify authentication/authorization headers

### Issue: Segments not matching customers

**Debug:**
1. Check segment criteria:
   ```sql
   SELECT segment_name, criteria FROM loyalty_segments WHERE segment_name = 'Your Segment';
   ```

2. Manually test customer data:
   ```sql
   -- Check if customer has purchases in Medicine category
   SELECT DISTINCT sc.name
   FROM bookings b
   JOIN services s ON b.service_id = s.id
   JOIN service_categories sc ON s.category_id = sc.id
   WHERE b.customer_id = 'CUSTOMER_ID';
   ```

3. Recalculate segments:
   ```bash
   curl -X POST "${API_URL}/admin/customers/CUSTOMER_ID/segments/recalculate" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

### Issue: UI not showing segments tab

**Check:**
1. Verify component import:
   ```bash
   grep "LoyaltySegmentsManagement" apps/admin-web/app/loyalty/page.tsx
   ```

2. Check if Tabs component is imported
3. Verify build completed without errors

## 📊 Performance Optimization

### Enable Segment Caching

Segments are automatically cached. To refresh:
```sql
-- Clear all cached assignments (forces recalculation)
UPDATE customer_segment_assignments SET is_active = false;
```

### Monitor Query Performance

```sql
-- Check segment evaluation performance
EXPLAIN ANALYZE
SELECT * FROM loyalty_segments
WHERE is_active = true
AND segment_type IN ('customer', 'both')
ORDER BY priority DESC;
```

## 🎯 Recommended Next Enhancements

1. **Add Segment Selector to Rule Form:**
   - Update rule creation UI to show dropdown of segments
   - Allow selecting multiple segments

2. **Segment Analytics:**
   - Add dashboard showing segment membership counts
   - Track segment growth over time

3. **Automatic Segment Updates:**
   - Trigger segment recalculation on customer actions
   - Background job to refresh segments periodically

4. **Segment Templates:**
   - Pre-built segment templates for common use cases
   - One-click segment creation

## ✅ Success Checklist

- [ ] Migrations run successfully
- [ ] 14 default segments created
- [ ] API endpoints respond correctly
- [ ] Frontend UI loads with Segments tab
- [ ] Can create/edit/delete segments
- [ ] Can view customer segments
- [ ] Rules using segments award points correctly
- [ ] No errors in logs
- [ ] Performance is acceptable (< 100ms segment evaluation)

## 📞 Support

If you encounter issues:

1. Check logs: `backend/lambda/logs/` or CloudWatch
2. Review documentation: `LOYALTY_SEGMENTATION_SYSTEM_IMPLEMENTATION.md`
3. Verify database state with SQL queries above
4. Test API endpoints directly with curl

---

**Ready to proceed?** Start with Step 1 (Database Migrations) and work through each step sequentially.
