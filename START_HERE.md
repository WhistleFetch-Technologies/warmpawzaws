# 🎯 START HERE - Pharmacy UAT Fixes

## ✅ What's Done

All code changes have been applied:
- ✅ Capability mapping fixed
- ✅ Role configuration updated
- ✅ Dashboard filtering implemented
- ✅ Database migration files updated

## ⚡ What You Need to Do

### Step 1: Set Database Connection

```bash
export DATABASE_URL="postgresql://user:password@host:port/database"
```

**Replace with your actual database connection string.**

### Step 2: Run Migrations

```bash
cd db
npm install
npm run migrate:up
```

### Step 3: Test

1. Clear browser cache
2. Login: `9606901516` / `123456`
3. Verify dashboard shows only Pharmacy features

---

## 📋 Quick Reference

**Files Updated:**
- `apps/vendor-web/components/vendor/hooks/useVendorCapabilities.ts`
- `apps/vendor-web/lib/role-config.ts`
- `apps/vendor-web/components/vendor/VendorDashboard.tsx`
- `db/migrations/047_seed_roles.sql`
- `db/migrations/051_seed_role_permissions.sql`

**What Migrations Do:**
- Add 11 capabilities to Pharmacy role
- Configure role permissions correctly

**Expected Result:**
- Pharmacy dashboard shows only relevant features
- Inventory button persists after clicking
- No appointments/consultations visible

---

## 🆘 Need Help?

See detailed guides:
- `COMMANDS_TO_RUN.md` - Exact commands
- `PHARMACY_UAT_NEXT_STEPS.md` - Full guide
- `ACTION_REQUIRED.md` - Quick action items

---

**That's it! Just 2 commands: set DATABASE_URL, then run migrations.** 🚀
