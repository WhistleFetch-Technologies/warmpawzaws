# Vendor Capabilities API Endpoints Mapping

**Date:** 2026-01-28  
**Purpose:** Map all 56 capabilities to their API endpoints for testing

---

## 📋 CAPABILITY → API ENDPOINT MAPPING

### Core Capabilities

#### 1. dashboard
- **UI Route:** `/`
- **API Endpoints:**
  - `GET /vendor/:vendorId/dashboard` - Get dashboard stats
- **CRUD:** READ only

#### 2. bookings
- **UI Route:** `/bookings`
- **API Endpoints:**
  - `GET /vendor/:vendorId/bookings` - List all bookings
  - `GET /vendor/:vendorId/bookings/today` - Today's bookings
  - `GET /vendor/:vendorId/bookings/:bookingId` - Get booking details
  - `PUT /vendor/:vendorId/bookings/:bookingId/status` - Update booking status
  - `PUT /vendor/:vendorId/bookings/:bookingId` - Update booking
- **CRUD:** READ, UPDATE

#### 3. profile
- **UI Route:** `/profile`
- **API Endpoints:**
  - `GET /vendor/:vendorId/profile` - Get vendor profile
  - `PUT /vendor/:vendorId/profile` - Update vendor profile
- **CRUD:** READ, UPDATE

---

### Services Capabilities

#### 4. services
- **UI Route:** `/services`
- **API Endpoints:**
  - `GET /vendor/:vendorId/services` - List services
  - `POST /vendor/:vendorId/services` - Create service
  - `PUT /vendor/:vendorId/services/:serviceId` - Update service
  - `DELETE /vendor/:vendorId/services/:serviceId` - Delete service
- **CRUD:** CREATE, READ, UPDATE, DELETE

#### 5. packages
- **UI Route:** `/services/packages`
- **API Endpoints:**
  - `GET /vendor/:vendorId/packages` - List packages
  - `POST /vendor/:vendorId/packages` - Create package
  - `PUT /vendor/:vendorId/packages/:packageId` - Update package
  - `DELETE /vendor/:vendorId/packages/:packageId` - Delete package
- **CRUD:** CREATE, READ, UPDATE, DELETE

#### 6. pricing
- **UI Route:** `/services/pricing`
- **API Endpoints:**
  - `GET /vendor/:vendorId/pricing` - Get pricing
  - `PUT /vendor/:vendorId/pricing` - Update pricing
- **CRUD:** READ, UPDATE

#### 7. test_catalog
- **UI Route:** `/services/tests`
- **API Endpoints:**
  - `GET /vendor/:vendorId/tests` - List tests
  - `POST /vendor/:vendorId/tests` - Create test
  - `PUT /vendor/:vendorId/tests/:testId` - Update test
  - `DELETE /vendor/:vendorId/tests/:testId` - Delete test
- **CRUD:** CREATE, READ, UPDATE, DELETE

#### 8. menu
- **UI Route:** `/services/menu`
- **API Endpoints:**
  - `GET /vendor/:vendorId/menu` - List menu items
  - `POST /vendor/:vendorId/menu` - Create menu item
  - `PUT /vendor/:vendorId/menu/:itemId` - Update menu item
  - `DELETE /vendor/:vendorId/menu/:itemId` - Delete menu item
- **CRUD:** CREATE, READ, UPDATE, DELETE

#### 9. products
- **UI Route:** `/services/products`
- **API Endpoints:**
  - `GET /vendor/:vendorId/products` - List products
  - `POST /vendor/:vendorId/products` - Create product
  - `PUT /vendor/:vendorId/products/:productId` - Update product
  - `DELETE /vendor/:vendorId/products/:productId` - Delete product
- **CRUD:** CREATE, READ, UPDATE, DELETE

#### 10. subscriptions
- **UI Route:** `/services/subscriptions`
- **API Endpoints:**
  - `GET /vendor/:vendorId/subscriptions` - List subscriptions
  - `POST /vendor/:vendorId/subscriptions` - Create subscription
  - `PUT /vendor/:vendorId/subscriptions/:subscriptionId` - Update subscription
  - `DELETE /vendor/:vendorId/subscriptions/:subscriptionId` - Delete subscription
- **CRUD:** CREATE, READ, UPDATE, DELETE

#### 11. centre_booking
- **UI Route:** `/bookings/centre`
- **API Endpoints:**
  - Same as `bookings` - uses booking endpoints with service_style filter
- **CRUD:** READ, UPDATE

#### 12. home_services
- **UI Route:** `/bookings/home`
- **API Endpoints:**
  - Same as `bookings` - uses booking endpoints with service_style filter
- **CRUD:** READ, UPDATE

#### 13. tele_consultation
- **UI Route:** `/bookings/tele`
- **API Endpoints:**
  - Same as `bookings` - uses booking endpoints with service_style filter
- **CRUD:** READ, UPDATE

---

### Operations Capabilities

#### 14. staff
- **UI Route:** `/staff`
- **API Endpoints:**
  - `GET /vendor/:vendorId/staff` - List staff
  - `POST /vendor/:vendorId/staff` - Create staff member
  - `PUT /vendor/:vendorId/staff/:staffId` - Update staff member
  - `DELETE /vendor/:vendorId/staff/:staffId` - Delete staff member
- **CRUD:** CREATE, READ, UPDATE, DELETE

#### 15. schedule
- **UI Route:** `/schedule`
- **API Endpoints:**
  - `GET /vendor/:vendorId/schedule` - Get schedule
  - `PUT /vendor/:vendorId/schedule` - Update schedule
- **CRUD:** READ, UPDATE

#### 16. service_radius
- **UI Route:** `/schedule/radius`
- **API Endpoints:**
  - `GET /vendor/:vendorId/service-radius` - Get service radius
  - `PUT /vendor/:vendorId/service-radius` - Update service radius
- **CRUD:** READ, UPDATE

#### 17. gps_tracking
- **UI Route:** `/schedule/gps`
- **API Endpoints:**
  - `GET /vendor/:vendorId/gps-tracking` - Get GPS tracking
  - `POST /vendor/:vendorId/gps-tracking` - Start GPS tracking
- **CRUD:** READ, CREATE

---

### Finance Capabilities

#### 18. earnings
- **UI Route:** `/finance/earnings`
- **API Endpoints:**
  - `GET /vendor/:vendorId/earnings` - Get earnings
- **CRUD:** READ only

#### 19. settlements
- **UI Route:** `/finance/settlements`
- **API Endpoints:**
  - `GET /vendor/:vendorId/settlements` - List settlements
  - `GET /vendor/:vendorId/settlements/:settlementId` - Get settlement details
- **CRUD:** READ only

#### 20. bank_account
- **UI Route:** `/finance/bank`
- **API Endpoints:**
  - `GET /vendor/:vendorId/bank-account` - Get bank account
  - `POST /vendor/:vendorId/bank-account` - Create bank account
  - `PUT /vendor/:vendorId/bank-account` - Update bank account
- **CRUD:** CREATE, READ, UPDATE

---

### Medical Capabilities

#### 21. prescriptions
- **UI Route:** `/medical/prescriptions`
- **API Endpoints:**
  - `GET /prescriptions/vendor/:vendorId` - List prescriptions
  - `POST /prescriptions` - Create prescription
  - `PUT /prescriptions/:prescriptionId` - Update prescription
- **CRUD:** CREATE, READ, UPDATE

#### 22. medical_records
- **UI Route:** `/medical/records`
- **API Endpoints:**
  - `GET /vendor/:vendorId/medical-records` - List medical records
  - `POST /vendor/:vendorId/medical-records` - Create medical record
  - `PUT /vendor/:vendorId/medical-records/:recordId` - Update medical record
- **CRUD:** CREATE, READ, UPDATE

#### 23. vaccination
- **UI Route:** `/medical/vaccination`
- **API Endpoints:**
  - `GET /vendor/:vendorId/vaccination` - List vaccinations
  - `POST /vendor/:vendorId/vaccination` - Create vaccination record
- **CRUD:** CREATE, READ

#### 24. diagnostics
- **UI Route:** `/medical/diagnostics`
- **API Endpoints:**
  - `GET /vendor/:vendorId/diagnostics` - List diagnostics
  - `POST /vendor/:vendorId/diagnostics` - Create diagnostic test
- **CRUD:** CREATE, READ

---

### Operations Capabilities (continued)

#### 25. reviews
- **UI Route:** `/operations/reviews`
- **API Endpoints:**
  - `GET /vendor/:vendorId/reviews` - List reviews
- **CRUD:** READ only

#### 26. analytics
- **UI Route:** `/operations/analytics`
- **API Endpoints:**
  - `GET /vendor/:vendorId/analytics` - Get analytics
- **CRUD:** READ only

#### 27. reports
- **UI Route:** `/operations/reports`
- **API Endpoints:**
  - `GET /vendor/:vendorId/reports` - List reports
  - `POST /vendor/:vendorId/reports` - Generate report
- **CRUD:** CREATE, READ

#### 28. settings
- **UI Route:** `/operations/settings`
- **API Endpoints:**
  - `GET /vendor/:vendorId/settings` - Get settings
  - `PUT /vendor/:vendorId/settings` - Update settings
- **CRUD:** READ, UPDATE

---

## 📊 TESTING STATUS

**Status:** ⏳ IN PROGRESS  
**Capabilities Documented:** 28/56  
**Remaining:** 28 capabilities

---

## 🔍 NOTES

- Some capabilities share endpoints (e.g., booking styles use same booking endpoints)
- Some capabilities are READ-only (e.g., earnings, reviews)
- Some capabilities require CREATE operations (e.g., services, staff)
- All capabilities should have at least READ operations

---

**Next Steps:**
1. Complete mapping for remaining 28 capabilities
2. Verify all endpoints exist in codebase
3. Test data handoff for each capability
4. Test full lifecycle (CRUD) for applicable capabilities
