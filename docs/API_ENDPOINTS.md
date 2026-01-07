# 📡 API Endpoints Documentation

## Overview

This document lists all API endpoints used by the 23 implemented UI screens across Admin Web, Vendor Web, and Customer Web applications.

**Base URLs:**
- Development: `https://dev.api.warmpawz.com`
- Production: `https://api.warmpawz.com`

**Authentication:**
- All endpoints require authentication token in `Authorization` header
- Format: `Bearer <token>`

---

## 🔐 Authentication Endpoints

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

---

## 👨‍💼 ADMIN WEB ENDPOINTS

### Service Catalog Management

#### List Services
```
GET /admin/service-catalog
Query: ?category_id=xxx&status=active
Response: { services: Service[] }
```

#### List Categories
```
GET /service-catalog/categories
Response: { categories: Category[] }
```

#### Create Service
```
POST /admin/service-catalog
Body: { service_name, display_name, category_id, applicable_roles, base_price, ... }
Response: { service: Service }
```

#### Update Service
```
PUT /admin/service-catalog/:id
Body: { ...service updates }
Response: { service: Service }
```

#### Delete Service
```
DELETE /admin/service-catalog/:id
Response: { success: boolean }
```

#### Reorder Services
```
POST /admin/service-catalog/reorder
Body: { service_ids: string[] }
Response: { success: boolean }
```

---

### Platform Integrations

#### Get AWS Config
```
GET /admin/integrations/aws
Response: { config: AWSConfig }
```

#### Update AWS Config
```
PUT /admin/integrations/aws
Body: { region, s3, sns, ses, chime }
Response: { config: AWSConfig }
```

#### Get Razorpay Config
```
GET /admin/integrations/razorpay
Response: { config: RazorpayConfig }
```

#### Update Razorpay Config
```
PUT /admin/integrations/razorpay
Body: { key_id, webhook_secret, live_mode, enabled }
Response: { config: RazorpayConfig }
```

#### Get Google Maps Config
```
GET /admin/integrations/google-maps
Response: { config: GoogleMapsConfig }
```

#### Update Google Maps Config
```
PUT /admin/integrations/google-maps
Body: { api_key, places_enabled, directions_enabled, enabled }
Response: { config: GoogleMapsConfig }
```

#### Get Shiprocket Config
```
GET /admin/integrations/shiprocket
Response: { config: ShiprocketConfig }
```

#### Update Shiprocket Config
```
PUT /admin/integrations/shiprocket
Body: { email, token, pickup_locations, enabled }
Response: { config: ShiprocketConfig }
```

#### Test Connection
```
POST /admin/integrations/test-connection
Body: { service: 'aws' | 'razorpay' | 'google-maps' | 'shiprocket' }
Response: { success: boolean, message: string }
```

---

### Settlements Dashboard

#### List Settlements
```
GET /settlements
Query: ?status=pending&year=2026&vendor_id=xxx
Response: { settlements: Settlement[] }
```

#### Get Settlement Summary
```
GET /settlements/summary
Response: { summary: SettlementSummary }
```

#### Process Settlement
```
POST /settlements/:id/process
Response: { success: boolean, payout_reference: string }
```

#### Bulk Process Settlements
```
POST /settlements/bulk-process
Body: { settlement_ids: string[] }
Response: { success: boolean, processed: number }
```

#### Get Settlement Details
```
GET /settlements/:id
Response: { settlement: Settlement }
```

---

### Governance Dashboard

#### Get System Status
```
GET /admin/governance/status
Response: { status: SystemStatus }
```

#### Get Audit Log
```
GET /admin/governance/audit-log
Query: ?limit=50&offset=0
Response: { entries: AuditLogEntry[] }
```

#### Invalidate Cache
```
POST /admin/governance/invalidate-cache
Body: { cache_type: string, target?: string }
Response: { success: boolean }
```

#### Propagate Changes
```
POST /admin/governance/propagate
Body: { type: string, data: object }
Response: { success: boolean }
```

---

### Reports Builder

#### List Report Templates
```
GET /admin/reports/templates
Response: { templates: ReportTemplate[] }
```

#### List Generated Reports
```
GET /admin/reports/generated
Query: ?limit=10&offset=0
Response: { reports: GeneratedReport[] }
```

#### List Saved Reports
```
GET /admin/reports/saved
Response: { reports: SavedReport[] }
```

#### Generate Report
```
POST /admin/reports/generate
Body: { template_id, parameters, format: 'pdf' | 'csv' | 'xlsx' }
Response: { report_id: string, download_url: string }
```

#### Download Report
```
GET /admin/reports/:id/download
Response: File download
```

---

### Analytics Dashboard

#### Get KPIs
```
GET /admin/analytics/kpis
Query: ?period=30d|7d|1d
Response: { kpis: KPI[] }
```

#### Get Chart Data
```
GET /admin/analytics/charts
Query: ?period=30d
Response: { revenue: ChartData, bookings: ChartData }
```

#### Get Top Performers
```
GET /admin/analytics/top-performers
Query: ?period=30d
Response: { vendors: TopPerformer[], services: TopPerformer[], cities: TopPerformer[] }
```

---

### Promotions Management

#### List Promotions
```
GET /admin/promotions
Query: ?status=active&type=coupon
Response: { promotions: Promotion[] }
```

#### List Coupons
```
GET /admin/coupons
Query: ?status=active
Response: { coupons: Coupon[] }
```

#### Create Promotion
```
POST /admin/promotions
Body: { code, name, description, discount_type, discount_value, ... }
Response: { promotion: Promotion }
```

#### Update Promotion
```
PUT /admin/promotions/:id
Body: { ...promotion updates }
Response: { promotion: Promotion }
```

#### Delete Promotion
```
DELETE /admin/promotions/:id
Response: { success: boolean }
```

---

### Region Management

#### List Regions
```
GET /admin/regions
Response: { regions: Region[] }
```

#### Create Region
```
POST /admin/regions
Body: { name, code, country, state, city, timezone, currency, service_radius_km }
Response: { region: Region }
```

#### Update Region
```
PUT /admin/regions/:id
Body: { ...region updates }
Response: { region: Region }
```

#### Delete Region
```
DELETE /admin/regions/:id
Response: { success: boolean }
```

---

### Tier System

#### List Tiers
```
GET /admin/tiers
Response: { tiers: Tier[] }
```

#### Create Tier
```
POST /admin/tiers
Body: { name, display_name, level, commission_rate, min_bookings, min_revenue, benefits }
Response: { tier: Tier }
```

#### Update Tier
```
PUT /admin/tiers/:id
Body: { ...tier updates }
Response: { tier: Tier }
```

#### Delete Tier
```
DELETE /admin/tiers/:id
Response: { success: boolean }
```

---

### Notification Broadcast

#### List Notifications
```
GET /admin/notifications
Query: ?status=sent&limit=20
Response: { notifications: Notification[] }
```

#### Send Notification
```
POST /admin/notifications
Body: { title, message, type, target_audience, channels, scheduled_at? }
Response: { notification: Notification }
```

#### Get Notification Analytics
```
GET /admin/notifications/:id/analytics
Response: { analytics: NotificationAnalytics }
```

---

## 🏪 VENDOR WEB ENDPOINTS

### Bank Details

#### List Bank Accounts
```
GET /vendor/bank-accounts
Response: { accounts: BankAccount[] }
```

#### List UPI Accounts
```
GET /vendor/upi-accounts
Response: { accounts: UPIAccount[] }
```

#### Add Bank Account
```
POST /vendor/bank-accounts
Body: { account_holder_name, account_number, ifsc_code, bank_name, branch_name, account_type }
Response: { account: BankAccount }
```

#### Update Bank Account
```
PUT /vendor/bank-accounts/:id
Body: { ...account updates }
Response: { account: BankAccount }
```

#### Verify Bank Account
```
POST /vendor/bank-accounts/:id/verify
Response: { success: boolean, verification_status: string }
```

#### IFSC Lookup
```
GET /vendor/bank-accounts/ifsc/:code
Response: { bank_name: string, branch_name: string }
```

---

### Vendor Settlements

#### List Settlements
```
GET /vendor/settlements
Query: ?status=completed&year=2026
Response: { settlements: Settlement[] }
```

#### Get Settlement Summary
```
GET /vendor/settlements/summary
Response: { summary: SettlementSummary }
```

#### Download Statement
```
GET /vendor/settlements/:id/statement
Response: PDF file download
```

---

### Package Management

#### List Packages
```
GET /vendor/packages
Response: { packages: Package[] }
```

#### List Services
```
GET /vendor/services
Response: { services: Service[] }
```

#### Create Package
```
POST /vendor/packages
Body: { name, description, service_ids, package_price, validity_days, max_uses }
Response: { package: Package }
```

#### Update Package
```
PUT /vendor/packages/:id
Body: { ...package updates }
Response: { package: Package }
```

#### Get Package Enrollments
```
GET /vendor/packages/:id/enrollments
Response: { enrollments: Enrollment[] }
```

---

### Subscription Plans

#### List Plans
```
GET /vendor/subscriptions/plans
Response: { plans: SubscriptionPlan[] }
```

#### Create Plan
```
POST /vendor/subscriptions/plans
Body: { name, description, service_id, billing_cycle, price, max_bookings_per_cycle }
Response: { plan: SubscriptionPlan }
```

#### Update Plan
```
PUT /vendor/subscriptions/plans/:id
Body: { ...plan updates }
Response: { plan: SubscriptionPlan }
```

#### Get Plan Subscribers
```
GET /vendor/subscriptions/plans/:id/subscribers
Response: { subscribers: Subscriber[] }
```

---

## 👤 CUSTOMER WEB ENDPOINTS

### E-Commerce Shop

#### List Products
```
GET /ecommerce/products
Query: ?category=food&pet_type=dog&sort=price_asc
Response: { products: Product[] }
```

#### List Categories
```
GET /ecommerce/categories
Response: { categories: Category[] }
```

#### Add to Cart
```
POST /ecommerce/cart/add
Body: { product_id, quantity }
Response: { cart: Cart }
```

#### Get Cart
```
GET /ecommerce/cart
Response: { cart: Cart }
```

#### Checkout
```
POST /ecommerce/checkout
Body: { payment_method, shipping_address }
Response: { order_id: string, payment_url?: string }
```

---

### Rewards & Loyalty

#### Get Points Balance
```
GET /rewards/balance
Response: { points: number, tier: string, points_to_next_tier: number, next_tier: string }
```

#### Get Reward Catalog
```
GET /rewards/catalog
Response: { rewards: Reward[] }
```

#### Get Points History
```
GET /rewards/history
Response: { history: PointsHistory[] }
```

#### Get Redeemed Rewards
```
GET /rewards/redeemed
Response: { rewards: RedeemedReward[] }
```

#### Redeem Reward
```
POST /rewards/redeem
Body: { reward_id }
Response: { coupon_code: string, expires_at: string }
```

---

### Medical Records

#### List Pets
```
GET /pets
Response: { pets: Pet[] }
```

#### List Medical Records
```
GET /medical-records
Query: ?pet_id=1&type=consultation
Response: { records: MedicalRecord[] }
```

#### Get Vaccination History
```
GET /medical-records/vaccinations
Query: ?pet_id=1
Response: { vaccinations: Vaccination[] }
```

#### Download Record
```
GET /medical-records/:id/download
Response: PDF file download
```

#### Share Record
```
POST /medical-records/:id/share
Body: { email?: string, phone?: string }
Response: { share_url: string }
```

---

### Chat Feature

#### List Conversations
```
GET /chat/conversations
Response: { conversations: Conversation[] }
```

#### Get Messages
```
GET /chat/conversations/:id/messages
Query: ?limit=50&offset=0
Response: { messages: Message[] }
```

#### Send Message
```
POST /chat/conversations/:id/messages
Body: { content, content_type: 'text' | 'image' | 'file' }
Response: { message: Message }
```

#### Upload File
```
POST /chat/conversations/:id/upload
Body: FormData (file)
Response: { message: Message }
```

---

### Insurance Plans

#### List Plans
```
GET /insurance/plans
Response: { plans: InsurancePlan[] }
```

#### List Policies
```
GET /insurance/policies
Response: { policies: Policy[] }
```

#### Purchase Policy
```
POST /insurance/policies
Body: { plan_id, pet_id, start_date }
Response: { policy: Policy }
```

#### List Claims
```
GET /insurance/claims
Response: { claims: Claim[] }
```

#### Submit Claim
```
POST /insurance/claims
Body: { policy_id, claim_type, incident_date, amount_claimed, description, documents }
Response: { claim: Claim }
```

---

### Events Discovery

#### List Events
```
GET /events
Query: ?category=adoption&city=Bangalore&status=upcoming
Response: { events: Event[] }
```

#### Get Event Details
```
GET /events/:id
Response: { event: Event }
```

#### List Registrations
```
GET /events/registrations
Response: { registrations: Registration[] }
```

#### Register for Event
```
POST /events/:id/register
Body: { pet_ids?: string[] }
Response: { registration: Registration }
```

#### Get QR Code
```
GET /events/:id/qr-code
Response: { qr_code_url: string }
```

---

### Donations Flow

#### List Campaigns
```
GET /donations/campaigns
Query: ?status=active&category=medical
Response: { campaigns: Campaign[] }
```

#### Get Campaign Details
```
GET /donations/campaigns/:id
Response: { campaign: Campaign }
```

#### List My Donations
```
GET /donations/my-donations
Response: { donations: Donation[] }
```

#### Make Donation
```
POST /donations/campaigns/:id/donate
Body: { amount, payment_method, anonymous: boolean }
Response: { donation: Donation, transaction_id: string }
```

---

### Referral System

#### Get Referral Stats
```
GET /referrals/stats
Response: { referral_code: string, referral_link: string, total_referrals: number, ... }
```

#### List Referrals
```
GET /referrals/list
Response: { referrals: Referral[] }
```

#### Get Rewards
```
GET /referrals/rewards
Response: { rewards: ReferralReward[] }
```

#### Generate Referral Link
```
POST /referrals/generate-link
Response: { referral_link: string, referral_code: string }
```

---

## 📝 Response Formats

### Success Response
```typescript
{
  success: true,
  data?: any,
  message?: string
}
```

### Error Response
```typescript
{
  success: false,
  error: string,
  message: string,
  statusCode: number
}
```

### Pagination
```typescript
{
  items: any[],
  total: number,
  limit: number,
  offset: number,
  has_more: boolean
}
```

---

## 🔒 Authentication

All endpoints (except auth endpoints) require:
```
Authorization: Bearer <token>
```

Tokens are obtained from:
- `/auth/verify-otp` - For customers/vendors
- `/auth/admin/login` - For admins

---

## 📊 Rate Limiting

- Standard endpoints: 100 requests/minute
- File upload endpoints: 10 requests/minute
- Analytics endpoints: 50 requests/minute

---

**Last Updated:** January 6, 2026

