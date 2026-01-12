# 🚀 Batch Migration Script Guide

This guide explains how to use the automated migration scripts to convert Supabase/backend calls to MockAPI across all components.

---

## 📋 Scripts Overview

### 1. `migrate-to-mock.js` - Automated Batch Migration
Automatically converts common Supabase patterns to MockAPI calls.

### 2. `analyze-components.js` - Component Analysis
Scans and reports which components need migration.

---

## 🔧 Usage

### Quick Start - Migrate All Components

```bash
# DRY RUN (preview changes without saving)
node scripts/migrate-to-mock.js --dry-run

# LIVE (actually migrate files)
node scripts/migrate-to-mock.js
```

### Migrate Specific App

```bash
# Customer components only
node scripts/migrate-to-mock.js --customer

# Vendor components only
node scripts/migrate-to-mock.js --vendor

# Admin components only
node scripts/migrate-to-mock.js --admin
```

### Migrate Single File

```bash
node scripts/migrate-to-mock.js --file components/customer/AppointmentsList.tsx
```

### Analyze Before Migrating

```bash
# See which files need migration
node scripts/analyze-components.js

# See detailed patterns found
node scripts/analyze-components.js --verbose
```

---

## 🔄 What Gets Migrated

### ✅ Automatic Replacements

1. **Import Statements**
   ```typescript
   // BEFORE
   import { projectId, publicAnonKey } from '../../utils/supabase/info';
   
   // AFTER
   import MockAPI from '../../lib/mockAPI';
   import { toast } from 'sonner@2.0.3';
   ```

2. **API Base URLs**
   ```typescript
   // BEFORE
   const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;
   
   // AFTER
   // (removed entirely)
   ```

3. **Common API Calls**
   ```typescript
   // BEFORE
   const response = await fetch(
     `${API_BASE}/customer/bookings/${phone}`,
     { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
   );
   const data = await response.json();
   
   // AFTER
   const data = await MockAPI.customer.getBookings(phone);
   ```

4. **Authorization Headers**
   ```typescript
   // BEFORE
   headers: { 'Authorization': `Bearer ${publicAnonKey}` }
   
   // AFTER
   // (removed - MockAPI doesn't need auth headers)
   ```

### 🎯 Endpoint Mappings

| Backend Endpoint | MockAPI Call |
|-----------------|--------------|
| `/customer/bookings/${phone}` | `MockAPI.customer.getBookings(phone)` |
| `/customer/pets/${phone}` | `MockAPI.customer.getPets(phone)` |
| `/bookings/${id}` | `MockAPI.booking.getBooking(id)` |
| `/bookings/${id}/cancel` | `MockAPI.booking.cancelBooking(id)` |
| `/customer/discover-services` | `MockAPI.search.searchVendors({})` |
| `/products` | `MockAPI.ecommerce.getProducts()` |
| `/orders` (POST) | `MockAPI.ecommerce.createOrder({})` |

---

## ⚠️ Manual Review Needed

Some patterns require manual intervention:

### 1. Complex Request Bodies
```typescript
// Script converts to:
await MockAPI.ecommerce.createOrder({})

// You need to update to:
await MockAPI.ecommerce.createOrder({
  customer_id: customerId,
  items: cartItems,
  total: totalAmount
})
```

### 2. Custom Error Handling
```typescript
// Script removes response.ok checks
// You may need to add custom try/catch

try {
  const data = await MockAPI.customer.getBookings(phone);
  // Handle success
} catch (error) {
  toast.error('Failed to load bookings');
}
```

### 3. State Management
```typescript
// Script doesn't update state logic
// Review and update useState/useEffect as needed
```

---

## 📊 Migration Report

After running the script, you'll see:

```
🚀 BATCH MIGRATION STARTED
================================================================================
📂 Files to process: 45
🔧 Mode: LIVE
================================================================================

📝 components/customer/AppointmentsList.tsx
   ✓ Remove Supabase imports
   ✓ Remove API_BASE constant
   ✓ Customer bookings → MockAPI
   ✓ Add MockAPI import
   ✅ Saved (backup: AppointmentsList.tsx.2024-01-10.backup)

📝 components/customer/BookingDetails.tsx
   ✓ Remove Supabase imports
   ✓ Booking details → MockAPI
   ✓ Cancel booking → MockAPI
   ✓ Add MockAPI import
   ✅ Saved (backup: BookingDetails.tsx.2024-01-10.backup)

...

================================================================================
📊 MIGRATION SUMMARY
================================================================================
✅ Migrated:  38
⏭️  Skipped:   5
❌ Failed:    2
📁 Total:     45

💾 Backups saved to: backups/
================================================================================
```

---

## 🛡️ Safety Features

### 1. Automatic Backups
Every migrated file is backed up to `/backups/` with timestamp.

```
backups/
  AppointmentsList.tsx.2024-01-10T15-30-45.backup
  BookingDetails.tsx.2024-01-10T15-30-46.backup
```

### 2. Dry Run Mode
Test changes without modifying files:
```bash
node scripts/migrate-to-mock.js --dry-run
```

### 3. Skip Already Migrated
Script automatically skips files that already use MockAPI.

---

## 🔍 Troubleshooting

### Script reports "Failed" for some files

**Common causes:**
- File has syntax errors
- Complex nested patterns not recognized
- Custom API implementations

**Solution:** Manually review and migrate these files.

### Changes look incorrect in dry run

**Solution:** 
1. Check the pattern definitions in the script
2. Add custom patterns for your use case
3. Migrate single file first to test

### Build errors after migration

**Common issues:**
1. Missing MockAPI imports → Run script again
2. Incorrect function parameters → Manually update
3. Type mismatches → Update TypeScript interfaces

---

## 🎨 Customization

### Add Custom Patterns

Edit `migrate-to-mock.js` and add to `ENDPOINT_REPLACEMENTS`:

```javascript
{
  from: /your-pattern-regex/g,
  to: 'replacement-text',
  desc: 'Description for report'
}
```

### Disable Backups

Edit `CONFIG` in script:

```javascript
const CONFIG = {
  createBackups: false, // Change to false
  // ...
}
```

---

## 📚 Advanced Examples

### Migrate with custom patterns

```bash
# Create custom script for specific use case
cp scripts/migrate-to-mock.js scripts/migrate-custom.js

# Edit patterns
vim scripts/migrate-custom.js

# Run custom migration
node scripts/migrate-custom.js --customer
```

### Restore from backup

```bash
# Find backup
ls backups/ | grep AppointmentsList

# Restore
cp backups/AppointmentsList.tsx.2024-01-10.backup components/customer/AppointmentsList.tsx
```

---

## ✅ Post-Migration Checklist

After running the script:

1. **Build Check**
   ```bash
   npm run build
   # or
   yarn build
   ```

2. **Fix TypeScript Errors**
   - Review any type mismatches
   - Update function signatures
   - Add missing imports

3. **Test Critical Flows**
   - Authentication
   - Service search
   - Booking creation
   - Cart/checkout

4. **Review Edge Cases**
   - Error handling
   - Loading states
   - Empty states

5. **Update Documentation**
   - Mark components as migrated in tracker
   - Update IMPLEMENTATION_PHASES_TRACKER.md

---

## 🚦 Migration Strategy

### Recommended Order:

1. **Phase 1: Analyze**
   ```bash
   node scripts/analyze-components.js --verbose
   ```

2. **Phase 2: Test with Dry Run**
   ```bash
   node scripts/migrate-to-mock.js --dry-run --customer
   ```

3. **Phase 3: Migrate Customer App**
   ```bash
   node scripts/migrate-to-mock.js --customer
   npm run build
   ```

4. **Phase 4: Migrate Vendor App**
   ```bash
   node scripts/migrate-to-mock.js --vendor
   npm run build
   ```

5. **Phase 5: Migrate Admin App**
   ```bash
   node scripts/migrate-to-mock.js --admin
   npm run build
   ```

6. **Phase 6: Manual Cleanup**
   - Review failed migrations
   - Update complex patterns
   - Test all flows

---

## 💡 Tips

1. **Always run dry-run first** to preview changes
2. **Migrate incrementally** (one app at a time)
3. **Test after each migration** to catch issues early
4. **Keep backups** until you verify everything works
5. **Review complex components manually** for accuracy
6. **Update tracker** as you complete each section

---

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review the backup files
3. Manually inspect the failed files
4. Test with a single file first

---

**Happy Migrating! 🚀**
