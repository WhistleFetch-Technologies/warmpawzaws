# Loyalty Segmentation - Quick Start Guide

## ✅ Pre-Flight Check

All files are in place and ready:
- ✅ Migration 064: `db/migrations/064_loyalty_segments_system.sql`
- ✅ Migration 065: `db/migrations/065_update_loyalty_rules_with_segments.sql`
- ✅ Backend endpoints registered
- ✅ Frontend UI component created

## 🚀 Quick Start (5 Minutes)

### 1. Run Database Migrations

```bash
# Connect to your database and run:
psql -h YOUR_HOST -U YOUR_USER -d YOUR_DATABASE -f db/migrations/064_loyalty_segments_system.sql
psql -h YOUR_HOST -U YOUR_USER -d YOUR_DATABASE -f db/migrations/065_update_loyalty_rules_with_segments.sql
```

**Or if using a migration runner:**
```bash
# Check your migration script location
ls scripts/*migration* 2>/dev/null || ls scripts/*migrate* 2>/dev/null
```

### 2. Verify Migrations

```sql
-- Run in your database:
SELECT COUNT(*) as segment_count FROM loyalty_segments;
-- Should return: 14

SELECT segment_name FROM loyalty_segments LIMIT 5;
-- Should show: Medicine Buyers, Grooming Service Users, etc.
```

### 3. Test API Endpoint

```bash
# Replace with your actual API URL
curl http://localhost:3000/admin/loyalty-segments

# Or if deployed:
curl https://your-api.com/admin/loyalty-segments \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "segments": [
    {
      "id": "...",
      "segment_name": "Medicine Buyers",
      "segment_type": "customer",
      "criteria": {"service_categories": ["Medicine"]},
      ...
    },
    ...
  ]
}
```

### 4. Test Frontend UI

```bash
# Start admin web (if not running)
cd apps/admin-web
npm run dev

# Navigate to: http://localhost:3000/loyalty
# Click "Segments" tab
# You should see 14 default segments
```

### 5. Create Your First Segment

**Via UI:**
1. Click "Create Segment"
2. Name: "Premium Customers"
3. Type: Customer
4. Criteria: 
   - Min Amount: 50000
5. Click "Create"

**Via API:**
```bash
curl -X POST http://localhost:3000/admin/loyalty-segments \
  -H "Content-Type: application/json" \
  -d '{
    "segment_name": "Premium Customers",
    "segment_type": "customer",
    "criteria": {
      "purchase_history": {"min_amount": 50000}
    },
    "match_type": "all",
    "is_active": true,
    "priority": 150
  }'
```

## 📋 What You Get

### Default Segments Created:
1. Medicine Buyers
2. Grooming Service Users
3. Vet Consultation Users
4. Pet Food Buyers
5. Insurance Buyers
6. Gold Tier Customers
7. Platinum Tier Customers
8. First Time Buyers
9. Birthday Month Customers
10. Regular Customers (5+ purchases)
11. High Value Customers (₹10,000+)
12. Doorstep Service Users
13. In-Clinic Service Users
14. Online Service Users

### API Endpoints Available:
- `GET /admin/loyalty-segments` - List all segments
- `POST /admin/loyalty-segments` - Create segment
- `PUT /admin/loyalty-segments/:id` - Update segment
- `DELETE /admin/loyalty-segments/:id` - Delete segment
- `GET /admin/customers/:id/segments` - Get customer's segments
- `POST /admin/customers/:id/segments/recalculate` - Recalculate

## 🎯 Next Actions

1. **Review default segments** - Adjust criteria as needed
2. **Create custom segments** - For your specific use cases
3. **Update loyalty rules** - Reference segments in rule conditions
4. **Test with real transactions** - Verify points are awarded correctly

## 🔍 Verify It's Working

```sql
-- Check segment assignments (after some customer activity)
SELECT 
  c.full_name,
  ls.segment_name,
  csa.assigned_at
FROM customer_segment_assignments csa
JOIN loyalty_segments ls ON csa.segment_id = ls.id
JOIN customers c ON csa.customer_id = c.id
WHERE csa.is_active = true
LIMIT 10;
```

## 📚 Full Documentation

- **Implementation Details**: `LOYALTY_SEGMENTATION_SYSTEM_IMPLEMENTATION.md`
- **Deployment Guide**: `LOYALTY_SEGMENTATION_DEPLOYMENT_CHECKLIST.md`
- **Next Steps**: `LOYALTY_SEGMENTATION_NEXT_STEPS.md`

## ⚠️ Important Notes

1. **Migration Order**: Run 060 before 061
2. **Backward Compatible**: Existing rules still work
3. **Performance**: Segments are cached automatically
4. **No Breaking Changes**: System works with or without segments

---

**Ready?** Start with Step 1 (run migrations) and you'll be up and running in minutes!
