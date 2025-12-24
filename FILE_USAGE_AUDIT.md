# File Usage Audit - Active vs Orphaned Files

**Date:** 2025-01-27  
**Audit Status:** ✅ All Critical Files Are Actively Used

---

## ✅ ACTIVELY USED FILES (Confirmed in index.tsx)

### 1. specialized-services-booking.tsx ✅
- **Location:** Line 120 (import), Line 1326 (usage)
- **KV Parameter:** Yes (needs migration)
- **Status:** ⏳ Needs SQL migration (31 KV usages)

### 2. holiday-package-endpoints.tsx ✅
- **Location:** Line 113 (import), Line 1270 (usage)
- **KV Parameter:** Yes (needs migration)
- **Status:** ⏳ Needs SQL migration (27 KV usages)

### 3. holiday-package-system.tsx ✅
- **Location:** Line 190 (import), Line 984 (usage)
- **KV Parameter:** Yes (needs migration)
- **Status:** ⏳ Needs SQL migration (32 KV usages)

### 4. boarding-room-management.tsx ✅
- **Location:** Line 65 (import), Line 664 (usage)
- **KV Parameter:** No (already SQL signature)
- **Status:** ⏳ Still has KV imports (13 KV usages) - needs cleanup

### 5. cafe-features.tsx ✅
- **Location:** Line 73 (import), Line 673 (usage)
- **KV Parameter:** No (already SQL signature)
- **Status:** ⏳ Still has KV imports (21 KV usages) - needs cleanup

### 6. adoption-endpoints.tsx ✅
- **Location:** Line 134 (import), Line 1094 (usage as route)
- **KV Parameter:** No (default export)
- **Status:** ⏳ Still has KV imports (14 KV usages) - needs cleanup

### 7. insurance-endpoints.tsx ✅
- **Location:** Line 165 (import), Line 811 (usage)
- **KV Parameter:** Yes (needs migration)
- **Status:** ⏳ Needs SQL migration (18 KV usages)

---

## 📊 Summary

- **Total Files Audited:** 7
- **Actively Used:** 7 (100%)
- **Orphaned Files:** 0
- **Need Migration:** 7
- **Already SQL Signature (needs cleanup):** 3 (boarding, cafe, adoption)
- **Still Need KV Parameter Removal:** 4 (specialized-services, holiday packages, insurance)

---

## 🔧 Migration Priority

### High Priority (Active KV Usage)
1. ✅ specialized-services-booking.tsx - 31 KV usages
2. ✅ holiday-package-system.tsx - 32 KV usages  
3. ✅ holiday-package-endpoints.tsx - 27 KV usages
4. ✅ insurance-endpoints.tsx - 18 KV usages

### Medium Priority (SQL Signature, KV Cleanup)
5. ✅ boarding-room-management.tsx - 13 KV usages (cleanup)
6. ✅ cafe-features.tsx - 21 KV usages (cleanup)
7. ✅ adoption-endpoints.tsx - 14 KV usages (cleanup)

---

## ❌ No Orphaned Files Found

All files are properly integrated into the main application flow.

