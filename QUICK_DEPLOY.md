# 🚀 Quick Deployment Guide

## ✅ Pre-Deployment Checklist

- [x] Migration 020 applied (shopping_carts, customer_addresses, wishlists)
- [x] All SQL-only endpoints created
- [x] Booking repository field mapping fixed
- [x] Zero KV store usage confirmed
- [x] All code changes committed

## 🎯 Deployment Method: Supabase Dashboard (Recommended)

### Step 1: Access Dashboard
Visit: **https://supabase.com/dashboard/project/vpvpbdwtyugbknrntkho**

### Step 2: Navigate to Edge Functions
1. Click **Edge Functions** in the left sidebar
2. Find `make-server-3dd53475` in the list

### Step 3: Deploy
1. Click on the function name
2. Click **Deploy** or **Redeploy** button
3. Wait for deployment to complete (usually 1-2 minutes)

### Step 4: Verify
1. Check function logs for any errors
2. Test health endpoint: `GET https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/health`
3. Should return: `{"status": "ok", "timestamp": "..."}`

## 🔄 Alternative: Supabase CLI

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login
supabase login

# Link project (if not already linked)
supabase link --project-ref vpvpbdwtyugbknrntkho

# Deploy
supabase functions deploy make-server-3dd53475
```

## 🧪 Post-Deployment Testing

### Health Check
```bash
curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/health
```

### Test SQL-Only Endpoints
```bash
# Loyalty System
curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/loyalty/profile/CUSTOMER_ID

# Ecommerce Cart
curl "https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/ecommerce/cart?customerId=CUSTOMER_ID"
```

## ✅ Success Criteria

- [ ] Function deployed without errors
- [ ] Health endpoint returns 200
- [ ] No KV store errors in logs
- [ ] SQL queries execute successfully
- [ ] All endpoints accessible

## 🆘 Troubleshooting

**If deployment fails:**
- Check function logs in Dashboard
- Verify all dependencies are available
- Ensure database migrations are applied

**If endpoints return errors:**
- Check database tables exist
- Verify foreign key constraints
- Review function logs for details

---

**Status: Ready for Deployment** ✅

