# Complete Plan Feature - Quick Start 🚀

## 3 Steps to Deploy

### 1️⃣ Run RDS Migration (2 minutes)
```bash
./db/migrations/run-migration-rds.sh
```
Enter your stage (dev/staging/prod) when prompted.

**Or manually:**
```bash
psql -h YOUR_RDS_ENDPOINT.rds.amazonaws.com \
     -U your_db_user \
     -d your_database \
     -f db/migrations/059_create_care_plans_tables.sql
```

---

### 2️⃣ Deploy Backend (5 minutes)
```bash
cd backend/lambda
npm run build
serverless deploy --stage dev
```

---

### 3️⃣ Deploy Frontend (5 minutes)
```bash
cd apps/admin-web
npm run build
# Then deploy to your platform (Vercel/Netlify/etc)
```

---

## ✅ Quick Test

1. Open **Support & CRM** in admin web
2. Open any ticket
3. Click **"Complete Plan"** button
4. Generate a plan → Done! 🎉

---

## 🐛 Issues?

- **Migration fails?** Check RDS security group allows your IP
- **Backend fails?** Check CloudWatch logs: `aws logs tail /aws/lambda/warmpawz-api-dev-api`
- **Button missing?** Check Marketing > Dashboard UI tab, enable the button

---

**Total Time: ~15 minutes**
