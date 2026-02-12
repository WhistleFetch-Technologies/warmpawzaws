# AWS Serverless Integration Guide - Vendor Web App

## ✅ Overview

This document outlines the complete AWS Serverless architecture integration for the Vendor Web Application, ensuring compatibility with:
- **AWS Cognito** - Authentication
- **AWS Lambda** - API handlers
- **AWS RDS** - PostgreSQL database
- **CloudFront** - CDN and static asset delivery

## 🔄 Migration Status

### ✅ Completed Migrations

1. **API Client** (`apps/vendor-web/lib/api-client.ts`)
   - ✅ Uses Cognito tokens for authentication
   - ✅ Supports runtime configuration via `runtime-config.js`
   - ✅ Handles FormData uploads correctly

2. **New UI Components** (All using `apiClient`)
   - ✅ `VendorDashboard` - Main dashboard with capability routing
   - ✅ `VendorAnalytics` - Analytics dashboard
   - ✅ `VendorPaymentSettings` - Payment configuration
   - ✅ `VendorDistancePricing` - Distance-based pricing rules
   - ✅ `VendorCustomServiceCreation` - Custom service creation
   - ✅ `VendorBookingManagement` - Booking management
   - ✅ `VendorCapabilityDashboard` - Capability-based dashboard
   - ✅ `AIChatBot` - AI assistant integration
   - ✅ `CommunicationHub` - Chat and video communication

3. **Lambda Endpoints Created**
   - ✅ `/vendor/distance-pricing/:vendorId` - Distance pricing CRUD
   - ✅ `/vendor/onboarding/*` - Vendor onboarding flow
   - ✅ `/vendor/bookings/*` - Booking management
   - ✅ `/vendor/services/*` - Service management
   - ✅ `/vendor/analytics/*` - Analytics endpoints
   - ✅ `/vendor/payments/*` - Payment settings

## 📋 Page Replacement Mapping

### Old Pages → New Pages

| Old Component | New Component | Status | Route |
|--------------|--------------|--------|-------|
| `VendorServiceManagement` | `VendorCustomServiceCreation` | ✅ Replaced | `/services/custom` |
| `VendorBookingList` | `VendorBookingManagement` | ✅ Replaced | `/bookings` |
| `VendorStats` | `VendorAnalytics` | ✅ Replaced | `/analytics` |
| `VendorSettings` | `VendorPaymentSettings` | ✅ Replaced | `/settings/payments` |
| `VendorDashboardOld` | `VendorDashboard` | ✅ Replaced | `/` |
| `VendorCapabilityView` | `VendorCapabilityDashboard` | ✅ Replaced | `/dashboard` |

## 🗺️ Routing Integration

### Next.js App Router Structure

```
apps/vendor-web/app/
├── page.tsx                    # Main entry → VendorApp
├── onboarding/
│   └── page.tsx                # Onboarding flow → VendorApp
├── auth/
│   └── page.tsx                # Authentication → VendorAuth
└── [dynamic routes via VendorDashboard]
```

### Component Routing Flow

1. **Entry Point**: `app/page.tsx` → `VendorApp`
2. **VendorApp**: Routes to `VendorLandingPage` based on vendor status
3. **VendorLandingPage**: Routes to appropriate component based on:
   - Vendor status (new, pending, approved, active)
   - User navigation (dashboard, bookings, services, etc.)
4. **VendorDashboard**: Uses capability-based routing (`lib/capability-routes.ts`)

### Capability-Based Routing

The new routing system uses capabilities to determine available routes:

```typescript
// lib/capability-routes.ts
export const CAPABILITY_ROUTES: Record<string, CapabilityRoute> = {
  'booking': {
    path: '/bookings',
    component: 'VendorBookingManagement',
    capabilities: ['booking']
  },
  'analytics': {
    path: '/analytics',
    component: 'VendorAnalytics',
    capabilities: ['analytics']
  },
  // ... 45+ capabilities mapped
};
```

## 🔌 API Contracts & Lambda Functions

### Distance Pricing Endpoints

| Method | Endpoint | Lambda Handler | Status |
|--------|----------|---------------|--------|
| GET | `/vendor/distance-pricing/:vendorId` | `GetDistancePricingRulesHandler` | ✅ Created |
| POST | `/vendor/distance-pricing/:vendorId` | `CreateDistancePricingRuleHandler` | ✅ Created |
| PUT | `/vendor/distance-pricing/:vendorId/:ruleId` | `UpdateDistancePricingRuleHandler` | ✅ Created |
| DELETE | `/vendor/distance-pricing/:vendorId/:ruleId` | `DeleteDistancePricingRuleHandler` | ✅ Created |
| PUT | `/vendor/distance-pricing/:vendorId/:ruleId/toggle` | `ToggleDistancePricingRuleHandler` | ✅ Created |

### Vendor Onboarding Endpoints

| Method | Endpoint | Lambda Handler | Status |
|--------|----------|---------------|--------|
| GET | `/vendor/onboarding/status` | `GetOnboardingStatusHandler` | ✅ Exists |
| GET | `/vendor/onboarding/roles` | `GetAvailableRolesHandler` | ✅ Exists |
| POST | `/vendor/onboarding/select-role` | `SelectRoleHandler` | ✅ Exists |
| POST | `/vendor/onboarding/submit-application` | `SubmitApplicationHandler` | ✅ Exists |
| POST | `/vendor/setup/complete` | `UpdateSetupCompletionHandler` | ✅ Exists |

### Booking Management Endpoints

| Method | Endpoint | Lambda Handler | Status |
|--------|----------|---------------|--------|
| GET | `/vendor/bookings/:vendorId` | `GetVendorBookingsHandler` | ✅ Exists |
| POST | `/vendor/bookings/:id/accept` | `AcceptBookingHandler` | ✅ Exists |
| POST | `/vendor/bookings/:id/complete` | `CompleteBookingHandler` | ✅ Exists |
| GET | `/vendor/prescription/:bookingId` | `GetPrescriptionHandler` | ✅ Exists |

### Analytics Endpoints

| Method | Endpoint | Lambda Handler | Status |
|--------|----------|---------------|--------|
| GET | `/vendor/analytics/:vendorId` | `GetVendorAnalyticsHandler` | ✅ Exists |
| GET | `/vendor/analytics/:vendorId/revenue` | `GetRevenueAnalyticsHandler` | ✅ Exists |

## 🔐 Authentication Flow

### AWS Cognito Integration

1. **Login Flow**:
   ```typescript
   // VendorAuth.tsx
   - User enters phone number
   - OTP sent via Cognito
   - OTP verified → Cognito token received
   - Token stored in localStorage
   - apiClient uses token for all requests
   ```

2. **Token Management**:
   ```typescript
   // lib/api-client.ts
   private getAuthToken(): string | null {
     // Try Cognito token first
     const cognitoToken = getCognitoIdToken();
     if (cognitoToken) return cognitoToken;
     // Fallback to legacy token
     return localStorage.getItem('vendorAuthToken');
   }
   ```

3. **Request Headers**:
   ```typescript
   headers['Authorization'] = `Bearer ${token}`;
   ```

## 🗄️ Database Schema

### Distance Pricing Table

```sql
CREATE TABLE vendor_distance_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  service_name VARCHAR(255) NOT NULL,
  base_price DECIMAL(10,2) NOT NULL,
  base_dist DECIMAL(10,2) NOT NULL,
  price_per_km DECIMAL(10,2) NOT NULL,
  max_distance DECIMAL(10,2),
  min_charge DECIMAL(10,2),
  surge_multiplier DECIMAL(3,2) DEFAULT 1.0,
  peak_hour_multiplier DECIMAL(3,2) DEFAULT 1.0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 🚀 Deployment Configuration

### Environment Variables

```bash
# API Gateway URL
NEXT_PUBLIC_API_BASE_URL=https://api.warmpawz.com

# Cognito Configuration
NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-south-1_XXXXXXX
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx

# UAT Mode
NEXT_PUBLIC_UAT_MODE=false
```

### Runtime Configuration (CloudFront)

The app uses `runtime-config.js` for deploy-time configuration:

```javascript
// public/runtime-config.js (generated at deploy time)
window.__WARMPAWZ_RUNTIME_CONFIG__ = {
  apiBaseUrl: 'https://api.warmpawz.com',
  uatMode: false
};
```

## ✅ Integration Checklist

### Frontend
- [x] All components use `apiClient` instead of direct `fetch`
- [x] Cognito authentication integrated
- [x] New UI pages created and functional
- [x] Routing structure updated
- [x] Capability-based navigation implemented

### Backend
- [x] Distance pricing Lambda endpoints created
- [x] Endpoints registered in main handler
- [x] Database schema verified
- [x] API contracts match frontend expectations
- [x] Error handling implemented
- [x] CORS configured for CloudFront

### Testing
- [ ] Unit tests for new components
- [ ] Integration tests for API endpoints
- [ ] E2E tests for complete flows
- [ ] Performance testing with CloudFront

## 🔍 Verification Steps

1. **Build Check**:
   ```bash
   cd apps/vendor-web && npm run build
   ```

2. **API Endpoint Verification**:
   ```bash
   # Test distance pricing endpoint
   curl -X GET https://api.warmpawz.com/vendor/distance-pricing/{vendorId} \
     -H "Authorization: Bearer {token}"
   ```

3. **Component Integration**:
   - Navigate to `/` → Should show `VendorDashboard`
   - Navigate to `/bookings` → Should show `VendorBookingManagement`
   - Navigate to `/analytics` → Should show `VendorAnalytics`

## 📝 Notes

- All new components are compatible with AWS Serverless architecture

## 🐛 Known Issues

- None currently identified

## 🔄 Next Steps

1. Complete E2E testing
2. Performance optimization
3. Add monitoring and logging
4. Document API contracts in OpenAPI format

