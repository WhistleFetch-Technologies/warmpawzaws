# Real UI Copy Plan - Fixing Placeholder Issue

**Date:** 2026-01-07  
**Issue:** Created 44+ placeholder components instead of copying real UI code  
**Solution:** Copy actual UI implementations from reference folder

---

## 🎯 IMMEDIATE ACTIONS

### Step 1: Copy CustomerHomeComplete.tsx (PRIORITY 1)
- **Reference:** 1156 lines with full UI
- **Target:** 533 lines (incomplete)
- **Action:** Copy full reference code, adapt imports:
  - `../ui/button` → `@/components/ui/button`
  - `../../context/CartContext` → `@/context/CartContext`
  - `../../utils/supabase/info` → `@/lib/supabase/info`
  - `./AIAssistantChat` → Check if exists, else use `AIChatbotWidget`
  - Remove `figma:asset/` import (not available in target)

### Step 2: Copy All 80 Reference Components
- List all components in reference folder
- For each component:
  - Read reference code
  - Copy full UI implementation
  - Adapt imports only
  - Preserve all JSX, styling, colors, layout

### Step 3: Remove Placeholder Components
- Identify all placeholder components (44+)
- For components that exist in reference: Replace with real UI
- For components that don't exist in reference: Remove or mark as TODO

---

## 📋 COMPONENT STATUS

### Components to Copy from Reference:
1. ✅ CustomerHomeComplete.tsx - 1156 lines (needs full copy)
2. ✅ CustomerSidebar.tsx - Already similar, verify complete
3. ✅ CustomerPetsPage.tsx - Already similar, verify complete
4. ⏳ All other 77 components - Need to check and copy

### Placeholder Components to Replace/Remove:
- ShoppingCartView.tsx - Check if exists in reference
- CheckoutView.tsx - Check if exists in reference
- OrderSuccessView.tsx - Check if exists in reference
- OrderDetailView.tsx - Check if exists in reference
- ... (40+ more)

---

## 🔄 IMPORT ADAPTATION PATTERNS

| Reference Import | Target Import |
|-----------------|--------------|
| `../ui/button` | `@/components/ui/button` |
| `../../context/CartContext` | `@/context/CartContext` |
| `../../utils/supabase/info` | `@/lib/supabase/info` |
| `./ComponentName` | `./ComponentName` (same directory) |
| `figma:asset/...` | Remove (not available) |

---

**Status:** Starting with CustomerHomeComplete.tsx

