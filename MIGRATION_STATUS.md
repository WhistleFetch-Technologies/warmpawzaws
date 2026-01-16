# 🔄 Migration Status

## Current Status

✅ **Code Changes**: Applied and ready
✅ **Dependencies**: Installed in `db/` directory
⚠️ **Database Connection**: Not configured

## ⚡ Action Required

To run migrations, you need to provide your database connection string.

### Option 1: Set Environment Variable

```bash
export DATABASE_URL="postgresql://user:password@host:port/database"
```

Then run:
```bash
cd db
npm run migrate:up
```

### Option 2: Use Individual Components

The migration script also accepts:
```bash
export DB_HOST="your-db-host"
export DB_PORT="5432"
export DB_NAME="your-database-name"
export DB_USER="your-username"
export DB_PASSWORD="your-password"
```

### Option 3: Supabase

```bash
export SUPABASE_DB_URL="postgresql://postgres:password@db.project.supabase.co:5432/postgres"
```

---

## 📋 What Happens After Connection is Set

Once you set the database connection and run `npm run migrate:up`, it will:

1. ✅ Connect to your database
2. ✅ Run migration 047 (update Pharmacy role capabilities)
3. ✅ Run migration 051 (add Pharmacy role permissions)
4. ✅ Verify all 11 capabilities are configured

---

## 🎯 Next Steps

1. **Set database connection** (one of the options above)
2. **Run migrations**: `cd db && npm run migrate:up`
3. **Verify**: Check console output for success messages
4. **Test**: Clear browser cache and login as Pharmacy vendor

---

**Ready when you provide the database connection!** 🚀
