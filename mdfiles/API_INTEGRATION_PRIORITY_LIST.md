# API Integration Priority List
## Screens That Need API Integration

**Date:** 2026-01-07  
**Total Screens Needing API:** 51  
**Screens With API:** 227 ✅

---

## HIGH PRIORITY (Customer-Facing, Data-Driven)

### Customer Mobile (20 screens)
1. ✅ BookingFeedbackScreen - **HAS API** (CustomerApi.submitFeedback)
2. ✅ OrderReturnScreen - **HAS API** (CustomerApi.cancelOrder)
3. ✅ SettingsScreen - **HAS API** (ApiService.clearSessionToken)
4. ✅ WalletTopUpScreen - **HAS API** (WalletApi.topUpWallet)
5. ⏳ AddAddressScreen - Needs API (address management)
6. ⏳ ChangePasswordScreen - Needs API (password update)
7. ⏳ CustomerOnboardingScreen - May need API (onboarding flow)
8. ⏳ PaymentFailureRecoveryScreen - Needs API (payment retry)

### Vendor Mobile (15 screens)
1. ⏳ BookingCheckInScreen - Needs API (check-in booking)
2. ⏳ FileUploadScreen - Needs API (file upload)
3. ⏳ StartServiceScreen - Needs API (start service)
4. ⏳ EmergencyAlertScreen - Needs API (emergency handling)
5. ⏳ DataExportScreen - Needs API (data export)
6. ⏳ HelpScreen - May not need API (static content)
7. ⏳ LogoutScreen - May not need API (local action)
8. ⏳ RealTimeUpdatesScreen - Needs API (real-time data)
9. ⏳ RouteOptimizationScreen - Needs API (route calculation)
10. ⏳ SecurityScreen - Needs API (security settings)
11. ⏳ RouteTrackingScreen - Needs API (GPS tracking)

### Customer Web (8 screens)
1. ⏳ AddPetModal - Needs API (add pet)
2. ⏳ ServiceDiscovery - Verify API integration
3. ⏳ CustomerBookingsPage - Verify API integration
4. ⏳ CustomerWallet - Verify API integration

### Vendor Web (8 screens)
1. ✅ VendorSettings - **HAS API** (just added)
2. ⏳ VendorServiceManagement - Verify API integration
3. ⏳ VendorBookings - Verify API integration

---

## MEDIUM PRIORITY (Utility/Support Screens)

### Customer Mobile
- OrderTrackingScreen - May need API (tracking data)
- OrderInvoiceScreen - May need API (invoice download)
- PaymentFailureRecoveryScreen - Needs API

### Vendor Mobile
- HelpScreen - Static content (may not need API)
- LogoutScreen - Local action (may not need API)
- DataExportScreen - Needs API

---

## LOW PRIORITY (Static/UI-Only Screens)

These screens may not need API integration:
- Static content screens
- Navigation screens
- UI-only components
- Modal overlays without data

---

## API ENDPOINTS NEEDED

### Address Management
- `GET /customer/addresses` - List addresses
- `POST /customer/addresses` - Add address
- `PUT /customer/addresses/:id` - Update address
- `DELETE /customer/addresses/:id` - Delete address

### Password Management
- `PUT /customer/password` - Change password
- `POST /customer/password/reset` - Reset password

### Payment Recovery
- `POST /payments/:id/retry` - Retry failed payment
- `GET /payments/:id/status` - Get payment status

### Booking Actions (Vendor)
- `POST /vendor/bookings/:id/check-in` - Check in booking
- `POST /vendor/bookings/:id/start` - Start service
- `POST /vendor/bookings/:id/upload-file` - Upload file

### Real-time Updates
- `GET /vendor/updates/realtime` - Get real-time updates
- WebSocket connection for live updates

### Route & Tracking
- `GET /vendor/routes/optimize` - Optimize route
- `GET /vendor/tracking/:bookingId` - Get tracking data

---

## IMPLEMENTATION PLAN

### Phase 1: High Priority (This Week)
1. Add address management API to AddAddressScreen
2. Add password change API to ChangePasswordScreen
3. Add payment retry API to PaymentFailureRecoveryScreen
4. Add booking action APIs to vendor mobile screens
5. Verify and add API to web screens

### Phase 2: Medium Priority (Next Week)
6. Add real-time updates API
7. Add route optimization API
8. Add tracking APIs
9. Add file upload APIs

### Phase 3: Low Priority (As Needed)
10. Review static screens (may not need API)
11. Add API to utility screens if needed

---

## NOTES

- Many screens already have API integration (227/299 = 76%)
- Focus on the 51 screens that truly need API
- Some screens may be static/UI-only and don't need API
- Verify each screen's purpose before adding API

---

**Last Updated:** 2026-01-07

