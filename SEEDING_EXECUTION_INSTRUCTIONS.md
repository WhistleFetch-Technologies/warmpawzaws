# Database Seeding Execution Instructions

**Date:** 2026-01-28  
**Status:** ✅ **Scripts Ready**

---

## 🎯 Current Status

**From CI/CD:**
- ✅ Schema exists (100 tables)
- ⚠️  Missing table: `wallets`
- ✅ Ready for seeding

---

## 🚀 Execution Steps

### **Step 1: Create Missing Wallets Table**

```bash
# Run from project root
./scripts/create-wallets-table.sh dev
```

**What it does:**
- Gets RDS credentials from AWS Secrets Manager
- Creates `customer_wallets` table
- Creates `wallet_transactions` table
- Creates indexes

**Expected output:**
```
🔧 Creating Wallets Table
============================================================
📝 Using migration file: 012_wallet_tables.sql
📝 Executing SQL...
✅ Wallets table created successfully!
```

---

### **Step 2: Seed Database Data**

```bash
# Run from project root
./scripts/seed-database-aws.sh dev
```

**What it seeds:**
1. ✅ **Roles** (20 roles from `047_seed_roles.sql`)
   - Veterinarian, Vet Clinic, Groomer, Trainer, etc.
   
2. ✅ **Service Catalog** (100+ services from `048_seed_service_catalog.sql`)
   - All service categories and services
   
3. ✅ **Onboarding Role Configs** (from `050_seed_onboarding_role_configs.sql`)
   - Role-specific onboarding configurations
   
4. ✅ **Role Permissions** (from `051_seed_role_permissions.sql`)
   - Capability mappings for each role

**Expected output:**
```
🌱 Database Seeding via AWS CLI
============================================================
Environment: dev
Region: ap-south-1

📊 Getting RDS cluster information...
✅ RDS Cluster found:
   Endpoint: warmpawz-dev-cluster.cluster-xxx.ap-south-1.rds.amazonaws.com
   Port: 5432
   Database: warmpawz

🔐 Getting database credentials from Secrets Manager...
✅ Credentials retrieved

🌱 Running seed script...
⚙️  Seeding roles...
✅ Roles seeded
⚙️  Seeding service catalog...
✅ Service catalog seeded
⚙️  Seeding onboarding role configs...
✅ Onboarding role configs seeded
⚙️  Seeding role permissions...
✅ Role permissions seeded

✅ Development data seeded successfully!
```

---

## ✅ Verification

After seeding, verify the data:

```bash
# Get database URL (same as script does)
RDS_ENDPOINT=$(aws rds describe-db-clusters \
  --db-cluster-identifier warmpawz-dev-cluster \
  --region ap-south-1 \
  --query 'DBClusters[0].Endpoint' \
  --output text)

RDS_SECRET_ARN=$(aws secretsmanager list-secrets \
  --region ap-south-1 \
  --query "SecretList[?starts_with(Name, 'warmpawz-dev-rds-master')].ARN" \
  --output text | head -1)

DB_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "$RDS_SECRET_ARN" \
  --region ap-south-1 \
  --query SecretString \
  --output text)

DB_USERNAME=$(echo "$DB_SECRET" | jq -r '.username')
DB_PASSWORD=$(echo "$DB_SECRET" | jq -r '.password')
DB_PASSWORD_ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$DB_PASSWORD''', safe=''))")

DATABASE_URL="postgresql://${DB_USERNAME}:${DB_PASSWORD_ENCODED}@${RDS_ENDPOINT}:5432/warmpawz"

# Verify seeded data
echo "📊 Verifying seeded data..."
psql "$DATABASE_URL" -c "SELECT COUNT(*) as role_count FROM roles;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) as service_count FROM service_catalog;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) as wallet_count FROM customer_wallets;"
```

**Expected results:**
- Roles: ~20 rows
- Service catalog: ~100+ rows
- Wallets: 0 rows (empty until customers create wallets)

---

## 📋 Quick Command Reference

```bash
# 1. Create wallets table
./scripts/create-wallets-table.sh dev

# 2. Seed database
./scripts/seed-database-aws.sh dev

# 3. Verify (optional)
# Use verification commands above
```

---

## ⚠️ Important Notes

1. **Prerequisites:**
   - AWS CLI configured with credentials
   - `jq` installed (for JSON parsing)
   - `psql` installed (for direct SQL if needed)
   - `python3` installed (for URL encoding)

2. **Idempotency:**
   - Seed scripts use `ON CONFLICT DO NOTHING`
   - Safe to run multiple times
   - Won't duplicate data

3. **Missing Table:**
   - `wallets` table needs to be created first
   - Run `create-wallets-table.sh` before seeding

---

**✅ Ready to execute! Run the scripts in order above.**
