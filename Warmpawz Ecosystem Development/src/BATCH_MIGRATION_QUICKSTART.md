# ⚡ BATCH MIGRATION - QUICK START GUIDE

> **Goal:** Automatically migrate 45+ customer components from Supabase to MockAPI in minutes

---

## 🎯 What You Get

✅ **Automated migration** of common Supabase patterns  
✅ **Automatic backups** of all changed files  
✅ **Dry-run mode** to preview changes safely  
✅ **Complexity analysis** to identify manual review needs  
✅ **Smart pattern matching** for endpoints and API calls  

---

## ⚡ 3-Step Quick Start

### Step 1️⃣: Analyze (30 seconds)

```bash
node scripts/analyze-components.js
```

**What it does:**
- Scans all customer/vendor/admin components
- Identifies which files need migration
- Estimates complexity (low/medium/high)
- Shows migration readiness

**Expected Output:**
```
📊 COMPONENT ANALYSIS REPORT
================================================================================
📁 Total files:           67
✅ Already migrated:      4
🔴 Needs migration:       45
⚪ No migration needed:   18

🎯 COMPLEXITY BREAKDOWN
🔥 High complexity:       8 files (manual review recommended)
⚡ Medium complexity:     15 files (script + review)
✨ Low complexity:        22 files (script can handle)
```

---

### Step 2️⃣: Preview Changes (1 minute)

```bash
node scripts/migrate-to-mock.js --dry-run --customer
```

**What it does:**
- Shows exactly what will change
- Doesn't save any files
- Safe to run multiple times

**Expected Output:**
```
📝 components/customer/AppointmentsList.tsx
   ✓ Remove Supabase imports
   ✓ Remove API_BASE constant
   ✓ Customer bookings → MockAPI
   ✓ Add MockAPI import
   ⚠️  [DRY RUN] Changes not saved
```

---

### Step 3️⃣: Migrate! (2 minutes)

```bash
node scripts/migrate-to-mock.js --customer
```

**What it does:**
- Migrates all customer components
- Creates automatic backups
- Reports success/failures

**Expected Output:**
```
🚀 BATCH MIGRATION STARTED
================================================================================
📂 Files to process: 22
🔧 Mode: LIVE

📝 components/customer/AppointmentsList.tsx
   ✓ Remove Supabase imports
   ✓ Customer bookings → MockAPI
   ✅ Saved (backup: AppointmentsList.tsx.2024-01-10.backup)

...

📊 MIGRATION SUMMARY
✅ Migrated:  18
⏭️  Skipped:   3
❌ Failed:    1
💾 Backups saved to: backups/
```

---

## 🎨 What Gets Migrated

### Before ❌
```typescript
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

const response = await fetch(
  `${API_BASE}/customer/bookings/${phone}`,
  { 
    headers: { 'Authorization': `Bearer ${publicAnonKey}` } 
  }
);

if (response.ok) {
  const data = await response.json();
  setBookings(data.bookings);
}
```

### After ✅
```typescript
import MockAPI from '../../lib/mockAPI';
import { toast } from 'sonner@2.0.3';

const data = await MockAPI.customer.getBookings(phone);
setBookings(data.bookings);
```

---

## 📊 Endpoint Conversion Map

| Old Supabase Endpoint | New MockAPI Call |
|-----------------------|------------------|
| `/customer/bookings/${phone}` | `MockAPI.customer.getBookings(phone)` |
| `/customer/pets/${phone}` | `MockAPI.customer.getPets(phone)` |
| `/bookings/${id}` | `MockAPI.booking.getBooking(id)` |
| `/bookings/${id}/cancel` | `MockAPI.booking.cancelBooking(id)` |
| `/customer/discover-services` | `MockAPI.search.searchVendors({})` |
| `/products` | `MockAPI.ecommerce.getProducts()` |
| `/orders` (POST) | `MockAPI.ecommerce.createOrder({})` |
| `/ai/chat` | `MockAPI.ai.chat({})` |

---

## 🛡️ Safety Features

### 1. Automatic Backups
Every file is backed up before changes:
```
backups/
  AppointmentsList.tsx.2024-01-10T15-30-45.backup
  BookingDetails.tsx.2024-01-10T15-30-46.backup
```

### 2. Dry Run Mode
Test without risk:
```bash
node scripts/migrate-to-mock.js --dry-run
```

### 3. Smart Skip Logic
Already migrated files are automatically skipped.

---

## ⚠️ What Needs Manual Review

After batch migration, review these patterns:

### 1. Complex Request Bodies
```typescript
// Script outputs:
await MockAPI.ecommerce.createOrder({})

// You update to:
await MockAPI.ecommerce.createOrder({
  customer_id: customerId,
  items: cartItems,
  total: totalAmount
})
```

### 2. Advanced Filters
```typescript
// Script outputs:
await MockAPI.search.searchVendors({})

// You update to:
await MockAPI.search.searchVendors({
  role: 'vet',
  rating_min: 4.0
})
```

### 3. Custom Error Handling
Add try/catch where needed for your specific logic.

---

## 🎯 Full Migration Workflow

```bash
# 1. Analyze all components
node scripts/analyze-components.js --verbose

# 2. Preview customer migrations
node scripts/migrate-to-mock.js --dry-run --customer

# 3. Migrate customer app
node scripts/migrate-to-mock.js --customer

# 4. Test build
npm run build

# 5. Fix any TypeScript errors
# Review high-complexity files manually

# 6. Migrate vendor app
node scripts/migrate-to-mock.js --vendor

# 7. Migrate admin app
node scripts/migrate-to-mock.js --admin

# 8. Final build & test
npm run build
npm run dev
```

---

## 📈 Expected Results

### Customer App (45 files)
- ✅ **22 files**: Automatically migrated (low complexity)
- ⚡ **15 files**: Migrated + manual review (medium complexity)
- 🔥 **8 files**: Manual migration recommended (high complexity)

### Vendor App (~30 files)
- Similar distribution expected

### Admin App (~20 files)
- Similar distribution expected

---

## 🚨 Troubleshooting

### Build Errors After Migration?

1. **Check TypeScript errors**
   ```bash
   npm run build
   ```

2. **Common fixes:**
   - Add missing function parameters
   - Update type definitions
   - Fix import paths

3. **Restore from backup if needed:**
   ```bash
   cp backups/ComponentName.tsx.backup components/customer/ComponentName.tsx
   ```

### Script Failed on Some Files?

**Normal!** High-complexity files need manual migration.

**What to do:**
1. Note which files failed
2. Migrate those manually using examples
3. Test each one individually

---

## 📚 Additional Resources

- **Detailed Guide:** `/scripts/MIGRATION_GUIDE.md`
- **Scripts README:** `/scripts/README.md`
- **MockAPI Reference:** `/lib/mockAPI.ts`
- **Mock Data:** `/lib/mockData.ts`

---

## ✅ Post-Migration Checklist

After running batch migration:

- [ ] Run `npm run build` successfully
- [ ] Test authentication flow
- [ ] Test service discovery
- [ ] Test booking creation
- [ ] Test e-commerce flows
- [ ] Review high-complexity files
- [ ] Update phase tracker
- [ ] Delete old backups (after verification)

---

## 💡 Pro Tips

1. **Start with analysis** to understand scope
2. **Always dry-run first** to preview changes
3. **Migrate incrementally** (customer → vendor → admin)
4. **Test after each phase** to catch issues early
5. **Keep backups** until fully verified
6. **Document custom changes** for team knowledge

---

## 🎉 Success Metrics

After successful batch migration:

- ✅ **80%+ automation** (low + medium complexity files)
- ✅ **<20% manual work** (high complexity files)
- ✅ **100% backups** (every changed file)
- ✅ **Clean build** (zero TypeScript errors from automation)
- ✅ **Fast migration** (minutes instead of hours)

---

## 🚀 Ready to Go?

Run this now:

```bash
# See what needs migration
node scripts/analyze-components.js

# Preview changes
node scripts/migrate-to-mock.js --dry-run --customer

# Migrate!
node scripts/migrate-to-mock.js --customer
```

**Estimated time:** 5-10 minutes for batch migration + 1-2 hours for manual review

Good luck! 🎯
