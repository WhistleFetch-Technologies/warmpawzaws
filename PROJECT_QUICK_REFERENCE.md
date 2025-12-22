# Warmpawz Project - Quick Reference Guide

**Last Updated:** January 2025

---

## 🚀 Tech Stack at a Glance

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Frontend (Web)** | React | 19.2.3 | Web applications |
| **Frontend (Mobile)** | React Native | 0.73.0 | iOS & Android apps |
| **UI Library** | Radix UI | Latest | Accessible components |
| **Styling** | Tailwind CSS | Latest | Utility-first CSS |
| **Build Tool** | Vite | 6.4.1 | Fast bundler |
| **Backend** | Hono | 4.6.14 | Edge Functions framework |
| **Runtime** | Deno | Latest | Edge Functions runtime |
| **Database** | PostgreSQL | Latest | Primary data store |
| **State Management** | React Query | Latest | Server state |
| **Forms** | React Hook Form | 7.55.0 | Form handling |

---

## 📊 Project Statistics

- **Total Endpoints:** 300+
- **Database Tables:** 71+
- **Vendor Roles:** 20+
- **Platform Capabilities:** 45
- **Third-Party Integrations:** 11
- **Frontend Apps:** 3 (Web Admin, Customer Mobile, Vendor Mobile)
- **Repository Files:** 15+
- **Migration Status:** KV → SQL (In Progress)

---

## 🔑 Key Integrations

| Service | Purpose | Status |
|---------|---------|--------|
| **Razorpay** | Payment processing | ✅ Active |
| **AWS S3** | File storage | ✅ Active |
| **AWS SNS** | SMS/OTP delivery | ✅ Active |
| **AWS Chime** | Video/Chat | ✅ Active |
| **Google Maps** | Location services | ✅ Active |
| **Shiprocket** | Logistics | ✅ Active |
| **Delhivery** | Logistics | ✅ Active |
| **Elasticsearch** | Search | ✅ Active |
| **Supabase** | Platform (DB, Auth, Storage) | ✅ Core |

---

## 🗄️ Database Schema Summary

### Core Tables (15)
- `customers`, `vendors`, `staff`, `bookings`, `services`
- `orders`, `payments`, `payouts`, `refunds`, `settlements`
- `pets`, `reviews`, `notifications`, `otp_tokens`, `sessions`

### Configuration Tables (10)
- `roles`, `role_permissions`, `platform_settings`
- `gst_configs`, `cancellation_policies`, `payment_gateway_settings`
- `admin_settings`, `refund_rules`, `payout_rules`, `booking_rules`

### Analytics Tables (6)
- `search_index`, `search_history`, `search_analytics`
- `vendor_stats`, `item_stats`, `performance_metrics`

**Full Schema:** See `db/migrations/001_initial_schema.sql`

---

## 🔐 Authentication Methods

| User Type | Method | Implementation |
|-----------|--------|----------------|
| **Customer** | Phone OTP | AWS SNS |
| **Vendor** | Phone OTP | AWS SNS |
| **Staff** | Phone OTP | AWS SNS |
| **Admin** | Email/Password | Supabase Auth |

**Session Management:** KV Store + SQL (`sessions` table)

---

## 📱 Application Structure

```
Warmpawzecodev/
├── apps/
│   ├── WarmpawzCustomer/     # Customer Mobile App (React Native)
│   └── WarmpawzVendor/       # Vendor Mobile App (React Native)
├── src/
│   ├── components/
│   │   ├── admin/           # Admin Portal (140+ files)
│   │   ├── customer/        # Customer App (251+ files)
│   │   └── vendor/          # Vendor App (157+ files)
│   ├── supabase/functions/  # Legacy Edge Functions
│   └── ...
├── supabase/functions/
│   └── make-server-3dd53475/  # Production Edge Functions (300+ files)
├── lib/repositories/        # Repository Pattern (15+ files)
└── db/migrations/          # Database Migrations (3 files)
```

---

## 🔄 Key User Journeys

### Customer Journey
1. Registration (Phone OTP) ✅
2. Service Discovery ✅
3. Booking Creation ✅
4. Payment Processing ✅
5. Booking Management ✅
6. E-commerce (Partial) ⚠️

### Vendor Journey
1. Registration (Phone OTP) ✅
2. Role Selection ✅
3. Onboarding Form ✅
4. Application Tracking ✅
5. Service Setup ✅
6. Availability Setup ✅
7. Staff Management ✅
8. Booking Management ✅
9. Earnings & Payouts ✅

### Admin Journey
1. Authentication (Email/Password) ✅
2. Vendor Approval ✅
3. Service Catalog Management ✅
4. Platform Configuration ✅
5. Analytics & Reporting ✅

---

## ⚡ API Endpoint Categories

### Major Categories
- **Authentication:** 10+ endpoints
- **Customer:** 50+ endpoints
- **Vendor:** 80+ endpoints
- **Admin:** 60+ endpoints
- **Payment:** 20+ endpoints
- **Notifications:** 10+ endpoints
- **Specialized Services:** 100+ endpoints

**Full List:** See `API_ENDPOINTS_INVENTORY.md`

---

## 📈 Current Status

### ✅ Working Well
- Core booking flow
- Payment processing (Razorpay)
- Vendor onboarding
- Admin portal
- Service discovery
- Authentication system

### ⚠️ Needs Attention
- E2E Test Pass Rate: 27% (Target: 80%+)
- KV to SQL Migration: In Progress
- Some capability components need integration
- Performance monitoring: Not implemented
- E-commerce: Partially implemented

### ❌ Not Working
- Advanced analytics features
- Real-time notifications (WebSocket)
- Multi-language support
- Rate limiting
- Advanced security features

---

## 🎯 Immediate Priorities

1. **Complete KV to SQL Migration**
   - Migrate all endpoints to repositories
   - Migrate data from KV to SQL

2. **Fix E2E Tests**
   - Current: 27% pass rate
   - Target: 80%+ pass rate

3. **Integrate Missing Components**
   - `vet_summary`, `delivery`, `medical_records`, `emergency`
   - Add to dashboard quick actions

4. **Implement Performance Monitoring**
   - Add metrics collection
   - Set up alerting
   - Create dashboard

5. **Complete E-commerce**
   - Product catalog
   - Shopping cart
   - Order fulfillment

---

## 🔍 Quick Commands

### Development
```bash
# Web App
npm run dev

# Customer Mobile App
cd apps/WarmpawzCustomer && npm start

# Vendor Mobile App
cd apps/WarmpawzVendor && npm start
```

### Deployment
```bash
# Deploy Edge Function
npx supabase functions deploy make-server-3dd53475

# Run Migrations
# (Via Supabase Dashboard or CLI)
```

### Testing
```bash
# E2E Tests
deno run src/tests/e2e-vendor-journey-test.ts --run
```

---

## 📚 Documentation Files

- `COMPREHENSIVE_PROJECT_ANALYSIS.md` - Full detailed analysis
- `API_ENDPOINTS_INVENTORY.md` - Complete API documentation
- `COMPREHENSIVE_FLOW_ANALYSIS_REPORT.md` - User flow analysis
- `docs/kv_to_sql_mapping.md` - Migration documentation
- `NEXT_STEPS_AFTER_DEPLOYMENT.md` - Current status and next steps

---

## 🆘 Common Issues & Solutions

### Issue: E2E Tests Failing
**Solution:** Tests failing due to backend accessibility. Server is now deployed, re-run tests.

### Issue: KV to SQL Migration
**Solution:** Use repository pattern. Migrate endpoints one by one.

### Issue: Missing Components
**Solution:** Components exist but not integrated. Add to dashboard quick actions.

---

## 📞 Key Contact Points

- **Server:** `https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475`
- **Health Check:** `/health`
- **Project ID:** `vpvpbdwtyugbknrntkho`

---

**For detailed information, refer to `COMPREHENSIVE_PROJECT_ANALYSIS.md`**

