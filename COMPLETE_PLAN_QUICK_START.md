# Complete Plan Feature - Quick Start Guide

## 🚀 Quick Deployment Steps

### 1. Database Migration (5 minutes)

**Using RDS Migration Script (Easiest):**
```bash
./db/migrations/run-migration-rds.sh
# Follow prompts to connect to RDS and run migration
```

**Manual RDS Connection:**
```bash
# Connect to AWS RDS PostgreSQL
psql -h YOUR_RDS_ENDPOINT.rds.amazonaws.com \
     -U your_db_user \
     -d your_database \
     -f db/migrations/059_create_care_plans_tables.sql

# Verify
psql -h YOUR_RDS_ENDPOINT.rds.amazonaws.com \
     -U your_db_user \
     -d your_database \
     -c "SELECT COUNT(*) FROM care_plan_templates;" -- Should return 3
```

**Using AWS RDS Query Editor:**
- Go to AWS Console > RDS > Query Editor
- Connect to your database
- Copy/paste SQL from `059_create_care_plans_tables.sql`
- Execute

### 2. Backend Deployment (10 minutes)
```bash
cd backend/lambda

# Build (if needed)
npm run build

# Deploy
serverless deploy --stage dev  # or prod

# Verify endpoints are live
curl https://your-api-url/config/ui/dashboard?roleId=veterinarian
```

### 3. Frontend Deployment (5 minutes)
```bash
cd apps/admin-web

# Build
npm run build

# Deploy to your hosting platform
# (Vercel, Netlify, etc.)
```

## ✅ Quick Test

1. **Open Support/CRM**
   - Navigate to admin web
   - Go to Support & CRM
   - Open any ticket

2. **Click "Complete Plan"**
   - Button should appear in ticket actions
   - Modal should open

3. **Generate Test Plan**
   - Select a pet
   - Choose "Wellness" plan type
   - Select "AI Generated"
   - Click "Generate Plan"
   - Should see success notification

## 🔍 Verification Checklist

- [ ] Database tables exist
- [ ] 3 templates seeded
- [ ] Backend endpoints respond
- [ ] "Complete Plan" button visible
- [ ] Modal opens correctly
- [ ] Plan generation works
- [ ] Plan saved to database

## 🐛 Common Issues

**Issue:** Button doesn't appear
- Check Dashboard UI config: Marketing > Dashboard UI tab
- Verify button is enabled for the role

**Issue:** AI generation fails
- Check AWS Bedrock permissions in IAM
- Verify Bedrock is enabled in platform settings
- Check CloudWatch logs for errors

**Issue:** Templates not loading
- Verify migration ran successfully
- Check database connection
- Verify template endpoint returns data

## 📞 Support

If you encounter issues:
1. Check CloudWatch logs
2. Verify database migration
3. Test endpoints individually
4. Check browser console for frontend errors

## 🎉 Success!

Once deployed and tested, the Complete Plan feature is ready to use!

**Next:** Train support team on how to use the feature.
