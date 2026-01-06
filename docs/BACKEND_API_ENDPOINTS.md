# 🔌 Backend API Endpoints - Complete Reference

## Overview

This document provides a complete reference for all backend API endpoints implemented in AWS Lambda. These endpoints are registered in the main Lambda handler and accessible via API Gateway.

**Base URL:** Configured via API Gateway (e.g., `https://api.warmpawz.com`)  
**Authentication:** Bearer token in `Authorization` header  
**Last Updated:** January 27, 2026

---

## 📋 Endpoint Categories

The backend is organized into the following endpoint categories:

1. **Authentication** - User authentication and authorization
2. **Vendor Management** - Vendor onboarding, profiles, dashboards
3. **Customer Management** - Customer profiles, booking history
4. **Bookings** - Booking lifecycle management
5. **Payments** - Payment processing and settlements
6. **Services** - Service catalog, specialized services
7. **Admin** - Admin dashboard and governance
8. **Notifications** - Push, SMS, and in-app notifications
9. **Analytics** - Analytics and reporting
10. **Infrastructure** - Health checks, system status

---

## 🔐 Authentication Endpoints

**Module:** `backend/lambda/src/endpoints/auth.ts`

### Send OTP
```
POST /auth/send-otp
Body: { phone: string, role?: string }
Response: { success: boolean, message: string }
```

### Verify OTP
```
POST /auth/verify-otp
Body: { phone: string, otp: string, role?: string }
Response: { success: boolean, token: string, user: object }
```

### Admin Login
```
POST /auth/admin/login
Body: { email: string, password: string }
Response: { success: boolean, token: string, admin: object }
```

### Refresh Token
```
POST /auth/refresh
Body: { refresh_token: string }
Response: { success: boolean, token: string }
```

### Logout
```
POST /auth/logout
Headers: Authorization: Bearer <token>
Response: { success: boolean }
```

---

## 🏪 Vendor Management Endpoints

### Vendor Onboarding

**Module:** `backend/lambda/src/endpoints/vendor-onboarding.ts`

```
GET /vendor/onboarding/status
Response: { status: string, progress: object, current_step: string }

POST /vendor/onboarding/submit
Body: { step: string, data: object }
Response: { success: boolean, next_step?: string }

GET /vendor/onboarding/comments
Response: { comments: Comment[] }
```

### Vendor Dashboard

**Module:** `backend/lambda/src/endpoints/vendor-dashboard.ts`  
**Module:** `backend/lambda/src/endpoints/vendor-dashboard-enhanced.ts`

```
GET /vendor/dashboard
Response: { stats: object, recent_bookings: Booking[], notifications: Notification[] }

GET /vendor/dashboard/enhanced
Response: { capabilities: Capability[], bookings: Booking[], analytics: object }
```

### Vendor Profile

**Module:** `backend/lambda/src/endpoints/vendor-profile.ts`

```
GET /vendor/profile
Response: { vendor: Vendor }

PUT /vendor/profile
Body: { ...vendor updates }
Response: { vendor: Vendor }
```

### Vendor Services

**Module:** `backend/lambda/src/endpoints/vendor-services.ts`

```
GET /vendor/services
Response: { services: Service[] }

POST /vendor/services
Body: { service_id: string, price: number, ... }
Response: { service: Service }

PUT /vendor/services/:id
Body: { ...service updates }
Response: { service: Service }
```

### Vendor Bookings

**Module:** `backend/lambda/src/endpoints/vendor-bookings.ts`  
**Module:** `backend/lambda/src/endpoints/vendor-booking-actions.ts`

```
GET /vendor/bookings
Query: ?status=pending&date=2026-01-27
Response: { bookings: Booking[] }

GET /vendor/bookings/:id
Response: { booking: Booking }

PUT /vendor/bookings/:id/accept
Response: { success: boolean, booking: Booking }

PUT /vendor/bookings/:id/reject
Body: { reason: string }
Response: { success: boolean }

PUT /vendor/bookings/:id/complete
Response: { success: boolean, booking: Booking }
```

### Vendor Schedule

**Module:** `backend/lambda/src/endpoints/vendor-schedule.ts`

```
GET /vendor/schedule
Query: ?date=2026-01-27
Response: { schedule: ScheduleSlot[] }

POST /vendor/schedule
Body: { date: string, slots: Slot[] }
Response: { success: boolean }

PUT /vendor/schedule/:id
Body: { ...slot updates }
Response: { slot: ScheduleSlot }
```

### Vendor Settings

**Module:** `backend/lambda/src/endpoints/vendor-settings.ts`

```
GET /vendor/settings
Response: { settings: VendorSettings }

PUT /vendor/settings
Body: { ...settings updates }
Response: { settings: VendorSettings }
```

---

## 👤 Customer Management Endpoints

### Customer Profile

**Module:** `backend/lambda/src/endpoints/customer-profile.ts`

```
GET /customer/profile
Response: { customer: Customer }

PUT /customer/profile
Body: { ...customer updates }
Response: { customer: Customer }
```

### Customer Endpoints

**Module:** `backend/lambda/src/endpoints/customer.ts`

```
GET /customer/dashboard
Response: { stats: object, recent_bookings: Booking[] }

GET /customer/pets
Response: { pets: Pet[] }
```

### Customer Booking History

**Module:** `backend/lambda/src/endpoints/customer-booking-history.ts`

```
GET /customer/bookings
Query: ?status=completed&limit=10
Response: { bookings: Booking[] }

GET /customer/bookings/:id
Response: { booking: Booking }
```

---

## 📅 Booking Management Endpoints

**Module:** `backend/lambda/src/endpoints/bookings.ts`  
**Enhanced Module:** `backend/lambda/src/endpoints/booking-details-enhanced.ts`

### Create Booking
```
POST /bookings
Body: { service_id: string, pet_id: string, date: string, time: string, ... }
Response: { booking: Booking }
```

### Get Booking
```
GET /bookings/:id
Response: { booking: Booking }
```

### Update Booking
```
PUT /bookings/:id
Body: { ...booking updates }
Response: { booking: Booking }
```

### Cancel Booking
```
DELETE /bookings/:id
Body: { reason?: string }
Response: { success: boolean }
```

### List Bookings
```
GET /bookings
Query: ?status=pending&customer_id=xxx&vendor_id=xxx
Response: { bookings: Booking[] }
```

### Get Enhanced Booking Details
```
GET /bookings/:id/enhanced
Query: ?actorId=xxx&actorRole=customer|vendor
Response: {
  booking: Booking,
  pet: Pet,
  vendor: Vendor,
  staff: Staff,
  service: Service,
  customer: Customer,
  prescriptions: Prescription[],
  medicalRecords: MedicalRecord[],
  chat: {
    messages: Message[],
    messageCount: number,
    hasUnreadMessages: boolean
  },
  summary: {
    hasPrescription: boolean,
    hasMedicalRecords: boolean,
    hasChatMessages: boolean,
    prescriptionCount: number,
    medicalRecordCount: number,
    chatMessageCount: number
  }
}
```

### Get Booking Prescriptions
```
GET /bookings/:id/prescriptions
Response: { prescriptions: Prescription[] }
```

### Get Booking Medical Records
```
GET /bookings/:id/medical-records
Response: { medicalRecords: MedicalRecord[] }
```

### Get Booking Chat
```
GET /bookings/:id/chat
Response: {
  messages: Message[],
  messageCount: number
}
```

---

## 💳 Payment Endpoints

**Module:** `backend/lambda/src/endpoints/payments.ts`

### Create Payment
```
POST /payments
Body: { booking_id: string, amount: number, payment_method: string }
Response: { payment: Payment, payment_url?: string }
```

### Get Payment
```
GET /payments/:id
Response: { payment: Payment }
```

### Process Payment
```
POST /payments/:id/process
Body: { payment_id: string, ... }
Response: { success: boolean, payment: Payment }
```

### Payment Webhook (Razorpay)
```
POST /payments/webhook
Body: { ...razorpay webhook payload }
Response: { success: boolean }
```

---

## 🏦 Razorpay Integration

**Module:** `backend/lambda/src/endpoints/razorpay.ts`

### Create Order
```
POST /razorpay/create-order
Body: { bookingId: string, amount: number, currency?: string, customerId?: string }
Response: { orderId: string, amount: number, currency: string, keyId: string }
```

### Verify Payment
```
POST /razorpay/verify-payment
Body: { razorpay_order_id: string, razorpay_payment_id: string, razorpay_signature: string }
Response: { success: boolean, message: string, paymentId: string }
```

### Webhook Handler
```
POST /razorpay/webhook
Body: { event: string, payload: object }
Response: { success: boolean, message: string }
```

### Marketplace Settlement
```
POST /razorpay/marketplace/settlement
Body: { bookingId: string }
Response: { settlementId: string, totalAmount: number, commissionAmount: number, vendorShare: number, status: string }
```

### Process Refund
```
POST /razorpay/refund
Body: { paymentId: string, amount: number, reason?: string }
Response: { refundId: string, amount: number, status: string }
```

---

## 🏦 Razorpay Settlements (Route API)

**Module:** `backend/lambda/src/endpoints/razorpay-settlements.ts`

### Create Linked Account
```
POST /razorpay/linked-account/create
Body: { vendor_id: string }
Response: { account_id: string, status: string, message: string }
```

### Add Bank Account
```
POST /razorpay/linked-account/bank
Body: { vendor_id: string, account_number: string, ifsc_code: string, beneficiary_name: string }
Response: { bank_account_id: string, message: string }
```

### Verify Bank Account
```
POST /razorpay/linked-account/verify-bank
Body: { vendor_id: string }
Response: { verified: boolean, status: string }
```

### Process Settlement
```
POST /settlements/process
Body: { vendor_id: string, booking_ids?: array, amount?: number }
Response: { settlement_id: string, transfer_id: string, total_amount: number, commission: number, payout_amount: number, status: string }
```

### Get Settlement Status
```
GET /settlements/:settlementId
Response: { settlement: Settlement }
```

### Get Vendor Settlements
```
GET /vendor/:vendorId/settlements?status=pending&limit=20&offset=0
Response: { settlements: array, total: number, summary: object }
```

### Auto Settlement (Cron)
```
POST /settlements/auto-process
Response: { processed: number, results: array }
```

---

## 💰 Wallet Endpoints

**Module:** `backend/lambda/src/endpoints/wallet.ts`

### Get Wallet Balance
```
GET /wallet/balance
Response: { balance: number, currency: string }
```

### Get Wallet Transactions
```
GET /wallet/transactions
Query: ?limit=20&offset=0
Response: { transactions: Transaction[] }
```

### Add Money to Wallet
```
POST /wallet/add-money
Body: { amount: number, payment_method: string }
Response: { transaction: Transaction, payment_url?: string }
```

### Wallet Transfer
```
POST /wallet/transfer
Body: { recipient_id: string, amount: number }
Response: { success: boolean, transaction: Transaction }
```

---

## 🛍️ E-Commerce Endpoints

**Module:** `backend/lambda/src/endpoints/ecommerce.ts`

### List Products
```
GET /ecommerce/products
Query: ?category=xxx&pet_type=dog&sort=price_asc
Response: { products: Product[] }
```

### Get Product
```
GET /ecommerce/products/:id
Response: { product: Product }
```

### Add to Cart
```
POST /ecommerce/cart/add
Body: { product_id: string, quantity: number }
Response: { cart: Cart }
```

### Get Cart
```
GET /ecommerce/cart
Response: { cart: Cart }
```

### Checkout
```
POST /ecommerce/checkout
Body: { payment_method: string, shipping_address: object }
Response: { order: Order, payment_url?: string }
```

---

## 🏥 Medical Records

**Module:** `backend/lambda/src/endpoints/medical-records.ts`

### List Medical Records
```
GET /medical-records
Query: ?pet_id=xxx&type=consultation
Response: { records: MedicalRecord[] }
```

### Get Medical Record
```
GET /medical-records/:id
Response: { record: MedicalRecord }
```

### Create Medical Record
```
POST /medical-records
Body: { pet_id: string, type: string, data: object }
Response: { record: MedicalRecord }
```

### Download Record
```
GET /medical-records/:id/download
Response: PDF file
```

---

## 💊 Prescriptions

**Module:** `backend/lambda/src/endpoints/prescriptions.ts`

### List Prescriptions
```
GET /prescriptions
Query: ?pet_id=xxx&booking_id=xxx
Response: { prescriptions: Prescription[] }
```

### Get Prescription
```
GET /prescriptions/:id
Response: { prescription: Prescription }
```

### Create Prescription
```
POST /prescriptions
Body: { booking_id: string, pet_id: string, medications: Medication[] }
Response: { prescription: Prescription }
```

---

## 🐾 Pet Management

**Module:** `backend/lambda/src/endpoints/pets.ts`

### List Pets
```
GET /pets
Response: { pets: Pet[] }
```

### Get Pet
```
GET /pets/:id
Response: { pet: Pet }
```

### Create Pet
```
POST /pets
Body: { name: string, type: string, breed: string, ... }
Response: { pet: Pet }
```

### Update Pet
```
PUT /pets/:id
Body: { ...pet updates }
Response: { pet: Pet }
```

### Delete Pet
```
DELETE /pets/:id
Response: { success: boolean }
```

---

## 📦 Package Management

**Module:** `backend/lambda/src/endpoints/packages.ts`

### List Packages
```
GET /packages
Query: ?vendor_id=xxx&status=active
Response: { packages: Package[] }
```

### Get Package
```
GET /packages/:id
Response: { package: Package }
```

### Create Package
```
POST /packages
Body: { name: string, services: string[], price: number, ... }
Response: { package: Package }
```

### Package Sessions

**Module:** `backend/lambda/src/endpoints/package-sessions.ts`

```
GET /packages/:id/sessions
Response: { sessions: PackageSession[] }

POST /packages/:id/sessions
Body: { booking_id: string }
Response: { session: PackageSession }
```

---

## 🎁 Promotions & Loyalty

### Promotions

**Module:** `backend/lambda/src/endpoints/promotions.ts`

```
GET /promotions
Query: ?status=active&type=coupon
Response: { promotions: Promotion[] }

POST /promotions
Body: { code: string, discount_type: string, discount_value: number, ... }
Response: { promotion: Promotion }
```

### Loyalty

**Module:** `backend/lambda/src/endpoints/loyalty.ts`

```
GET /loyalty/points
Response: { points: number, tier: string }

GET /loyalty/history
Response: { history: PointsHistory[] }

POST /loyalty/redeem
Body: { reward_id: string }
Response: { success: boolean, coupon_code: string }
```

---

## 🏥 Specialized Services

**Module:** `backend/lambda/src/endpoints/specialized-services.ts`

### Ambulance Service
```
POST /services/ambulance/request
Body: { pet_id: string, location: object, emergency_type: string }
Response: { booking: Booking }
```

### Diagnostics
```
POST /services/diagnostics/book
Body: { pet_id: string, tests: string[], date: string }
Response: { booking: Booking }
```

### Medicine Delivery
```
POST /services/medicine-delivery/order
Body: { prescription_id: string, address: object }
Response: { order: Order }
```

---

## 📍 GPS Tracking

**Module:** `backend/lambda/src/endpoints/gps-tracking.ts`

### Start Tracking
```
POST /gps-tracking/start
Body: { booking_id: string }
Response: { session_id: string }
```

### Update Location
```
POST /gps-tracking/update
Body: { session_id: string, lat: number, lng: number }
Response: { success: boolean }
```

### Get Tracking Status
```
GET /gps-tracking/:bookingId/status
Response: { isTracking: boolean, currentLocation: object, route: object[] }
```

### Stop Tracking
```
POST /gps-tracking/stop
Body: { session_id: string }
Response: { success: boolean }
```

---

## 📹 Video Call

**Module:** `backend/lambda/src/endpoints/video-call.ts`

### Get Meeting Info
```
GET /video-call/:bookingId/meeting-info
Response: { meeting_id: string, attendee_info: object }
```

### End Call
```
POST /video-call/:bookingId/end
Response: { success: boolean, duration: number }
```

---

## 💬 Chat

**Module:** `backend/lambda/src/endpoints/chat.ts`

### List Conversations
```
GET /chat/conversations
Response: { conversations: Conversation[] }
```

### Get Messages
```
GET /chat/conversations/:id/messages
Query: ?limit=50&offset=0
Response: { messages: Message[] }
```

### Send Message
```
POST /chat/conversations/:id/messages
Body: { content: string, content_type: string }
Response: { message: Message }
```

---

## 🔍 Search

**Module:** `backend/lambda/src/endpoints/search.ts`

### Search Services
```
GET /search/services
Query: ?q=vet&location=lat,lng&radius=5
Response: { services: Service[], vendors: Vendor[] }
```

### Search Vendors
```
GET /search/vendors
Query: ?q=clinic&location=lat,lng
Response: { vendors: Vendor[] }
```

---

## 👨‍💼 Admin Endpoints

### Admin Dashboard

**Module:** `backend/lambda/src/endpoints/admin.ts`

```
GET /admin/dashboard
Response: { stats: object, recent_activities: Activity[] }
```

### Admin Governance

**Module:** `backend/lambda/src/endpoints/admin-governance.ts`

```
GET /admin/governance/status
Response: { status: SystemStatus }

GET /admin/governance/audit-log
Query: ?limit=50&offset=0
Response: { entries: AuditLogEntry[] }

POST /admin/governance/invalidate-cache
Body: { cache_type: string }
Response: { success: boolean }
```

### Admin Integrations

**Module:** `backend/lambda/src/endpoints/admin-integrations.ts`

```
GET /admin/integrations/aws
Response: { config: AWSConfig }

PUT /admin/integrations/aws
Body: { region: string, s3: object, sns: object, ... }
Response: { config: AWSConfig }
```

### Service Catalog

**Module:** `backend/lambda/src/endpoints/service-catalog.ts`

```
GET /admin/service-catalog
Response: { services: Service[] }

POST /admin/service-catalog
Body: { service_name: string, category_id: string, ... }
Response: { service: Service }
```

### Settlements

**Module:** `backend/lambda/src/endpoints/settlements.ts`

```
GET /settlements
Query: ?status=pending&vendor_id=xxx
Response: { settlements: Settlement[] }

POST /settlements/:id/process
Response: { success: boolean, payout_reference: string }
```

### Refund Policy Engine

**Module:** `backend/lambda/src/endpoints/refund-policy-engine.ts`

```
POST /refund-policy/calculate
Body: { bookingId: string, cancellationReason?: string }
Response: { success: boolean, data: { allowed: boolean, refundPercentage: number, refundAmount: number, reason: string, policyType: string, hoursUntilBooking: number } }

GET /admin/refund-rules?vendorId=uuid&serviceId=uuid
Response: { success: boolean, rules: array }

POST /admin/refund-rules
Body: { vendorId?: string, serviceId?: string, fullRefundBeforeHours: number, partialRefundBeforeHours: number, partialRefundPercentage: number, cancellationCutoffHours?: number, isActive?: boolean }
Response: { success: boolean, rule: object, message: string }

PUT /admin/refund-rules/:ruleId
Body: { fullRefundBeforeHours?: number, partialRefundBeforeHours?: number, partialRefundPercentage?: number, cancellationCutoffHours?: number, isActive?: boolean }
Response: { success: boolean, rule: object, message: string }
```

### Reports

**Module:** `backend/lambda/src/endpoints/reports.ts`

```
GET /admin/reports
Response: { success: boolean, reports: Report[] }

GET /admin/reports/templates
Response: { success: boolean, templates: ReportTemplate[] }

POST /admin/reports/generate
Body: { reportType: string, dateRange: string, groupBy?: string, filters?: object, metrics?: array }
Response: { success: boolean, data: array, reportType: string, dateRange: object, totalRows: number }

GET /admin/reports/financial/summary?dateRange=30d
Response: { success: boolean, summary: object, dateRange: object }

GET /admin/reports/financial/settlements?dateRange=30d&vendorId=uuid
Response: { success: boolean, settlements: array, dateRange: object, total: number }

GET /admin/reports/financial/payments?dateRange=30d&status=completed
Response: { success: boolean, payments: array, dateRange: object, total: number }
```

### Analytics

**Module:** `backend/lambda/src/endpoints/analytics.ts`

```
GET /admin/analytics/kpis
Query: ?period=30d
Response: { kpis: KPI[] }

GET /admin/analytics/charts
Query: ?period=30d
Response: { revenue: ChartData, bookings: ChartData }
```

### Regions

**Module:** `backend/lambda/src/endpoints/regions.ts`

```
GET /admin/regions
Response: { regions: Region[] }

POST /admin/regions
Body: { name: string, code: string, ... }
Response: { region: Region }
```

### Tier System

**Module:** `backend/lambda/src/endpoints/tier-system.ts`

```
GET /admin/tiers
Response: { tiers: Tier[] }

POST /admin/tiers
Body: { name: string, level: number, commission_rate: number, ... }
Response: { tier: Tier }
```

### Roles

**Module:** `backend/lambda/src/endpoints/roles.ts`

```
GET /admin/roles
Response: { roles: Role[] }

GET /admin/roles/:id/capabilities
Response: { capabilities: Capability[] }

PUT /admin/roles/:id/capabilities
Body: { capability_ids: string[] }
Response: { success: boolean }
```

---

## 📊 Staff Management

**Module:** `backend/lambda/src/endpoints/staff.ts`

```
GET /staff
Query: ?vendor_id=xxx&role=walker
Response: { staff: Staff[] }

POST /staff
Body: { vendor_id: string, name: string, role: string, ... }
Response: { staff: Staff }
```

---

## 🔔 Notifications

### Notifications

**Module:** `backend/lambda/src/endpoints/notifications.ts`

```
GET /notifications
Query: ?unread_only=true
Response: { notifications: Notification[] }

POST /notifications/:id/read
Response: { success: boolean }
```

### Notification System

**Module:** `backend/lambda/src/endpoints/notification-system.ts`

```
POST /notifications/send
Body: { user_id: string, title: string, message: string, type: string }
Response: { success: boolean, notification: Notification }
```

### SMS Notifications

**Module:** `backend/lambda/src/endpoints/sms-notifications.ts`

```
POST /sms/send
Body: { phone: string, message: string }
Response: { success: boolean, message_id: string }
```

### Push Notifications

**Module:** `backend/lambda/src/endpoints/push-notifications.ts`

```
POST /push/send
Body: { user_id: string, title: string, body: string, data: object }
Response: { success: boolean }
```

---

## 📦 Subscriptions

**Module:** `backend/lambda/src/endpoints/subscriptions.ts`

```
GET /subscriptions/plans
Response: { plans: SubscriptionPlan[] }

POST /subscriptions/subscribe
Body: { plan_id: string, payment_method: string }
Response: { subscription: Subscription }
```

### Time Window Subscriptions

**Module:** `backend/lambda/src/endpoints/time-window-subscription.ts`

```
GET /subscriptions/time-windows
Response: { windows: TimeWindow[] }

POST /subscriptions/time-windows
Body: { service_id: string, start_time: string, end_time: string, ... }
Response: { window: TimeWindow }
```

---

## 🏥 Insurance

**Module:** `backend/lambda/src/endpoints/insurance.ts`

```
GET /insurance/plans
Response: { plans: InsurancePlan[] }

POST /insurance/policies
Body: { plan_id: string, pet_id: string, start_date: string }
Response: { policy: Policy }

GET /insurance/claims
Response: { claims: Claim[] }

POST /insurance/claims
Body: { policy_id: string, claim_type: string, amount_claimed: number, ... }
Response: { claim: Claim }
```

---

## 🎉 Events

**Module:** `backend/lambda/src/endpoints/events.ts`

```
GET /events
Query: ?category=adoption&city=Bangalore
Response: { events: Event[] }

POST /events/:id/register
Body: { pet_ids: string[] }
Response: { registration: Registration }
```

---

## 💝 Donations

**Module:** `backend/lambda/src/endpoints/donations.ts`

```
GET /donations/campaigns
Response: { campaigns: Campaign[] }

POST /donations/campaigns/:id/donate
Body: { amount: number, payment_method: string }
Response: { donation: Donation }
```

---

## ⭐ Reviews

**Module:** `backend/lambda/src/endpoints/reviews.ts`

```
GET /reviews
Query: ?vendor_id=xxx&rating=5
Response: { reviews: Review[] }

POST /reviews
Body: { booking_id: string, rating: number, comment: string }
Response: { review: Review }
```

---

## 📦 Order Management

**Module:** `backend/lambda/src/endpoints/order-management.ts`

```
GET /orders
Query: ?status=pending&customer_id=xxx
Response: { orders: Order[] }

GET /orders/:id
Response: { order: Order }

PUT /orders/:id/status
Body: { status: string }
Response: { order: Order }
```

---

## 🔄 Returns

**Module:** `backend/lambda/src/endpoints/returns.ts`

```
POST /returns/request
Body: { order_id: string, reason: string, items: string[] }
Response: { return: Return }

GET /returns
Query: ?status=pending
Response: { returns: Return[] }
```

---

## 🚚 Logistics

**Module:** `backend/lambda/src/endpoints/logistics.ts`

```
GET /logistics/tracking/:orderId
Response: { tracking: TrackingInfo }

POST /logistics/update-location
Body: { order_id: string, lat: number, lng: number }
Response: { success: boolean }
```

---

## 📍 Addresses

**Module:** `backend/lambda/src/endpoints/addresses.ts`

```
GET /addresses
Response: { addresses: Address[] }

POST /addresses
Body: { type: string, street: string, city: string, ... }
Response: { address: Address }

PUT /addresses/:id
Body: { ...address updates }
Response: { address: Address }
```

---

## 📄 File Upload

**Module:** `backend/lambda/src/endpoints/file-upload.ts`

```
POST /upload
Body: FormData (file)
Response: { url: string, file_id: string }
```

---

## 💾 Storage

**Module:** `backend/lambda/src/endpoints/storage.ts`

```
GET /storage/:fileId
Response: File download

DELETE /storage/:fileId
Response: { success: boolean }
```

---

## 🔍 Service Discovery

**Module:** `backend/lambda/src/endpoints/service-discovery.ts`

```
GET /services/discover
Query: ?location=lat,lng&service_type=vet
Response: { services: Service[], vendors: Vendor[] }
```

---

## 📅 Appointment Reminders

**Module:** `backend/lambda/src/endpoints/appointment-reminders.ts`

```
GET /appointments/reminders
Query: ?date=2026-01-27
Response: { reminders: Reminder[] }

POST /appointments/:id/remind
Response: { success: boolean }
```

---

## 🎓 Training Progress

**Module:** `backend/lambda/src/endpoints/training-progress.ts`

```
GET /training/progress
Query: ?pet_id=xxx&training_type=obedience
Response: { progress: TrainingProgress[] }

POST /training/progress
Body: { pet_id: string, training_type: string, milestone: string }
Response: { progress: TrainingProgress }
```

---

## 💳 Transaction Monitoring

**Module:** `backend/lambda/src/endpoints/transaction-monitoring.ts`

```
GET /transactions
Query: ?status=pending&type=payment
Response: { transactions: Transaction[] }

GET /transactions/:id
Response: { transaction: Transaction }
```

---

## 🔧 Enhanced OTP

**Module:** `backend/lambda/src/endpoints/otp-enhanced.ts`

```
POST /otp/send
Body: { phone: string, purpose: string }
Response: { success: boolean, expires_in: number }

POST /otp/verify
Body: { phone: string, otp: string, purpose: string }
Response: { success: boolean, verified: boolean }
```

---

## 🚗 Commute Time Calculation

**Module:** `backend/lambda/src/endpoints/commute-time.ts`

### Calculate Commute Time
```
POST /commute-time/calculate
Body: {
  origin: { latitude: number, longitude: number },
  destination: { latitude: number, longitude: number },
  options?: {
    googleMapsApiKey?: string,
    averageSpeedKmh?: number,
    trafficMultiplier?: number,
    departureTime?: string
  }
}
Response: {
  distanceKm: number,
  durationMinutes: number,
  durationSeconds: number,
  trafficMultiplier?: number,
  method: 'google_maps' | 'haversine',
  estimatedArrival?: string
}
```

### Calculate Multiple Commute Times
```
POST /commute-time/calculate-multiple
Body: {
  origin: { latitude: number, longitude: number },
  destinations: Array<{ latitude: number, longitude: number }>,
  options?: { ... }
}
Response: {
  results: Array<CommuteTimeResult & { destination: Location, index: number }>,
  sorted: Array<...> // Sorted by duration (shortest first)
}
```

### Calculate Staff ETA
```
POST /commute-time/staff-eta
Body: {
  staff_id: string,
  customer_location: { latitude: number, longitude: number },
  booking_datetime: string,
  options?: {
    googleMapsApiKey?: string,
    bufferMinutes?: number
  }
}
Response: {
  staffId: string,
  distanceKm: number,
  durationMinutes: number,
  durationSeconds: number,
  estimatedArrival?: string,
  ...
}
```

---

## ❤️ Health & System Status

### Health Check

**Module:** `backend/lambda/src/endpoints/health.ts`

```
GET /health
Response: { status: 'ok', timestamp: string }
```

### System Health

**Module:** `backend/lambda/src/endpoints/system-health.ts`

```
GET /system/health
Response: { 
  status: 'healthy' | 'degraded' | 'down',
  services: ServiceHealth[],
  database: DatabaseHealth,
  cache: CacheHealth
}
```

---

## 📝 Response Format

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
  "success": false,
  "error": "Error code",
  "message": "Human-readable error message",
  "statusCode": 400
}
```

### Pagination
```json
{
  "items": [ ... ],
  "total": 100,
  "limit": 20,
  "offset": 0,
  "has_more": true
}
```

---

## 🔒 Authentication

All endpoints (except `/health` and `/auth/*`) require authentication:

```
Authorization: Bearer <token>
```

Tokens are obtained from:
- `/auth/verify-otp` - For customers/vendors
- `/auth/admin/login` - For admins

---

## 📊 Rate Limiting

- Standard endpoints: 100 requests/minute per user
- File upload endpoints: 10 requests/minute per user
- Analytics endpoints: 50 requests/minute per user
- Search endpoints: 200 requests/minute per user

---

## 🐛 Error Codes

| Code | Description |
|------|-------------|
| `400` | Bad Request - Invalid input |
| `401` | Unauthorized - Missing or invalid token |
| `403` | Forbidden - Insufficient permissions |
| `404` | Not Found - Resource doesn't exist |
| `409` | Conflict - Resource already exists |
| `422` | Unprocessable Entity - Validation failed |
| `429` | Too Many Requests - Rate limit exceeded |
| `500` | Internal Server Error - Server error |
| `503` | Service Unavailable - Service temporarily unavailable |

---

**Last Updated:** January 27, 2026

