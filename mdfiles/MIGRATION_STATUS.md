# 🗄️ Database Migration Status

## Current Situation

✅ **Migration files ready:**
- SQL file: `backend/lambda/src/database/schemas/instant-tele-queue.sql`
- Lambda migration runner updated: `backend/lambda-migration-runner/index.js`

⚠️ **Database is in VPC** - Not directly accessible from local machine

---

## 🚀 Quick Migration Options

### Option 1: AWS RDS Query Editor (Easiest - No Code Changes)

1. **Go to AWS Console:**
   - Navigate to: RDS → Databases → Your database → Query Editor
   - Or: RDS → Query Editor (if available)

2. **Connect to database:**
   - Select your database cluster: `warmpawz-dev-cluster`
   - Use master credentials

3. **Run the migration:**
   - Open the SQL file: `backend/lambda/src/database/schemas/instant-tele-queue.sql`
   - Copy all SQL content
   - Paste into Query Editor
   - Click "Run" or Execute

4. **Verify:**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
     AND table_name IN ('staff_tele_availability', 'tele_queue');
   ```

**✅ This is the fastest option - no deployment needed!**

---

### Option 2: Deploy Updated Lambda & Invoke

1. **Deploy the updated Lambda:**
   ```bash
   cd backend/lambda-migration-runner
   # Use your deployment method (SAM, Serverless, etc.)
   ```

2. **Invoke Lambda:**
   ```bash
   aws lambda invoke \
     --function-name warmpawz-dev-migration-runner \
     --region ap-south-1 \
     --payload '{"migrationType": "instant-tele-queue"}' \
     migration-response.json
   
   cat migration-response.json
   ```

---

### Option 3: Manual SQL Execution

If you have access to a database client (pgAdmin, DBeaver, TablePlus, etc.):

1. Connect to: `warmpawz-dev-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com:5432`
2. Database: `warmpawz`
3. Open SQL file: `backend/lambda/src/database/schemas/instant-tele-queue.sql`
4. Execute the SQL

---

## 📋 Migration Checklist

After running migration, verify:

- [ ] Table `staff_tele_availability` exists
- [ ] Table `tele_queue` exists
- [ ] Indexes created (check with `SELECT indexname FROM pg_indexes WHERE tablename IN ('staff_tele_availability', 'tele_queue')`)
- [ ] Foreign key constraints in place

---

## ✅ Next Steps After Migration

Once migration is complete:

1. ✅ **Deploy backend** - Lambda endpoints already registered
2. ✅ **Deploy frontend** - Components already integrated
3. ✅ **Test features** - Instant Tele Queue & GPS Tracking

---

## 🎯 Recommended: Use AWS RDS Query Editor

**This is the fastest way** - no code deployment needed, just copy-paste SQL!

1. AWS Console → RDS → Query Editor
2. Connect to `warmpawz-dev-cluster`
3. Copy SQL from `backend/lambda/src/database/schemas/instant-tele-queue.sql`
4. Execute
5. Done! ✅

---

**Ready to migrate?** Use Option 1 (Query Editor) for the fastest path! 🚀
