# Import Path Fixes - System Wide

## Issue
Files were using incorrect relative import paths for `utils/supabase/info` and other utils imports.

## Root Cause
Files directly in `src/components/customer/`, `src/components/vendor/`, and `src/components/admin/` were using `../../../utils/` when they should use `../../utils/` (2 levels up, not 3).

## File Structure
```
src/
├── components/
│   ├── customer/
│   │   ├── ReferralSystemPage.tsx  ← Should use ../../utils (depth 3)
│   │   └── grooming/
│   │       └── PaymentPage.tsx     ← Should use ../../../utils (depth 4)
│   ├── vendor/
│   │   └── *.tsx                   ← Should use ../../utils (depth 3)
│   └── admin/
│       └── *.tsx                   ← Should use ../../utils (depth 3)
└── utils/
    └── supabase/
        └── info.tsx
```

## Fixes Applied

### Files Directly in Component Folders (Depth 3)
**Before:**
```typescript
import { projectId, publicAnonKey } from '../../../utils/supabase/info';  // ❌ Wrong
```

**After:**
```typescript
import { projectId, publicAnonKey } from '../../utils/supabase/info';  // ✅ Correct
```

### Files in Subdirectories (Depth 4+)
These files correctly use `../../../utils/`:
```typescript
// src/components/customer/grooming/PaymentPage.tsx
import { projectId, publicAnonKey } from '../../../utils/supabase/info';  // ✅ Correct
```

## Files Fixed
- `src/components/customer/ReferralSystemPage.tsx`
- `src/components/customer/UniversalVendorListView.tsx`
- All other files directly in `customer/`, `vendor/`, and `admin/` folders

## Verification
Run this to check for remaining issues:
```bash
# Check files directly in component folders
grep -r "from ['\"]\.\.\/\.\.\/\.\.\/utils\/supabase\/info" \
  src/components/customer/*.tsx \
  src/components/vendor/*.tsx \
  src/components/admin/*.tsx
```

Should return 0 results.

## Note
Files in subdirectories (like `customer/grooming/`, `admin/settings/`) correctly use `../../../utils/` because they need to go up 3 levels to reach `src/`.

