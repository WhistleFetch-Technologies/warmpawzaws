# Database Seeding Guide - AWS CLI

**Date:** 2026-01-28  
**Status:** ✅ **Ready to Execute**

---

## 🔍 Current Status

**From CI/CD Output:**
- ✅ Schema exists (100 tables found)
- ✅ Key tables present: 7/8
- ⚠️  Missing table: `wallets`
- ✅ Foreign keys: 85
- ✅ Indexes: 211

---

## 🚀 Seeding Steps

### **Step 1: Create Missing Wallets Table**

```bash
# Run the script to create wallets table
./scripts/create-wallets-table.sh dev
```

**What it does:**
- Gets RDS credentials from Secrets Manager
- Creates `customer_wallets` table
- Creates `wallet_transactions` table
- Creates necessary indexes

---

### **Step 2: Seed Database Data**

```bash
# Run the seed script
./scripts/seed-database-aws.sh dev
```

**What it seeds:**
- ✅ RBAC roles (from `047_seed_roles.sql`)
- ✅ Service catalog (from `048_seed_service_catalog.sql`)
- ✅ Role permissions (if migration exists)
- ✅ Onboarding role configs (if migration exists)

---

## 📋 Alternative: Manual Seeding

If you prefer to run manually:

```bash
# 1. Get database credentials
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

# 2. Run seed script
cd db
export DATABASE_URL
npm run seed:dev
```

---

## ✅ Verification

After seeding, verify the data:

```bash
# Check roles
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM roles;"

# Check service catalog
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM service_catalog;"

# Check wallets table
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM customer_wallets;"
```

---

## 📝 Scripts Created

1. **`scripts/seed-database-aws.sh`**
   - Gets RDS credentials from AWS Secrets Manager
   - Runs `npm run seed:dev`
   - Handles all credential retrieval automatically

2. **`scripts/create-wallets-table.sh`**
   - Creates missing `wallets` table
   - Creates `wallet_transactions` table
   - Creates necessary indexes

---

## 🚀 Quick Start

```bash
# 1. Create wallets table
./scripts/create-wallets-table.sh dev

# 2. Seed database
./scripts/seed-database-aws.sh dev
```

---

**✅ Ready to seed! Run the scripts above to populate the database.**
