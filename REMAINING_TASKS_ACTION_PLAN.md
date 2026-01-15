# Remaining Tasks - Action Plan

## 📋 Current Status

### ✅ Completed Tasks:
1. ✅ Deploy Lambda backend with enhanced endpoints
2. ✅ Deploy customer web app
3. ✅ Test frontend displays real vendor data
4. ✅ Verify API calls are successful in browser
5. ✅ Confirm real vendors displaying (Vet Warmpaz, etc.)

### ⏳ Remaining Tasks:
1. ⏳ Create `problem_grid_mappings` table in database
2. ⏳ Test problem-based vendor discovery after table creation
3. ⏳ Verify specialists/staff data displays correctly
4. ⏳ Verify schedule availability displays

---

## 🎯 Task 1: Create problem_grid_mappings Table

### Priority: **HIGH**
### Estimated Time: **10 minutes**

### What to Do:
1. Connect to your RDS database
2. Run the SQL script: `create-problem-grid-table.sql`
3. Verify table created: `SELECT COUNT(*) FROM problem_grid_mappings;`

### SQL Script Location:
- File: `create-problem-grid-table.sql` (in project root)
- Contains: Table creation + sample data insertion

### Verification:
```sql
-- Check table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'problem_grid_mappings'
);

-- Check data inserted
SELECT COUNT(*) FROM problem_grid_mappings;

-- View sample data
SELECT * FROM problem_grid_mappings LIMIT 5;
```

### Expected Result:
- Table created successfully
- At least 5 problem mappings inserted
- Indexes created for performance

---

## 🎯 Task 2: Test Problem-Based Discovery

### Priority: **HIGH** (After Task 1)
### Estimated Time: **15 minutes**

### What to Do:
1. After creating table, test the endpoint:
   ```bash
   curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/vendors/by-problem?problemGridId=health-checkup&roleId=072548c8-84a9-4165-a9ec-0387c8c76a0e"
   ```

2. Test in browser:
   - Navigate to customer app
   - Go to problem grid section
   - Select a problem (e.g., "Health Checkup")
   - Verify vendors appear

### Expected Result:
- API returns vendors for selected problem
- Frontend displays vendors correctly
- No "No problems found" error

### Test Cases:
- [ ] Test with "health-checkup" problem
- [ ] Test with "vaccination" problem
- [ ] Test with "surgery" problem
- [ ] Verify vendors match problem category
- [ ] Check browser console for API calls

---

## 🎯 Task 3: Verify Specialists/Staff Data

### Priority: **MEDIUM**
### Estimated Time: **20 minutes**

### What to Do:

#### Step 1: Check Database
```sql
-- Check if vendors have staff
SELECT v.business_name, COUNT(s.id) as staff_count
FROM vendors v
LEFT JOIN staff s ON s.vendor_id = v.id AND s.is_active = true
WHERE v.role_id = '072548c8-84a9-4165-a9ec-0387c8c76a0e'
  AND v.status = 'approved'
  AND v.is_active = true
GROUP BY v.id, v.business_name
HAVING COUNT(s.id) > 0
LIMIT 10;
```

#### Step 2: Test API Endpoint
```bash
# Test with a vendor that has staff
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/vendors/by-problem?problemGridId=health-checkup&roleId=072548c8-84a9-4165-a9ec-0387c8c76a0e" | jq '.specialists'
```

#### Step 3: Test in Browser
- Navigate to problem grid
- Select a vet-related problem
- Verify specialists/doctors appear
- Check each specialist has:
  - Full name
  - Specialization details
  - Services
  - Clinic information

### Expected Result:
- API response includes `specialists` array
- Each specialist has required fields:
  - `fullName`
  - `specializationDetails`
  - `services`
  - `clinicId`, `clinicName`, `clinicAddress`
- Frontend displays specialists correctly

### If No Specialists:
- Check if vendors have staff in database
- Verify staff is_active = true
- Check staff_specializations table exists
- Verify API endpoint queries staff table correctly

---

## 🎯 Task 4: Verify Schedule Availability

### Priority: **MEDIUM**
### Estimated Time: **15 minutes**

### What to Do:

#### Step 1: Check Database
```sql
-- Check if vendor_schedule_slots table exists
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
  AND v.is_active = true
GROUP BY v.id, v.business_name
HAVING COUNT(vss.id) > 0
LIMIT 10;
```

#### Step 2: Test API Endpoint
```bash
# Test vendor endpoint - check for schedule data
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/vendors/by-problem?problemGridId=health-checkup&roleId=072548c8-84a9-4165-a9ec-0387c8c76a0e" | jq '.vendors[0] | {isAvailableToday, nextAvailable, availableServiceStyles}'
```

#### Step 3: Test in Browser
- View vendor list
- Check for availability indicators:
  - "Available Today" badge
  - "Next Available: [Date] [Time]"
  - Service styles (at_center, at_home, tele)

### Expected Result:
- API response includes:
  - `isAvailableToday`: boolean
  - `nextAvailable`: { date, time }
  - `availableServiceStyles`: array
- Frontend displays schedule correctly
- If table doesn't exist, defaults to `isAvailableToday: true`

### If Schedule Not Showing:
- Check if `vendor_schedule_slots` table exists
- Verify schedule slots configured for vendors
- Check API endpoint handles missing table gracefully (already implemented)

---

## 📊 Testing Checklist

### After Creating Table:
- [ ] Table created successfully
- [ ] Sample data inserted
- [ ] Indexes created
- [ ] API endpoint returns vendors for problems
- [ ] Frontend displays problem grid correctly

### After Testing Problem Discovery:
- [ ] Problem-based search works
- [ ] Vendors appear for selected problems
- [ ] No "No problems found" error
- [ ] API calls successful
- [ ] Frontend navigation smooth

### After Verifying Specialists:
- [ ] Specialists array in API response
- [ ] Specialists display in frontend
- [ ] All required fields present
- [ ] Specialization details shown
- [ ] Services per specialist listed

### After Verifying Schedule:
- [ ] Schedule data in API response
- [ ] Availability indicators show
- [ ] Next available slot displayed
- [ ] Service styles listed
- [ ] Graceful handling if table missing

---

## 🚀 Quick Start Commands

### 1. Create Table:
```bash
# Connect to database and run:
psql -h YOUR_RDS_HOST -U YOUR_USER -d YOUR_DB -f create-problem-grid-table.sql
```

### 2. Test API:
```bash
# Test problem-based discovery
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/vendors/by-problem?problemGridId=health-checkup&roleId=072548c8-84a9-4165-a9ec-0387c8c76a0e"

# Test specialists
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/vendors/by-problem?problemGridId=health-checkup&roleId=072548c8-84a9-4165-a9ec-0387c8c76a0e" | jq '.specialists'

# Test schedule
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/vendors/by-problem?problemGridId=health-checkup&roleId=072548c8-84a9-4165-a9ec-0387c8c76a0e" | jq '.vendors[0] | {isAvailableToday, nextAvailable}'
```

### 3. Test in Browser:
- Navigate to: https://d2aoyjj8ine0wk.cloudfront.net
- Go to problem grid
- Select a problem
- Verify vendors/specialists appear
- Check schedule availability

---

## 📝 Priority Order

### Do First (Today):
1. ✅ **Create problem_grid_mappings table** - Enables problem-based discovery
2. ✅ **Test problem-based discovery** - Verify full functionality

### Do Next (This Week):
3. ✅ **Verify specialists data** - Ensure staff/specialists display
4. ✅ **Verify schedule availability** - Complete the feature set

---

## 🎯 Success Criteria

### Task 1 Complete When:
- ✅ Table exists in database
- ✅ Sample data inserted
- ✅ No SQL errors

### Task 2 Complete When:
- ✅ API returns vendors for problems
- ✅ Frontend displays problem grid
- ✅ No "No problems found" error

### Task 3 Complete When:
- ✅ Specialists appear in API response
- ✅ Specialists display in frontend
- ✅ All required fields present

### Task 4 Complete When:
- ✅ Schedule data in API response
- ✅ Availability indicators show
- ✅ Next available slot displayed

---

## 📊 Estimated Timeline

- **Task 1**: 10 minutes
- **Task 2**: 15 minutes
- **Task 3**: 20 minutes
- **Task 4**: 15 minutes

**Total**: ~1 hour for all remaining tasks

---

## ✅ Current Status Summary

**Completed**: 5/9 tasks (56%)  
**Remaining**: 4/9 tasks (44%)

**Next Action**: Create `problem_grid_mappings` table

**Files Ready**:
- ✅ `create-problem-grid-table.sql` - Database script
- ✅ `REMAINING_TASKS_ACTION_PLAN.md` - This guide
- ✅ `BROWSER_TEST_RESULTS.md` - Test results
- ✅ `TESTING_RESULTS.md` - API test results

**Ready to proceed!** 🚀
