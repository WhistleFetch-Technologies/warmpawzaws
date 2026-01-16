# Complete Plan Feature - Deployment Guide

## Prerequisites

- ✅ Database migration script created (`059_create_care_plans_tables.sql`)
- ✅ Backend endpoints implemented
- ✅ Frontend components created
- ✅ Handler registration complete

## Step 1: Database Migration

### Run the migration:

**AWS RDS PostgreSQL Connection:**

```bash
# Option 1: Direct RDS connection
psql -h YOUR_RDS_ENDPOINT.rds.amazonaws.com \
     -U your_db_user \
     -d your_database \
     -f db/migrations/059_create_care_plans_tables.sql

# Option 2: Using SSM parameters (from serverless.yml)
DB_HOST=$(aws ssm get-parameter --name /warmpawz/dev/db/host --query Parameter.Value --output text)
DB_PORT=$(aws ssm get-parameter --name /warmpawz/dev/db/port --query Parameter.Value --output text)
DB_NAME=$(aws ssm get-parameter --name /warmpawz/dev/db/name --query Parameter.Value --output text)
DB_USER=$(aws ssm get-parameter --name /warmpawz/dev/db/user --query Parameter.Value --output text)
DB_PASSWORD=$(aws ssm get-parameter --name /warmpawz/dev/db/password --with-decryption --query Parameter.Value --output text)

PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
     -f db/migrations/059_create_care_plans_tables.sql

# Option 3: AWS RDS Query Editor
# - Go to AWS Console > RDS > Query Editor
# - Connect to your database
# - Copy/paste SQL from migration file and execute

# Option 4: Database Management Tool
# - Use pgAdmin, DBeaver, or similar
# - Connect to RDS endpoint
# - Run migration SQL
```

### Verify tables created:
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('pet_care_plans', 'care_plan_items', 'care_plan_templates');

-- Check templates seeded
SELECT COUNT(*) FROM care_plan_templates;
-- Should return 3
```

## Step 2: Backend Deployment

### Verify handler registration:
The endpoints are already registered in `backend/lambda/src/handler/index.ts`:
- ✅ `registerUIDashboardConfigEndpoints(app)`
- ✅ `registerCarePlansEndpoints(app)`

### Deploy Lambda:
```bash
cd backend/lambda
npm install  # If needed
serverless deploy
```

### Verify endpoints:
After deployment, test the endpoints:

```bash
# Test UI Dashboard Config
curl -X GET "https://your-api-gateway-url/config/ui/dashboard?roleId=veterinarian"

# Test Plan Templates
curl -X GET "https://your-api-gateway-url/crm/plans/templates?planType=wellness"

# Test Plan Generation (with auth)
curl -X POST "https://your-api-gateway-url/crm/plans/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "customerId": "test-customer-id",
    "petId": "test-pet-id",
    "planType": "wellness",
    "generationMethod": "ai"
  }'
```

## Step 3: Frontend Deployment

### Build admin web:
```bash
cd apps/admin-web
npm install  # If needed
npm run build
```

### Deploy:
Deploy to your hosting platform (Vercel, Netlify, etc.)

## Step 4: Testing Checklist

### Backend Tests:

1. **UI Dashboard Config**
   - [ ] GET `/config/ui/dashboard?roleId=veterinarian` returns buttons
   - [ ] "Complete Plan" button is in the response
   - [ ] PUT `/config/ui/dashboard` saves configuration

2. **Plan Templates**
   - [ ] GET `/crm/plans/templates` returns templates
   - [ ] Filter by planType works
   - [ ] Filter by petType works

3. **Plan Generation**
   - [ ] AI generation works (requires valid customer/pet IDs)
   - [ ] Template generation works
   - [ ] Manual generation creates empty plan
   - [ ] Plan is linked to ticket (if ticketId provided)

4. **Plan Management**
   - [ ] GET `/crm/plans/:planId` returns plan with items
   - [ ] PUT `/crm/plans/:planId` updates plan
   - [ ] POST `/crm/plans/:planId/items/:itemId/complete` marks item complete

### Frontend Tests:

1. **Support/CRM Page**
   - [ ] "Complete Plan" button appears in ticket actions
   - [ ] Button opens modal when clicked
   - [ ] Modal displays correctly

2. **Complete Plan Modal**
   - [ ] Pet selection dropdown loads pets
   - [ ] Plan type selector works
   - [ ] Generation method selector works
   - [ ] Template dropdown loads templates (when method = template)
   - [ ] Context textarea accepts input
   - [ ] Generate button creates plan
   - [ ] Success notification appears
   - [ ] Error handling works

3. **Marketing Dashboard UI**
   - [ ] "Complete Plan" button appears in Dashboard UI tab
   - [ ] Button can be enabled/disabled
   - [ ] Launch phase can be changed
   - [ ] Rollout percentage can be set
   - [ ] Changes save correctly

## Step 5: Integration Testing

### End-to-End Flow:

1. **Open Support Ticket**
   - Navigate to Support/CRM
   - Open any ticket

2. **Generate Plan**
   - Click "Complete Plan" button
   - Select pet (if multiple)
   - Choose plan type: "Wellness"
   - Select generation method: "AI Generated"
   - Add context: "Pet needs regular checkups"
   - Click "Generate Plan"

3. **Verify Plan Created**
   - Check success notification
   - Verify plan in database:
     ```sql
     SELECT * FROM pet_care_plans ORDER BY created_at DESC LIMIT 1;
     ```
   - Verify plan items created:
     ```sql
     SELECT * FROM care_plan_items WHERE plan_id = 'PLAN_ID';
     ```

4. **Test Template Generation**
   - Click "Complete Plan" again
   - Select generation method: "Use Template"
   - Choose a template
   - Generate plan
   - Verify template items are used

## Troubleshooting

### Issue: Endpoints return 404
**Solution:** Verify endpoints are registered in `handler/index.ts` and serverless.yml routes are correct

### Issue: AI generation fails
**Solution:** 
- Check AWS Bedrock credentials
- Verify Bedrock model access
- Check CloudWatch logs for errors

### Issue: Database errors
**Solution:**
- Verify migration ran successfully
- Check table permissions
- Verify foreign key constraints

### Issue: Modal doesn't open
**Solution:**
- Check browser console for errors
- Verify component import path
- Check if modal state is managed correctly

### Issue: Templates not loading
**Solution:**
- Verify templates seeded in database
- Check template endpoint response
- Verify planType filter matches

## Post-Deployment

### Monitor:
- CloudWatch logs for errors
- API Gateway metrics
- Database query performance
- Plan generation success rate

### Optimize:
- Add caching for templates
- Optimize AI prompt for better results
- Add plan completion analytics

## Rollback Plan

If issues occur:

1. **Disable Feature:**
   - Set "Complete Plan" button to `enabled: false` in Dashboard UI config
   - Or remove button from UI temporarily

2. **Database Rollback:**
   ```sql
   -- Drop tables (if needed)
   DROP TABLE IF EXISTS care_plan_items CASCADE;
   DROP TABLE IF EXISTS pet_care_plans CASCADE;
   DROP TABLE IF EXISTS care_plan_templates CASCADE;
   ```

3. **Code Rollback:**
   - Revert handler/index.ts changes
   - Remove endpoint files
   - Revert frontend changes

## Success Criteria

✅ Database migration runs without errors
✅ All endpoints respond correctly
✅ AI plan generation works
✅ Templates load and work
✅ Modal opens and functions correctly
✅ Plans are created and linked to tickets
✅ No console errors in browser
✅ No errors in CloudWatch logs

## Next Steps After Deployment

1. **User Training:**
   - Document how to use Complete Plan feature
   - Create video tutorial
   - Train support team

2. **Analytics:**
   - Track plan generation rate
   - Monitor AI success rate
   - Track plan completion rates

3. **Enhancements:**
   - Add plan view/edit UI
   - Add customer-facing plan view
   - Add plan reminders/notifications
