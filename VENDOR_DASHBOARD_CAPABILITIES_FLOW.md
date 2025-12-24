# Vendor Dashboard Loading Flow & Gallery/Portfolio Capabilities Analysis

## 🔍 Flow Overview

### 1. Vendor Dashboard Loading Flow

**Entry Point:** `VendorLandingPage.tsx`
- Loads vendor data and determines status
- Routes to `VendorDashboard.tsx` when status is `'active'`

**VendorDashboard.tsx Loading Process:**
1. **Line 240**: Uses `useVendorCapabilities(vendorData?.roleId)` hook to fetch capabilities
2. **Line 239-459**: `fetchDashboardData()` function loads:
   - Dashboard stats (`/vendor/dashboard/${vendorId}`)
   - Schedule (`/vendor/schedule/${vendorId}`)
   - Watchlist (`/vendor/watchlist/${vendorId}`)
   - Notifications (`/vendor/notifications/${vendorId}`)
   - Services (`/vendor/services/${vendorId}`)
3. All data fetching is **conditional** based on capabilities

---

## 🎯 Gallery & Portfolio Capabilities Source

### Problem Identified

**Gallery and Portfolio are appearing in Vet Dashboard even though they're NOT in role config.**

### Root Cause Analysis

#### Source 1: Hardcoded Fallback (PRIMARY SOURCE)

**File:** `src/components/vendor/hooks/useVendorCapabilities.ts`

**Lines 75-144:** `HARDCODED_VET_CAPABILITIES` object:
```typescript
const HARDCODED_VET_CAPABILITIES: VendorCapabilities = {
  // ...
  // Media/Content
  photo_updates: true,
  gallery: true,        // ⚠️ HARDCODED FOR VET
  portfolio: true,      // ⚠️ HARDCODED FOR VET
  progress_tracking: true,
  cctv_access: false,
  // ...
};
```

**Lines 324-336:** Fallback Logic:
```typescript
} else {
  console.warn('⚠️ [CAPABILITIES] Role not found, falling back to hardcoded defaults');
  
  // Fallback to hardcoded for known roles
  const mappedRoleName = HARDCODED_ROLE_NAMES[roleId] || roleId;
  setRoleName(mappedRoleName);
  
  if (roleId === 'veterinarian' || roleId === 'veterinary_clinic' || roleId.includes('vet')) {
    setCapabilities(HARDCODED_VET_CAPABILITIES);  // ⚠️ GALLERY & PORTFOLIO SET HERE
    console.log('✅ Applied hardcoded Veterinarian capabilities');
  }
}
```

**Lines 343-355:** Error Fallback:
```typescript
} catch (error) {
  console.error('❌ [CAPABILITIES] Error fetching role capabilities:', error);
  
  // Fallback to hardcoded on error
  if (roleId === 'veterinarian' || roleId === 'veterinary_clinic' || roleId.includes('vet')) {
    setCapabilities(HARDCODED_VET_CAPABILITIES);  // ⚠️ ALSO HERE
    console.log('✅ Applied hardcoded Veterinarian capabilities (fallback)');
  }
}
```

#### Source 2: Default Capabilities (SECONDARY SOURCE)

**Lines 146-214:** `DEFAULT_CAPABILITIES` object:
```typescript
const DEFAULT_CAPABILITIES: VendorCapabilities = {
  // ...
  // Media/Content
  photo_updates: false,
  gallery: true,        // ⚠️ DEFAULT TRUE
  portfolio: true,      // ⚠️ DEFAULT TRUE
  progress_tracking: false,
  cctv_access: false,
  // ...
};
```

**Lines 287-319:** When API returns role config:
```typescript
// Map string capabilities array to boolean object
const newCapabilities = { ...DEFAULT_CAPABILITIES };  // ⚠️ STARTS WITH DEFAULTS

if (currentRole.capabilities && currentRole.capabilities.length > 0) {
  // Start with all false for explicit control
  Object.keys(newCapabilities).forEach(key => {
    (newCapabilities as any)[key] = false;
  });
  
  // Enable listed capabilities
  currentRole.capabilities.forEach((cap: string) => {
    if (cap in newCapabilities) {
      (newCapabilities as any)[cap] = true;
    }
  });
}
```

**⚠️ Issue:** If `currentRole.capabilities` array doesn't include `gallery` or `portfolio`, but the role config exists, the code:
1. Starts with `DEFAULT_CAPABILITIES` (gallery: true, portfolio: true)
2. Sets all to false
3. Only enables capabilities listed in `currentRole.capabilities`

**However**, if `currentRole.capabilities` is empty or undefined, it falls through to line 318-319:
```typescript
} else {
  console.warn('⚠️ [CAPABILITIES] No capabilities array in role config, using defaults');
}
```

This means `newCapabilities` still has `DEFAULT_CAPABILITIES` values (gallery: true, portfolio: true)!

---

## 🔄 Complete Flow Diagram

```
VendorDashboard loads
    ↓
useVendorCapabilities(roleId) called
    ↓
Fetch /config/roles API
    ↓
┌─────────────────────────────────────────────┐
│ Does API return role config?                │
└─────────────────────────────────────────────┘
    │
    ├─ YES ──────────────────────────────────┐
    │   ↓                                    │
    │ Does role.capabilities array exist?    │
    │   │                                    │
    │   ├─ YES ───────────────────────────┐ │
    │   │   ↓                             │ │
    │   │ Set all capabilities to false   │ │
    │   │ Enable only listed capabilities │ │
    │   │                                  │ │
    │   │ ⚠️ If gallery/portfolio NOT in  │ │
    │   │    list, they stay FALSE ✅     │ │
    │   └──────────────────────────────────┘ │
    │   │                                    │
    │   └─ NO ────────────────────────────┐ │
    │       ↓                             │ │
    │   ⚠️ Use DEFAULT_CAPABILITIES       │ │
    │   (gallery: true, portfolio: true)  │ │
    │   └──────────────────────────────────┘ │
    │                                        │
    └─ NO ───────────────────────────────────┘
        ↓
    Role not found in API
        ↓
    Check if roleId includes 'vet'
        ↓
    ├─ YES → Use HARDCODED_VET_CAPABILITIES ⚠️
    │        (gallery: true, portfolio: true)
    │
    └─ NO → Use DEFAULT_CAPABILITIES ⚠️
            (gallery: true, portfolio: true)
```

---

## ❌ Why Gallery/Portfolio Show Up

### Scenario 1: API Returns Role But No Capabilities Array
- API returns role config
- `currentRole.capabilities` is empty/undefined
- Code warns but uses `DEFAULT_CAPABILITIES`
- **Result:** Gallery & Portfolio = `true` ✅

### Scenario 2: API Returns Role But Capabilities Don't Include gallery/portfolio
- API returns role config
- `currentRole.capabilities` exists but doesn't include `gallery` or `portfolio`
- Code sets all to false, then only enables listed ones
- **Result:** Gallery & Portfolio = `false` ✅ (CORRECT)

### Scenario 3: Role Not Found in API
- API doesn't return matching role
- Falls back to `HARDCODED_VET_CAPABILITIES` for vet roles
- **Result:** Gallery & Portfolio = `true` ⚠️ (INCORRECT - not from config)

### Scenario 4: API Error
- Fetch fails
- Falls back to `HARDCODED_VET_CAPABILITIES` for vet roles
- **Result:** Gallery & Portfolio = `true` ⚠️ (INCORRECT - not from config)

---

## 🔧 Recommendations

### Fix 1: Remove Hardcoded Values
**File:** `src/components/vendor/hooks/useVendorCapabilities.ts`

**Lines 103-104:** Change HARDCODED_VET_CAPABILITIES:
```typescript
// Media/Content
photo_updates: true,
gallery: false,      // ✅ Change to false - should come from config
portfolio: false,    // ✅ Change to false - should come from config
progress_tracking: true,
```

**Lines 173-174:** Change DEFAULT_CAPABILITIES:
```typescript
// Media/Content
photo_updates: false,
gallery: false,      // ✅ Change to false - should come from config
portfolio: false,    // ✅ Change to false - should come from config
progress_tracking: false,
```

### Fix 2: Handle Empty Capabilities Array
**Lines 317-319:** Improve empty capabilities handling:
```typescript
} else {
  console.warn('⚠️ [CAPABILITIES] No capabilities array in role config');
  // ⚠️ CRITICAL: Don't use defaults, set all to false
  Object.keys(newCapabilities).forEach(key => {
    (newCapabilities as any)[key] = false;
  });
  console.warn('⚠️ [CAPABILITIES] All capabilities set to false. Add capabilities to role config to enable features.');
}
```

### Fix 3: Verify API Endpoint
**Endpoint:** `/config/roles`
- Check if it returns capabilities for veterinarian role
- Verify if `gallery` and `portfolio` are included in the response
- Ensure role config is properly seeded in database

---

## 📊 Current State

| Scenario | Gallery | Portfolio | Source |
|----------|---------|-----------|--------|
| API returns role with capabilities (gallery/portfolio NOT listed) | ❌ false | ❌ false | ✅ Correct |
| API returns role with empty capabilities | ✅ true | ✅ true | ❌ DEFAULT_CAPABILITIES |
| API returns role with capabilities (gallery/portfolio listed) | ✅ true | ✅ true | ✅ Correct |
| Role not found in API (vet) | ✅ true | ✅ true | ❌ HARDCODED_VET_CAPABILITIES |
| API error (vet) | ✅ true | ✅ true | ❌ HARDCODED_VET_CAPABILITIES |

---

## 🎯 Summary

**Gallery and Portfolio are showing because:**

1. **Hardcoded fallback values** in `HARDCODED_VET_CAPABILITIES` (lines 103-104)
2. **Default values** in `DEFAULT_CAPABILITIES` (lines 173-174)
3. **Empty capabilities array handling** doesn't explicitly set to false (lines 317-319)
4. **Fallback logic** uses hardcoded values when role not found or API errors (lines 330-332, 349-351)

**The capabilities should ONLY come from the role config API endpoint, not hardcoded defaults.**

