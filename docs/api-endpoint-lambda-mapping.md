# API Endpoint → Lambda Mapping

> **Document Purpose**: Maps all API endpoints from frontend applications to their corresponding Lambda handlers.
>
> **Generated**: January 8, 2026
>
> **Architecture**: Single Lambda function (`warmpawz-api`) using Hono framework routes all requests to endpoint modules.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Gateway                               │
│                    (HTTP API v2, /{proxy+})                     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Lambda: warmpawz-api                         │
│                    Handler: dist/handler.handler                │
│                    Framework: Hono                              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Endpoint Modules (99 files)                  │
│    auth-enhanced.ts, bookings-enhanced.ts, admin.ts, etc.       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Admin Web (`apps/admin-web`)

| HTTP | API Endpoint | Endpoint Module | Purpose | Shared |
|------|--------------|-----------------|---------|--------|
| POST | `/admin/settings/general` | admin.ts | Save general settings | No |
| POST | `/admin/settings/integrations` | admin-integrations.ts | Save integration settings | No |
| POST | `/admin/settings/notifications` | notifications.ts | Save notification settings | No |
| POST | `/admin/support/tickets/:id/reply` | support-crm.ts | Reply to support ticket | Yes |
| DELETE | `/admin/rbac/roles/:roleId` | roles.ts | Delete RBAC role | No |
| POST | `/admin/catalog/pricing-rules` | service-catalog.ts | Create pricing rules | No |
| PUT | `/admin/catalog/services/:serviceId` | service-catalog.ts | Update catalog service | No |
| PUT | `/admin/catalog/products/:productId` | vendor-products.ts | Update catalog product | No |
| PUT | `/admin/catalog/categories/:categoryId` | service-catalog.ts | Update category | No |
| POST | `/admin/catalog/:itemType/bulk-edit` | service-catalog.ts | Bulk edit catalog items | No |
| POST | `/admin/catalog/services` | service-catalog.ts | Add catalog service | No |
| POST | `/admin/catalog/categories` | service-catalog.ts | Add category | No |
| POST | `/admin/catalog/products` | vendor-products.ts | Add catalog product | No |
| POST | `/admin/vendors/reverification-requests/:id/verify` | admin.ts | Verify reverification | No |
| POST | `/admin/vendors/reverification-requests/:id/reject` | admin.ts | Reject reverification | No |
| POST | `/admin/vendor/application/:appId/approve` | admin.ts | Approve vendor application | No |
| POST | `/admin/vendor/application/:appId/reject` | admin.ts | Reject vendor application | No |
| POST | `/admin/vendor/application/:appId/request-clarification` | admin.ts | Request clarification | No |
| POST | `/admin/vendors/deactivation-requests/:id/approve` | admin.ts | Approve deactivation | No |
| POST | `/admin/vendors/deactivation-requests/:id/reject` | admin.ts | Reject deactivation | No |
| POST | `/admin/vendors/compliance-issues/:id/investigate` | admin-governance.ts | Investigate compliance | No |
| POST | `/admin/vendors/compliance-issues/:id/resolve` | admin-governance.ts | Resolve compliance issue | No |
| POST | `/admin/vendors/clarification-requests/:id/review` | admin.ts | Review clarification | No |
| POST | `/admin/vendors/:vendorId/approve` | admin.ts | Approve vendor | No |
| POST | `/admin/vendors/:vendorId/reject` | admin.ts | Reject vendor | No |
| POST | `/admin/vendors/:vendorId/request-changes` | admin.ts | Request changes | No |
| POST | `/admin/vendors/:vendorId/verify` | admin.ts | Verify vendor | No |
| POST | `/admin/vendors/create` | admin.ts | Create vendor | No |
| POST | `/settlements/calculate-daily` | settlements.ts | Calculate daily settlements | Yes |
| POST | `/settlements/process-payouts` | settlements.ts | Process payouts | Yes |
| POST | `/settlements/process` | settlements.ts | Process settlements | Yes |
| POST | `/settlements/auto-process` | settlements.ts | Auto-process settlements | Yes |
| POST | `/settlements/:id/retry` | settlements.ts | Retry settlement | Yes |
| PUT | `/admin/roles/:roleId` | roles.ts | Update role | No |
| POST | `/admin/roles` | roles.ts | Create role | No |
| POST | `/admin/refunds/:refundId/reject` | refunds.ts | Reject refund | No |
| POST | `/logistics/cancel-order` | logistics.ts | Cancel logistics order | Yes |
| POST | `/admin/governance/invalidate-cache` | admin-governance.ts | Invalidate cache | No |
| POST | `/admin/governance/propagate` | admin-governance.ts | Propagate governance | No |
| PUT | `/admin/tiers/:tierId` | tier-system.ts | Update tier | No |
| POST | `/admin/tiers` | tier-system.ts | Create tier | No |
| PUT | `/admin/settings` | admin.ts | Update settings | No |
| POST | `/admin/vendors/:vendorId/approve-seller` | admin-sellers.ts | Approve seller | No |
| POST | `/admin/vendors/:vendorId/reject-seller` | admin-sellers.ts | Reject seller | No |
| POST | `/admin/reports/generate` | reports.ts | Generate report | No |
| POST | `/admin/reports/save` | reports.ts | Save report | No |
| PUT | `/admin/promotions/:id` | promotions.ts | Update promotion | No |
| POST | `/admin/promotions` | promotions.ts | Create promotion | No |
| DELETE | `/admin/promotions/:id` | promotions.ts | Delete promotion | No |
| POST | `/admin/notifications` | notification-system.ts | Send notification | No |
| PUT | `/admin/integrations/:integration` | admin-integrations.ts | Update integration | No |
| PUT | `/admin/service-catalog/:id` | service-catalog.ts | Update service catalog | No |
| POST | `/admin/service-catalog` | service-catalog.ts | Create service catalog | No |
| DELETE | `/admin/service-catalog/:id` | service-catalog.ts | Delete service catalog | No |

---

## Customer Web (`apps/customer-web`)

| HTTP | API Endpoint | Endpoint Module | Purpose | Shared |
|------|--------------|-----------------|---------|--------|
| GET | `/services/:serviceId` | service-discovery.ts | Get service details | Yes |
| GET | `/customers/phone/:phone` | customer-enhanced.ts | Get customer by phone | Yes |
| GET | `/customers/:id/pets` | pets.ts | Get customer pets | Yes |
| GET | `/customers/:id/addresses` | addresses.ts | Get customer addresses | Yes |
| GET | `/bookings/available-slots` | bookings-enhanced.ts | Get available slots | Yes |
| GET | `/vendors/:vendorId/staff/available` | staff.ts | Get available staff | Yes |
| POST | `/bookings/create` | bookings-enhanced.ts | Create booking | Yes |
| POST | `/customer/pets` | pets.ts | Add customer pet | Yes |
| POST | `/payments/verify` | payments-enhanced.ts | Verify payment | Yes |
| POST | `/video-call/:bookingId/end` | video-call.ts | End video call | Yes |
| POST | `/customer/profile` | customer-profile.ts | Update customer profile | Yes |
| POST | `/customer/refunds/request` | refunds.ts | Request refund | Yes |
| POST | `/integrated-services/:serviceId/cancel` | specialized-services.ts | Cancel integrated service | Yes |
| PUT | `/customer/settings/notifications` | notifications.ts | Update notification settings | Yes |
| POST | `/push/register-device` | push-notifications.ts | Register push device | Yes |
| GET | `/customer/pets/:phone` | pets.ts | Get pets by phone | Yes |
| POST | `/customer/onboarding` | customer-enhanced.ts | Update onboarding | Yes |
| POST | `/bookings/:id/reschedule` | bookings-enhanced.ts | Reschedule booking | Yes |
| POST | `/bookings/:id/cancel` | bookings-enhanced.ts | Cancel booking | Yes |
| POST | `/ecommerce/orders` | ecommerce.ts | Create ecommerce order | Yes |
| POST | `/rewards/redeem` | rewards.ts | Redeem rewards | Yes |
| PUT | `/customer/:customerId/profile` | customer-profile.ts | Update customer profile | Yes |
| POST | `/pets/create` | pets.ts | Create pet | Yes |
| POST | `/orders/:orderId/cancel` | order-management.ts | Cancel order | Yes |
| GET | `/customer/by-phone` | customer-enhanced.ts | Get customer by phone | Yes |
| GET | `/customer/orders` | customer-orders.ts | Get customer orders | Yes |
| POST | `/insurance/policies` | insurance.ts | Create insurance policy | Yes |
| POST | `/insurance/claims` | insurance.ts | Create insurance claim | Yes |
| POST | `/events/:eventId/register` | events.ts | Register for event | Yes |
| DELETE | `/events/registrations/:id` | events.ts | Cancel event registration | Yes |
| POST | `/donations/campaigns/:id/donate` | donations.ts | Make donation | Yes |
| POST | `/chat/conversations/:id/read` | chat.ts | Mark chat read | Yes |
| POST | `/chat/conversations/:id/messages` | chat.ts | Send chat message | Yes |
| POST | `/auth/otp/send` | auth-enhanced.ts | Send OTP | Yes |
| GET | `/customer/profile/unified/:phone` | customer-profile.ts | Get unified profile | Yes |
| PUT | `/notifications/:id/read` | notifications.ts | Mark notification read | Yes |
| POST | `/ai-chatbot/chat` | ai-chatbot.ts | AI chatbot interaction | Yes |
| POST | `/ai-chatbot/symptoms-checker` | ai-chatbot.ts | Check symptoms | Yes |
| POST | `/ai-chatbot/booking-assist` | ai-chatbot.ts | Booking assistance | Yes |
| POST | `/ai-chatbot/escalate-to-agent` | ai-chatbot.ts | Escalate to agent | Yes |
| GET | `/ai-chatbot/conversation/:id` | ai-chatbot.ts | Get conversation | Yes |
| POST | `/support/tickets` | support-crm.ts | Create support ticket | Yes |
| GET | `/support/tickets` | support-crm.ts | Get support tickets | Yes |
| GET | `/support/tickets/:ticketId` | support-crm.ts | Get ticket details | Yes |
| POST | `/support/tickets/:ticketId/respond` | support-crm.ts | Respond to ticket | Yes |
| PUT | `/support/tickets/:ticketId/status` | support-crm.ts | Update ticket status | Yes |

---

## Vendor Web (`apps/vendor-web`)

| HTTP | API Endpoint | Endpoint Module | Purpose | Shared |
|------|--------------|-----------------|---------|--------|
| POST | `/vendor/:vendorId/resort/boarding-bookings/:id/checkin` | pet-resort.ts | Checkin boarding | No |
| POST | `/vendor/:vendorId/resort/boarding-bookings/:id/checkout` | pet-resort.ts | Checkout boarding | No |
| PUT | `/vendor/:vendorId/products/:id` | vendor-products.ts | Update product | Yes |
| POST | `/vendor/:vendorId/products` | vendor-products.ts | Add product | Yes |
| DELETE | `/vendor/:vendorId/packages/:id` | packages.ts | Delete package | Yes |
| PUT | `/orders/:id/status` | order-management.ts | Update order status | Yes |
| PUT | `/vendor/:vendorId/services/:id` | vendor-services.ts | Update service | Yes |
| POST | `/vendor/:vendorId/services` | vendor-services.ts | Add service | Yes |
| DELETE | `/vendor/:vendorId/services/:id` | vendor-services.ts | Delete service | Yes |
| PUT | `/vendor/:vendorId/staff/:staffId` | staff.ts | Update staff | Yes |
| DELETE | `/vendor/:vendorId/staff/:staffId` | staff.ts | Delete staff | Yes |
| POST | `/vendor/:vendorId/staff` | staff.ts | Add staff | Yes |
| GET | `/vendor/:vendorId/settings` | vendor-settings.ts | Get vendor settings | Yes |
| PUT | `/vendor/:vendorId/profile` | vendor-profile.ts | Update vendor profile | Yes |
| PUT | `/vendor/:vendorId/bank-details` | vendor-profile.ts | Update bank details | Yes |
| PUT | `/vendor/:vendorId/schedule` | vendor-schedule.ts | Update schedule | Yes |
| PUT | `/vendor/:vendorId/notification-preferences` | notifications.ts | Update notification prefs | Yes |
| POST | `/auth/otp/send` | auth-enhanced.ts | Send OTP | Yes |
| PUT | `/vendor/:vendorId/distance-pricing/:id` | vendor-services.ts | Update distance pricing | No |
| POST | `/vendor/:vendorId/distance-pricing` | vendor-services.ts | Add distance pricing | No |
| DELETE | `/vendor/:vendorId/distance-pricing/:id` | vendor-services.ts | Delete distance pricing | No |
| PUT | `/bookings/:bookingId/status` | bookings-enhanced.ts | Update booking status | Yes |
| POST | `/vendor/bookings/:bookingId/start-session` | vendor-booking-actions.ts | Start session | Yes |
| POST | `/vendor/bookings/:bookingId/end-session` | vendor-booking-actions.ts | End session | Yes |
| POST | `/vendor/bookings/:bookingId/complete` | vendor-booking-actions.ts | Complete booking | Yes |
| GET | `/prescriptions/booking/:bookingId` | prescriptions.ts | Get prescriptions | Yes |
| POST | `/chat/mark-read/:bookingId` | chat.ts | Mark chat read | Yes |
| POST | `/prescriptions` | prescriptions.ts | Create prescription | Yes |
| POST | `/auth/send-otp` | auth-enhanced.ts | Send OTP | Yes |
| PUT | `/vendor/:vendorId/facility` | vendor-setup.ts | Update facility | No |
| PUT | `/vendor/:vendorId/boarding-rooms/:id` | pet-resort.ts | Update boarding room | No |
| POST | `/vendor/:vendorId/boarding-rooms` | pet-resort.ts | Add boarding room | No |
| DELETE | `/vendor/:vendorId/boarding-rooms/:id` | pet-resort.ts | Delete boarding room | No |
| PUT | `/vendor/:vendorId/center-availability` | vendor-schedule.ts | Update availability | No |
| PUT | `/vendor/:vendorId/center-profile` | vendor-profile.ts | Update center profile | No |
| PUT | `/vendor/subscriptions/plans/:id` | subscriptions.ts | Update subscription plan | Yes |
| POST | `/vendor/subscriptions/plans` | subscriptions.ts | Create subscription plan | Yes |
| DELETE | `/vendor/subscriptions/plans/:id` | subscriptions.ts | Delete subscription plan | Yes |
| POST | `/staff/create` | staff.ts | Create staff | Yes |
| PUT | `/staff/:staffId` | staff.ts | Update staff | Yes |
| POST | `/vendor-services/create` | vendor-services.ts | Create vendor service | Yes |
| PUT | `/vendor-services/:serviceId` | vendor-services.ts | Update vendor service | Yes |
| PUT | `/vendor/${vendorId}/cafe/menu/:id` | pet-cafe.ts | Update menu item | No |
| POST | `/vendor/${vendorId}/cafe/menu` | pet-cafe.ts | Add menu item | No |
| DELETE | `/vendor/${vendorId}/cafe/menu/:id` | pet-cafe.ts | Delete menu item | No |
| PUT | `/vendor-schedule/:vendorId` | vendor-schedule.ts | Update schedule | Yes |
| PUT | `/vendor/${vendorId}/resort/boarding-bookings/:id/status` | pet-resort.ts | Update boarding status | No |
| DELETE | `/vendor/:vendorId/products/:productId` | vendor-products.ts | Delete product | Yes |
| PUT | `/vendor/packages/:id` | packages.ts | Update package | Yes |
| POST | `/vendor/packages` | packages.ts | Create package | Yes |
| DELETE | `/vendor/packages/:id` | packages.ts | Delete package | Yes |
| POST | `/orders/:id/cancel` | order-management.ts | Cancel order | Yes |
| POST | `/logistics/shiprocket/create-order` | logistics.ts | Create Shiprocket order | Yes |
| PUT | `/vendor/${vendorId}/nutrition/meal-plans/:id` | specialized-services.ts | Update meal plan | No |
| POST | `/vendor/${vendorId}/nutrition/meal-plans` | specialized-services.ts | Create meal plan | No |
| DELETE | `/vendor/${vendorId}/nutrition/meal-plans/:id` | specialized-services.ts | Delete meal plan | No |
| PUT | `/vendor/${vendorId}/insurance/claims/:id/status` | insurance.ts | Update claim status | Yes |
| PUT | `/vendor/${vendorId}/insurance/plans/:id` | insurance.ts | Update insurance plan | Yes |
| POST | `/vendor/${vendorId}/insurance/plans` | insurance.ts | Create insurance plan | Yes |
| DELETE | `/vendor/${vendorId}/insurance/plans/:id` | insurance.ts | Delete insurance plan | Yes |
| PUT | `/vendor/${vendorId}/nutrition/delivery-orders/:id/status` | specialized-services.ts | Update delivery status | No |
| POST | `/settlements/request` | settlements.ts | Request settlement | Yes |
| PUT | `/vendor/${vendorId}/cafe/tables/:id` | pet-cafe.ts | Update table | No |
| POST | `/vendor/${vendorId}/cafe/tables` | pet-cafe.ts | Add table | No |
| DELETE | `/vendor/${vendorId}/cafe/tables/:id` | pet-cafe.ts | Delete table | No |
| PUT | `/vendor/${vendorId}/cafe/reservations/:id/status` | pet-cafe.ts | Update reservation status | No |
| PUT | `/vendor/bank-accounts/:id` | vendor-profile.ts | Update bank account | Yes |
| POST | `/vendor/bank-accounts` | vendor-profile.ts | Add bank account | Yes |
| POST | `/vendor/bank-accounts/:id/verify` | vendor-profile.ts | Verify bank account | Yes |
| PUT | `/vendor/bank-accounts/:id/set-primary` | vendor-profile.ts | Set primary bank account | Yes |
| DELETE | `/vendor/bank-accounts/:id` | vendor-profile.ts | Delete bank account | Yes |
| POST | `/vendor/upi-accounts` | vendor-profile.ts | Add UPI account | Yes |
| DELETE | `/vendor/upi-accounts/:id` | vendor-profile.ts | Delete UPI account | Yes |

---

## WarmpawzCustomer (React Native - `apps/WarmpawzCustomer`)

| HTTP | API Endpoint | Endpoint Module | Purpose | Shared |
|------|--------------|-----------------|---------|--------|
| GET | `/customer-by-phone/:identifier` | customer-enhanced.ts | Get customer by phone | Yes |
| GET | `/customer/:customerId` | customer-enhanced.ts | Get customer | Yes |
| PUT | `/customer/:customerId` | customer-enhanced.ts | Update customer | Yes |
| GET | `/customer/pets/:identifier` | pets.ts | Get customer pets | Yes |
| POST | `/customer/pets` | pets.ts | Add customer pet | Yes |
| PUT | `/pet/:petId` | pets.ts | Update pet | Yes |
| DELETE | `/pet/:petId` | pets.ts | Delete pet | Yes |
| POST | `/search/vendors` | search.ts | Search vendors | Yes |
| GET | `/customer/services/:serviceId` | service-discovery.ts | Get service details | Yes |
| GET | `/customer/services` | service-discovery.ts | Get services | Yes |
| GET | `/vendor/:vendorId` | vendor-dashboard.ts | Get vendor details | Yes |
| GET | `/vendor/:vendorId/services` | vendor-services.ts | Get vendor services | Yes |
| GET | `/vendor/problem-grid-specializations/:roleId` | service-discovery.ts | Get problem grid | Yes |
| GET | `/vendor/:vendorId/packages` | packages.ts | Get vendor packages | Yes |
| POST | `/customer/adoption-application` | specialized-services.ts | Submit adoption | Yes |
| POST | `/bookings/create` | bookings-enhanced.ts | Create booking | Yes |
| GET | `/customer/:customerId/bookings` | customer-booking-history.ts | Get bookings | Yes |
| GET | `/bookings/:bookingId` | bookings-enhanced.ts | Get booking details | Yes |
| POST | `/bookings/:bookingId/cancel` | bookings-enhanced.ts | Cancel booking | Yes |
| POST | `/bookings/:bookingId/reschedule` | bookings-enhanced.ts | Reschedule booking | Yes |
| GET | `/customer/orders` | customer-orders.ts | Get orders | Yes |
| GET | `/customer/orders/:orderId` | customer-orders.ts | Get order details | Yes |
| GET | `/customer/orders/:orderId/invoice` | customer-orders.ts | Get order invoice | Yes |
| GET | `/customer/shop/orders/:orderId/track` | ecommerce.ts | Track order | Yes |
| POST | `/customer/shop/orders/:orderId/cancel` | order-management.ts | Cancel order | Yes |
| GET | `/crm/tickets` | support-crm.ts | Get support tickets | Yes |
| POST | `/crm/tickets` | support-crm.ts | Create support ticket | Yes |
| GET | `/customer/bookings/pet/:phone/:petId` | customer-booking-history.ts | Get pet bookings | Yes |
| POST | `/otp/generate` | otp-enhanced.ts | Generate OTP | Yes |
| POST | `/otp/verify` | otp-enhanced.ts | Verify OTP | Yes |
| GET | `/customer/notifications/:customerId` | notifications.ts | Get notifications | Yes |
| POST | `/notification/:id/read` | notifications.ts | Mark notification read | Yes |
| PUT | `/customer/notifications/:customerId/mark-all-read` | notifications.ts | Mark all read | Yes |
| DELETE | `/notification/:id` | notifications.ts | Delete notification | Yes |
| DELETE | `/customer/notifications/:customerId/clear-all` | notifications.ts | Clear all notifications | Yes |
| POST | `/notifications/push/register` | push-notifications.ts | Register push token | Yes |
| POST | `/bookings/:bookingId/checkin` | bookings-enhanced.ts | Checkin booking | Yes |
| POST | `/bookings/:bookingId/feedback` | reviews.ts | Submit feedback | Yes |
| GET | `/bookings/:bookingId/receipt` | bookings-enhanced.ts | Get receipt | Yes |
| GET | `/customer/:customerId/addresses` | addresses.ts | Get addresses | Yes |
| POST | `/customer/addresses` | addresses.ts | Add address | Yes |
| PUT | `/customer/addresses/:addressId` | addresses.ts | Update address | Yes |
| DELETE | `/customer/addresses/:addressId` | addresses.ts | Delete address | Yes |
| GET | `/customer/shop/cart/:customerId` | ecommerce.ts | Get cart | Yes |
| POST | `/customer/shop/cart/:customerId` | ecommerce.ts | Add to cart | Yes |
| PUT | `/customer/shop/cart/:customerId/items/:itemId` | ecommerce.ts | Update cart item | Yes |
| DELETE | `/customer/shop/cart/:customerId/items/:itemId` | ecommerce.ts | Delete cart item | Yes |
| POST | `/customer/shop/checkout` | ecommerce.ts | Checkout | Yes |
| POST | `/customer/shop/coupons/validate` | promotions.ts | Validate coupon | Yes |
| GET | `/customer/shop/coupons/available` | promotions.ts | Get available coupons | Yes |
| GET | `/customer/shop/home` | ecommerce.ts | Get shop home data | Yes |
| GET | `/customer/shop/products` | ecommerce.ts | Search products | Yes |
| GET | `/customer/shop/products/:productId` | ecommerce.ts | Get product details | Yes |
| POST | `/customer/change-password` | customer-password.ts | Change password | Yes |
| GET | `/customer/:customerId/settings` | customer-enhanced.ts | Get settings | Yes |
| PUT | `/customer/:customerId/settings` | customer-enhanced.ts | Update settings | Yes |
| POST | `/customer/:customerId/onboarding` | customer-enhanced.ts | Update onboarding | Yes |
| GET | `/customer/:customerId/wishlist` | ecommerce.ts | Get wishlist | Yes |
| POST | `/customer/:customerId/wishlist` | ecommerce.ts | Add to wishlist | Yes |
| DELETE | `/customer/wishlist/:wishlistItemId` | ecommerce.ts | Remove from wishlist | Yes |
| GET | `/orders/:orderId/invoice` | order-management.ts | Get order invoice | Yes |
| POST | `/customer/shop/orders/:orderId/reorder` | ecommerce.ts | Reorder | Yes |
| POST | `/customer/returns` | returns.ts | Create return | Yes |
| GET | `/customer/events` | events.ts | Get events | Yes |
| GET | `/customer/events/:eventId` | events.ts | Get event details | Yes |
| POST | `/customer/events/:eventId/register` | events.ts | Register for event | Yes |
| GET | `/customer/memorial/services` | specialized-services.ts | Get memorial services | Yes |
| GET | `/customer/memorial/products` | specialized-services.ts | Get memorial products | Yes |
| GET | `/customer/donations/campaigns` | donations.ts | Get donation campaigns | Yes |
| POST | `/customer/donations/:campaignId/donate` | donations.ts | Make donation | Yes |
| GET | `/customer/counseling/sessions` | specialized-services.ts | Get counseling sessions | Yes |
| POST | `/customer/counseling/:vendorId/book` | specialized-services.ts | Book counseling | Yes |
| GET | `/nutritionist/customer/:customerId/diet-plans` | specialized-services.ts | Get diet charts | Yes |
| GET | `/nutritionist/:vendorId/menu` | specialized-services.ts | Get nutritionist menu | Yes |
| GET | `/vendor/:vendorId/pharmacy/inventory` | ecommerce.ts | Get pharmacy products | Yes |
| GET | `/insurance/plans` | insurance.ts | Get insurance plans | Yes |
| POST | `/insurance/calculate-premium` | insurance.ts | Calculate premium | Yes |
| POST | `/insurance/purchase` | insurance.ts | Purchase insurance | Yes |
| GET | `/customer/packages` | packages.ts | Get packages | Yes |
| GET | `/customer/packages/:packageId` | packages.ts | Get package details | Yes |
| GET | `/customer/facility/:facilityId` | service-discovery.ts | Get facility details | Yes |
| POST | `/media/upload` | file-upload.ts | Upload media | Yes |
| GET | `/customer/:customerId/payment-methods` | payments-enhanced.ts | Get payment methods | Yes |
| POST | `/customer/:customerId/payment-methods` | payments-enhanced.ts | Add payment method | Yes |
| PUT | `/customer/:customerId/payment-methods/:methodId/set-default` | payments-enhanced.ts | Set default payment | Yes |
| DELETE | `/customer/payment-methods/:methodId` | payments-enhanced.ts | Delete payment method | Yes |
| POST | `/payment/razorpay/create-order` | razorpay.ts | Create Razorpay order | Yes |
| POST | `/payment/razorpay/verify` | razorpay.ts | Verify Razorpay payment | Yes |
| GET | `/payment/:paymentId/status` | payments-enhanced.ts | Get payment status | Yes |
| POST | `/payment/refund` | refunds.ts | Request refund | Yes |
| POST | `/payment/retry` | payments-enhanced.ts | Retry payment | Yes |
| GET | `/customer/appointments` | customer-appointments.ts | Get appointments | Yes |
| GET | `/customer/appointments/:appointmentId` | customer-appointments.ts | Get appointment | Yes |
| POST | `/customer/appointments/:appointmentId/cancel` | customer-appointments.ts | Cancel appointment | Yes |
| POST | `/customer/appointments/:appointmentId/reschedule` | customer-appointments.ts | Reschedule appointment | Yes |
| POST | `/bookings/:bookingId/generate-otp` | otp-enhanced.ts | Generate booking OTP | Yes |
| POST | `/bookings/:bookingId/verify-otp` | otp-enhanced.ts | Verify booking OTP | Yes |
| GET | `/booking/rescheduling-policy/:serviceType` | bookings-enhanced.ts | Get rescheduling policy | Yes |
| GET | `/booking/:bookingId/reschedule-options` | bookings-enhanced.ts | Get reschedule options | Yes |
| POST | `/booking/:bookingId/reschedule` | bookings-enhanced.ts | Reschedule booking | Yes |
| POST | `/booking/:bookingId/reschedule/confirm` | bookings-enhanced.ts | Confirm reschedule | Yes |
| GET | `/customer/discover-staff` | staff.ts | Discover staff | Yes |
| GET | `/customer/:customerId/wallet` | wallet.ts | Get wallet | Yes |
| GET | `/customer/:customerId/wallet/topup-offers` | wallet.ts | Get topup offers | Yes |
| POST | `/customer/:customerId/wallet/topup/initiate` | wallet.ts | Initiate topup | Yes |
| POST | `/wallet/:customerId/credit` | wallet.ts | Credit wallet | Yes |
| POST | `/customer/:customerId/wallet/topup/verify` | wallet.ts | Verify topup | Yes |
| GET | `/customer/:customerId/wallet/transactions` | wallet.ts | Get wallet transactions | Yes |
| POST | `/bookings/:bookingId/start-tracking` | gps-tracking.ts | Start GPS tracking | Yes |
| POST | `/bookings/:bookingId/stop-tracking` | gps-tracking.ts | Stop GPS tracking | Yes |
| POST | `/bookings/:bookingId/update-location` | gps-tracking.ts | Update location | Yes |
| GET | `/bookings/:bookingId/live-location` | gps-tracking.ts | Get live location | Yes |
| GET | `/bookings/:bookingId/route` | gps-tracking.ts | Get route | Yes |
| POST | `/nutritionist/meals/item` | specialized-services.ts | Add meal item | Yes |
| POST | `/nutritionist/meals/order` | specialized-services.ts | Place meal order | Yes |
| POST | `/nutritionist/orders/:orderId/assign-delivery` | specialized-services.ts | Assign delivery | Yes |
| GET | `/nutritionist/orders/:orderId/track` | specialized-services.ts | Track order | Yes |
| PUT | `/nutritionist/orders/:orderId/status` | specialized-services.ts | Update order status | Yes |
| POST | `/ai-chatbot/chat` | ai-chatbot.ts | AI chatbot chat | Yes |
| POST | `/ai-chatbot/symptoms-checker` | ai-chatbot.ts | Symptoms checker | Yes |
| POST | `/ai-chatbot/booking-assist` | ai-chatbot.ts | Booking assist | Yes |
| POST | `/ai-chatbot/escalate-to-agent` | ai-chatbot.ts | Escalate to agent | Yes |
| GET | `/ai-chatbot/conversation/:conversationId` | ai-chatbot.ts | Get conversation | Yes |
| POST | `/support/tickets` | support-crm.ts | Create support ticket | Yes |
| GET | `/support/tickets` | support-crm.ts | Get support tickets | Yes |
| GET | `/support/tickets/:ticketId` | support-crm.ts | Get ticket details | Yes |
| POST | `/support/tickets/:ticketId/respond` | support-crm.ts | Respond to ticket | Yes |
| PUT | `/support/tickets/:ticketId/status` | support-crm.ts | Update ticket status | Yes |
| GET | `/community/posts` | community.ts | Get community posts | Yes |
| POST | `/community/posts` | community.ts | Create community post | Yes |
| POST | `/community/posts/:postId/like` | community.ts | Like post | Yes |
| DELETE | `/community/posts/:postId/like` | community.ts | Unlike post | Yes |
| POST | `/community/posts/:postId/comments` | community.ts | Comment on post | Yes |
| GET | `/community/posts/:postId/comments` | community.ts | Get comments | Yes |
| DELETE | `/community/posts/:postId` | community.ts | Delete post | Yes |
| GET | `/customer/:customerId/referral` | referrals.ts | Get referral code | Yes |
| GET | `/customer/:customerId/referral/stats` | referrals.ts | Get referral stats | Yes |
| POST | `/referral/invite` | referrals.ts | Send referral invite | Yes |
| GET | `/customer/:customerId/referral/history` | referrals.ts | Get referral history | Yes |
| POST | `/customer/:customerId/referral/claim` | referrals.ts | Claim referral reward | Yes |
| GET | `/customer/:customerId/rewards/points` | rewards.ts | Get reward points | Yes |
| GET | `/customer/:customerId/rewards/history` | rewards.ts | Get reward history | Yes |
| GET | `/customer/:customerId/rewards/available` | rewards.ts | Get available rewards | Yes |
| POST | `/customer/:customerId/rewards/redeem` | rewards.ts | Redeem rewards | Yes |
| GET | `/rewards/:rewardId` | rewards.ts | Get reward details | Yes |
| GET | `/customer/:customerId/subscriptions` | subscriptions.ts | Get subscriptions | Yes |
| GET | `/subscriptions/:subscriptionId` | subscriptions.ts | Get subscription | Yes |
| POST | `/subscriptions/:subscriptionId/cancel` | subscriptions.ts | Cancel subscription | Yes |
| POST | `/subscriptions/:subscriptionId/pause` | subscriptions.ts | Pause subscription | Yes |
| POST | `/subscriptions/:subscriptionId/resume` | subscriptions.ts | Resume subscription | Yes |
| GET | `/subscriptions/:subscriptionId/usage` | subscriptions.ts | Get subscription usage | Yes |

---

## WarmpawzVendor (React Native - `apps/WarmpawzVendor`)

| HTTP | API Endpoint | Endpoint Module | Purpose | Shared |
|------|--------------|-----------------|---------|--------|
| POST | `/vendor/apply` | vendor-onboarding.ts | Submit vendor application | Yes |
| GET | `/vendor/check-phone/:phone` | vendor-onboarding.ts | Check vendor phone | Yes |
| GET | `/config/roles/:roleId` | roles.ts | Get role config | Yes |
| GET | `/vendor/:vendorId` | vendor-dashboard.ts | Get vendor profile | Yes |
| PUT | `/vendor/:vendorId` | vendor-profile.ts | Update vendor profile | Yes |
| GET | `/admin/service-catalog` | service-catalog.ts | Get service catalog | Yes |
| POST | `/vendor/:vendorId/services/publish` | vendor-services.ts | Publish services | Yes |
| GET | `/vendor/:vendorId/services` | vendor-services.ts | Get vendor services | Yes |
| GET | `/vendor/bookings/:vendorId` | vendor-bookings.ts | Get vendor bookings | Yes |
| POST | `/bookings/:bookingId/accept` | bookings-enhanced.ts | Accept booking | Yes |
| POST | `/bookings/:bookingId/reject` | bookings-enhanced.ts | Reject booking | Yes |
| GET | `/staff/vendor/:vendorId` | staff.ts | Get vendor staff | Yes |
| POST | `/staff/vendor/:vendorId` | staff.ts | Add vendor staff | Yes |
| PUT | `/staff/:staffId` | staff.ts | Update staff | Yes |
| DELETE | `/staff/:staffId` | staff.ts | Delete staff | Yes |
| GET | `/vendor/dashboard/:vendorId` | vendor-dashboard.ts | Get dashboard | Yes |
| POST | `/otp/generate` | otp-enhanced.ts | Generate OTP | Yes |
| POST | `/otp/verify` | otp-enhanced.ts | Verify OTP | Yes |
| GET | `/staff/:staffId/breaks` | staff.ts | Get staff breaks | Yes |
| POST | `/staff/:staffId/breaks` | staff.ts | Create staff break | Yes |
| PUT | `/staff/:staffId/breaks/:breakId` | staff.ts | Update staff break | Yes |
| DELETE | `/staff/:staffId/breaks/:breakId` | staff.ts | Delete staff break | Yes |
| GET | `/staff/:staffId/preferences` | staff.ts | Get staff preferences | Yes |
| PUT | `/staff/:staffId/preferences` | staff.ts | Update staff preferences | Yes |
| GET | `/staff/:staffId/holidays` | staff.ts | Get staff holidays | Yes |
| POST | `/staff/:staffId/holidays` | staff.ts | Create staff holiday | Yes |
| POST | `/vendor/bookings/:bookingId/complete` | vendor-booking-actions.ts | Complete booking | Yes |
| POST | `/vendor/:vendorId/bookings/:bookingId/start-session` | vendor-booking-actions.ts | Start session | Yes |
| POST | `/vendor/:vendorId/bookings/:bookingId/end-session` | vendor-booking-actions.ts | End session | Yes |
| GET | `/staff/:staffId/appointments` | staff.ts | Get staff appointments | Yes |
| GET | `/staff/:staffId/bookings/active` | staff.ts | Get active bookings | Yes |
| GET | `/staff/:staffId/schedule` | staff.ts | Get staff schedule | Yes |
| GET | `/staff/:staffId/earnings` | staff.ts | Get staff earnings | Yes |
| GET | `/staff/:staffId/analytics` | staff.ts | Get staff analytics | Yes |
| POST | `/automation/staff/accept` | staff.ts | Accept staff assignment | Yes |
| POST | `/automation/staff/reject` | staff.ts | Reject staff assignment | Yes |
| POST | `/bookings/:bookingId/start-service` | bookings-enhanced.ts | Start service | Yes |
| POST | `/bookings/:bookingId/start-session` | bookings-enhanced.ts | Start session | Yes |
| POST | `/bookings/:bookingId/end-session` | bookings-enhanced.ts | End session | Yes |
| POST | `/bookings/:bookingId/check-in` | bookings-enhanced.ts | Check in | Yes |
| GET | `/bookings/:bookingId` | bookings-enhanced.ts | Get booking details | Yes |
| POST | `/files/upload` | file-upload.ts | Upload file | Yes |
| GET | `/bookings/:bookingId/prescription` | prescriptions.ts | Get prescription | Yes |
| POST | `/bookings/:bookingId/activity` | bookings-enhanced.ts | Log activity | Yes |
| POST | `/bookings/:bookingId/prescription` | prescriptions.ts | Upload prescription | Yes |
| POST | `/call/initiate` | video-call.ts | Initiate call | Yes |
| POST | `/call/:callId/answer` | video-call.ts | Answer call | Yes |
| POST | `/call/:callId/end` | video-call.ts | End call | Yes |
| POST | `/call/:callId/reject` | video-call.ts | Reject call | Yes |
| GET | `/call/:callId` | video-call.ts | Get call | Yes |
| GET | `/call/history/:vendorId` | video-call.ts | Get call history | Yes |
| GET | `/slots/available` | bookings-enhanced.ts | Get available slots | Yes |
| GET | `/slots/check` | bookings-enhanced.ts | Check slot availability | Yes |
| POST | `/bookings/validate` | bookings-enhanced.ts | Validate booking | Yes |
| GET | `/vendor/:vendorId/integrated-services` | specialized-services.ts | Get integrated services | Yes |
| POST | `/logistics/optimize-route` | logistics.ts | Optimize route | Yes |
| GET | `/logistics/route/:routeId` | logistics.ts | Get route | Yes |
| POST | `/analytics/events` | analytics.ts | Track analytics event | Yes |
| GET | `/vendor/:vendorId/schedule-settings` | vendor-schedule.ts | Get schedule settings | Yes |
| PUT | `/vendor/:vendorId/schedule-settings` | vendor-schedule.ts | Update schedule settings | Yes |
| GET | `/vendor/:vendorId/catalog` | service-catalog.ts | Get vendor catalog | Yes |
| PUT | `/vendor/:vendorId/catalog` | service-catalog.ts | Update vendor catalog | Yes |
| GET | `/chat/booking/:bookingId/messages` | chat.ts | Get chat messages | Yes |
| POST | `/chat/booking/:bookingId/message` | chat.ts | Send chat message | Yes |
| POST | `/chat/booking/:bookingId/read` | chat.ts | Mark chat read | Yes |
| GET | `/vendor/:vendorId/notifications` | notifications.ts | Get notifications | Yes |
| POST | `/notifications/:notificationId/read` | notifications.ts | Mark notification read | Yes |
| POST | `/vendor/:vendorId/notifications/read-all` | notifications.ts | Mark all read | Yes |
| POST | `/emergency/report` | notifications.ts | Report emergency | Yes |
| POST | `/vendor/:vendorId/emergency` | notifications.ts | Send emergency alert | Yes |
| POST | `/location/share` | location-sharing.ts | Share location | Yes |
| POST | `/location/start-sharing` | location-sharing.ts | Start sharing location | Yes |
| POST | `/location/update` | location-sharing.ts | Update location | Yes |
| POST | `/location/stop-sharing` | location-sharing.ts | Stop sharing location | Yes |
| POST | `/vendor/:vendorId/route/optimize` | logistics.ts | Optimize vendor route | Yes |
| GET | `/route/:routeId` | logistics.ts | Get route | Yes |
| GET | `/vendor/:vendorId/updates` | notifications.ts | Get vendor updates | Yes |
| GET | `/vendor/:vendorId/realtime` | notifications.ts | Get realtime updates | Yes |
| GET | `/health/check` | system-health.ts | Check health | Yes |
| POST | `/offline/sync` | Lambda not clearly mapped | Sync offline | Yes |
| GET | `/offline/pending/:vendorId` | Lambda not clearly mapped | Get pending offline | Yes |
| POST | `/offline/clear` | Lambda not clearly mapped | Clear offline | Yes |
| GET | `/vendor/:vendorId/earnings` | vendor-analytics.ts | Get earnings | Yes |
| GET | `/vendor/:vendorId/earnings/summary` | vendor-analytics.ts | Get earnings summary | Yes |
| GET | `/vendor/:vendorId/payouts` | settlements.ts | Get payouts | Yes |
| GET | `/payouts/:payoutId` | settlements.ts | Get payout details | Yes |
| POST | `/vendor/:vendorId/payouts/request` | settlements.ts | Request payout | Yes |
| GET | `/vendor/:vendorId/commission` | tier-system.ts | Get commission | Yes |
| GET | `/vendor/:vendorId/reports` | reports.ts | Get reports | Yes |
| POST | `/vendor/:vendorId/reports/generate` | reports.ts | Generate report | Yes |
| GET | `/vendor/:vendorId/reports/history` | reports.ts | Get report history | Yes |
| GET | `/reports/:reportId/download` | reports.ts | Download report | Yes |
| GET | `/reports/:reportId/status` | reports.ts | Get report status | Yes |
| POST | `/vendor/:vendorId/export` | reports.ts | Export data | Yes |
| GET | `/vendor/:vendorId/performance` | vendor-analytics.ts | Get performance | Yes |
| GET | `/vendor/:vendorId/revenue` | vendor-analytics.ts | Get revenue | Yes |
| GET | `/vendor/:vendorId/transactions` | transaction-monitoring.ts | Get transactions | Yes |
| GET | `/vendor/:vendorId/financial/summary` | vendor-analytics.ts | Get financial summary | Yes |
| GET | `/vendor/:vendorId/tax/documents` | tax-management.ts | Get tax documents | Yes |
| GET | `/tax/documents/:documentId/download` | tax-management.ts | Download tax document | Yes |
| POST | `/vendor/:vendorId/tax/documents/generate` | tax-management.ts | Generate tax document | Yes |
| GET | `/vendor/:vendorId/tax/summary` | tax-management.ts | Get tax summary | Yes |
| GET | `/vendor/:vendorId/settings` | vendor-settings.ts | Get vendor settings | Yes |
| PUT | `/vendor/:vendorId/settings` | vendor-settings.ts | Update vendor settings | Yes |
| GET | `/vendor/:vendorId/profile` | vendor-profile.ts | Get vendor profile | Yes |
| PUT | `/vendor/:vendorId/profile` | vendor-profile.ts | Update vendor profile | Yes |
| GET | `/vendor/:vendorId/preferences` | vendor-settings.ts | Get preferences | Yes |
| PUT | `/vendor/:vendorId/preferences` | vendor-settings.ts | Update preferences | Yes |
| GET | `/vendor/:vendorId/account` | vendor-profile.ts | Get account | Yes |
| PUT | `/vendor/:vendorId/account` | vendor-profile.ts | Update account | Yes |
| POST | `/vendor/:vendorId/security/change-password` | vendor-security.ts | Change password | Yes |
| POST | `/vendor/:vendorId/security/enable-2fa` | vendor-security.ts | Enable 2FA | No |
| POST | `/vendor/:vendorId/security/disable-2fa` | vendor-security.ts | Disable 2FA | No |
| GET | `/vendor/:vendorId/security` | vendor-security.ts | Get security settings | No |
| PUT | `/vendor/:vendorId/security` | vendor-security.ts | Update security settings | No |
| GET | `/vendor/:vendorId/notifications/settings` | notifications.ts | Get notification settings | Yes |
| PUT | `/vendor/:vendorId/notifications/settings` | notifications.ts | Update notification settings | Yes |
| GET | `/vendor/:vendorId/privacy/settings` | vendor-settings.ts | Get privacy settings | Yes |
| PUT | `/vendor/:vendorId/privacy/settings` | vendor-settings.ts | Update privacy settings | Yes |
| GET | `/help/articles` | Lambda not clearly mapped | Get help articles | Yes |
| GET | `/help/faq` | Lambda not clearly mapped | Get FAQ | Yes |
| POST | `/help/contact` | support-crm.ts | Contact support | Yes |
| GET | `/about/app-info` | Lambda not clearly mapped | Get app info | Yes |
| GET | `/about/version` | Lambda not clearly mapped | Get version | Yes |
| POST | `/auth/logout` | auth-enhanced.ts | Logout | Yes |
| GET | `/vendor/:vendorId/assignable-staff` | staff.ts | Get assignable staff | Yes |
| POST | `/automation/staff/assign` | staff.ts | Assign staff | Yes |
| GET | `/vendor/:vendorId/tier` | tier-system.ts | Get vendor tier | Yes |
| POST | `/bank-account/verify` | vendor-profile.ts | Verify bank account | Yes |
| POST | `/bookings/:bookingId/update-location` | gps-tracking.ts | Update location | Yes |
| POST | `/home-service/:bookingId/start-ride` | gps-tracking.ts | Start ride | Yes |
| POST | `/home-service/:bookingId/end-ride` | gps-tracking.ts | End ride | Yes |
| GET | `/vendor/:vendorId/active-trackings` | gps-tracking.ts | Get active trackings | Yes |
| GET | `/bookings/:bookingId/route` | gps-tracking.ts | Get booking route | Yes |
| GET | `/routes/:routeId/track` | gps-tracking.ts | Track route | Yes |

---

## Shared Lambdas

The following endpoint modules are used by **multiple** frontend applications:

| Endpoint Module | Apps Using It | Key Endpoints |
|-----------------|---------------|---------------|
| `auth-enhanced.ts` | All 5 apps | `/auth/otp/send`, `/auth/verify-otp`, `/auth/logout` |
| `bookings-enhanced.ts` | All 5 apps | `/bookings/create`, `/bookings/:id`, `/bookings/:id/status` |
| `customer-enhanced.ts` | Customer Web, WarmpawzCustomer | `/customer/:id`, `/customer/by-phone` |
| `vendor-dashboard.ts` | Vendor Web, WarmpawzVendor | `/vendor/dashboard/:vendorId`, `/vendor/:vendorId` |
| `vendor-services.ts` | Vendor Web, WarmpawzVendor, Admin Web | `/vendor/:vendorId/services` |
| `staff.ts` | Vendor Web, WarmpawzVendor, Customer Web, WarmpawzCustomer | `/vendor/:vendorId/staff`, `/staff/:staffId` |
| `payments-enhanced.ts` | Customer Web, WarmpawzCustomer | `/payments/verify`, `/payment/:id/status` |
| `notifications.ts` | All 5 apps | `/notifications/:id/read`, `/vendor/:vendorId/notifications` |
| `chat.ts` | Customer Web, Vendor Web, WarmpawzCustomer, WarmpawzVendor | `/chat/booking/:bookingId/messages` |
| `support-crm.ts` | All 5 apps | `/support/tickets`, `/support/tickets/:id` |
| `wallet.ts` | Customer Web, WarmpawzCustomer | `/wallet/:customerId`, `/wallet/:customerId/transactions` |
| `gps-tracking.ts` | Customer Web, WarmpawzCustomer, WarmpawzVendor | `/bookings/:id/live-location`, `/bookings/:id/update-location` |
| `settlements.ts` | Admin Web, Vendor Web, WarmpawzVendor | `/settlements/process`, `/settlements/request` |
| `ai-chatbot.ts` | Customer Web, WarmpawzCustomer | `/ai-chatbot/chat`, `/ai-chatbot/symptoms-checker` |

---

## Background / Job Lambdas

The following endpoint modules handle background tasks, cron jobs, or admin-only operations:

| Endpoint Module | Purpose | Endpoints |
|-----------------|---------|-----------|
| `opensearch-sync.ts` | Sync data to OpenSearch | Background job |
| `appointment-reminders.ts` | Send appointment reminders | `/reminders/:id/send-now`, cron-triggered |
| `subscriptions.ts` | Process subscription renewals | `/subscriptions/process-renewals` |
| `admin-governance.ts` | Propagate governance changes | `/admin/governance/propagate` |
| `admin-governance-enhanced.ts` | Enhanced governance operations | Admin-only endpoints |
| `razorpay-settlements.ts` | Process Razorpay settlements | Background processing |
| `transaction-monitoring.ts` | Monitor transactions | `/admin/transactions/stats` |
| `tier-system.ts` | Calculate tier commissions | `/admin/tiers/calculate-commissions` |

---

## Lambda Not Clearly Mapped

The following API endpoints are called by frontend apps but could not be clearly mapped to a Lambda handler:

| API Endpoint | Called From | Notes |
|--------------|-------------|-------|
| `/offline/sync` | WarmpawzVendor | Offline sync endpoint - implementation not found |
| `/offline/pending/:vendorId` | WarmpawzVendor | Offline pending - implementation not found |
| `/offline/clear` | WarmpawzVendor | Offline clear - implementation not found |
| `/help/articles` | WarmpawzVendor | Help articles - implementation not found |
| `/help/faq` | WarmpawzVendor | FAQ - implementation not found |
| `/about/app-info` | WarmpawzVendor | App info - implementation not found |
| `/about/version` | WarmpawzVendor | Version info - implementation not found |

---

## Summary

| Metric | Count |
|--------|-------|
| **Frontend Apps Scanned** | 5 |
| **Total Endpoint Modules** | 99 |
| **Shared Endpoint Modules** | 14+ |
| **Admin-Only Endpoints** | ~50 |
| **Customer Endpoints** | ~150+ |
| **Vendor Endpoints** | ~200+ |
| **Unmapped Endpoints** | 7 |
| **Background/Job Modules** | 8 |

---

## Document Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-08 | 1.0 | Initial document creation |
