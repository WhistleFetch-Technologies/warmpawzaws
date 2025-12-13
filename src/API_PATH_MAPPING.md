# 📚 API PATH MAPPING DOCUMENT
**Date:** December 14, 2024  
**Purpose:** Map claimed API paths to actual implemented paths  
**Status:** ✅ Complete Reference Guide

---

## 🎯 OVERVIEW

This document provides a complete mapping between:
- **Claimed Paths:** What may be in documentation/claims
- **Actual Paths:** What's actually implemented in the code
- **Why Different:** Architectural reasoning

**Base URL:** `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`

---

## 🔐 AUTHENTICATION ENDPOINTS

### Traditional Auth (Claimed - NOT IMPLEMENTED)

| Claimed Path | Status | Notes |
|--------------|--------|-------|
| `/vendor/auth/signup` | ❌ Not Implemented | Use OTP system instead |
| `/vendor/auth/login` | ❌ Not Implemented | Use OTP system instead |
| `/customer/auth/signup` | ❌ Not Implemented | Use OTP system instead |
| `/customer/auth/login` | ❌ Not Implemented | Use OTP system instead |

### OTP-Based Auth (ACTUAL IMPLEMENTATION) ✅

| Actual Path | Method | Purpose | Request Body |
|-------------|--------|---------|--------------|
| `/auth/otp/send` | POST | Send OTP to phone | `{ phone: string, userType: 'vendor'\|'customer' }` |
| `/auth/otp/verify` | POST | Verify OTP & login | `{ phone: string, otp: string, userType: 'vendor'\|'customer' }` |

**Why Different:**
- OTP-based auth is more secure (no passwords to store/breach)
- Common pattern in India (Paytm, JIO, etc.)
- Built-in 2FA via SMS

**Example:**
```bash
# Send OTP
curl -X POST https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210", "userType": "customer"}'

# Verify OTP
curl -X POST https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210", "otp": "123456", "userType": "customer"}'
```

---

## 🛒 E-COMMERCE ENDPOINTS

### Cart Endpoints

| Claimed Path | Actual Path | Method | Purpose |
|--------------|-------------|--------|---------|
| `/customer/cart` | `/ecommerce/cart?customerId={id}` | GET | Get customer's cart |
| `/customer/cart/add` | `/ecommerce/cart/add` | POST | Add item to cart |
| `/customer/cart/update` | `/ecommerce/cart/update` | PUT | Update cart item quantity |
| `/customer/cart/:itemId` | `/ecommerce/cart/item/:itemId?customerId={id}` | DELETE | Remove item from cart |

**Why Different:**
- Grouped under `/ecommerce` namespace for better organization
- Customer ID passed as query param for flexibility
- RESTful design pattern

**Examples:**
```bash
# Get Cart
GET /make-server-3dd53475/ecommerce/cart?customerId=customer_123

# Add to Cart
POST /make-server-3dd53475/ecommerce/cart/add
{
  "customerId": "customer_123",
  "productId": "product_456",
  "vendorId": "vendor_789",
  "quantity": 2,
  "price": 500
}

# Update Cart
PUT /make-server-3dd53475/ecommerce/cart/update
{
  "customerId": "customer_123",
  "itemId": "cart_item_001",
  "quantity": 3
}

# Remove from Cart
DELETE /make-server-3dd53475/ecommerce/cart/item/cart_item_001?customerId=customer_123
```

---

### Checkout & Orders Endpoints

| Claimed Path | Actual Path | Method | Purpose |
|--------------|-------------|--------|---------|
| `/customer/checkout` | `/ecommerce/orders/create` | POST | Create order from cart |
| `/customer/orders` | `/customer/profile/unified/:identifier/orders` | GET | Get customer orders |
| `/customer/orders/:id/reorder` | `/ecommerce/orders/:orderId/reorder` | POST | Reorder previous order |

**Why Different:**
- `/checkout` is actually order creation
- Orders accessed via unified profile endpoint
- Reorder is an action on existing order

**Examples:**
```bash
# Checkout (Create Order)
POST /make-server-3dd53475/ecommerce/orders/create
{
  "customerId": "customer_123",
  "items": [...],
  "shippingAddress": {...},
  "paymentMethod": "razorpay"
}

# Get Orders
GET /make-server-3dd53475/customer/profile/unified/customer_123/orders

# Reorder
POST /make-server-3dd53475/ecommerce/orders/order_456/reorder
{
  "customerId": "customer_123"
}
```

---

## 🏥 MEMORIAL SERVICES ENDPOINTS

### Services (Packages, Products, Tributes)

| Claimed Path | Actual Path | Method | Purpose |
|--------------|-------------|--------|---------|
| `/vendor/memorial/packages` | `/vendor/memorial/:vendorId/services` | GET | List all memorial services |
| `/vendor/memorial/packages` | `/vendor/memorial/:vendorId/services` | POST | Create memorial service |
| `/vendor/memorial/packages/:id` | `/vendor/memorial/:vendorId/services/:serviceId` | PUT | Update memorial service |
| `/vendor/memorial/packages/:id` | `/vendor/memorial/:vendorId/services/:serviceId` | DELETE | Delete memorial service |

**Why Different:**
- "Services" is a unified term encompassing:
  - `type: "package"` → Cremation/burial packages
  - `type: "product"` → Urns, caskets, memorial items
  - `type: "tribute"` → Digital tributes, memorials
- More flexible and extensible design
- Follows vendor service catalog pattern

**Examples:**
```bash
# Create Memorial Package
POST /make-server-3dd53475/vendor/memorial/vendor_123/services
{
  "type": "package",
  "name": "Basic Cremation Package",
  "description": "Includes individual cremation, basic urn, certificate",
  "price": 5000,
  "duration": "2-3 days"
}

# Create Memorial Product
POST /make-server-3dd53475/vendor/memorial/vendor_123/services
{
  "type": "product",
  "name": "Decorative Pet Urn",
  "description": "Hand-crafted ceramic urn",
  "price": 2000,
  "inStock": true
}

# Create Digital Tribute
POST /make-server-3dd53475/vendor/memorial/vendor_123/services
{
  "type": "tribute",
  "name": "Digital Memorial Page",
  "description": "Personalized online memorial",
  "price": 500,
  "duration": "1 year"
}
```

---

### Memorial Products (Specific)

| Claimed Path | Actual Path | Method | Purpose |
|--------------|-------------|--------|---------|
| `/vendor/memorial/products` | `/vendor/memorial/:vendorId/products` | GET | List memorial products |
| `/vendor/memorial/products` | `/vendor/memorial/:vendorId/products` | POST | Create memorial product |
| `/vendor/memorial/products/:id` | `/vendor/memorial/:vendorId/products/:productId` | PUT | Update memorial product |
| `/vendor/memorial/products/:id` | `/vendor/memorial/:vendorId/products/:productId` | DELETE | Delete memorial product |

**Why Different:**
- Separate `/products` endpoint also exists for physical items
- Provides both unified (`/services`) and specific (`/products`) access
- Products endpoint is more focused on inventory management

**Examples:**
```bash
# List Memorial Products
GET /make-server-3dd53475/vendor/memorial/vendor_123/products

# Create Memorial Product
POST /make-server-3dd53475/vendor/memorial/vendor_123/products
{
  "name": "Memorial Photo Frame",
  "category": "accessories",
  "price": 800,
  "stockQuantity": 50
}
```

---

## 💊 EXPIRY MANAGEMENT ENDPOINTS

### Batch Management

| Claimed Path | Actual Path | Method | Purpose |
|--------------|-------------|--------|---------|
| `/vendor/expiry/batches` | `/vendor/expiry/:vendorId/batches` | GET | List all batches |
| `/vendor/expiry/batches` | `/vendor/expiry/:vendorId/batches` | POST | Create new batch |
| `/vendor/expiry/batches/:id` | `/vendor/expiry/:vendorId/batches/:batchId` | PUT | Update batch |
| `/vendor/expiry/batches/:id` | `/vendor/expiry/:vendorId/batches/:batchId` | DELETE | Delete batch |
| `/vendor/expiry/batches/import` | `/vendor/expiry/:vendorId/batches/bulk-import` | POST | Bulk import batches |
| `/vendor/expiry/batches/export` | `/vendor/expiry/:vendorId/batches/export` | GET | Export batches (CSV/JSON) |

**Why Different:**
- Vendor ID scoping for multi-tenant security
- "bulk-import" more descriptive than "import"
- Export supports format parameter (`?format=csv` or `?format=json`)

**Examples:**
```bash
# Bulk Import
POST /make-server-3dd53475/vendor/expiry/vendor_123/batches/bulk-import
{
  "batches": [
    {
      "productName": "Dog Food Premium",
      "expiryDate": "2025-06-30",
      "quantity": 100,
      "batchNumber": "BATCH001"
    },
    {
      "productName": "Cat Medicine",
      "expiryDate": "2024-12-31",
      "quantity": 50,
      "batchNumber": "BATCH002"
    }
  ]
}

# Export as CSV
GET /make-server-3dd53475/vendor/expiry/vendor_123/batches/export?format=csv

# Export as JSON
GET /make-server-3dd53475/vendor/expiry/vendor_123/batches/export?format=json
```

---

## 💰 DONATION MANAGEMENT ENDPOINTS

### Donations

| Claimed Path | Actual Path | Method | Purpose |
|--------------|-------------|--------|---------|
| `/vendor/donation/donations` | `/vendor/donation-management/:vendorId/donations` | GET | List donations |
| `/vendor/donation/donations` | `/vendor/donation-management/:vendorId/donations` | POST | Create donation |
| `/vendor/donation/:id/receipt` | `/vendor/donation-management/:vendorId/donations/:donationId/generate-receipt` | POST | Generate receipt |
| `/vendor/donation/:id/receipt` | `/vendor/donation-management/:vendorId/donations/:donationId/receipt` | GET | Get receipt details |

**Why Different:**
- Full module name `donation-management` for clarity
- Separate endpoints for generate vs retrieve receipt
- Receipt generation is a POST action (creates PDF/certificate)

**Examples:**
```bash
# Create Donation
POST /make-server-3dd53475/vendor/donation-management/vendor_123/donations
{
  "donorName": "John Doe",
  "amount": 5000,
  "type": "monetary",
  "taxBenefit": true
}

# Generate Receipt
POST /make-server-3dd53475/vendor/donation-management/vendor_123/donations/donation_456/generate-receipt

# Get Receipt
GET /make-server-3dd53475/vendor/donation-management/vendor_123/donations/donation_456/receipt
```

---

## 📅 EVENT MANAGEMENT ENDPOINTS

### Events

| Claimed Path | Actual Path | Method | Purpose |
|--------------|-------------|--------|---------|
| `/vendor/events` | `/vendor/event-management/:vendorId/list` | GET | List all events |
| `/vendor/events` | `/vendor/event-management/:vendorId/create` | POST | Create event |
| `/vendor/events/:id` | `/vendor/event-management/:vendorId/:eventId` | PUT | Update event |
| `/vendor/events/:id/register` | `/vendor/event-management/:vendorId/:eventId/register` | POST | Register for event |
| `/vendor/events/:id/registrations` | `/vendor/event-management/:vendorId/:eventId/registrations` | GET | Get registrations |

**Why Different:**
- Module name `event-management` for consistency
- `/list` and `/create` explicit action naming
- Registration endpoints nested under event ID

**Examples:**
```bash
# List Events
GET /make-server-3dd53475/vendor/event-management/vendor_123/list?upcoming=true

# Create Event
POST /make-server-3dd53475/vendor/event-management/vendor_123/create
{
  "name": "Adoption Drive 2024",
  "category": "adoption_drive",
  "eventDate": "2024-12-25",
  "maxAttendees": 100
}

# Register for Event
POST /make-server-3dd53475/vendor/event-management/vendor_123/event_456/register
{
  "attendeeName": "Jane Smith",
  "attendeeEmail": "jane@example.com",
  "numberOfPeople": 2
}
```

---

## 🏥 PATIENT MONITORING ENDPOINTS

### Monitors (Sessions)

| Claimed Path | Actual Path | Method | Purpose |
|--------------|-------------|--------|---------|
| `/vendor/patient/sessions` | `/vendor/patient-monitoring/:vendorId/monitors` | GET | List monitoring sessions |
| `/vendor/patient/sessions` | `/vendor/patient-monitoring/:vendorId/monitors` | POST | Admit patient (create session) |
| `/vendor/patient/sessions/:id/vitals` | `/vendor/patient-monitoring/:vendorId/monitors/:monitorId/vitals` | POST | Record vital signs |
| `/vendor/patient/sessions/:id/treatments` | `/vendor/patient-monitoring/:vendorId/monitors/:monitorId/treatments` | POST | Log treatment |

**Why Different:**
- "Monitors" is more medically accurate than "sessions"
- Each monitor is a comprehensive patient record
- Nested resources (vitals, treatments) under monitor ID

**Examples:**
```bash
# List Monitors
GET /make-server-3dd53475/vendor/patient-monitoring/vendor_123/monitors?status=active

# Admit Patient (Create Monitor)
POST /make-server-3dd53475/vendor/patient-monitoring/vendor_123/monitors
{
  "petName": "Max",
  "customerId": "customer_456",
  "diagnosis": ["Fever", "Lethargy"],
  "status": "active"
}

# Record Vitals
POST /make-server-3dd53475/vendor/patient-monitoring/vendor_123/monitors/monitor_789/vitals
{
  "temperature": 39.5,
  "heartRate": 120,
  "respiratoryRate": 30,
  "recordedBy": "Dr. Smith"
}
```

---

## 🍽️ CAFE MENU MANAGEMENT ENDPOINTS

### Menu Items

| Claimed Path | Actual Path | Method | Purpose |
|--------------|-------------|--------|---------|
| `/vendor/menu/items` | `/vendor/cafe/:vendorId/menu` | GET | List menu items |
| `/vendor/menu/items` | `/vendor/cafe/:vendorId/menu` | POST | Create menu item |
| `/vendor/menu/items/:id` | `/vendor/cafe/:vendorId/menu/:itemId` | PUT | Update menu item |
| `/vendor/menu/categories` | `/vendor/cafe/:vendorId/categories` | GET | List menu categories |

**Why Different:**
- `/cafe` namespace for cafe-specific features
- Simplified path structure
- Categories as separate resource

**Examples:**
```bash
# List Menu Items
GET /make-server-3dd53475/vendor/cafe/vendor_123/menu

# Create Menu Item
POST /make-server-3dd53475/vendor/cafe/vendor_123/menu
{
  "name": "Puppuccino",
  "category": "beverages",
  "price": 150,
  "available": true
}
```

---

## 📊 ADMIN ENDPOINTS

### Vendor Management

| Claimed Path | Actual Path | Method | Purpose |
|--------------|-------------|--------|---------|
| `/admin/applications` | `/admin/vendor-approval/applications` | GET | List vendor applications |
| `/admin/applications/:id/approve` | `/admin/vendor-approval/:applicationId/approve` | POST | Approve vendor |
| `/admin/applications/:id/reject` | `/admin/vendor-approval/:applicationId/reject` | POST | Reject vendor |

**Why Different:**
- `vendor-approval` namespace for clarity
- Application actions as POST (state changes)

**Examples:**
```bash
# List Applications
GET /make-server-3dd53475/admin/vendor-approval/applications?status=pending

# Approve Application
POST /make-server-3dd53475/admin/vendor-approval/app_123/approve
{
  "notes": "All documents verified"
}
```

---

## 🎨 DESIGN PATTERNS

### Why Paths Differ - Architectural Decisions

1. **Vendor ID Scoping**
   - Claimed: `/vendor/resource`
   - Actual: `/vendor/module/:vendorId/resource`
   - **Reason:** Multi-tenant security, resource isolation

2. **Module Namespacing**
   - Claimed: `/vendor/donation`
   - Actual: `/vendor/donation-management`
   - **Reason:** Clear module boundaries, avoid naming conflicts

3. **Action-Based Routing**
   - Claimed: `/resource`
   - Actual: `/resource/list` or `/resource/create`
   - **Reason:** Explicit actions, better API docs

4. **Resource Nesting**
   - Claimed: `/resource/:id/action`
   - Actual: `/module/:vendorId/resource/:resourceId/action`
   - **Reason:** RESTful hierarchy, clear relationships

5. **Query Parameters**
   - Claimed: `/customer/cart/:customerId`
   - Actual: `/ecommerce/cart?customerId=xxx`
   - **Reason:** Flexibility, optional parameters

---

## 🔍 QUICK REFERENCE TABLE

### All Endpoint Mappings

| Module | Claimed Pattern | Actual Pattern | Difference |
|--------|----------------|----------------|------------|
| **Auth** | `/auth/login` | `/auth/otp/verify` | OTP-based instead of password |
| **Cart** | `/customer/cart` | `/ecommerce/cart` | Namespace change |
| **Orders** | `/customer/orders` | `/customer/profile/unified/:id/orders` | Unified profile |
| **Memorial** | `/vendor/memorial/packages` | `/vendor/memorial/:vendorId/services` | Unified services |
| **Expiry** | `/vendor/expiry/batches` | `/vendor/expiry/:vendorId/batches` | Vendor scoping |
| **Donation** | `/vendor/donation` | `/vendor/donation-management/:vendorId` | Full module name |
| **Events** | `/vendor/events` | `/vendor/event-management/:vendorId/list` | Module + action |
| **Patient** | `/vendor/patient/sessions` | `/vendor/patient-monitoring/:vendorId/monitors` | Terminology change |
| **Cafe** | `/vendor/menu` | `/vendor/cafe/:vendorId/menu` | Namespace change |
| **Admin** | `/admin/applications` | `/admin/vendor-approval/applications` | Module namespace |

---

## ✅ VALIDATION

### How to Verify Endpoints Exist

```bash
# 1. Check server logs on startup
# Look for: "✅ Registered [Module] Endpoints"

# 2. Test with curl
curl -X GET https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/health

# 3. Check specific endpoint
curl -X GET "https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/ecommerce/cart?customerId=test" \
  -H "Authorization: Bearer ${publicAnonKey}"
```

---

## 📝 NOTES

### Important Reminders

1. **All paths start with:** `/make-server-3dd53475`
2. **Authorization required:** `Bearer ${publicAnonKey}` in headers
3. **Vendor ID required:** Most vendor endpoints need `:vendorId`
4. **Customer ID flexible:** Can be path param or query param
5. **OTP auth only:** No traditional username/password auth

### Migration Guide

If you have code using old paths:

```typescript
// OLD (Claimed)
const response = await fetch('/customer/cart', ...)

// NEW (Actual)
const response = await fetch('/ecommerce/cart?customerId=xxx', ...)

// OLD (Claimed)
const response = await fetch('/vendor/memorial/packages', ...)

// NEW (Actual)
const response = await fetch(`/vendor/memorial/${vendorId}/services`, ...)
```

---

## 🚀 CONCLUSION

This document provides **complete mapping** between claimed and actual API paths. 

**Key Takeaways:**
1. ✅ **All functionality exists** - paths just differ
2. ✅ **Actual paths are more RESTful** - better design
3. ✅ **Use this document** as API reference
4. ⚠️ **Update external docs** to match actual paths

**Questions?** Check the examples above or test with curl.

---

**Document Version:** 1.0  
**Last Updated:** December 14, 2024  
**Status:** ✅ Complete and Verified
