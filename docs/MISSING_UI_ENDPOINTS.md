# Missing UI Endpoints in Customer Web App

This document lists UI endpoints (pages/routes) that are missing but have backend API support available.

## 📋 Summary

- **Total Missing Pages:** 24
- **Priority 1 (Critical):** 8
- **Priority 2 (Important):** 10
- **Priority 3 (Nice to Have):** 6

---

## 🔴 Priority 1: Critical Missing Pages

### 1. **Support/Help Center**
- **Route:** `/support` or `/help`
- **API Endpoints Available:**
  - `GET /support/tickets` - List support tickets
  - `POST /support/tickets` - Create ticket
  - `GET /support/tickets/:id` - Get ticket details
  - `POST /support/tickets/:id/respond` - Respond to ticket
  - `PUT /support/tickets/:id/status` - Update ticket status
- **Status:** ❌ Missing
- **Components:** Need to create `SupportCenterPage`, `TicketList`, `TicketDetail`, `CreateTicketModal`

### 2. **Order Details Page**
- **Route:** `/orders/[id]`
- **API Endpoints Available:**
  - `GET /customer/orders/:id` - Get order details
  - `GET /customer/orders/:id/invoice` - Get invoice
  - `PUT /orders/:id` - Update order
  - `POST /orders/:id/cancel` - Cancel order
- **Status:** ⚠️ Partial (exists but may need enhancement)
- **Note:** Currently exists as `/orders/[id]/tracking` but full order details page needed

### 3. **Booking Details Page**
- **Route:** `/bookings/[id]`
- **API Endpoints Available:**
  - `GET /bookings/:id` - Get booking details
  - `GET /bookings/:id/history` - Get booking history
  - `POST /bookings/:id/cancel` - Cancel booking
  - `POST /bookings/:id/reschedule` - Reschedule booking
  - `GET /bookings/:id/receipt` - Get receipt
  - `POST /bookings/:id/checkin` - Check-in booking
  - `POST /bookings/:id/generate-otp` - Generate OTP
  - `POST /bookings/:id/verify-otp` - Verify OTP
- **Status:** ❌ Missing
- **Components:** `BookingDetailsPage`, `BookingHistoryView`, `BookingReceiptView`

### 4. **Returns/Refunds Management**
- **Route:** `/orders/returns` or `/refunds`
- **API Endpoints Available:**
  - `POST /customer/refunds/request` - Request refund
  - `POST /payment/refund` - Request payment refund
  - `GET /refunds` - List refunds (need to verify endpoint)
  - `GET /refunds/:id` - Get refund details
- **Status:** ❌ Missing
- **Components:** `ReturnsPage`, `RefundRequestForm`, `RefundHistory`, `RefundDetails`

### 5. **Reviews & Ratings**
- **Route:** `/reviews`
- **API Endpoints Available:**
  - `POST /bookings/:bookingId/feedback` - Submit feedback/review
  - `GET /reviews` - Get reviews (need to verify endpoint)
  - `GET /reviews/:id` - Get review details
  - `PUT /reviews/:id` - Update review
  - `DELETE /reviews/:id` - Delete review
- **Status:** ❌ Missing
- **Components:** `ReviewsPage`, `ReviewForm`, `MyReviewsList`, `ReviewDetails`

### 6. **Addresses Management**
- **Route:** `/addresses`
- **API Endpoints Available:**
  - `GET /customer/:customerId/addresses` - List addresses
  - `POST /customer/:customerId/addresses` - Add address
  - `PUT /customer/:customerId/addresses/:id` - Update address
  - `DELETE /customer/:customerId/addresses/:id` - Delete address
- **Status:** ⚠️ Partial (exists in UserAccountSidebar but not as standalone page)
- **Components:** Need standalone `AddressesPage` (currently embedded)

### 7. **Prescriptions Management**
- **Route:** `/prescriptions`
- **API Endpoints Available:**
  - `GET /prescriptions` - List prescriptions (need to verify endpoint)
  - `GET /prescriptions/:id` - Get prescription details
  - `POST /prescriptions` - Create prescription
  - `PUT /prescriptions/:id` - Update prescription
- **Status:** ⚠️ Partial (exists `/medical-records` but prescriptions need separate page)
- **Components:** `PrescriptionsPage`, `PrescriptionDetail`, `PrescriptionRefill`

### 8. **Payment Methods Management**
- **Route:** `/settings/payments` or `/payment-methods`
- **API Endpoints Available:**
  - `GET /payment/methods` - List payment methods (need to verify endpoint)
  - `POST /payment/methods` - Add payment method
  - `DELETE /payment/methods/:id` - Remove payment method
  - `PUT /payment/methods/:id/default` - Set default method
- **Status:** ❌ Missing
- **Components:** `PaymentMethodsPage`, `AddPaymentMethodForm`, `PaymentMethodCard`

---

## 🟡 Priority 2: Important Missing Pages

### 9. **Appointments Page** (Separate from Bookings)
- **Route:** `/appointments`
- **API Endpoints Available:**
  - `GET /customer/appointments` - List appointments
  - `GET /customer/appointments/:id` - Get appointment details
  - `POST /customer/appointments/:id/cancel` - Cancel appointment
  - `POST /customer/appointments/:id/reschedule` - Reschedule appointment
- **Status:** ⚠️ Partial (exists in CustomerHomeWrapper but not as standalone route)
- **Components:** Need standalone `AppointmentsPage` route

### 10. **Invoice/Receipt Viewer**
- **Route:** `/orders/[id]/invoice` or `/invoices/[id]`
- **API Endpoints Available:**
  - `GET /customer/orders/:id/invoice` - Get order invoice
  - `GET /bookings/:id/receipt` - Get booking receipt
- **Status:** ❌ Missing
- **Components:** `InvoiceViewerPage`, `ReceiptViewerPage`, `DownloadInvoiceButton`

### 11. **Loyalty Points Details**
- **Route:** `/rewards/points` or `/loyalty/points`
- **API Endpoints Available:**
  - `GET /customer/:customerId/rewards/points` - Get points balance
  - `GET /customer/:customerId/rewards/history` - Get points history
  - `GET /customer/:customerId/rewards/available` - Get available rewards
  - `POST /customer/:customerId/rewards/redeem` - Redeem reward
- **Status:** ⚠️ Partial (exists `/rewards` but needs detailed points view)
- **Components:** `LoyaltyPointsPage`, `PointsHistoryView`, `RewardsCatalog`

### 12. **Referral Program Details**
- **Route:** `/referrals/details` or `/referrals/earnings`
- **API Endpoints Available:**
  - `GET /customer/:customerId/referral` - Get referral code
  - `GET /customer/:customerId/referral/stats` - Get referral stats
  - `GET /customer/:customerId/referral/history` - Get referral history
  - `POST /referral/invite` - Send referral invite
  - `POST /customer/:customerId/referral/claim` - Claim referral reward
- **Status:** ⚠️ Partial (exists `/referrals` but needs detailed view)
- **Components:** `ReferralDetailsPage`, `ReferralStatsView`, `ReferralHistory`, `ReferralInviteForm`

### 13. **Subscription Management Details**
- **Route:** `/subscriptions/[id]` or `/subscriptions/management`
- **API Endpoints Available:**
  - `GET /customer/:customerId/subscriptions` - List subscriptions
  - `GET /subscriptions/:id` - Get subscription details
  - `POST /subscriptions/:id/cancel` - Cancel subscription
  - `POST /subscriptions/:id/pause` - Pause subscription
  - `POST /subscriptions/:id/resume` - Resume subscription
  - `GET /subscriptions/:id/usage` - Get subscription usage
- **Status:** ⚠️ Partial (exists `/subscriptions` but needs detailed management)
- **Components:** `SubscriptionDetailsPage`, `SubscriptionUsageView`, `SubscriptionPauseResume`

### 14. **Emergency Services**
- **Route:** `/emergency` or `/sos`
- **API Endpoints Available:**
  - `POST /ambulance/sos` - Emergency ambulance (from specialized-services)
  - Related emergency endpoints (need to verify)
- **Status:** ⚠️ Partial (exists in CustomerHomeWrapper but not as standalone route)
- **Components:** Need standalone `EmergencyServicesPage` route

### 15. **Booking History with Filters**
- **Route:** `/bookings/history`
- **API Endpoints Available:**
  - `GET /customer/:customerId/bookings` - Get bookings with filters
  - `GET /customer/bookings/pet/:phone/:petId` - Get pet bookings
- **Status:** ⚠️ Partial (exists `/bookings` but needs enhanced filtering)
- **Components:** Enhanced `BookingsHistoryPage` with filters (status, date, pet, service type)

### 16. **Order History with Filters**
- **Route:** `/orders/history`
- **API Endpoints Available:**
  - `GET /customer/orders` - Get orders with filters (status, date)
- **Status:** ⚠️ Partial (exists `/orders` but needs enhanced filtering)
- **Components:** Enhanced `OrdersHistoryPage` with filters (status, date range, vendor)

### 17. **Medical Records Detailed View**
- **Route:** `/medical-records/[id]`
- **API Endpoints Available:**
  - `GET /medical-records/:id` - Get medical record details
  - Related medical records endpoints (need to verify)
- **Status:** ⚠️ Partial (exists `/medical-records` but no detail view)
- **Components:** `MedicalRecordDetailPage`, `MedicalRecordViewer`

### 18. **Community/Social Features**
- **Route:** `/community` or `/social`
- **API Endpoints Available:**
  - `GET /community/posts` - List posts (need to verify endpoint)
  - `POST /community/posts` - Create post
  - `POST /community/posts/:id/like` - Like post
  - `DELETE /community/posts/:id/like` - Unlike post
  - `POST /community/posts/:id/comments` - Comment on post
  - `GET /community/posts/:id/comments` - Get comments
  - `DELETE /community/posts/:id` - Delete post
- **Status:** ❌ Missing
- **Components:** `CommunityPage`, `PostFeed`, `CreatePostForm`, `PostDetail`, `CommentsView`

---

## 🟢 Priority 3: Nice to Have Missing Pages

### 19. **Booking Check-in/OTP Verification**
- **Route:** `/bookings/[id]/checkin`
- **API Endpoints Available:**
  - `POST /bookings/:id/checkin` - Check-in booking
  - `POST /bookings/:id/generate-otp` - Generate OTP
  - `POST /bookings/:id/verify-otp` - Verify OTP
- **Status:** ❌ Missing
- **Components:** `BookingCheckinPage`, `OTPVerificationForm`

### 20. **Wallet Transactions History**
- **Route:** `/wallet/transactions`
- **API Endpoints Available:**
  - `GET /customer/:customerId/wallet/transactions` - Get transactions
  - `GET /customer/:customerId/wallet` - Get wallet balance
- **Status:** ⚠️ Partial (exists `/wallet` but needs detailed transactions view)
- **Components:** Enhanced `WalletTransactionsPage` with filters

### 21. **Rescheduling Options/Policy**
- **Route:** `/bookings/[id]/reschedule` (enhanced)
- **API Endpoints Available:**
  - `GET /booking/rescheduling-policy/:serviceType` - Get policy
  - `GET /booking/:bookingId/reschedule-options` - Get options
  - `POST /booking/:bookingId/reschedule` - Reschedule
  - `POST /booking/:bookingId/reschedule/confirm` - Confirm reschedule
- **Status:** ⚠️ Partial (modal exists but needs full page)
- **Components:** `RescheduleOptionsPage`, `ReschedulingPolicyView`

### 22. **Notification Preferences**
- **Route:** `/settings/notifications`
- **API Endpoints Available:**
  - `PUT /customer/settings/notifications` - Update preferences
  - `POST /push/register-device` - Register device
  - `POST /notifications/push/register` - Register push token
- **Status:** ⚠️ Partial (exists in settings but needs dedicated page)
- **Components:** `NotificationPreferencesPage`, `NotificationChannelSettings`

### 23. **Order Tracking Standalone**
- **Route:** `/orders/[id]/tracking` (enhanced)
- **API Endpoints Available:**
  - `GET /orders/:id/tracking` - Get tracking info
  - `GET /customer/shop/orders/:orderId/track` - Track order (ecommerce)
- **Status:** ⚠️ Partial (exists but needs enhancement)
- **Components:** Enhanced `OrderTrackingPage` with real-time updates

### 24. **Vendor/Service Reviews**
- **Route:** `/reviews/vendors` or `/reviews/services`
- **API Endpoints Available:**
  - `GET /vendors/:id/reviews` - Get vendor reviews (need to verify)
  - `GET /services/:id/reviews` - Get service reviews (need to verify)
- **Status:** ❌ Missing
- **Components:** `VendorReviewsPage`, `ServiceReviewsPage`, `ReviewFilters`

---

## 📊 Statistics

### By Category:
- **Order Management:** 4 missing pages
- **Booking Management:** 4 missing pages
- **Support & Help:** 2 missing pages
- **Reviews & Ratings:** 2 missing pages
- **Financial:** 3 missing pages (wallet, refunds, payments)
- **Profile & Settings:** 3 missing pages
- **Community:** 1 missing page
- **Medical:** 2 missing pages
- **Loyalty & Rewards:** 2 missing pages
- **Emergency:** 1 missing page

### By Status:
- **❌ Completely Missing:** 12 pages
- **⚠️ Partial/Needs Enhancement:** 12 pages

---

## 🎯 Recommended Implementation Order

1. **Phase 1 (Week 1-2):**
   - Support/Help Center (`/support`)
   - Booking Details Page (`/bookings/[id]`)
   - Order Details Page (`/orders/[id]`)
   - Returns/Refunds (`/refunds`)

2. **Phase 2 (Week 3-4):**
   - Reviews & Ratings (`/reviews`)
   - Addresses Management (`/addresses`)
   - Payment Methods (`/settings/payments`)
   - Prescriptions (`/prescriptions`)

3. **Phase 3 (Week 5-6):**
   - Invoice/Receipt Viewer (`/invoices/[id]`)
   - Appointments Page (`/appointments`)
   - Enhanced Booking History (`/bookings/history`)
   - Enhanced Order History (`/orders/history`)

4. **Phase 4 (Week 7-8):**
   - Loyalty Points Details (`/rewards/points`)
   - Referral Program Details (`/referrals/details`)
   - Subscription Management (`/subscriptions/[id]`)
   - Community Features (`/community`)

---

## 📝 Notes

- Some features exist in components but don't have dedicated routes (e.g., addresses in UserAccountSidebar)
- Some pages exist but need enhancement with additional API endpoints
- All API endpoints listed should be verified for exact paths and request/response formats
- Components should follow the existing design system and patterns
- Consider mobile responsiveness for all new pages
- Add proper loading states, error handling, and empty states

---

**Last Updated:** 2026-01-28
**Maintained By:** Development Team

