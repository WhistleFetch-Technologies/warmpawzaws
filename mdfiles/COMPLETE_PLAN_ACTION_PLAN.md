# Complete Plan Feature - Action Plan

## 🎯 Ready to Deploy - Follow These Steps

### Step 1: Run Database Migration on RDS (5 minutes)

**Easiest Method - Use the automated script:**
```bash
./db/migrations/run-migration-rds.sh
```
This script will:
- Fetch RDS connection details from AWS SSM
- Connect to your RDS PostgreSQL database
- Run the migration
- Verify tables and templates were created

**Alternative - Manual connection:**
```bash
# Get RDS endpoint from AWS Console or SSM
psql -h YOUR_RDS_ENDPOINT.rds.amazonaws.com \
     -U your_db_user \
     -d your_database \
     -f db/migrations/059_create_care_plans_tables.sql
```

**Verify migration:**
```sql
-- Should return 3 tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('pet_care_plans', 'care_plan_items', 'care_plan_templates');

-- Should return 3 (templates seeded)
SELECT COUNT(*) FROM care_plan_templates;
```

---

### Step 2: Deploy Backend to AWS Lambda (10 minutes)

```bash
cd backend/lambda

# Install dependencies (if needed)
npm install

# Build TypeScript
npm run build

# Deploy to AWS
serverless deploy --stage dev  # or staging/prod
```

**Verify deployment:**
```bash
# Test endpoints (replace with your API Gateway URL)
curl https://your-api-url/config/ui/dashboard?roleId=veterinarian
curl https://your-api-url/crm/plans/templates?planType=wellness
```

**Check CloudWatch logs if issues:**
```bash
aws logs tail /aws/lambda/warmpawz-api-dev-api --follow
```

---

### Step 3: Deploy Frontend (5 minutes)

```bash
cd apps/admin-web

# Install dependencies (if needed)
npm install

# Build Next.js app
npm run build

# Deploy to your platform
# Vercel: vercel --prod
# Netlify: netlify deploy --prod
# Or your platform's deployment command
```

---

### Step 4: Test the Feature (10 minutes)

1. **Open Admin Web**
   - Navigate to your admin web URL
   - Login as admin

2. **Test Marketing Dashboard UI**
   - Go to Marketing & Promotions
   - Click "Dashboard UI" tab
   - Verify "Complete Plan" button appears in the list
   - Toggle it on/off to test

3. **Test Support/CRM Integration**
   - Go to Support & CRM
   - Open any support ticket
   - Verify "Complete Plan" button appears in ticket actions
   - Click the button - modal should open

4. **Test Plan Generation**
   - In the modal, select a pet
   - Choose plan type: "Wellness"
   - Select generation method: "AI Generated"
   - Add context (optional)
   - Click "Generate Plan"
   - Verify success notification appears

5. **Verify Database**
   ```sql
   -- Check plan was created
   SELECT * FROM pet_care_plans ORDER BY created_at DESC LIMIT 1;
   
   -- Check plan items were created
   SELECT * FROM care_plan_items WHERE plan_id = 'PLAN_ID';
   ```

---

## ✅ Success Checklist

After deployment, verify:

- [ ] Database migration completed successfully
- [ ] Tables created: `pet_care_plans`, `care_plan_items`, `care_plan_templates`
- [ ] 3 default templates seeded
- [ ] Backend deployed without errors
- [ ] Endpoints respond correctly
- [ ] Frontend builds successfully
- [ ] "Complete Plan" button visible in Marketing > Dashboard UI
- [ ] "Complete Plan" button visible in Support/CRM tickets
- [ ] Modal opens correctly
- [ ] Plan generation works (AI/Template/Manual)
- [ ] Plan saved to database
- [ ] No console errors
- [ ] No CloudWatch errors

---

## 🐛 Troubleshooting

### Database Migration Issues
- **Can't connect to RDS:** Check security group allows your IP
- **Permission denied:** Verify database user has CREATE TABLE permissions
- **Migration fails:** Check CloudWatch logs, verify SQL syntax

### Backend Deployment Issues
- **Build fails:** Check TypeScript errors, verify all imports
- **Deployment fails:** Check AWS credentials, verify serverless.yml syntax
- **Endpoints 404:** Verify endpoints registered in handler/index.ts

### Frontend Issues
- **Build fails:** Check for TypeScript errors, verify dependencies
- **Button doesn't appear:** Check Dashboard UI config, verify button enabled
- **Modal doesn't open:** Check browser console for errors

### Plan Generation Issues
- **AI fails:** Check Bedrock permissions, verify Bedrock enabled in platform settings
- **Templates don't load:** Verify migration ran, check database connection
- **Plan not saved:** Check database permissions, verify foreign keys

---

## 📊 Post-Deployment Monitoring

Monitor these metrics:

1. **CloudWatch Logs**
   - Check for errors in Lambda logs
   - Monitor API Gateway logs
   - Track plan generation success rate

2. **Database Performance**
   - Monitor query performance
   - Check for slow queries
   - Monitor connection pool usage

3. **Feature Usage**
   - Track plan generation requests
   - Monitor AI vs Template usage
   - Track plan completion rates

---

## 🎉 You're All Set!

Once all steps are complete:

1. ✅ Feature is live and ready to use
2. ✅ Support team can start using Complete Plan
3. ✅ Plans will be generated and stored in RDS
4. ✅ Feature is integrated with Support/CRM workflow

**Estimated Total Time:** 30-45 minutes

**Need Help?** Check the detailed guides:
- `COMPLETE_PLAN_DEPLOYMENT_GUIDE.md` - Full deployment guide
- `COMPLETE_PLAN_QUICK_START.md` - Quick reference
- `COMPLETE_PLAN_NEXT_STEPS.md` - Detailed next steps
