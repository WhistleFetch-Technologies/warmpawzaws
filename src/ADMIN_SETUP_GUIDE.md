# 🔐 ADMIN PANEL - SETUP & ACCESS GUIDE

## ✅ QUICK START - Create Admin Account

### Option 1: Create New Admin Account (Recommended)

1. **Open Platform Admin App**
2. **Click "Create new admin account"**
3. **Fill in the form:**
   - **Full Name:** `Admin User` (or your name)
   - **Master Key:** `warmpawz2025`
   - **Email:** `admin@warmpawz.com` (or any email)
   - **Password:** `warmpawz2025` (or your password)
4. **Click "Create Admin Account"**
5. **You'll be automatically signed in!**

### Option 2: Sign In with Existing Admin Account

1. **Open Platform Admin App**
2. **Enter your admin credentials:**
   - **Email:** Your admin email
   - **Password:** Your admin password
3. **Click "Sign In"**

---

## 🔧 How Admin Authentication Works

### Backend Implementation

**Admin Signup Endpoint:** `/auth/admin/signup`
```typescript
// Creates admin with master key verification
POST /make-server-3dd53475/auth/admin/signup
{
  "email": "admin@warmpawz.com",
  "password": "warmpawz2025",
  "name": "Admin User",
  "masterKey": "warmpawz2025"  // Required!
}

// Response:
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "admin@warmpawz.com",
    "user_metadata": {
      "role": "admin",  // ✅ Critical field
      "name": "Admin User"
    }
  }
}
```

**Admin Profile Storage:**
```typescript
// Stored in KV store at: admin:{userId}
{
  "id": "user-uuid",
  "email": "admin@warmpawz.com",
  "name": "Admin User",
  "role": "admin",
  "permissions": ["all"],
  "created_at": "2024-11-14T10:00:00.000Z"
}
```

**Admin Check Endpoint:** `/auth/check-admin/:userId`
```typescript
// Verifies admin status from KV store
GET /make-server-3dd53475/auth/check-admin/{userId}

// Response:
{
  "isAdmin": true,
  "adminProfile": { ... }
}
```

### Frontend Authentication Flow

1. **Sign In** → Calls Supabase `signInWithPassword`
2. **Check Metadata** → Verifies `user_metadata.role === 'admin'`
3. **Check KV Store** → Calls `/auth/check-admin/:userId`
4. **Grant Access** → If either check passes, admin is authenticated

---

## 🐛 Troubleshooting

### Error: "Admin access required. Please use an admin account."

**Cause:** You're trying to sign in with a non-admin account (customer or vendor account)

**Solution:**
1. **Click "Create new admin account"**
2. **Use master key:** `warmpawz2025`
3. **Create a dedicated admin email** (not a customer/vendor email)

### Error: "Invalid master key"

**Cause:** Wrong master key entered during signup

**Solution:**
- Default master key is: `warmpawz2025`
- Master key is stored in KV at: `system:master_key`

### Admin account created but can't sign in

**Cause:** User metadata might not have saved properly

**Solution:**
1. Check console logs for `User metadata:` output
2. Verify admin profile exists in KV store
3. Try creating a new admin with a different email

---

## 🔑 Master Key Management

**Default Master Key:** `warmpawz2025`

**Where it's stored:** `system:master_key` in KV store

**How to change it:**
```typescript
// Update in database
await kv.set('system:master_key', 'YOUR_NEW_KEY');
```

**Security Note:** 
- Master key should be kept secret in production
- Only share with authorized platform administrators
- Change default key before production deployment

---

## ✅ Testing Admin Access

### Test 1: Create Admin Account
```
1. Click "Create new admin account"
2. Enter: admin@test.com / testpass123 / warmpawz2025
3. Should redirect to Admin Dashboard
```

### Test 2: Verify Admin Profile
```
Console should show:
✅ Sign in successful, checking admin status...
✅ User metadata: { role: 'admin', name: 'Admin User' }
✅ Admin check results: { isAdminFromMetadata: true, isAdminFromKV: true }
```

### Test 3: Access Admin Features
```
1. Should see: Vendor Management, Analytics, Settings tabs
2. Can view pending applications
3. Can approve/reject vendors
4. Can seed test data
```

---

## 📊 Admin Panel Features

Once authenticated, you have access to:

### 🏢 Vendor Management
- **Pending Applications** - Review new vendor submissions
- **Active Vendors** - Manage approved vendors
- **Rejected Vendors** - View rejected applications
- **Approval Workflow** - Approve/reject with notes

### 📈 Analytics
- Platform metrics
- Revenue tracking
- Vendor performance

### ⚙️ Settings
- Platform configuration
- Master key management
- System settings

### 🌱 Dev Tools
- **Reset & Seed Vendors** - Create test data
- **Clear All Vendors** - Reset database
- Database inspection tools

---

## 🚀 Production Deployment Checklist

Before deploying to production:

- [ ] Change master key from `warmpawz2025` to secure key
- [ ] Create production admin accounts
- [ ] Remove test credentials from UI
- [ ] Enable email confirmation for admin signups
- [ ] Add 2FA for admin accounts (future)
- [ ] Set up admin activity logging
- [ ] Configure admin password requirements
- [ ] Add admin session timeout

---

**Status:** ✅ WORKING
**Last Updated:** November 14, 2024
**Default Credentials:** See "Quick Test Access" box in UI
