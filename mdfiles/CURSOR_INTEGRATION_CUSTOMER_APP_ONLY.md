# 🤖 Cursor Integration: Customer App UI Code (Customer App Only)
## How to Integrate Figma-Generated Customer App Screens

**Date:** January 2026  
**Focus:** Customer App Only - No Vendor Screens  
**Purpose:** Guide Cursor AI to integrate Figma-generated customer app UI components

---

## 📋 INTEGRATION WORKFLOW

### Step 1: Receive Figma UI Code

When you receive UI code from Figma for customer app screens:

1. **Identify the Component:**
   - Check component name (e.g., `VetServiceDashboard`, `ClinicBookingFlow`, `TeleConsultationModeSelection`)
   - Match to flow document:
     - Vet Service Dashboard
     - Vet Booking Flows (Clinic, Tele, Home)
     - Universal Booking Flows (at_center, at_home, tele)

2. **Locate Existing Component (if any):**
   - Search: `apps/customer-web/components/customer/`
   - Check: `apps/customer-web/components/customer/vet/`
   - Check: `apps/customer-web/components/customer/home-services/`
   - Check: `apps/customer-web/app/` (Next.js pages)

3. **Review API Contracts:**
   - Extract API endpoint annotations from Figma code comments
   - Verify against: `packages/api-contracts/src/`
   - Ensure request/response schemas match existing patterns

---

## 🔧 INTEGRATION RULES (Customer App Only)

### Rule 1: Preserve Existing API Integrations

**DO NOT:**
- ❌ Replace existing `apiClient` calls
- ❌ Change API endpoint URLs
- ❌ Modify existing error handling
- ❌ Break existing navigation patterns

**DO:**
- ✅ Keep existing `apiClient` from `@/lib/api-client`
- ✅ Maintain existing error handling patterns
- ✅ Preserve existing loading states
- ✅ Keep existing `onNavigate` handler pattern

### Rule 2: Match Design System Exactly

**Verify:**
- Header: `bg-gradient-to-br from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]`
- Content: `bg-white rounded-t-[24px] -mt-3 pt-4 pb-24`
- Footer: Use `StandardizedFooter` component
- Icons: Only Lucide React (import from `lucide-react`)
- Colors: Exact hex values from design system

### Rule 3: Component Structure

**Standard Structure:**
```typescript
'use client';

import { useState, useEffect } from 'react';
import { /* Lucide icons */ } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StandardizedHeader } from '@/components/customer/shared/StandardizedHeader';
import { StandardizedFooter } from '@/components/customer/shared/StandardizedFooter';
import { apiClient } from '@/lib/api-client';

interface ComponentNameProps {
  phone: string;
  onNavigate?: (screen: string, data?: any) => void;
  onBack?: () => void;
  // ... other props
}

export function ComponentName({ 
  phone, 
  onNavigate,
  onBack
}: ComponentNameProps) {
  // State management
  // API calls
  // Event handlers
  
  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <StandardizedHeader
        userName={userName}
        userProfilePhoto={userProfilePhoto}
        title="Page Title"
        subtitle="Page subtitle"
        showBackButton={true}
        onBack={onBack}
        onNavigate={onNavigate}
        customerPhone={phone}
      />
      
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
- [ ] Replace placeholder API calls with `apiClient` calls
- [ ] Map Figma navigation handlers to existing `onNavigate` pattern
- [ ] Ensure error handling matches existing patterns
- [ ] Add loading states (if missing)
- [ ] Verify design matches exactly (colors, spacing, typography)
- [ ] Use `StandardizedHeader` and `StandardizedFooter` components
- [ ] Test responsive design (320px - 768px)

### After Integration:
- [ ] Test API calls (verify endpoints work)
- [ ] Test navigation (verify routes work)
- [ ] Test error states
- [ ] Test loading states
- [ ] Verify no breaking changes to existing components
- [ ] Check console for errors/warnings

---

## 🔌 API INTEGRATION PATTERN

### Example: Replace Figma API Annotation

**Figma Code:**
```typescript
// API: POST /bookings/create
// Request: { customerId, vendorId, serviceId, ... }
// Response: { success: true, bookingId: string }

const handleCreateBooking = async () => {
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
        serviceType: 'at_center', // or 'at_home' or 'tele'
        petId,
        amount: totalAmount
      } as CreateBookingRequest
    );
    
    if (response.success) {
      onNavigate?.('payment', { bookingId: response.data.bookingId });
    }
  } catch (error: any) {
    console.error('Booking creation failed:', error);
    toast.error(error.message || 'Failed to create booking');
  } finally {
    setLoading(false);
  }
};
```

---

## 🧭 NAVIGATION INTEGRATION PATTERN

### Example: Replace Figma Navigation

**Figma Code:**
```typescript
// Navigation: onNavigate('payment', { bookingId })
onNavigate('payment', { bookingId: response.bookingId });
```

**Integrated Code:**
```typescript
// Use existing navigation pattern
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
      case 'vet-clinic-list':
        router.push('/vet/clinics');
        break;
      case 'vet-tele-consultation':
        router.push('/vet/tele');
        break;
      // ... other routes
    }
  }
};
```

---

## 📁 FILE LOCATION RULES (Customer App Only)

### Component Files:
- **Vet Components:** `apps/customer-web/components/customer/vet/{ComponentName}.tsx`
- **Home Services:** `apps/customer-web/components/customer/home-services/{ComponentName}.tsx`
- **Universal Components:** `apps/customer-web/components/customer/{ComponentName}.tsx`
- **Shared Components:** `apps/customer-web/components/customer/shared/{ComponentName}.tsx`
- **Page Components:** `apps/customer-web/app/{route}/page.tsx`

### Naming Convention:
- Component files: PascalCase (e.g., `VetServiceDashboard.tsx`)
- Export names: Match file name (e.g., `export function VetServiceDashboard`)

---

## 🔄 INTEGRATION STEPS (Step-by-Step)

### Step 1: Create Component File
```bash
# Example: Vet Service Dashboard
touch apps/customer-web/components/customer/vet/VetServiceDashboard.tsx
```

### Step 2: Copy Figma Code
- Paste Figma-generated code
- Keep all imports
- Keep component structure

### Step 3: Replace API Calls
- Find all `fetch()` or placeholder API calls
- Replace with `apiClient` calls
- Use types from `packages/api-contracts`

### Step 4: Fix Imports
- Add: `import { apiClient } from '@/lib/api-client';`
- Add: `import { StandardizedHeader } from '@/components/customer/shared/StandardizedHeader';`
- Add: `import { StandardizedFooter } from '@/components/customer/shared/StandardizedFooter';`
- Verify all Lucide React icon imports

### Step 5: Add Navigation
- Replace Figma navigation with `onNavigate` prop
- Or use Next.js router as fallback
- Verify routes exist in app router

### Step 6: Add Error Handling
- Wrap API calls in try-catch
- Show error messages using `toast` from `sonner`
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
**Solution:** Replace with actual endpoint from `packages/api-contracts` or existing components

### Issue 2: Missing Navigation Handler
**Problem:** `onNavigate` prop not passed  
**Solution:** Add `onNavigate` to component props, or use Next.js router directly

### Issue 3: Icon Import Errors
**Problem:** Figma uses wrong icon library  
**Solution:** Replace with Lucide React icons, verify import: `import { IconName } from 'lucide-react'`

### Issue 4: Design Mismatch
**Problem:** Colors/spacing don't match  
**Solution:** Verify exact hex values and Tailwind classes from CustomerHomeComplete.tsx

### Issue 5: Header/Footer Not Matching
**Problem:** Custom header/footer instead of standardized  
**Solution:** Replace with `StandardizedHeader` and `StandardizedFooter` components

---

## ✅ FINAL VERIFICATION

After integration, verify:

1. **Design:**
   - [ ] Matches Figma design exactly
   - [ ] Colors correct (hex values)
   - [ ] Spacing correct (Tailwind classes)
   - [ ] Typography correct (font sizes/weights)
   - [ ] Icons correct (Lucide React)
   - [ ] Header matches CustomerHomeComplete.tsx
   - [ ] Footer matches StandardizedFooter.tsx

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
- **Navigation:** `mdfiles/NAVIGATION_DOCUMENTATION_CUSTOMER_APP.md`
- **Flow Documents:**
  - Vet Dashboard: `mdfiles/FIGMA_CUSTOMER_APP_VET_SERVICE_DASHBOARD.md`
  - Vet Booking: `mdfiles/FIGMA_CUSTOMER_APP_VET_BOOKING_FLOWS.md`
  - Universal Booking: `mdfiles/FIGMA_CUSTOMER_APP_UNIVERSAL_BOOKING_FLOWS.md`

---

**End of Cursor Integration Prompt (Customer App Only)**
