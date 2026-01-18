# Deploy Now - Exact Commands

## Step 1: Backend Deployment (Run in Terminal)

```bash
cd backend/lambda

# Deploy to AWS (replace 'dev' with your stage)
npx serverless deploy --stage dev

# Or if serverless is installed globally:
serverless deploy --stage dev
```

**Note:** This requires:
- AWS credentials configured (`aws configure` or environment variables)
- SSM parameters set up in AWS Systems Manager
- Proper IAM permissions

---

## Step 2: Database Migration (Run in Terminal)

### Option A: Using the Interactive Script
```bash
./db/migrations/run-migration-rds.sh
# Enter stage when prompted: dev
# Enter password when prompted
```

### Option B: Manual RDS Connection
```bash
# Get RDS details from AWS Console or SSM
DB_HOST=$(aws ssm get-parameter --name /warmpawz/dev/db/host --query Parameter.Value --output text)
DB_PORT=$(aws ssm get-parameter --name /warmpawz/dev/db/port --query Parameter.Value --output text)
DB_NAME=$(aws ssm get-parameter --name /warmpawz/dev/db/name --query Parameter.Value --output text)
DB_USER=$(aws ssm get-parameter --name /warmpawz/dev/db/user --query Parameter.Value --output text)
DB_PASSWORD=$(aws ssm get-parameter --name /warmpawz/dev/db/password --with-decryption --query Parameter.Value --output text)

# Run migration
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
     -f db/migrations/059_create_care_plans_tables.sql
```

### Option C: Direct RDS Connection
```bash
# If you know your RDS endpoint
psql -h YOUR_RDS_ENDPOINT.rds.amazonaws.com \
     -U your_db_user \
     -d your_database \
     -f db/migrations/059_create_care_plans_tables.sql
```

---

## Current Status

✅ **Backend:** Built successfully (ready to deploy)
✅ **Migration Script:** Ready
⏳ **Waiting:** Your AWS credentials and RDS connection

---

## Quick Verification

After deployment, verify:

```bash
# Test backend endpoint
curl https://your-api-url/config/ui/dashboard?roleId=veterinarian

# Verify database tables
psql -h YOUR_RDS_ENDPOINT -U your_user -d your_db -c "SELECT COUNT(*) FROM care_plan_templates;"
# Should return: 3
```

---

**Run these commands in your terminal to complete deployment!**
