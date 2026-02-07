# Migration and Middleware - Ready for Testing

**Date:** January 2026  
**Status:** ✅ All Files Created and Verified

---

## ✅ VERIFICATION RESULTS

### **Migration Files:**
- ✅ **Migration 050:** 621 lines, 41,545 bytes
  - Contains `update_role_form_schema` function
  - Contains **20 role updates** (all roles covered)
  - Syntax verified

- ✅ **Migration 051:** 239 lines, 6,268 bytes
  - Contains `insert_role_permissions` function
  - Contains **20 role permission inserts** (all roles covered)
  - Syntax verified

### **Middleware:**
- ✅ **Middleware File:** `apps/vendor-web/middleware.ts` exists
  - Implements route guards
  - Uses `route-map.ts` configuration
  - No linter errors

---

## 📋 FILES CREATED

### **Migrations:**
1. ✅ `db/migrations/050_complete_role_form_schemas.sql`
2. ✅ `db/migrations/051_seed_role_permissions.sql`
3. ✅ `scripts/test-migrations-verification.sql` - Verification queries
4. ✅ `scripts/setup-test-vendor-identities.sql` - Test data setup

### **Middleware:**
1. ✅ `apps/vendor-web/middleware.ts` - Next.js middleware
2. ✅ `apps/vendor-web/__tests__/middleware.test.ts` - Unit tests
3. ✅ `scripts/test-middleware-manually.sh` - Manual test script

### **Documentation:**
1. ✅ `MIGRATION_RUN_GUIDE.md` - Migration instructions
2. ✅ `MIDDLEWARE_ANALYSIS_AND_IMPLEMENTATION.md` - Analysis
3. ✅ `MIGRATION_AND_MIDDLEWARE_TEST_RESULTS.md` - Test guide

---

## 🚀 HOW TO RUN (When Database is Available)

### **Step 1: Start Database**

**Option A: Docker Compose**
```bash
cd /Users/ketan/Documents/warmpawzecodev
docker-compose up -d postgres
sleep 5  # Wait for database to be ready
```

**Option B: Local PostgreSQL**
```bash
# Ensure PostgreSQL is running
pg_ctl status  # or check with your system
```

**Option C: RDS Connection**
```bash
# Set RDS connection string
export DATABASE_URL="postgresql://user:pass@host:5432/database"
```

### **Step 2: Run Migrations**

```bash
cd /Users/ketan/Documents/warmpawzecodev/db

# Set database URL (if not using .env)
export DATABASE_URL="postgresql://warmpawz:warmpawz@localhost:5432/warmpawz"

# Run Migration 050
echo "Running Migration 050: Complete Form Schemas..."
node run-migration.js migrations/050_complete_role_form_schemas.sql

# Run Migration 051
echo "Running Migration 051: Role Permissions..."
node run-migration.js migrations/051_seed_role_permissions.sql
```

### **Step 3: Verify Migrations**

```bash
# Using psql
psql -h localhost -U warmpawz -d warmpawz -f ../scripts/test-migrations-verification.sql

# Or using node
cd /Users/ketan/Documents/warmpawzecodev/db
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://warmpawz:warmpawz@localhost:5432/warmpawz' });
pool.query(\`
  SELECT 
    COUNT(*) FILTER (WHERE config->'onboardingFields'->'fields' IS NOT NULL 
                     AND jsonb_array_length(config->'onboardingFields'->'fields') > 0) as roles_with_schemas,
    COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = roles.id)) as roles_with_permissions,
    COUNT(*) as total_active_roles
  FROM roles
  WHERE is_active = true
\`).then(r => {
  const result = r.rows[0];
  console.log('✅ Verification Results:');
  console.log('   Roles with schemas:', result.roles_with_schemas, '/', result.total_active_roles);
  console.log('   Roles with permissions:', result.roles_with_permissions, '/', result.total_active_roles);
  if (result.roles_with_schemas === 20 && result.roles_with_permissions === 20) {
    console.log('✅ All migrations successful!');
    process.exit(0);
  } else {
    console.log('⚠️  Some roles missing schemas or permissions');
    process.exit(1);
  }
}).catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
}).finally(() => pool.end());
"
```

### **Step 4: Setup Test Data for Middleware**

```bash
cd /Users/ketan/Documents/warmpawzecodev
psql -h localhost -U warmpawz -d warmpawz -f scripts/setup-test-vendor-identities.sql
```

### **Step 5: Test Middleware**

**Option A: Unit Tests**
```bash
cd apps/vendor-web
npm test -- middleware.test.ts
```

**Option B: Manual Testing**
```bash
# Terminal 1: Start Next.js dev server
cd apps/vendor-web
npm run dev

# Terminal 2: Run test script
cd /Users/ketan/Documents/warmpawzecodev
./scripts/test-middleware-manually.sh
```

**Option C: Browser Testing**
1. Start dev server: `cd apps/vendor-web && npm run dev`
2. Open browser to `http://localhost:3002`
3. Open DevTools → Application → Cookies
4. Set cookie: `vendor_phone=+911111111111`
5. Navigate to different routes and verify redirects

---

## 🧪 TEST SCENARIOS

### **Middleware Test Matrix:**

| Test Case | Phone Cookie | Route | Expected Status | Expected Redirect |
|-----------|--------------|-------|-----------------|-------------------|
| 1 | None | `/dashboard` | 307 | `/auth?redirect=/dashboard` |
| 2 | `+911111111111` (INIT) | `/dashboard` | 307 | `/onboarding/role-selection` |
| 3 | `+911111111111` (INIT) | `/onboarding/role-selection` | 200 | - |
| 4 | `+911111111112` (ROLE_PENDING) | `/onboarding/vendor-type` | 200 | - |
| 5 | `+911111111113` (FORM_PENDING) | `/onboarding/form` | 200 | - |
| 6 | `+911111111114` (UNDER_REVIEW) | `/onboarding/pending-review` | 200 | - |
| 7 | `+911111111115` (CLARIFICATION_REQUIRED) | `/onboarding/clarification` | 200 | - |
| 8 | `+911111111116` (APPROVED) | `/onboarding/approved` | 200 | - |
| 9 | `+911111111117` (ACTIVATED) | `/dashboard` | 200 | - |
| 10 | `+911111111117` (ACTIVATED) | `/onboarding/role-selection` | 307 | `/dashboard` |

---

## 📊 EXPECTED RESULTS

### **After Running Migrations:**
```sql
-- Should return 20 for all counts
SELECT 
  COUNT(*) as total_roles,
  COUNT(*) FILTER (WHERE config->'onboardingFields'->'fields' IS NOT NULL 
                   AND jsonb_array_length(config->'onboardingFields'->'fields') > 0) as roles_with_schemas,
  (SELECT COUNT(DISTINCT role_id) FROM role_permissions) as roles_with_permissions
FROM roles
WHERE is_active = true;
```

**Expected Output:**
- `total_roles`: 20
- `roles_with_schemas`: 20
- `roles_with_permissions`: 20

### **After Testing Middleware:**
- ✅ All public routes accessible
- ✅ All protected routes redirect when unauthenticated
- ✅ Status-based routing works for all 8 statuses
- ✅ Query parameters preserved
- ✅ Graceful degradation on API errors

---

## ⚠️ CURRENT STATUS

### **✅ Completed:**
- Migration files created and verified
- Middleware implemented
- Test files created
- Documentation complete

### **⏳ Pending (Requires Database):**
- Running migrations 050 and 051
- Verifying migration results
- Setting up test vendor identities
- Running middleware tests

---

## 🔧 TROUBLESHOOTING

### **If Database Connection Fails:**
1. Check if PostgreSQL is running: `pg_isready` or `docker ps`
2. Verify DATABASE_URL is correct
3. Check firewall/security group settings (for RDS)
4. Verify database credentials

### **If Migrations Fail:**
1. Check if previous migrations (047, 049) have run
2. Verify roles table exists: `SELECT COUNT(*) FROM roles;`
3. Check for syntax errors in migration files
4. Review error messages in migration output

### **If Middleware Doesn't Work:**
1. Check Next.js version (requires 13+)
2. Verify middleware.ts is in correct location (`apps/vendor-web/`)
3. Check browser console for errors
4. Verify API_BASE_URL is set correctly
5. Check if phone cookie is being set correctly

---

## ✅ SUMMARY

**All files are ready and verified:**
- ✅ 2 migration files (050, 051) - 20 roles each
- ✅ 1 middleware file - Complete route guards
- ✅ 3 test files - Unit tests, manual tests, test data
- ✅ 3 documentation files - Guides and analysis

**Next Steps:**
1. Start database (Docker Compose or local PostgreSQL)
2. Run migrations 050 and 051
3. Verify migrations with SQL queries
4. Setup test data
5. Test middleware with different statuses

**Everything is ready to test once the database is available!** 🚀

