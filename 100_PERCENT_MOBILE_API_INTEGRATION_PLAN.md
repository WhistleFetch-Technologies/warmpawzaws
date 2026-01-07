# 100% Mobile API Integration Plan
## Complete API Integration for iOS & Android Mobile Apps

**Date:** 2026-01-07  
**Goal:** Achieve 100% API integration for all mobile screens with iOS/Android compatibility and AWS Serverless architecture verification

---

## 📊 CURRENT STATUS

### Customer Mobile
- **Total Screens:** 81
- **Screens with API:** 72 (89%)
- **Screens Needing API:** 8

### Vendor Mobile
- **Total Screens:** 50
- **Screens with API:** 36 (72%)
- **Screens Needing API:** 11

### Total
- **Screens Needing API:** 19
- **Target:** 100% API integration

---

## 🎯 SCREENS REQUIRING API INTEGRATION

### Customer Mobile (8 screens)

1. **BookingFeedbackScreen** ✅ API Method Exists
   - **File:** `apps/WarmpawzCustomer/src/screens/bookings/BookingFeedbackScreen.tsx`
   - **API Method:** `CustomerApi.submitFeedback` (already exists)
   - **Status:** Screen already uses API, but verification script may have missed it
   - **Action:** Verify and ensure proper error handling

2. **AddAddressScreen** ✅ API Method Exists
   - **File:** `apps/WarmpawzCustomer/src/screens/settings/AddAddressScreen.tsx`
   - **API Method:** `CustomerApi.addAddress` (already exists)
   - **Status:** Screen already uses API
   - **Action:** Verify and ensure proper error handling

3. **ChangePasswordScreen** ✅ API Method Exists
   - **File:** `apps/WarmpawzCustomer/src/screens/settings/ChangePasswordScreen.tsx`
   - **API Method:** `CustomerApi.changePassword` (already exists)
   - **Status:** Screen already uses API
   - **Action:** Verify and ensure proper error handling

4. **CustomerOnboardingScreen** ⚠️ Needs API
   - **File:** `apps/WarmpawzCustomer/src/screens/onboarding/CustomerOnboardingScreen.tsx`
   - **API Method Needed:** `CustomerApi.createProfile`, `CustomerApi.updateOnboardingStatus`
   - **Action:** Add API integration

5. **OrderReturnScreen** ⚠️ Needs API
   - **File:** `apps/WarmpawzCustomer/src/screens/orders/OrderReturnScreen.tsx`
   - **API Method Needed:** `CustomerApi.createReturn`, `OrderApi.returnOrder`
   - **Backend:** `registerReturnsEndpoints` (already exists)
   - **Action:** Add API method and integrate

6. **PaymentFailureRecoveryScreen** ⚠️ Needs API
   - **File:** `apps/WarmpawzCustomer/src/screens/payments/PaymentFailureRecoveryScreen.tsx`
   - **API Method:** `PaymentApi.retryPayment` (already exists)
   - **Status:** May need verification
   - **Action:** Verify and ensure proper integration

7. **SettingsScreen** ⚠️ Needs API
   - **File:** `apps/WarmpawzCustomer/src/screens/settings/SettingsScreen.tsx`
   - **API Methods Needed:** `CustomerApi.getSettings`, `CustomerApi.updateSettings`
   - **Action:** Add API methods and integrate

8. **WalletTopUpScreen** ⚠️ Needs API
   - **File:** `apps/WarmpawzCustomer/src/screens/wallet/WalletTopUpScreen.tsx`
   - **API Method Needed:** `WalletApi.topUp`, `WalletApi.initiateTopUp`
   - **Backend:** `registerWalletEndpoints` (already exists)
   - **Action:** Add API method and integrate

### Vendor Mobile (11 screens)

1. **BookingCheckInScreen** ⚠️ Needs API
   - **File:** `apps/WarmpawzVendor/src/screens/bookings/BookingCheckInScreen.tsx`
   - **API Method Needed:** `VendorBookingApi.checkIn`, `BookingApi.checkIn`
   - **Backend:** `registerBookingEndpointsEnhanced` (already exists)
   - **Action:** Add API method and integrate

2. **FileUploadScreen** ⚠️ Needs API
   - **File:** `apps/WarmpawzVendor/src/screens/bookings/FileUploadScreen.tsx`
   - **API Method Needed:** `FileUploadApi.uploadFile`, `BookingApi.uploadPrescription`
   - **Backend:** `registerFileUploadEndpoints` (already exists)
   - **Action:** Add API method and integrate

3. **StartServiceScreen** ⚠️ Needs API
   - **File:** `apps/WarmpawzVendor/src/screens/bookings/StartServiceScreen.tsx`
   - **API Method Needed:** `VendorBookingApi.startService`, `BookingApi.startService`
   - **Backend:** `registerVendorBookingActionsEndpoints` (already exists)
   - **Action:** Add API method and integrate

4. **EmergencyAlertScreen** ⚠️ Needs API
   - **File:** `apps/WarmpawzVendor/src/screens/emergency/EmergencyAlertScreen.tsx`
   - **API Method Needed:** `VendorApi.sendEmergencyAlert`, `NotificationApi.sendEmergency`
   - **Action:** Add API method and integrate

5. **DataExportScreen** ⚠️ Needs API
   - **File:** `apps/WarmpawzVendor/src/screens/export/DataExportScreen.tsx`
   - **API Method Needed:** `VendorApi.exportData`, `ReportApi.exportVendorData`
   - **Backend:** `registerReportEndpoints` (already exists)
   - **Action:** Add API method and integrate

6. **HelpScreen** ⚠️ Needs API
   - **File:** `apps/WarmpawzVendor/src/screens/help/HelpScreen.tsx`
   - **API Method Needed:** `VendorApi.getHelpArticles`, `SupportApi.getHelp`
   - **Action:** Add API method and integrate (or mark as static if appropriate)

7. **LogoutScreen** ✅ No API Needed
   - **File:** `apps/WarmpawzVendor/src/screens/logout/LogoutScreen.tsx`
   - **Status:** Logout is client-side only
   - **Action:** Mark as static/no API needed

8. **RealTimeUpdatesScreen** ⚠️ Needs API
   - **File:** `apps/WarmpawzVendor/src/screens/realtime/RealTimeUpdatesScreen.tsx`
   - **API Method Needed:** `VendorApi.getRealTimeUpdates`, WebSocket connection
   - **Action:** Add API method and integrate

9. **RouteOptimizationScreen** ⚠️ Needs API
   - **File:** `apps/WarmpawzVendor/src/screens/routing/RouteOptimizationScreen.tsx`
   - **API Method Needed:** `LogisticsApi.optimizeRoute`, `VendorApi.optimizeRoute`
   - **Backend:** `registerLogisticsEndpoints` (already exists)
   - **Action:** Add API method and integrate

10. **SecurityScreen** ⚠️ Needs API
    - **File:** `apps/WarmpawzVendor/src/screens/security/SecurityScreen.tsx`
    - **API Method Needed:** `VendorApi.getSecuritySettings`, `VendorApi.updateSecuritySettings`
    - **Backend:** `registerVendorSettingsEndpoints` (already exists)
    - **Action:** Add API method and integrate

11. **RouteTrackingScreen** ⚠️ Needs API
    - **File:** `apps/WarmpawzVendor/src/screens/tracking/RouteTrackingScreen.tsx`
    - **API Method Needed:** `GPSTrackingApi.getRoute`, `LogisticsApi.trackRoute`
    - **Backend:** `registerGpsTrackingEndpoints` (already exists)
    - **Action:** Add API method and integrate

---

## 🔧 IMPLEMENTATION PLAN

### Phase 1: Add Missing API Methods to Service Files

#### Customer Mobile API (`apps/WarmpawzCustomer/src/services/api.ts`)

1. **Add Order Return API:**
```typescript
// Order Returns
createReturn: (orderId: string, returnData: { reason: string; items: any[]; customerId: string }) =>
  ApiService.post(`/orders/${orderId}/return`, returnData),
getReturnStatus: (returnId: string) => ApiService.get(`/returns/${returnId}`),
```

2. **Add Wallet Top-Up API:**
```typescript
// Wallet Top-Up
topUp: (customerId: string, amount: number, paymentMethod: string) =>
  ApiService.post('/wallet/topup', { customerId, amount, paymentMethod }),
initiateTopUp: (customerId: string, amount: number) =>
  ApiService.post('/wallet/topup/initiate', { customerId, amount }),
```

3. **Add Settings API:**
```typescript
// Settings
getSettings: (customerId: string) => ApiService.get(`/customer/${customerId}/settings`),
updateSettings: (customerId: string, settings: any) =>
  ApiService.put(`/customer/${customerId}/settings`, settings),
```

4. **Add Onboarding API:**
```typescript
// Onboarding
updateOnboardingStatus: (customerId: string, status: string, data?: any) =>
  ApiService.post(`/customer/${customerId}/onboarding`, { status, data }),
```

#### Vendor Mobile API (`apps/WarmpawzVendor/src/services/api.ts`)

1. **Add Booking Actions API:**
```typescript
// Booking Actions
checkIn: (bookingId: string, checkInData: { latitude: number; longitude: number; timestamp: string }) =>
  ApiService.post(`/bookings/${bookingId}/checkin`, checkInData),
startService: (bookingId: string, startData?: any) =>
  ApiService.post(`/bookings/${bookingId}/start`, startData),
```

2. **Add File Upload API:**
```typescript
// File Upload
uploadFile: (file: any, bookingId?: string) => {
  const formData = new FormData();
  formData.append('file', file);
  if (bookingId) formData.append('bookingId', bookingId);
  return ApiService.post('/files/upload', formData, { 'Content-Type': 'multipart/form-data' });
},
uploadPrescription: (bookingId: string, file: any) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('bookingId', bookingId);
  return ApiService.post(`/bookings/${bookingId}/prescription`, formData, { 'Content-Type': 'multipart/form-data' });
},
```

3. **Add Emergency Alert API:**
```typescript
// Emergency
sendEmergencyAlert: (vendorId: string, alertData: { type: string; message: string; location?: any }) =>
  ApiService.post(`/vendor/${vendorId}/emergency`, alertData),
```

4. **Add Data Export API:**
```typescript
// Data Export
exportData: (vendorId: string, exportType: string, dateRange?: any) =>
  ApiService.post(`/vendor/${vendorId}/export`, { exportType, dateRange }),
```

5. **Add Real-Time Updates API:**
```typescript
// Real-Time Updates
getRealTimeUpdates: (vendorId: string) => ApiService.get(`/vendor/${vendorId}/realtime`),
subscribeToUpdates: (vendorId: string, callback: (update: any) => void) => {
  // WebSocket or polling implementation
},
```

6. **Add Route Optimization API:**
```typescript
// Route Optimization
optimizeRoute: (vendorId: string, routeData: { bookings: string[]; startLocation: any }) =>
  ApiService.post(`/vendor/${vendorId}/route/optimize`, routeData),
```

7. **Add Security Settings API:**
```typescript
// Security Settings
getSecuritySettings: (vendorId: string) => ApiService.get(`/vendor/${vendorId}/security`),
updateSecuritySettings: (vendorId: string, settings: any) =>
  ApiService.put(`/vendor/${vendorId}/security`, settings),
```

8. **Add Route Tracking API:**
```typescript
// Route Tracking
getRoute: (routeId: string) => ApiService.get(`/routes/${routeId}`),
trackRoute: (routeId: string) => ApiService.get(`/routes/${routeId}/track`),
```

### Phase 2: Integrate API Calls into Screens

For each screen, ensure:
1. ✅ Import API service
2. ✅ Add loading states
3. ✅ Add error handling
4. ✅ Add success callbacks
5. ✅ Handle iOS/Android differences (if any)

### Phase 3: Verify iOS/Android Compatibility

1. **React Native Compatibility:**
   - ✅ All API calls use `fetch` (works on both platforms)
   - ✅ FormData for file uploads (works on both platforms)
   - ✅ AsyncStorage for token storage (works on both platforms)

2. **Platform-Specific Considerations:**
   - ✅ Location permissions (iOS vs Android)
   - ✅ File picker (iOS vs Android)
   - ✅ Push notifications (iOS vs Android)

### Phase 4: Verify AWS Serverless Architecture

1. **RDS (PostgreSQL):**
   - ✅ Database connection in `backend/lambda/src/database/rds-connection.ts`
   - ✅ All endpoints use RDS for data storage

2. **Lambda:**
   - ✅ All endpoints registered in `backend/lambda/src/handler/index.ts`
   - ✅ Stateless handlers (no in-memory state)

3. **Cognito:**
   - ✅ Authentication endpoints registered
   - ✅ Token validation in API Gateway

4. **CloudFront:**
   - ✅ Frontend deployment configured
   - ✅ API Gateway behind CloudFront (if applicable)

---

## 📋 IMPLEMENTATION CHECKLIST

### Customer Mobile
- [ ] Verify BookingFeedbackScreen API integration
- [ ] Verify AddAddressScreen API integration
- [ ] Verify ChangePasswordScreen API integration
- [ ] Add CustomerOnboardingScreen API integration
- [ ] Add OrderReturnScreen API integration
- [ ] Verify PaymentFailureRecoveryScreen API integration
- [ ] Add SettingsScreen API integration
- [ ] Add WalletTopUpScreen API integration

### Vendor Mobile
- [ ] Add BookingCheckInScreen API integration
- [ ] Add FileUploadScreen API integration
- [ ] Add StartServiceScreen API integration
- [ ] Add EmergencyAlertScreen API integration
- [ ] Add DataExportScreen API integration
- [ ] Mark HelpScreen as static or add API
- [ ] Mark LogoutScreen as static (no API needed)
- [ ] Add RealTimeUpdatesScreen API integration
- [ ] Add RouteOptimizationScreen API integration
- [ ] Add SecurityScreen API integration
- [ ] Add RouteTrackingScreen API integration

### API Service Files
- [ ] Add missing methods to Customer API service
- [ ] Add missing methods to Vendor API service
- [ ] Verify all methods have proper error handling

### iOS/Android Compatibility
- [ ] Test API calls on iOS simulator
- [ ] Test API calls on Android emulator
- [ ] Verify file uploads work on both platforms
- [ ] Verify location services work on both platforms

### AWS Architecture Verification
- [ ] Verify RDS connection
- [ ] Verify Lambda handlers are stateless
- [ ] Verify Cognito integration
- [ ] Verify CloudFront deployment

---

## 🚀 DEPLOYMENT ARCHITECTURE

### AWS Serverless Stack

```
┌─────────────────┐
│   CloudFront    │  ← Frontend (React Native apps)
└────────┬─────────┘
         │
┌────────▼─────────┐
│  API Gateway     │  ← API endpoints
└────────┬─────────┘
         │
┌────────▼─────────┐
│     Lambda       │  ← Backend handlers
└────────┬─────────┘
         │
┌────────▼─────────┐
│   RDS (PostgreSQL)│  ← Database
└──────────────────┘

┌─────────────────┐
│    Cognito      │  ← Authentication
└─────────────────┘
```

### Mobile App Architecture

```
┌─────────────────────────────────┐
│   React Native App (iOS/Android)│
│                                 │
│  ┌───────────────────────────┐ │
│  │   API Service Layer       │ │
│  │   (api.ts)                │ │
│  └───────────┬───────────────┘ │
│              │                  │
│  ┌───────────▼───────────────┐ │
│  │   Screens (Components)    │ │
│  │   - All with API calls    │ │
│  └───────────────────────────┘ │
└─────────────────────────────────┘
              │
              │ HTTPS
              ▼
┌─────────────────────────────────┐
│   AWS API Gateway               │
│   → Lambda Functions            │
│   → RDS (PostgreSQL)            │
│   → Cognito (Auth)              │
└─────────────────────────────────┘
```

---

## ✅ SUCCESS CRITERIA

1. ✅ **100% API Integration:** All 131 mobile screens have API integration
2. ✅ **iOS Compatibility:** All API calls work on iOS
3. ✅ **Android Compatibility:** All API calls work on Android
4. ✅ **AWS Serverless:** All endpoints use Lambda, RDS, Cognito, CloudFront
5. ✅ **Error Handling:** All API calls have proper error handling
6. ✅ **Loading States:** All screens show loading states during API calls
7. ✅ **Offline Handling:** Graceful degradation when offline

---

## 📝 NOTES

- Some screens may be marked as "needsAPI" but already have API integration (verification script may have missed them)
- Static screens (like LogoutScreen) don't need API integration
- Help screens may be static or may need API for dynamic content
- Real-time updates may require WebSocket connections (to be implemented separately)

---

**Status:** Ready for Implementation  
**Priority:** High  
**Estimated Time:** 2-3 hours for complete implementation

