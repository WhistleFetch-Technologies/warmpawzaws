# Manual Database Migrations

## 🔄 Change Summary

**Database migrations have been decoupled from the CI/CD pipeline.**

### Why?

After multiple attempts, database migrations in CI/CD were failing due to authentication issues that are difficult to diagnose in the GitHub Actions environment. To unblock deployments, migrations are now run manually after infrastructure deployment completes.

### What Changed?

1. **CI/CD Workflow (`github/workflows/dev.yml`):**
   - `database-migrations` job: **DISABLED** (`if: false`)
   - `seed-data` job: **DISABLED** (`if: false`)
   - Both jobs remain in the workflow for future re-enablement

2. **Manual Migration Script:**
   - New script: `scripts/manual-migrate.sh`
   - Run manually after deployment completes
   - Handles all credential retrieval and connectivity

---

## 📋 New Deployment Process

### 1. Trigger Deployment

```bash
git push origin develop
```

**CI/CD will complete:**
- ✅ Build frontend apps
- ✅ Build backend Lambda
- ✅ Build Android apps
- ✅ Terraform apply (infrastructure)
- ✅ Deploy frontends to S3/CloudFront
- ⏭️  **SKIP** database migrations
- ⏭️  **SKIP** seed data

---

### 2. Run Migrations Manually

**After deployment completes**, run:

```bash
./scripts/manual-migrate.sh dev
```

**For other environments:**

```bash
./scripts/manual-migrate.sh stage
./scripts/manual-migrate.sh prod
```

---

## 🔧 Manual Migration Script

### Prerequisites

- AWS CLI configured with valid credentials
- Node.js installed
- Terraform installed
- Network access to RDS (public or VPN)

### What It Does

1. ✅ Retrieves database credentials from Terraform outputs
2. ✅ Fetches secrets from AWS Secrets Manager
3. ✅ Constructs DATABASE_URL with proper encoding
4. ✅ Tests database connectivity (TCP + PostgreSQL)
5. ✅ Installs dependencies (`npm ci`)
6. ✅ Runs all migrations (`node run-migration-all.js`)

### Output Example

```
=================================================================
🗄️  Manual Database Migration Runner
=================================================================

Environment: dev
Project Root: /Users/ketan/Documents/warmpawzecodev

Step 1: Retrieving database credentials...
✅ Terraform outputs retrieved
   Endpoint: warmpawz-dev-cluster.cluster-xxx.ap-south-1.rds.amazonaws.com
   Database: warmpawz
   Port: 5432
   Region: ap-south-1

Step 2: Fetching credentials from Secrets Manager...
✅ Credentials retrieved
   Username: warmpawz_admin

Step 3: Constructing DATABASE_URL...
✅ DATABASE_URL constructed
   Format: postgresql://warmpawz_admin:***@...
   SSL: Handled automatically by migration script

Step 4: Testing database connectivity...
✅ TCP connection successful

Step 5: Installing dependencies...
✅ Dependencies installed

Step 6: Running database migrations...

🚀 Migration Runner - Running All Migrations
============================================================
🔌 Database: postgresql://***:***@...
📁 Found 102 migration files

🔗 Connecting to database...
✅ Connected successfully

⚙️  Running: 001_initial_schema.sql
   ✅ Success
...

=================================================================
✅ Database migrations completed successfully!
=================================================================

Next steps:
  1. Verify migrations: cd db && npm run migrate:status
  2. Seed data: cd db && npm run seed:dev
  3. Test API: curl https://dev.api.warmpawz.com/health
```

---

## 🛠️ Troubleshooting

### Cannot Connect to RDS

**Error:**
```
❌ ERROR: Cannot connect to warmpawz-dev-cluster:5432
```

**Solution (Dev Only):**
```bash
./scripts/enable-rds-public-access-dev.sh
```

This script:
- Enables RDS public accessibility
- Configures security group for external access
- Adds Internet Gateway route if missing

---

### Authentication Failed

**Error:**
```
PostgreSQL authentication failed
```

**Causes:**
1. Password mismatch between RDS and Secrets Manager
2. Database user doesn't exist
3. SSL configuration issue

**Solution:**

1. **Check secret:**
   ```bash
   aws secretsmanager get-secret-value \
     --secret-id $(cd infra/envs/dev && terraform output -raw rds_secret_arn) \
     --query SecretString \
     --output text | python3 -c "import sys,json; d=json.load(sys.stdin); print({k: '***' if k=='password' else v for k,v in d.items()})"
   ```

2. **Reset RDS password to match secret:**
   ```bash
   SECRET_ARN=$(cd infra/envs/dev && terraform output -raw rds_secret_arn)
   PASSWORD=$(aws secretsmanager get-secret-value --secret-id $SECRET_ARN --query SecretString --output text | python3 -c "import sys,json; print(json.load(sys.stdin)['password'])")
   
   aws rds modify-db-cluster \
     --db-cluster-identifier warmpawz-dev-cluster \
     --master-user-password "$PASSWORD" \
     --apply-immediately \
     --region ap-south-1
   ```

3. **Wait for password reset** (1-2 minutes):
   ```bash
   aws rds describe-db-clusters \
     --db-cluster-identifier warmpawz-dev-cluster \
     --query 'DBClusters[0].Status' \
     --region ap-south-1
   ```

4. **Retry migrations:**
   ```bash
   ./scripts/manual-migrate.sh dev
   ```

---

## 🔄 Re-enabling Automated Migrations

Once authentication issues are resolved, re-enable migrations in CI/CD:

1. Edit `.github/workflows/dev.yml`
2. Remove `if: false` from:
   - `database-migrations` job
   - `seed-data` job
3. Update `seed-data.needs` back to `database-migrations`
4. Update `smoke-tests.needs` to include `seed-data`
5. Commit and test

---

## 📊 Status

| Component | Status | Notes |
|-----------|--------|-------|
| Infrastructure Deployment | ✅ Automated | Via CI/CD |
| Database Migrations | ⚠️  Manual | Run `scripts/manual-migrate.sh` |
| Data Seeding | ⚠️  Manual | Run `npm run seed:dev` |
| Smoke Tests | ✅ Automated | Frontend + API health checks |

---

## 📞 Support

If migrations continue to fail:
1. Check RDS status in AWS Console
2. Verify Secrets Manager contains valid credentials
3. Test connectivity from your local machine
4. Review migration script logs for specific errors

**For authentication issues, see troubleshooting section above.**

