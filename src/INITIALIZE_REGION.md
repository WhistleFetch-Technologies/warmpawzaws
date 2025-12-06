# 🚀 Initialize Multi-Region System

## Quick Start: Initialize India Region

Run this command to seed the India region in your database:

### Option 1: Using Browser Console

```javascript
// Open browser console (F12) and run:
fetch('https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475/admin/regions/init-india', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_ANON_KEY',
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(console.log);

// Should return: { success: true, message: "India region initialized successfully" }
```

### Option 2: Using cURL

```bash
curl -X POST \
  'https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475/admin/regions/init-india' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json'
```

### Option 3: Component Auto-Initialize

The `useRegion` hook automatically tries to initialize India region on first load if it doesn't exist.

Just open the app and it will auto-initialize! ✅

---

## Verification

### Check if India Region Exists

```javascript
// Browser console:
fetch('https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475/regions/india', {
  headers: {
    'Authorization': 'Bearer YOUR_ANON_KEY'
  }
})
.then(r => r.json())
.then(console.log);

// Should return India region config with:
// - regionId: "india"
// - currency: INR (₹)
// - phone: +91
// - all services enabled
```

### Check Active Regions

```javascript
fetch('https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475/regions/active', {
  headers: {
    'Authorization': 'Bearer YOUR_ANON_KEY'
  }
})
.then(r => r.json())
.then(console.log);

// Should return: { success: true, regions: [{ regionId: "india", ... }] }
```

---

## Testing in App

### Test Component

Add this to any component to test:

```typescript
import { useRegion } from './hooks/useRegion';

function RegionTest() {
  const { region, formatCurrency, formatPhoneDisplay, isLoading } = useRegion();
  
  if (isLoading) return <div>Loading region...</div>;
  
  return (
    <div className="p-4 bg-white rounded shadow">
      <h3 className="font-bold">Region Test</h3>
      <p>Region: {region.regionName} ({region.regionCode})</p>
      <p>Currency: {formatCurrency(2999)}</p>
      <p>Phone: {formatPhoneDisplay('9876543210')}</p>
      <p>Services: {JSON.stringify(region.serviceCatalog)}</p>
    </div>
  );
}
```

Expected output:
```
Region: India (IN)
Currency: ₹2,999
Phone: +91 98765 43210
Services: { veterinary: true, grooming: true, ... }
```

---

## What Happens on First Load

1. App starts → `RegionProvider` mounts
2. Tries to load current region (defaults to 'india')
3. If India region doesn't exist in database:
   - Falls back to `DEFAULT_INDIA_REGION` constant
   - Automatically calls `/admin/regions/init-india`
   - Creates India region in KV store
4. Region loaded and available to all components

**Result**: Zero manual configuration needed! 🎉

---

## Troubleshooting

### Issue: "Region not found"

**Solution**: Run init-india endpoint manually:
```bash
curl -X POST .../admin/regions/init-india
```

### Issue: "Failed to fetch region"

**Check**:
1. Server is running
2. Supabase credentials are correct
3. Network connectivity

**Fallback**: App will use `DEFAULT_INDIA_REGION` constant

### Issue: Region hook throws error

**Check**:
1. `RegionProvider` is wrapping your app
2. Import path is correct: `'./hooks/useRegion'`

---

## Next Steps After Initialization

Once India region is initialized:

1. ✅ **Verify in console**: Region data loads correctly
2. ✅ **Test formatCurrency**: Shows ₹ symbol
3. ✅ **Test phone validation**: Accepts 10-digit numbers
4. ✅ **Check services**: All services enabled

Then you're ready for Phase 2! 🚀
