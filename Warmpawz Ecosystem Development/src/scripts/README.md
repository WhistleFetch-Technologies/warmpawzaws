# 🛠️ Warmpawz Migration Scripts

Automated tools to migrate from Supabase backend to MockAPI system.

---

## 📦 Scripts Included

| Script | Purpose | Usage |
|--------|---------|-------|
| `analyze-components.js` | Analyze which files need migration | `node scripts/analyze-components.js` |
| `migrate-to-mock.js` | Batch migrate files to MockAPI | `node scripts/migrate-to-mock.js` |
| `migrate-to-mock.ts` | TypeScript version (reference) | N/A |

---

## 🚀 Quick Start

### Step 1: Analyze Components

See what needs to be migrated:

```bash
node scripts/analyze-components.js
```

**Output:**
```
📊 COMPONENT ANALYSIS REPORT
================================================================================
📁 Total files:           67
✅ Already migrated:      4
🔴 Needs migration:       45
⚪ No migration needed:   18
================================================================================

🎯 COMPLEXITY BREAKDOWN
================================================================================
🔥 High complexity:       8 files (manual review recommended)
⚡ Medium complexity:     15 files (script + review)
✨ Low complexity:        22 files (script can handle)
⚪ No migration:          22 files
================================================================================
```

### Step 2: Dry Run Migration

Preview changes without saving:

```bash
node scripts/migrate-to-mock.js --dry-run --customer
```

### Step 3: Run Actual Migration

Migrate customer components:

```bash
node scripts/migrate-to-mock.js --customer
```

### Step 4: Test Build

```bash
npm run build
# or
yarn build
```

---

## 📖 Detailed Usage

### Analysis Script

```bash
# Basic analysis
node scripts/analyze-components.js

# Verbose (show all patterns found)
node scripts/analyze-components.js --verbose

# Customer components only
node scripts/analyze-components.js --customer

# JSON output (for automation)
node scripts/analyze-components.js --json > analysis.json
```

### Migration Script

```bash
# Dry run (preview only)
node scripts/migrate-to-mock.js --dry-run

# Migrate all components
node scripts/migrate-to-mock.js

# Migrate specific app
node scripts/migrate-to-mock.js --customer
node scripts/migrate-to-mock.js --vendor
node scripts/migrate-to-mock.js --admin

# Migrate single file
node scripts/migrate-to-mock.js --file components/customer/AppointmentsList.tsx
```

---

## ✅ What Gets Migrated

### Automatic Changes

✅ Remove Supabase imports  
✅ Remove API_BASE constants  
✅ Convert fetch() calls to MockAPI  
✅ Remove Authorization headers  
✅ Add MockAPI imports  
✅ Clean up extra whitespace  

### Common Conversions

| Before | After |
|--------|-------|
| `import { projectId, publicAnonKey } from '../../utils/supabase/info'` | `import MockAPI from '../../lib/mockAPI'` |
| `const API_BASE = \`https://\${projectId}.supabase.co/...\`` | _(removed)_ |
| `await fetch(\`\${API_BASE}/customer/pets/\${phone}\`)` | `await MockAPI.customer.getPets(phone)` |
| `headers: { 'Authorization': \`Bearer \${publicAnonKey}\` }` | _(removed)_ |

---

## 🎯 Migration Strategy

### Recommended Approach

1. **Analyze First**
   ```bash
   node scripts/analyze-components.js --verbose
   ```
   - Review complexity breakdown
   - Identify high-complexity files for manual review

2. **Test with Dry Run**
   ```bash
   node scripts/migrate-to-mock.js --dry-run --customer
   ```
   - Verify changes look correct
   - Check for any issues

3. **Migrate Low Complexity First**
   ```bash
   node scripts/migrate-to-mock.js --customer
   ```
   - Start with customer app (most important)
   - Test thoroughly

4. **Build & Test**
   ```bash
   npm run build
   npm run dev
   ```
   - Fix any TypeScript errors
   - Test critical flows

5. **Continue with Other Apps**
   ```bash
   node scripts/migrate-to-mock.js --vendor
   # Test
   node scripts/migrate-to-mock.js --admin
   # Test
   ```

6. **Manual Cleanup**
   - Review high-complexity files
   - Update complex patterns
   - Add proper error handling

---

## 🛡️ Safety Features

### Automatic Backups

Every migrated file is automatically backed up:

```
backups/
  AppointmentsList.tsx.2024-01-10T15-30-45.backup
  BookingDetails.tsx.2024-01-10T15-30-46.backup
  ...
```

To restore a file:
```bash
cp backups/AppointmentsList.tsx.2024-01-10.backup components/customer/AppointmentsList.tsx
```

### Dry Run Mode

Always test first:
```bash
node scripts/migrate-to-mock.js --dry-run
```

### Skip Already Migrated

Script automatically skips files that already use MockAPI.

---

## ⚠️ Manual Review Needed

Some patterns require manual updates after script runs:

### 1. Complex Request Bodies

**Script output:**
```typescript
await MockAPI.ecommerce.createOrder({})
```

**You need to update:**
```typescript
await MockAPI.ecommerce.createOrder({
  customer_id: customerId,
  items: cartItems,
  shipping_address: address,
  total: totalAmount
})
```

### 2. Response Handling

**Script simplifies:**
```typescript
// Before
if (response.ok) {
  const data = await response.json();
  setBookings(data);
} else {
  toast.error('Failed');
}

// After (script removes response.ok check)
const data = await MockAPI.customer.getBookings(phone);
setBookings(data);
```

**You may need to add:**
```typescript
try {
  const data = await MockAPI.customer.getBookings(phone);
  setBookings(data);
} catch (error) {
  toast.error('Failed to load bookings');
}
```

### 3. Complex Filters

**Script output:**
```typescript
await MockAPI.search.searchVendors({})
```

**Update to:**
```typescript
await MockAPI.search.searchVendors({
  role: 'vet',
  rating_min: 4.0,
  location: userLocation
})
```

---

## 🔧 Customization

### Add Custom Patterns

Edit `migrate-to-mock.js`:

```javascript
const ENDPOINT_REPLACEMENTS = [
  // ... existing patterns ...
  
  // Add your custom pattern
  {
    from: /your-custom-pattern/g,
    to: 'replacement',
    desc: 'Description'
  }
];
```

### Disable Backups

Edit CONFIG in script:

```javascript
const CONFIG = {
  createBackups: false, // Set to false
  // ...
}
```

---

## 📊 Example Output

### Analysis Report

```
🔍 WARMPAWZ - COMPONENT MIGRATION ANALYSIS
================================================================================
Scanning 67 files...

📊 COMPONENT ANALYSIS REPORT
================================================================================
📁 Total files:           67
✅ Already migrated:      4
🔴 Needs migration:       45
⚪ No migration needed:   18
================================================================================

🎯 COMPLEXITY BREAKDOWN
================================================================================
🔥 High complexity:       8 files (manual review recommended)
⚡ Medium complexity:     15 files (script + review)
✨ Low complexity:        22 files (script can handle)
⚪ No migration:          22 files
================================================================================

📋 FILES NEEDING MIGRATION
================================================================================
✨ components/customer/AppointmentsList.tsx
   Complexity: LOW (easy)

⚡ components/customer/BookingFlow.tsx
   Complexity: MEDIUM (moderate)

🔥 components/customer/AIAssistantChat.tsx
   Complexity: HIGH (complex)
================================================================================
```

### Migration Report

```
🚀 BATCH MIGRATION STARTED
================================================================================
📂 Files to process: 22
🔧 Mode: LIVE
================================================================================

📝 components/customer/AppointmentsList.tsx
   ✓ Remove Supabase imports
   ✓ Remove API_BASE constant
   ✓ Customer bookings → MockAPI
   ✓ Add MockAPI import
   ✅ Saved (backup: AppointmentsList.tsx.2024-01-10.backup)

📝 components/customer/ServiceDiscovery.tsx
   ✓ Already migrated or no Supabase references

...

================================================================================
📊 MIGRATION SUMMARY
================================================================================
✅ Migrated:  18
⏭️  Skipped:   3
❌ Failed:    1
📁 Total:     22

💾 Backups saved to: backups/
================================================================================
```

---

## ❓ FAQ

### Q: Will the script break my code?

**A:** No. The script:
- Creates automatic backups
- Has dry-run mode for testing
- Only modifies known patterns
- Skips complex/unknown patterns

### Q: What if the script fails on some files?

**A:** 
- Failed files are reported in summary
- Manual migration needed for complex patterns
- Original files remain if script fails

### Q: Can I run the script multiple times?

**A:** Yes! The script:
- Automatically skips already migrated files
- Creates new backups each time
- Is idempotent (safe to re-run)

### Q: How do I verify migrations are correct?

**A:**
1. Run `npm run build` - checks TypeScript
2. Test critical user flows
3. Check browser console for errors
4. Review high-complexity files manually

### Q: What about vendor and admin apps?

**A:** Same process:
```bash
node scripts/migrate-to-mock.js --vendor
node scripts/migrate-to-mock.js --admin
```

---

## 📞 Support

For issues or questions:

1. Check `/scripts/MIGRATION_GUIDE.md` for detailed guide
2. Review script output for specific errors
3. Check backups if something goes wrong
4. Test with single file first: `--file <path>`

---

## 🎉 Success Criteria

After migration, you should have:

- ✅ Zero Supabase references in components
- ✅ All components using MockAPI
- ✅ Clean TypeScript build
- ✅ All user flows working
- ✅ Backups of all changed files

---

**Ready to migrate? Start here:**

```bash
# Step 1: Analyze
node scripts/analyze-components.js

# Step 2: Test
node scripts/migrate-to-mock.js --dry-run --customer

# Step 3: Migrate
node scripts/migrate-to-mock.js --customer

# Step 4: Build
npm run build
```

Good luck! 🚀
