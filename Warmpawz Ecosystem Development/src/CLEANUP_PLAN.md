# 🧹 REPOSITORY CLEANUP PLAN

**Objective:** Remove all unnecessary backend/Supabase files and dependencies

---

## 📋 CLEANUP CHECKLIST

### **Phase 2.0: Backend File Deletion**

#### **1. Delete Entire /supabase Directory**
- ✅ Action: Delete `/supabase/functions/server/*` (280+ backend endpoint files)
- ✅ Result: Remove ~200KB+ of unused backend code

#### **2. Delete Supabase Utility Files**
- ✅ Action: Delete `/utils/supabase/client.ts`
- ⚠️ Keep: `/utils/supabase/info.tsx` (contains projectId constants used in components)

#### **3. Clean Up Utility Files**
Files to review/delete in `/utils`:
- ❌ Delete: `/utils/api/*` (if backend API wrappers)
- ✅ Keep: Analytics, validation, cache utilities (frontend-only)

#### **4. Update Import References**
Files that import from Supabase (need to be updated):
- `/context/AuthContext.tsx`
- `/components/AdminApp.tsx`
- `/components/VendorApp.tsx`
- All admin components (50+ files)
- All vendor components
- All customer components

Replace with:
```typescript
// OLD
import { supabase } from '../utils/supabase/client';

// NEW
import MockAPI from '../lib/mockAPI';
```

---

## 🎯 EXECUTION STRATEGY

### **Step 1: Mass File Deletion (High Impact)**
1. Delete `/supabase/functions/server/*` entirely
2. Delete `/utils/supabase/client.ts`
3. Delete `/utils/api/*` directory

### **Step 2: Import Cleanup (Component Updates)**
Will be handled in Phase 2 migration per app:
- Customer App components
- Vendor App components  
- Admin App components

### **Step 3: Verification**
- No broken imports
- No references to deleted files
- All components use MockAPI

---

## 📊 ESTIMATED REDUCTION

**Before Cleanup:**
- Backend files: ~280 files
- Estimated size: ~300KB+

**After Cleanup:**
- Backend files: 0 files
- Size reduction: ~300KB+

**Timeline:** 30 minutes

---

**Status:** Ready to Execute
