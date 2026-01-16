# Database Migration & Testing Summary

## 📋 Current Status

### ✅ Completed:
1. ✅ Lambda backend deployed with enhanced endpoints
2. ✅ Customer web app deployed
3. ✅ Frontend testing - Real vendors displaying
4. ✅ API endpoints working
5. ✅ Migration scripts created

### ⏳ Next Steps:
1. **Create problem_grid_mappings table** (Requires database access)
2. **Test problem-based discovery** (After table creation)
3. **Verify specialists data**
4. **Verify schedule availability**

---

## 🗄️ Step 1: Create Database Table

### Quick Instructions:

**Option A: Using AWS RDS Query Editor (Easiest)**
1. Go to AWS Console → RDS → Query Editor
2. Connect to your database
3. Copy contents of `create-problem-grid-table.sql`
4. Paste and execute

**Option B: Using psql**
```bash
psql -h YOUR_RDS_HOST -U YOUR_USER -d YOUR_DB -f create-problem-grid-table.sql
```

**Option C: Using Database Client**
- Open pgAdmin, DBeaver, or your preferred client
- Connect to RDS database
- Execute `create-problem-grid-table.sql`

### Verification:
```sql
SELECT COUNT(*) FROM problem_grid_mappings;
-- Should return at least 5 records
```

---

## 🧪 Step 2: Test After Migration

Once table is created, run:

```bash
# Test all endpoints
./test-after-migration.sh
```

Or test manually:

```bash
# Test problem-based discovery
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/vendors/by-problem?problemGridId=health-checkup&roleId=072548c8-84a9-4165-a9ec-0387c8c76a0e"

# Check for specialists
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/vendors/by-problem?problemGridId=health-checkup&roleId=072548c8-84a9-4165-a9ec-0387c8c76a0e" | jq '.specialists'

# Check for schedule
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/vendors/by-problem?problemGridId=health-checkup&roleId=072548c8-84a9-4165-a9ec-0387c8c76a0e" | jq '.vendors[0] | {isAvailableToday, nextAvailable}'
```

---

## 🌐 Step 3: Test in Browser

1. Navigate to: https://d2aoyjj8ine0wk.cloudfront.net
2. Go to problem grid section
3. Select a problem (e.g., "Health Checkup")
4. Verify vendors appear
5. Check for specialists/staff
6. Verify schedule availability

---

## 📊 Expected Results

### After Table Creation:
- ✅ API endpoint `/customer/vendors/by-problem` returns vendors
- ✅ No "problem_grid_mappings does not exist" error
- ✅ Vendors match selected problem category

### Specialists:
- ✅ `specialists` array in API response
- ✅ Each specialist has: fullName, specializationDetails, services
- ✅ Frontend displays specialists correctly

### Schedule:
- ✅ `isAvailableToday` field in response
- ✅ `nextAvailable` object with date/time
- ✅ `availableServiceStyles` array
- ✅ Frontend shows availability indicators

---

## 📁 Files Ready

1. **create-problem-grid-table.sql** - SQL migration script
2. **execute-migration.js** - Node.js migration script (needs `pg` module)
3. **execute-db-migration.sh** - Bash migration script (needs `psql`)
4. **test-after-migration.sh** - Test script for after migration
5. **MIGRATION_INSTRUCTIONS.md** - Detailed instructions

---

## 🎯 Quick Start

### 1. Create Table (Choose one method):
```bash
# Method 1: AWS RDS Query Editor (Recommended - No setup needed)
# - Go to AWS Console → RDS → Query Editor
# - Execute create-problem-grid-table.sql

# Method 2: psql
psql -h HOST -U USER -d DB -f create-problem-grid-table.sql

# Method 3: Database Client
# - Open create-problem-grid-table.sql in your client
# - Execute
```

### 2. Verify Table:
```sql
SELECT COUNT(*) FROM problem_grid_mappings;
```

### 3. Test Endpoints:
```bash
./test-after-migration.sh
```

### 4. Test in Browser:
- Navigate to customer app
- Test problem grid
- Verify vendors/specialists appear

---

## ✅ Success Criteria

- [ ] Table created successfully
- [ ] At least 5 problem mappings inserted
- [ ] API endpoint returns vendors for problems
- [ ] No database errors in API responses
- [ ] Frontend displays problem grid correctly
- [ ] Specialists appear (if vendors have staff)
- [ ] Schedule availability shows (if configured)

---

## 🚨 Troubleshooting

### If Table Creation Fails:
- Check database connection
- Verify user has CREATE TABLE permissions
- Check if table already exists (use IF NOT EXISTS)

### If API Still Returns Errors:
- Verify table name is exactly `problem_grid_mappings`
- Check Lambda has database connection
- Verify role_id matches in problem mappings

### If No Vendors Return:
- Check vendors are approved and active
- Verify problem_id matches in mappings
- Check role_id matches

---

## 📝 Next Actions

1. **NOW**: Create `problem_grid_mappings` table (choose method above)
2. **THEN**: Run `./test-after-migration.sh`
3. **THEN**: Test in browser
4. **FINALLY**: Verify specialists and schedule data

**Estimated Time**: 15-20 minutes total

---

## 🎉 Status

**Ready to proceed!** All scripts and instructions are prepared. Once you create the table, we can immediately test and verify everything works.
