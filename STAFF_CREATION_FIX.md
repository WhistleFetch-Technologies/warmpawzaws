# Staff Creation - Vendor ID Resolution Fix

## Issue
Staff creation was failing with error: `"Vendor not found: vendor_9611377119"`

## Root Cause
1. **Wrong file being used**: `index.tsx` was importing `staff-crud-endpoints-refactored.tsx` which didn't have the `resolveVendorId` fix
2. **Vendor ID format**: Frontend sends `vendorId: "vendor_9611377119"` (string identifier), but database needs UUID
3. **Missing fallback**: If vendor_id not found, no fallback to phone number lookup

## Fixes Applied

### 1. ✅ Fixed `staff-crud-endpoints-refactored.tsx`
- Added `resolveVendorId()` call before vendor lookup
- Changed `vendor_id: staffData.vendorId` to `vendor_id: resolvedVendorId` (UUID)

**File:** `supabase/functions/make-server-3dd53475/staff-crud-endpoints-refactored.tsx`

**Changes:**
```typescript
// Before:
const vendor = await getVendorsRepository().findById(staffData.vendorId);

// After:
const vendorsRepo = getVendorsRepository();
const resolvedVendorId = await vendorsRepo.resolveVendorId(staffData.vendorId);
if (!resolvedVendorId) {
  return sendError(c, `Vendor not found: ${staffData.vendorId}`, 404);
}
const vendor = await vendorsRepo.findById(resolvedVendorId);
```

### 2. ✅ Enhanced `resolveVendorId()` with phone number fallback
- If `vendor_id` not found, extracts phone number from identifier (e.g., "vendor_9611377119" -> "9611377119")
- Tries to find vendor by phone number as fallback
- Added logging for debugging

**File:** `supabase/lib/repositories/vendors.ts`

**Changes:**
```typescript
// Added phone number extraction and fallback
if (identifier.startsWith('vendor_')) {
  const vendor = await this.findByVendorId(identifier);
  if (vendor) return vendor.id;
  
  // Extract phone from vendor_id (e.g., "vendor_9611377119" -> "9611377119")
  const phoneMatch = identifier.match(/vendor_(\d+)/);
  if (phoneMatch) {
    const phone = phoneMatch[1];
    const vendorByPhone = await this.findByPhone(phone);
    if (vendorByPhone) return vendorByPhone.id;
  }
}
```

## Resolution Flow

1. **UUID Check**: If identifier is UUID, use `findById()`
2. **vendor_id Check**: If starts with "vendor_", use `findByVendorId()`
3. **Phone Fallback**: Extract phone from vendor_id and try `findByPhone()`
4. **Direct vendor_id**: Try as vendor_id string
5. **Phone Number**: If all digits, try as phone number

## Testing

To test staff creation:
1. Frontend sends: `vendorId: "vendor_9611377119"`
2. Backend resolves to UUID using `resolveVendorId()`
3. If vendor_id not found, tries phone "9611377119"
4. Creates staff with resolved UUID

## Status: ✅ FIXED

The staff creation endpoint now properly resolves vendor IDs and includes fallback mechanisms.

