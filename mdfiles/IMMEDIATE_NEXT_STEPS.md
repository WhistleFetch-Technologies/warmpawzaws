# Immediate Next Steps - Customer App API Integration

## 🎯 Current Status

✅ **Completed**:
- Lambda backend deployed with enhanced endpoints
- Customer web app deployed
- API endpoints responding correctly
- Real vendor data confirmed in API responses
- Parameter compatibility verified

⚠️ **Needs Action**:
- `problem_grid_mappings` table missing (for problem-based discovery)
- Frontend testing needed to verify real data displays
- Verify specialists/staff data returns correctly

---

## 🚀 Immediate Actions (Priority Order)

### 1. Create Database Table (High Priority)

**Action**: Create `problem_grid_mappings` table to enable problem-based discovery

**SQL Script**:
```sql
-- Create problem_grid_mappings table
CREATE TABLE IF NOT EXISTS problem_grid_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id TEXT NOT NULL,
  problem_name TEXT NOT NULL,
  problem_display_name TEXT,
  role_id TEXT NOT NULL,
  sub_category_id TEXT,
  sub_category_name TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_problem_grid_problem_id 
  ON problem_grid_mappings(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_grid_role_id 
  ON problem_grid_mappings(role_id);
CREATE INDEX IF NOT EXISTS idx_problem_grid_role_problem 
  ON problem_grid_mappings(role_id, problem_id);

-- Insert sample problem mappings for veterinarians
INSERT INTO problem_grid_mappings (problem_id, problem_name, problem_display_name, role_id, order_index)
VALUES 
  ('health-checkup', 'Health Checkup', 'Health Checkup', '072548c8-84a9-4165-a9ec-0387c8c76a0e', 1),
  ('vaccination', 'Vaccination', 'Vaccination', '072548c8-84a9-4165-a9ec-0387c8c76a0e', 2),
  ('surgery', 'Surgery', 'Surgery', '072548c8-84a9-4165-a9ec-0387c8c76a0e', 3),
  ('emergency', 'Emergency', 'Emergency Care', '072548c8-84a9-4165-a9ec-0387c8c76a0e', 4),
  ('dermatology', 'Dermatology', 'Skin & Coat Issues', '072548c8-84a9-4165-a9ec-0387c8c76a0e', 5)
ON CONFLICT DO NOTHING;

-- Insert sample problem mappings for groomers
INSERT INTO problem_grid_mappings (problem_id, problem_name, problem_display_name, role_id, order_index)
SELECT role_id FROM roles WHERE name = 'pet_groomer' OR name = 'groomer'
LIMIT 1
ON CONFLICT DO NOTHING;
```

**How to Execute**:
1. Connect to your RDS database
2. Run the SQL script above
3. Verify table created: `SELECT COUNT(*) FROM problem_grid_mappings;`

---

### 2. Test Frontend Integration (High Priority)

**Action**: Verify customer app displays real vendor data

**Steps**:
1. Open customer web app in browser
2. Navigate to Vet service section
3. Check if real vendors appear (e.g., "Vet Warmpaz")
4. Open browser DevTools → Network tab
5. Filter by "discover-services" or "vendors"
6. Verify API calls are successful
7. Check response contains real data
8. Verify no placeholder/mock data visible

**What to Look For**:
- ✅ Real vendor names (not "Test Vendor" or "Placeholder")
- ✅ Real addresses and contact info
- ✅ API calls return 200 status
- ✅ Response contains actual vendor IDs from database
- ❌ No fallback to default/mock data

---

### 3. Test Problem-Based Discovery (After Table Creation)

**Action**: Test `/customer/vendors/by-problem` endpoint with real problem ID

**Test Command**:
```bash
# After creating table, test with real problem ID
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/vendors/by-problem?problemGridId=health-checkup&roleId=072548c8-84a9-4165-a9ec-0387c8c76a0e"
```

**Expected**:
- Returns vendors that match the problem
- Includes specialists/staff if available
- Includes schedule/availability data
- No database errors

---

### 4. Verify Specialists Data (Medium Priority)

**Action**: Check if specialists/staff data is returned correctly

**Test**:
1. Find a vendor that has staff (vet clinic with doctors)
2. Call `/customer/vendors/by-problem` with that vendor's role
3. Verify response includes `specialists` array
4. Check each specialist has:
   - `fullName`
   - `specializationDetails`
   - `services`
   - `clinicId`, `clinicName`, `clinicAddress`

**Database Check**:
```sql
-- Check if vendors have staff
SELECT v.business_name, COUNT(s.id) as staff_count
FROM vendors v
LEFT JOIN staff s ON s.vendor_id = v.id AND s.is_active = true
WHERE v.role_id = '072548c8-84a9-4165-a9ec-0387c8c76a0e'
  AND v.status = 'approved'
GROUP BY v.id, v.business_name
HAVING COUNT(s.id) > 0
LIMIT 5;
```

---

### 5. Test Schedule Integration (Medium Priority)

**Action**: Verify schedule/availability data is included

**Check**:
1. Test endpoint with vendor that has schedule slots
2. Verify response includes:
   - `isAvailableToday`: boolean
   - `nextAvailable`: { date, time }
   - `availableServiceStyles`: array

**Database Check**:
```sql
-- Check if vendor_schedule_slots table exists and has data
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'vendor_schedule_slots'
);

-- If exists, check for schedule data
SELECT v.business_name, COUNT(vss.id) as slot_count
FROM vendors v
LEFT JOIN vendor_schedule_slots vss ON vss.vendor_id = v.id
WHERE v.status = 'approved'
GROUP BY v.id, v.business_name
HAVING COUNT(vss.id) > 0
LIMIT 5;
```

---

### 6. Test Filters (Low Priority)

**Action**: Verify all filters work correctly

**Test Cases**:
1. **Price Range Filter**:
   ```bash
   curl ".../customer/vendors/by-problem?problemGridId=xxx&feeMin=500&feeMax=2000"
   ```

2. **Sorting**:
   ```bash
   curl ".../customer/vendors/by-problem?problemGridId=xxx&sortBy=rating"
   curl ".../customer/vendors/by-problem?problemGridId=xxx&sortBy=distance"
   curl ".../customer/vendors/by-problem?problemGridId=xxx&sortBy=price"
   ```

3. **Location Filter**:
   ```bash
   curl ".../customer/vendors/by-problem?problemGridId=xxx&lat=12.9716&lng=77.5946"
   ```

---

## 📋 Verification Checklist

### Backend Verification
- [x] Lambda function deployed
- [x] API endpoints responding
- [x] Real vendor data returned
- [ ] `problem_grid_mappings` table created
- [ ] Problem-based discovery working
- [ ] Specialists data returned
- [ ] Schedule data included

### Frontend Verification
- [ ] Customer app loads correctly
- [ ] Real vendors display (not placeholders)
- [ ] Vendor details show correctly
- [ ] Specialists appear for vet clinics
- [ ] Schedule availability displays
- [ ] Filters work correctly
- [ ] No console errors
- [ ] API calls successful

### Data Quality
- [ ] Vendor names are real
- [ ] Addresses are valid
- [ ] Phone numbers are real
- [ ] Ratings are realistic
- [ ] Services have real prices
- [ ] No test/placeholder data

---

## 🔧 Quick Fixes

### If problem_grid_mappings Table Doesn't Exist
**Option 1**: Create the table (see SQL above)
**Option 2**: Update frontend to use `/customer/discover-services` instead

### If No Specialists Return
**Check**:
- Staff table has data
- Staff is_active = true
- Staff linked to vendors correctly

### If Schedule Data Missing
**Check**:
- `vendor_schedule_slots` table exists
- Schedule slots configured for vendors
- Code gracefully handles missing table (already implemented)

---

## 📊 Success Metrics

### API Level
- ✅ Response time < 2 seconds
- ✅ Error rate < 1%
- ✅ Real data in responses
- ✅ All parameters supported

### Frontend Level
- ✅ Real vendors visible
- ✅ No placeholder data
- ✅ Smooth user experience
- ✅ No console errors

---

## 🎯 Recommended Order of Execution

1. **NOW**: Test frontend with current working endpoints
2. **TODAY**: Create `problem_grid_mappings` table
3. **TODAY**: Test problem-based discovery
4. **THIS WEEK**: Verify specialists data
5. **THIS WEEK**: Test schedule integration
6. **ONGOING**: Monitor and optimize

---

## 🚨 If Issues Occur

### API Returns Errors
- Check CloudWatch logs: `aws logs tail /aws/lambda/warmpawz-dev-api-handler --follow`
- Verify database connection
- Check table existence

### Frontend Shows Placeholders
- Check browser console for API errors
- Verify API_BASE_URL is correct
- Check if API calls are being made
- Verify response contains real data

### No Vendors Display
- Check vendor status (must be 'approved' and 'is_active')
- Verify role_id matches
- Check database has vendor data

---

## ✅ Expected Final State

After completing these steps:
- ✅ Problem-based discovery fully functional
- ✅ Specialists display for vet clinics
- ✅ Schedule availability shows
- ✅ All filters working
- ✅ Real data throughout customer journey
- ✅ No placeholder/mock data visible

**Status**: Ready to execute! 🚀
