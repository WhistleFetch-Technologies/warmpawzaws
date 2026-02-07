# 🤖 Cursor Integration Prompt: Figma UI Code Integration
## How to Integrate Figma-Generated UI Screens into Codebase

**Date:** January 2026  
**Purpose:** Guide Cursor AI to integrate Figma-generated UI components without breaking existing integrations

---

## 📋 INTEGRATION WORKFLOW

### Step 1: Receive Figma UI Code

When you receive UI code from Figma (React/TypeScript components):

1. **Identify the Component:**
   - Check the component name (e.g., `BookingFlowScreen`, `GPSTrackingScreen`)
   - Match it to the corresponding flow document:
     - Flow 1: Customer Onboarding → Booking
     - Flow 2: Vendor Acceptance → Delivery
     - Flow 3: Service Completion → Revenue

2. **Locate Existing Component (if any):**
   - Search codebase for similar component
   - Check: `apps/customer-web/components/customer/`
   - Check: `apps/customer-web/app/` (Next.js pages)

3. **Review API Contracts:**
   - Extract API endpoint annotations from Figma code comments
   - Verify against: `packages/api-contracts/src/`
   - Ensure request/response schemas match

---

## 🔧 INTEGRATION RULES

### Rule 1: Preserve Existing API Integrations

**DO NOT:**
- ❌ Replace existing API client calls
- ❌ Change API endpoint URLs
- ❌ Modify request/response handling logic
- ❌ Break existing error handling

**DO:**
- ✅ Keep existing `apiClient` usage
- ✅ Maintain existing error handling patterns
- ✅ Preserve existing loading states
- ✅ Keep existing navigation handlers

### Rule 2: Match Design System Exactly

**Verify:**
- Header gradient: `bg-gradient-to-br from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]`
- Content area: `bg-white rounded-t-[24px] -mt-3`
- Footer: Use `StandardizedFooter` component
- Icons: Only Lucide React icons (import from `lucide-react`)
- Colors: Exact hex values from design system

### Rule 3: Component Structure

**Standard Structure:**
```typescript
'use client';

import { useState, useEffect } from 'react';
import { /* Lucide icons */ } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StandardizedFooter } from '@/components/customer/shared/StandardizedFooter';
import { apiClient } from '@/lib/api-client';

interface ComponentNameProps {
  phone: string;
  onNavigate?: (screen: string, data?: any) => void;
  // ... other props
}

export function ComponentName({ 
  phone, 
  onNavigate 
}: ComponentNameProps) {
  // State management
  // API calls
  // Event handlers
  
  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] px-4 pt-4 pb-4">
        {/* Header content */}
      </div>
      
      {/* Content */}
      <div className="bg-white rounded-t-[24px] -mt-3 pt-4 pb-24">
        {/* Component content */}
      </div>
      
      {/* Footer */}
      <StandardizedFooter 
        currentTab="home"
        onTabChange={(tab) => onNavigate?.(tab)}
      />
    </div>
  );
}
```

---

## 📝 INTEGRATION CHECKLIST

### Before Integration:
- [ ] Review Figma code for API contract annotations
- [ ] Verify component name matches flow document
- [ ] Check if similar component exists
- [ ] Review navigation handlers in Figma code
- [ ] Verify icon imports (Lucide React only)

### During Integration:
- [ ] Replace placeholder API calls with actual `apiClient` calls
- [ ] Map Figma navigation handlers to existing `onNavigate` pattern
- [ ] Ensure error handling matches existing patterns
- [ ] Add loading states (if missing)
- [ ] Verify design matches exactly (colors, spacing, typography)
- [ ] Test responsive design (320px - 768px)

### After Integration:
- [ ] Test API calls (verify endpoints work)
- [ ] Test navigation (verify routes work)
- [ ] Test error states (network failure, validation errors)
- [ ] Test loading states
- [ ] Verify no breaking changes to existing components
- [ ] Check console for errors/warnings

---

## 🔌 API INTEGRATION PATTERN

### Example: Replace Figma API Annotation with Actual Call

**Figma Code (with annotation):**
```typescript
// API: POST /bookings/create
// Request: { customerId, vendorId, serviceId, ... }
// Response: { success: true, bookingId: string }

const handleCreateBooking = async () => {
  // Placeholder - replace with actual API call
  const response = await fetch('/api/bookings/create', {
    method: 'POST',
    body: JSON.stringify(bookingData)
  });
};
```

**Integrated Code:**
```typescript
import { apiClient } from '@/lib/api-client';
import { CreateBookingRequest, CreateBookingResponse } from '@/packages/api-contracts';

const handleCreateBooking = async () => {
  try {
    setLoading(true);
    
    const response = await apiClient.post<CreateBookingResponse>(
      '/bookings/create',
      {
        customerId,
        vendorId,
        serviceId,
        bookingDate,
        bookingTime,
        serviceType,
        petId,
        amount
      } as CreateBookingRequest
    );
    
    if (response.success) {
      onNavigate?.('payment', { bookingId: response.data.bookingId });
    }
  } catch (error: any) {
    console.error('Booking creation failed:', error);
    // Show error message to user
  } finally {
    setLoading(false);
  }
};
```

---

## 🧭 NAVIGATION INTEGRATION PATTERN

### Example: Replace Figma Navigation with Actual Handler

**Figma Code:**
```typescript
// Navigation: onNavigate('payment', { bookingId })
onNavigate('payment', { bookingId: response.bookingId });
```

**Integrated Code:**
```typescript
// Use existing navigation pattern from CustomerHomeWrapper
const handleNavigate = (screen: string, data?: any) => {
  if (onNavigate) {
    onNavigate(screen, data);
  } else {
    // Fallback: Use Next.js router
    const router = useRouter();
    switch (screen) {
      case 'payment':
        router.push(`/payments?bookingId=${data.bookingId}`);
        break;
      case 'tracking':
        router.push(`/tracking/${data.bookingId}`);
        break;
      // ... other routes
    }
  }
};
```

---

## 📁 FILE LOCATION RULES

### Component Files:
- **New Components:** `apps/customer-web/components/customer/{ComponentName}.tsx`
- **Page Components:** `apps/customer-web/app/{route}/page.tsx`
- **Shared Components:** `apps/customer-web/components/customer/shared/{ComponentName}.tsx`

### Naming Convention:
- Component files: PascalCase (e.g., `BookingFlowScreen.tsx`)
- Export names: Match file name (e.g., `export function BookingFlowScreen`)

---

## 🔄 INTEGRATION STEPS (Step-by-Step)

### Step 1: Create Component File
```bash
# Create file in correct location
touch apps/customer-web/components/customer/NewComponentName.tsx
```

### Step 2: Copy Figma Code
- Paste Figma-generated code into the file
- Keep all imports
- Keep component structure

### Step 3: Replace API Calls
- Find all `fetch()` or placeholder API calls
- Replace with `apiClient` calls
- Use types from `packages/api-contracts`

### Step 4: Fix Imports
- Verify all imports exist
- Add missing imports:
  - `apiClient` from `@/lib/api-client`
  - UI components from `@/components/ui/`
  - Shared components from `@/components/customer/shared/`

### Step 5: Add Navigation
- Replace Figma navigation with actual handlers
- Use `onNavigate` prop or Next.js router
- Verify routes exist in app router

### Step 6: Add Error Handling
- Wrap API calls in try-catch
- Show error messages to user
- Handle loading states

### Step 7: Test Integration
- Test component renders
- Test API calls work
- Test navigation works
- Test error states
- Test loading states

---

## ⚠️ COMMON INTEGRATION ISSUES

### Issue 1: API Endpoint Mismatch
**Problem:** Figma code uses placeholder endpoint  
**Solution:** Replace with actual endpoint from `packages/api-contracts` or `docs/API_ENDPOINTS.md`

### Issue 2: Missing Navigation Handler
**Problem:** `onNavigate` prop not passed  
**Solution:** Add `onNavigate` to component props, or use Next.js router directly

### Issue 3: Icon Import Errors
**Problem:** Figma uses wrong icon library  
**Solution:** Replace with Lucide React icons, verify import: `import { IconName } from 'lucide-react'`

### Issue 4: Design Mismatch
**Problem:** Colors/spacing don't match  
**Solution:** Verify exact hex values and Tailwind classes from design system

### Issue 5: Breaking Existing Components
**Problem:** Integration breaks other components  
**Solution:** 
- Test existing components after integration
- Use feature flags if needed
- Create new route instead of replacing existing

---

## ✅ FINAL VERIFICATION

After integration, verify:

1. **Design:**
   - [ ] Matches Figma design exactly
   - [ ] Colors correct (hex values)
   - [ ] Spacing correct (Tailwind classes)
   - [ ] Typography correct (font sizes/weights)
   - [ ] Icons correct (Lucide React)

2. **Functionality:**
   - [ ] API calls work
   - [ ] Navigation works
   - [ ] Loading states work
   - [ ] Error states work
   - [ ] Success states work

3. **Integration:**
   - [ ] No breaking changes
   - [ ] Existing components still work
   - [ ] No console errors
   - [ ] No TypeScript errors
   - [ ] Responsive design works

---

## 📚 REFERENCE DOCUMENTS

- **Design System:** `mdfiles/CUSTOMER_WEB_DESIGN_STRATEGY.md`
- **API Contracts:** `packages/api-contracts/src/`
- **API Endpoints:** `docs/API_ENDPOINTS.md`
- **Navigation:** `mdfiles/NAVIGATION_DOCUMENTATION.md` (see next document)
- **Flow Documents:**
  - Flow 1: `mdfiles/FIGMA_FLOW_1_CUSTOMER_ONBOARDING_TO_BOOKING.md`
  - Flow 2: `mdfiles/FIGMA_FLOW_2_VENDOR_ACCEPTANCE_TO_DELIVERY.md`
  - Flow 3: `mdfiles/FIGMA_FLOW_3_SERVICE_COMPLETION_TO_REVENUE.md`

---

**End of Cursor Integration Prompt**
