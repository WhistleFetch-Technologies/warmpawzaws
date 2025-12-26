# Function Split Implementation Plan

## Status

✅ **Core Function Created**: `make-server-core`
- Contains: Auth, Health, Regions
- Status: Deployed successfully (version 1)
- Note: Getting 503 on first requests (cold start normal)

## Next Steps

### Phase 1: Admin Function (Priority: High)
**Function:** `make-server-admin`
**Endpoints:**
- Admin vendor management (`registerAdminVendorRoutes`)
- Admin catalog (`registerAdminCatalogEndpoints`)
- Admin integrations (`adminIntegrationEndpoints`)
- Vendor settings rules (`registerVendorSettingsRulesEndpoints`)
- Video call endpoints (`registerVideoCallEndpoints`)
- Problem grid specialization (`registerProblemGridSpecializationSystem`)
- Vendor reverification (`registerReverificationEndpointsSQL`)

### Phase 2: Vendor Function (Priority: High)
**Function:** `make-server-vendor`
**Endpoints:**
- Vendor onboarding (`vendorOnboardingEndpoints`)
- Vendor dashboard (`vendorDashboardEndpoints`)
- Vendor services (`registerVendorServiceEndpoints`)
- Vendor scheduling (`vendorScheduleV2Endpoints`)
- Vendor catalog (`registerVendorCatalogAPIV2`)
- Onboarding forms (`onboardingFormAPI`)
- Vendor profile (`registerVendorProfileUpdateEndpoints`)
- Vendor approval (`vendorApprovalWorkflowEndpoints`)
- Solo providers (`soloProviderEndpoints`)

### Phase 3: Customer Function (Priority: High)
**Function:** `make-server-customer`
**Endpoints:**
- Customer routes (`registerCustomerRoutes`)
- Customer services (`registerCustomerServices`)
- Customer search (`registerCustomerSearchEndpoints`)
- Customer pets (`customerPetsRoutes`)
- Customer booking history (`registerCustomerBookingHistory`)
- Customer packages (`registerCustomerPackageEndpoints`)
- Customer e-commerce (`customerEcommerceEndpoints`)

### Phase 4: Booking Function (Priority: Medium)
**Function:** `make-server-booking`
**Endpoints:**
- Booking endpoints (`bookingEndpoints`)
- Booking lifecycle (`registerBookingLifecycleManagement`)
- Booking management (`bookingManagementEndpointsSQL`)
- Home services (`homeServicesEndpointsSQL`)
- Follow-up bookings (`followupEndpointsSQL`)
- Medical history (`registerMedicalHistoryEndpoints`)
- Staff schedule (`registerUniversalStaffSchedule`)
- Center availability (`registerCenterAvailabilityEndpoints`)
- Boarding rooms (`registerBoardingRoomManagement`)

### Phase 5: Payment Function (Priority: Medium)
**Function:** `make-server-payment`
**Endpoints:**
- Payment endpoints (`paymentEndpoints`)
- Razorpay integration (`razorpayPaymentIntegrationSQL`)
- Marketplace payments (`marketplacePaymentEndpoints`)
- Refunds (`refundReschedulingEndpointsSQL`)
- Settlements (`registerSettlementAutomation`)
- Payouts (`registerPayoutCronJob`)

### Phase 6+: Specialized Functions (Priority: Low)
- `make-server-specialized` - Vet, diagnostics, pharmacy, etc.
- `make-server-notifications` - SMS, notifications, chat
- `make-server-integrations` - Logistics, AWS, etc.
- `make-server-analytics` - Analytics, reports

## Implementation Template

Each function should follow this structure:

```typescript
import { Hono } from 'npm:hono@4';
import { cors } from 'npm:hono@4/cors';
import { logger } from 'npm:hono@4/logger';
import { sendSuccess, sendError } from '../_shared/response-utils.ts';

const app = new Hono();

// Global middleware
app.use('*', cors({...}));
app.use('*', logger(console.log));

// OPTIONS handler
app.options('*', (c) => {...});

// Health endpoint
app.get('/health', (c) => {...});

// Register specific endpoints
// ... endpoint registrations ...

// Deno.serve with safety wrapper
Deno.serve(async (req: Request) => {...});
```

## Shared Resources

All functions share:
- `supabase/lib/` - Repositories and database utilities
- `supabase/functions/_shared/` - Common utilities
  - `response-utils.ts` ✅
  - `critical-action-guard.tsx` ✅

## Path Strategy

**Option A:** Keep original paths (recommended for compatibility)
- All functions respond to `/make-server-3dd53475/*` paths
- Route via API gateway or client-side routing

**Option B:** Use function-specific paths
- Core: `/make-server-core/*`
- Admin: `/make-server-admin/*`
- etc.

## Testing Strategy

1. Deploy each function independently
2. Test OPTIONS and health endpoints
3. Test core functionality
4. Update client routing if needed

