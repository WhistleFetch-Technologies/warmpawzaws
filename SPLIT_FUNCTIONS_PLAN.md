# Function Split Plan

## Logical Groupings

1. **make-server-core** (Base function - auth, health, regions)
   - Auth endpoints
   - Health endpoints
   - Region endpoints
   - OPTIONS handlers
   - Base middleware

2. **make-server-admin** (Admin operations)
   - Admin vendor management
   - Admin catalog
   - Admin integrations
   - Vendor settings rules
   - Problem grid specialization

3. **make-server-vendor** (Vendor operations)
   - Vendor onboarding
   - Vendor dashboard
   - Vendor services
   - Vendor scheduling
   - Vendor profile
   - Onboarding forms

4. **make-server-customer** (Customer operations)
   - Customer routes
   - Customer services
   - Customer bookings
   - Customer pets
   - Customer search
   - Customer e-commerce

5. **make-server-booking** (Booking management)
   - Booking endpoints
   - Booking lifecycle
   - Booking management
   - Home services
   - Follow-up bookings
   - Medical history

6. **make-server-payment** (Payment processing)
   - Payment endpoints
   - Razorpay integration
   - Marketplace payments
   - Refunds
   - Rescheduling
   - Settlements

7. **make-server-specialized** (Specialized services)
   - Vet services
   - Diagnostics
   - Pharmacy
   - Ambulance
   - Insurance
   - Training

8. **make-server-notifications** (Notifications & communication)
   - SMS OTP
   - Notifications
   - Notification templates
   - Chat
   - Video calls

9. **make-server-integrations** (Third-party integrations)
   - Logistics (Shiprocket, Delhivery)
   - Google Places
   - S3 uploader
   - Elasticsearch
   - AWS Chime

10. **make-server-analytics** (Analytics & intelligence)
    - Analytics aggregation
    - Reports
    - Pet intelligence
    - Search analytics

## Implementation Order

1. Create core function (auth, health, regions) - **PRIORITY 1**
2. Split critical paths (admin, vendor, customer) - **PRIORITY 2**
3. Split supporting functions - **PRIORITY 3**

## Shared Resources

All functions will share:
- `/supabase/lib/` - Shared repositories and utilities
- `/supabase/functions/_shared/` - Shared utilities (to be created)

