# Warmpawz API Endpoints Documentation

This document lists all API endpoints available in the Warmpawz platform, grouped by entity.

**Last Updated:** January 2026  
**Total Entities:** 17  
**Total Endpoints:** 95+

---

## Table of Contents

1. [Auth](#1-auth)
2. [Customer](#2-customer)
3. [Pet](#3-pet)
4. [Booking](#4-booking)
5. [Vendor](#5-vendor)
6. [Vendor Onboarding](#6-vendor-onboarding)
7. [Staff](#7-staff)
8. [Payment](#8-payment)
9. [Wallet](#9-wallet)
10. [Subscription](#10-subscription)
11. [Review](#11-review)
12. [Notification](#12-notification)
13. [Service Catalog](#13-service-catalog)
14. [Search](#14-search)
15. [Admin](#15-admin)
16. [Vendor Bookings](#16-vendor-bookings)
17. [Support](#17-support)

---

## 1. Auth

Authentication and OTP verification endpoints.

| Method | Endpoint | Description | Request | Response | Auth |
|--------|----------|-------------|---------|----------|------|
| POST | `/auth/send-otp` | Send OTP to phone number | `{ phone: string }` | `{ message, debug_otp? }` | No |
| POST | `/auth/verify-otp` | Verify OTP and create session | `{ phone: string, otp: string }` | `{ verified, accessToken, idToken, refreshToken }` | No |
| POST | `/auth/otp/send` | Alias for send-otp (web/mobile) | `{ phone: string }` | Same as `/auth/send-otp` | No |
| POST | `/auth/otp/verify` | Alias for verify-otp (web/mobile) | `{ phone: string, otp: string }` | Same as `/auth/verify-otp` | No |
| POST | `/otp/generate` | Legacy mobile endpoint for sending OTP | `{ phone: string }` | Same as `/auth/send-otp` | No |
| POST | `/otp/verify` | Legacy mobile endpoint for verifying OTP | `{ phone: string, otp: string }` | Same as `/auth/verify-otp` | No |

---

## 2. Customer

Customer profile and management endpoints.

| Method | Endpoint | Description | Request | Response | Auth |
|--------|----------|-------------|---------|----------|------|
| GET | `/customer/:customerId` | Get customer profile | - | `{ id, full_name, email, phone, ... }` | Yes |
| GET | `/customer/by-phone` | Get customer by phone number | `?phone=<phone>` | `{ customer: { ... } }` | Yes |
| PUT | `/customer/:customerId` | Update customer profile | `{ fullName?, email?, address?, city?, state?, pincode? }` | `{ message }` | Yes |
| GET | `/customer/:customerId/pets` | Get customer's pets | - | `{ pets: [...] }` | Yes |
| POST | `/customer/:customerId/pets` | Add pet to customer | `{ name, species, breed, ... }` | `{ pet: { ... } }` | Yes |
| GET | `/customer/:customerId/subscriptions` | Get customer subscriptions | - | `{ subscriptions: [...] }` | Yes |

---

## 3. Pet

Pet management endpoints.

| Method | Endpoint | Description | Request | Response | Auth |
|--------|----------|-------------|---------|----------|------|
| GET | `/pets/customer/:customerId` | Get all pets for a customer | - | `{ pets: [...], count }` | Yes |
| GET | `/pets/:petId` | Get pet details with stats | - | `{ pet: { ..., medicalRecordsCount, prescriptionsCount } }` | Yes |
| POST | `/pets` | Create a new pet | `{ customerId, name, petType, breed, age?, gender?, weight?, ... }` | `{ pet: { ... } }` | Yes |
| PUT | `/pets/:petId` | Update pet information | `{ name?, breed?, age?, gender?, weight?, medicalHistory? }` | `{ pet: { ... } }` | Yes |
| DELETE | `/pets/:petId` | Delete a pet | - | `{ message }` | Yes |

---

## 4. Booking

Booking creation and management endpoints.

| Method | Endpoint | Description | Request | Response | Auth |
|--------|----------|-------------|---------|----------|------|
| POST | `/bookings/create` | Create a new booking | `{ customerId, vendorId, serviceId, bookingDate, bookingTime, staffId?, address?, petId?, amount?, idempotencyKey? }` | `{ bookingId, status }` | Yes |
| GET | `/bookings/:bookingId` | Get booking details | - | `{ id, customer_id, vendor_id, status, ... }` | Yes |
| GET | `/bookings/:bookingId/history` | Get booking status history | - | `{ booking, statusHistory: [...] }` | Yes |
| PUT | `/bookings/:bookingId/status` | Update booking status | `{ status, reason?, actorId?, actorType? }` | `{ bookingId, oldStatus, newStatus }` | Yes |

**Valid Statuses:** `pending`, `confirmed`, `in_progress`, `completed`, `cancelled`, `no_show`, `rescheduled`

---

## 5. Vendor

Vendor profile and settings endpoints.

| Method | Endpoint | Description | Request | Response | Auth |
|--------|----------|-------------|---------|----------|------|
| GET | `/vendor/:vendorId` | Get vendor profile | - | `{ vendor: { ... } }` | Yes |
| PUT | `/vendor/:vendorId` | Update vendor profile | `{ businessName?, address?, ... }` | `{ vendor: { ... } }` | Yes |
| GET | `/vendor/:vendorId/staff` | Get all staff for a vendor | - | `{ staff: [...], total }` | Yes |
| POST | `/vendor/:vendorId/staff` | Create staff member | `{ name, phone, email?, role, services?: [...] }` | `{ staff: { ... } }` | Yes |
| PUT | `/vendor/:vendorId/staff/:staffId` | Update staff member | `{ name?, phone?, specialization?, isActive? }` | `{ staff: { ... } }` | Yes |
| DELETE | `/vendor/:vendorId/staff/:staffId` | Deactivate staff member | - | `{ message }` | Yes |
| GET | `/vendor/:vendorId/staff/:staffId/availability` | Get staff availability | `?startDate&endDate?` | `{ availability: [...] }` | Yes |
| POST | `/vendor/:vendorId/staff/:staffId/availability` | Set staff availability | `{ availableDate, availableTimeStart, availableTimeEnd }` or `[...]` | `{ availability: [...] }` | Yes |

---

## 6. Vendor Onboarding

Vendor registration and onboarding flow endpoints.

| Method | Endpoint | Description | Request | Response | Auth |
|--------|----------|-------------|---------|----------|------|
| GET | `/vendor/onboarding/status` | Get current onboarding status | `?phone=<phone>` | `{ identity, application?, role?, nextStep }` | No |
| GET | `/vendor/onboarding/roles` | Get available vendor roles | - | `{ roles: [...] }` | No |
| POST | `/vendor/onboarding/select-role` | Select vendor role | `{ phone, role_id }` | `{ message, nextStep }` | No |
| POST | `/vendor/onboarding/select-vendor-type` | Select vendor type (solo/business) | `{ phone, vendor_type }` | `{ message, nextStep }` | No |
| GET | `/vendor/onboarding/form-schema` | Get dynamic form schema | `?phone=<phone>` | `{ schema, existingApplication?, canEdit }` | No |
| POST | `/vendor/onboarding/submit-application` | Submit onboarding application | `{ phone, application_payload, uploaded_documents? }` | `{ applicationId, nextStep }` | No |
| POST | `/vendor/onboarding/activate` | Activate approved vendor | `{ phone }` | `{ vendor_id, nextStep }` | No |
| POST | `/vendor/setup/update-completion` | Update setup step completion | `{ vendor_id, step, completed }` | `{ is_go_live_ready }` | Yes |
| POST | `/vendor/setup/go-live` | Make vendor live | `{ vendor_id }` | `{ go_live_at }` | Yes |

**Setup Steps:** `profile`, `bank_account`, `business_hours`, `staff_management`, `services`

---

## 7. Staff

Staff discovery and management endpoints.

| Method | Endpoint | Description | Request | Response | Auth |
|--------|----------|-------------|---------|----------|------|
| GET | `/customer/discover-staff` | Discover staff by preferences | `?roleId&serviceStyle&latitude?&longitude?&maxDistance?&serviceId?&vendorId?&customerId?` | `{ staff: [...], total }` | Yes |

**Service Styles:** `at_home`, `at_center`, `tele`

---

## 8. Payment

Payment processing endpoints.

| Method | Endpoint | Description | Request | Response | Auth |
|--------|----------|-------------|---------|----------|------|
| POST | `/payments/create` | Create a payment | `{ bookingId, amount, paymentMethod?, customerId?, vendorId?, idempotencyKey? }` | `{ paymentId, status }` | Yes |
| GET | `/payments/:paymentId` | Get payment details with history | - | `{ payment, statusHistory: [...] }` | Yes |
| POST | `/payments/razorpay/webhook` | Razorpay webhook handler | Razorpay webhook payload | `{ message }` | No (Signature verified) |

---

## 9. Wallet

Customer wallet endpoints with atomic operations.

| Method | Endpoint | Description | Request | Response | Auth |
|--------|----------|-------------|---------|----------|------|
| GET | `/wallet/:customerId` | Get wallet balance | - | `{ customerId, balance, currency, lastUpdated }` | Yes |
| POST | `/wallet/:customerId/credit` | Credit wallet (add funds) | `{ amount, referenceType?, referenceId?, description?, idempotencyKey? }` | `{ transactionId, newBalance }` | Yes |
| POST | `/wallet/:customerId/debit` | Debit wallet (spend funds) | `{ amount, referenceType?, referenceId?, description?, idempotencyKey? }` | `{ transactionId, newBalance }` | Yes |
| GET | `/wallet/:customerId/transactions` | Get transaction history | `?limit?&offset?` | `{ transactions: [...], count }` | Yes |

---

## 10. Subscription

Subscription plan and customer subscription endpoints.

| Method | Endpoint | Description | Request | Response | Auth |
|--------|----------|-------------|---------|----------|------|
| POST | `/subscriptions/plans` | Create subscription plan (vendor) | `{ vendorId, name, price, interval, features?, description? }` | `{ plan: { ... } }` | Yes |
| GET | `/subscriptions/plans/vendor/:vendorId` | Get vendor's subscription plans | - | `{ plans: [...], total }` | No |
| GET | `/subscriptions/plans/:planId` | Get plan details | - | `{ plan: { ... } }` | No |
| POST | `/subscriptions/subscribe` | Subscribe to a plan | `{ customerId, planId, paymentMethodId? }` | `{ subscription: { ... } }` | Yes |
| GET | `/subscriptions/customer/:customerId` | Get customer subscriptions | - | `{ subscriptions: [...], total }` | Yes |
| GET | `/subscriptions/:subscriptionId` | Get subscription details | - | `{ subscription: { ... } }` | Yes |
| POST | `/subscriptions/cancel` | Cancel subscription | `{ subscriptionId, reason? }` | `{ subscription: { ... } }` | Yes |
| POST | `/subscriptions/:subscriptionId/pause` | Pause subscription | `{ pauseUntil? }` | `{ subscription: { ... } }` | Yes |
| POST | `/subscriptions/:subscriptionId/resume` | Resume paused subscription | - | `{ subscription: { ... } }` | Yes |
| GET | `/subscriptions/:subscriptionId/usage` | Get subscription usage | `?period=(week|month|year)` | `{ usage: { sessionsUsed, totalSpent, ... } }` | Yes |
| POST | `/subscriptions/process-renewals` | Process subscription renewals (cron) | - | `{ processed, subscriptions: [...] }` | Internal |

**Intervals:** `monthly`, `yearly`

---

## 11. Review

Customer review endpoints.

| Method | Endpoint | Description | Request | Response | Auth |
|--------|----------|-------------|---------|----------|------|
| GET | `/reviews` | Get reviews with filters | `?vendorId?&serviceId?&customerId?&bookingId?&isApproved?&limit?&offset?` | `{ reviews: [...], averageRating }` | No |
| POST | `/reviews` | Create a review | `{ customerId, vendorId, serviceId?, bookingId?, rating, comment?, images? }` | `{ review: { ... } }` | Yes |
| PUT | `/reviews/:reviewId` | Update a review | `{ rating?, comment?, images? }` | `{ review: { ... } }` | Yes |
| POST | `/admin/reviews/:reviewId/approve` | Approve review (admin) | - | `{ review: { ... } }` | Yes (Admin) |
| POST | `/admin/reviews/:reviewId/reject` | Reject review (admin) | `{ reason? }` | `{ review: { ... } }` | Yes (Admin) |

**Rating:** 1-5

---

## 12. Notification

Notification management endpoints.

| Method | Endpoint | Description | Request | Response | Auth |
|--------|----------|-------------|---------|----------|------|
| GET | `/notifications` | Get user notifications | `?userId&userType&isRead?&limit?&offset?` | `{ notifications: [...], unreadCount }` | Yes |
| POST | `/notifications` | Create notification | `{ userId, userType, notificationType, title, message, data?, sendSms?, sendPush? }` | `{ notification: { ... } }` | Yes |
| PUT | `/notifications/:notificationId/read` | Mark notification as read | - | `{ notification: { ... } }` | Yes |
| PUT | `/notifications/read-all` | Mark all notifications as read | `{ userId, userType }` | `{ message }` | Yes |

**User Types:** `customer`, `vendor`, `admin`

---

## 13. Service Catalog

Platform service catalog endpoints.

| Method | Endpoint | Description | Request | Response | Auth |
|--------|----------|-------------|---------|----------|------|
| GET | `/service-catalog/role/:roleId` | Get services for a role | `?serviceStyle?` | `{ roleId, services: [...], total }` | No |
| GET | `/service-catalog/:serviceId` | Get service details | - | `{ service: { ... } }` | No |
| GET | `/service-catalog/categories` | Get all service categories | - | `{ categories: [...], total }` | No |
| GET | `/admin/service-catalog` | Get all services (admin) | `?status?&roleId?` | `{ services: [...], total }` | Yes (Admin) |
| POST | `/admin/service-catalog` | Create service (admin) | `{ service_id, service_name, applicable_roles, ... }` | `{ service: { ... } }` | Yes (Admin) |
| PUT | `/admin/service-catalog/:serviceId` | Update service (admin) | `{ service_name?, base_price?, status?, ... }` | `{ service: { ... } }` | Yes (Admin) |
| DELETE | `/admin/service-catalog/:serviceId` | Archive service (admin) | - | `{ message }` | Yes (Admin) |

**Service Styles:** `at_home`, `at_center`, `tele`, `all`

---

## 14. Search

Universal search endpoints.

| Method | Endpoint | Description | Request | Response | Auth |
|--------|----------|-------------|---------|----------|------|
| GET | `/search` | Universal search for vendors and services | `?q=<query>&category?&location?&limit?` | `{ query, vendors: [...], services: [...], searchMethod }` | No |

**Search Methods:** `opensearch` (primary), `sql-fallback`

---

## 15. Admin

Admin management endpoints.

| Method | Endpoint | Description | Request | Response | Auth |
|--------|----------|-------------|---------|----------|------|
| GET | `/admin/vendors/stats` | Get vendor statistics | - | `{ activeVendors, pendingApplications, deactivatedVendors, ... }` | Yes (Admin) |
| GET | `/admin/vendors` | List all vendors | `?status?&limit?&offset?` | `{ vendors: [...], total }` | Yes (Admin) |
| POST | `/admin/vendors/:vendorId/approve` | Approve vendor | `{ adminId? }` | `{ message, vendorId }` | Yes (Admin) |
| POST | `/admin/vendors/:vendorId/reject` | Reject vendor | `{ reason, adminId? }` | `{ message, vendorId }` | Yes (Admin) |
| POST | `/admin/vendor/onboarding/:applicationId/review` | Review application | `{ action, admin_id, comments?, rejection_reason? }` | `{ message, status }` | Yes (Admin) |

**Review Actions:** `APPROVE`, `REQUEST_CLARIFICATION`, `REJECT`

---

## 16. Vendor Bookings

Vendor-specific booking management endpoints.

| Method | Endpoint | Description | Request | Response | Auth |
|--------|----------|-------------|---------|----------|------|
| GET | `/vendor/bookings/:vendorId` | Get vendor bookings | `?date?&filter?` | `{ bookings: [...], total, filters }` | Yes (Vendor) |
| PUT | `/vendor/bookings/:bookingId/status` | Update booking status | `{ status, notes? }` | `{ booking: { ... } }` | Yes (Vendor) |
| POST | `/vendor/bookings/:bookingId/confirm` | Confirm booking | - | `{ booking: { ... } }` | Yes (Vendor) |
| POST | `/vendor/bookings/:bookingId/cancel` | Cancel booking | `{ reason? }` | `{ booking: { ... } }` | Yes (Vendor) |
| POST | `/vendor/bookings/:bookingId/complete` | Complete booking | `{ notes? }` | `{ booking: { ... } }` | Yes (Vendor) |

**Filters:** `all`, `pending`, `confirmed`, `in_progress`, `completed`, `cancelled`

---

## 17. Support

Support ticket endpoints (Not clearly defined in scanned files).

| Method | Endpoint | Description | Request | Response | Auth |
|--------|----------|-------------|---------|----------|------|
| - | See `support-crm.ts` | Support ticket management | Not clearly defined | Not clearly defined | Yes |

---

## Additional Endpoint Files

The following endpoint files exist but were not fully documented in this scan:

| File | Entity/Purpose |
|------|----------------|
| `addresses.ts` | Address management |
| `ai-chatbot.ts` | AI chatbot integration |
| `analytics.ts` | Analytics/reporting |
| `chat.ts` | Chat messaging |
| `community.ts` | Community features |
| `donations.ts` | Donation handling |
| `ecommerce.ts` | E-commerce/products |
| `events.ts` | Event management |
| `gps-tracking.ts` | GPS/location tracking |
| `insurance.ts` | Pet insurance |
| `logistics.ts` | Delivery logistics |
| `loyalty.ts` | Loyalty program |
| `medical-records.ts` | Medical records |
| `packages.ts` | Service packages |
| `pet-cafe.ts` | Pet cafe bookings |
| `pet-resort.ts` | Pet resort bookings |
| `prescriptions.ts` | Prescription management |
| `promotions.ts` | Promotional offers |
| `referrals.ts` | Referral system |
| `refunds.ts` | Refund processing |
| `regions.ts` | Geographic regions |
| `reports.ts` | Reporting |
| `rewards.ts` | Rewards program |
| `roles.ts` | Role management |
| `settlements.ts` | Vendor settlements |
| `specialized-services.ts` | Specialized services |
| `video-call.ts` | Video call (Chime) |

---

## Response Formats

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### HTTP Status Codes
- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `500` - Internal Server Error

---

## Authentication

Most endpoints require authentication via Cognito JWT tokens:

```
Authorization: Bearer <access_token>
```

Or via custom headers:
- `x-vendor-id` - For vendor context
- `x-admin-id` - For admin context

---

## Idempotency

Critical endpoints support idempotency keys to prevent duplicate operations:

```json
{
  "idempotencyKey": "unique-client-generated-key",
  ...
}
```

Supported on:
- `POST /bookings/create`
- `POST /payments/create`
- `POST /wallet/:customerId/credit`
- `POST /wallet/:customerId/debit`

---

## Ambiguities and Gaps

1. **Support CRM** - The `support-crm.ts` file exists but endpoint structure was not clearly documented
2. **Video Call** - AWS Chime integration exists but specific endpoint paths need verification
3. **E-commerce** - Product catalog and order endpoints need detailed documentation
4. **Insurance/Prescriptions** - Medical-related endpoints need detailed review
5. **Some admin endpoints** - Additional admin endpoints exist in `admin-advanced.ts` and `admin-governance.ts`

---

*This documentation was generated from source code analysis. For the most accurate and up-to-date information, refer to the source files in `backend/lambda/src/endpoints/`.*
