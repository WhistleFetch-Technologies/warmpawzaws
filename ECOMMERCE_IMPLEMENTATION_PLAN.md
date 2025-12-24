# 🛒 ECOMMERCE MARKETPLACE - PHASED IMPLEMENTATION PLAN

**Date:** 2024-12-23  
**Objective:** Complete migration from KV to SQL and implement all missing features  
**Rule:** **STRICTLY NO KV USAGE** - All operations must use SQL repositories

---

## 📋 PHASE OVERVIEW

### **Phase 1: KV to SQL Migration (P0)** - Week 1-2
- Migrate all KV-based endpoints to SQL
- Create missing repositories
- Ensure 100% SQL coverage

### **Phase 2: Core Missing Features (P0)** - Week 2-3
- GST Invoice Generation
- Advertising Module
- Profit Margin Tools

### **Phase 3: Enhanced Features (P1)** - Week 3-4
- Seller Analytics Enhancement
- Ecommerce Policies Completion
- Admin Dashboard

### **Phase 4: Integration & Testing (P1-P2)** - Week 4-5
- Complete order lifecycle
- Payment & settlement integration
- Logistics integration
- Comprehensive testing

---

## 🎯 PHASE 1: KV TO SQL MIGRATION

### **Task 1.1: Migrate Marketplace Products** ⏳
**File:** `marketplace-products.tsx`  
**Status:** Uses KV extensively  
**Target:** Use `ProductsRepository`

**Subtasks:**
1. ✅ Verify `ProductsRepository` exists (DONE - already SQL-based)
2. ⏳ Replace all `kv.get()` calls with `productsRepo.findByVendor()`
3. ⏳ Replace all `kv.set()` calls with `productsRepo.create()` / `update()`
4. ⏳ Update image upload to use SQL
5. ⏳ Test all product CRUD operations
6. ⏳ Verify no KV imports remain

**Test Cases:**
- [ ] Create product
- [ ] Update product
- [ ] Delete product
- [ ] List vendor products
- [ ] Search products
- [ ] Upload product images
- [ ] Update stock
- [ ] Bulk operations

**Acceptance Criteria:**
- ✅ Zero KV usage
- ✅ All endpoints functional
- ✅ All tests pass
- ✅ Data persists in SQL

---

### **Task 1.2: Create GST Configuration Repository** ⏳
**File:** `gst-configuration-endpoints.tsx`  
**Status:** Uses KV for all GST configs  
**Target:** Create `GstConfigRepository` and migrate

**Subtasks:**
1. ⏳ Create database migration for `gst_configurations` table
2. ⏳ Create `GstConfigRepository` class
3. ⏳ Migrate all endpoints to use repository
4. ⏳ Test GST config CRUD
5. ⏳ Verify integration with GST calculator

**Database Schema:**
```sql
CREATE TABLE gst_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hsn_code TEXT,
    category TEXT,
    gst_rate NUMERIC(5, 2) NOT NULL,
    cgst_rate NUMERIC(5, 2),
    sgst_rate NUMERIC(5, 2),
    igst_rate NUMERIC(5, 2),
    applicable_states JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Test Cases:**
- [ ] Create GST config
- [ ] Update GST config
- [ ] Delete GST config
- [ ] List all GST configs
- [ ] Get GST config by HSN code
- [ ] Get GST config by category
- [ ] Integration with GST calculator

**Acceptance Criteria:**
- ✅ Zero KV usage
- ✅ All endpoints functional
- ✅ All tests pass
- ✅ GST calculation works correctly

---

### **Task 1.3: Migrate Promotions** ⏳
**File:** `promotion-endpoints.tsx`  
**Status:** Uses KV for all promotions  
**Target:** Use `PromotionsRepository` (verify if exists, create if not)

**Subtasks:**
1. ⏳ Check if `PromotionsRepository` exists and is SQL-based
2. ⏳ If not, create database migration for `promotions` table
3. ⏳ Create/update `PromotionsRepository` class
4. ⏳ Migrate all endpoints to use repository
5. ⏳ Test promotion CRUD and application
6. ⏳ Verify integration with orders

**Database Schema:**
```sql
CREATE TABLE promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value NUMERIC(10, 2) NOT NULL,
    min_order_amount NUMERIC(10, 2),
    max_discount_amount NUMERIC(10, 2),
    applicable_services JSONB DEFAULT '[]'::jsonb,
    applicable_roles JSONB DEFAULT '[]'::jsonb,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Test Cases:**
- [ ] Create promotion
- [ ] Update promotion
- [ ] Delete promotion
- [ ] List active promotions
- [ ] Apply promotion to order
- [ ] Validate promotion eligibility
- [ ] Track promotion usage

**Acceptance Criteria:**
- ✅ Zero KV usage
- ✅ All endpoints functional
- ✅ All tests pass
- ✅ Promotion application works correctly

---

### **Task 1.4: Migrate Settlement Automation** ⏳
**File:** `marketplace-settlement-automation.tsx`  
**Status:** Uses KV for settlements  
**Target:** Use `SettlementsRepository` (verify if exists)

**Subtasks:**
1. ⏳ Check if `SettlementsRepository` exists and is SQL-based
2. ⏳ Verify settlement table schema
3. ⏳ Migrate all endpoints to use repository
4. ⏳ Test settlement creation and processing
5. ⏳ Verify integration with orders and payments

**Test Cases:**
- [ ] Create settlement
- [ ] Process settlement
- [ ] Get pending settlements
- [ ] Get vendor settlements
- [ ] Update settlement status
- [ ] Integration with Razorpay

**Acceptance Criteria:**
- ✅ Zero KV usage
- ✅ All endpoints functional
- ✅ All tests pass
- ✅ Settlement processing works correctly

---

### **Task 1.5: Migrate Ecommerce Routes** ⏳
**File:** `ecommerce_routes.tsx`  
**Status:** Uses KV for categories and commission settings  
**Target:** Use SQL repositories

**Subtasks:**
1. ⏳ Check if `EcommerceCategoriesRepository` exists
2. ⏳ Create database migration for `ecommerce_categories` (if not exists)
3. ⏳ Create `CommissionSettingsRepository` or use `PlatformSettingsRepository`
4. ⏳ Migrate category endpoints
5. ⏳ Migrate commission settings endpoints
6. ⏳ Test all endpoints

**Database Schema:**
```sql
-- Categories already exist in ecommerce_categories table
-- Commission settings can use platform_settings table with key 'ecommerce_commission'
```

**Test Cases:**
- [ ] List categories
- [ ] Create category
- [ ] Update category
- [ ] Get commission settings
- [ ] Update commission settings
- [ ] Get vendor commission rate

**Acceptance Criteria:**
- ✅ Zero KV usage
- ✅ All endpoints functional
- ✅ All tests pass
- ✅ Data persists in SQL

---

## 🎯 PHASE 2: CORE MISSING FEATURES

### **Task 2.1: GST Invoice Generation** ⏳
**Status:** Missing completely  
**Target:** Complete invoice generation system

**Subtasks:**
1. ⏳ Create database migration for `invoices` table
2. ⏳ Create `InvoicesRepository` class
3. ⏳ Create invoice generation service
4. ⏳ Create invoice endpoints (admin, vendor, customer)
5. ⏳ Integrate with order completion
6. ⏳ Create PDF generation (optional - can use template)
7. ⏳ Test invoice generation

**Database Schema:**
```sql
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT UNIQUE NOT NULL,
    order_id UUID REFERENCES orders(id),
    customer_id UUID REFERENCES customers(id),
    vendor_id UUID REFERENCES vendors(id),
    invoice_date DATE NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL,
    tax_amount NUMERIC(10, 2) NOT NULL,
    cgst_amount NUMERIC(10, 2),
    sgst_amount NUMERIC(10, 2),
    igst_amount NUMERIC(10, 2),
    total_amount NUMERIC(10, 2) NOT NULL,
    hsn_codes JSONB DEFAULT '[]'::jsonb,
    invoice_data JSONB NOT NULL,
    pdf_url TEXT,
    status TEXT DEFAULT 'generated',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Endpoints:**
- `POST /orders/:orderId/generate-invoice`
- `GET /invoices/:invoiceId`
- `GET /invoices/order/:orderId`
- `GET /invoices/vendor/:vendorId`
- `GET /invoices/customer/:customerId`
- `GET /invoices/:invoiceId/pdf`

**Test Cases:**
- [ ] Generate invoice on order completion
- [ ] Get invoice by ID
- [ ] Get invoice by order ID
- [ ] List vendor invoices
- [ ] List customer invoices
- [ ] Invoice contains correct GST breakdown
- [ ] Invoice number is unique
- [ ] Invoice data is complete

**Acceptance Criteria:**
- ✅ Invoice generated automatically on order completion
- ✅ All endpoints functional
- ✅ Invoice contains all required fields
- ✅ GST breakdown is accurate
- ✅ All tests pass

---

### **Task 2.2: Advertising Module** ⏳
**Status:** Missing completely  
**Target:** Complete advertising system

**Subtasks:**
1. ⏳ Create database migration for advertising tables
2. ⏳ Create `AdvertisingCampaignsRepository` class
3. ⏳ Create `AdvertisingImpressionsRepository` class
4. ⏳ Create advertising endpoints (admin, vendor)
5. ⏳ Create impression tracking endpoint
6. ⏳ Create click tracking endpoint
7. ⏳ Create advertising analytics
8. ⏳ Integrate with product display
9. ⏳ Test advertising flow

**Database Schema:**
```sql
CREATE TABLE advertising_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id),
    product_id UUID REFERENCES products(id),
    campaign_name TEXT NOT NULL,
    budget NUMERIC(10, 2) NOT NULL,
    bid_type TEXT CHECK (bid_type IN ('cpc', 'cpm')) NOT NULL,
    bid_amount NUMERIC(10, 2) NOT NULL,
    status TEXT CHECK (status IN ('active', 'paused', 'completed', 'cancelled')) DEFAULT 'active',
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    spend NUMERIC(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE advertising_impressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES advertising_campaigns(id),
    customer_id UUID REFERENCES customers(id),
    product_id UUID REFERENCES products(id),
    impression_type TEXT CHECK (impression_type IN ('view', 'click', 'purchase')) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Endpoints:**
- `POST /admin/advertising/campaigns` - Create campaign (admin)
- `GET /admin/advertising/campaigns` - List all campaigns (admin)
- `POST /vendor/:vendorId/advertising/campaigns` - Create campaign (vendor)
- `GET /vendor/:vendorId/advertising/campaigns` - List vendor campaigns
- `POST /advertising/track-impression` - Track impression
- `POST /advertising/track-click` - Track click
- `GET /vendor/:vendorId/advertising/analytics` - Campaign analytics

**Test Cases:**
- [ ] Create advertising campaign
- [ ] List campaigns
- [ ] Track impression
- [ ] Track click
- [ ] Update campaign budget
- [ ] Pause/resume campaign
- [ ] Get campaign analytics
- [ ] Integration with product display

**Acceptance Criteria:**
- ✅ All endpoints functional
- ✅ Impression tracking works
- [ ] Click tracking works
- [ ] Analytics are accurate
- [ ] Budget tracking works
- [ ] All tests pass

---

### **Task 2.3: Profit Margin Tools** ⏳
**Status:** Missing completely  
**Target:** Complete profit margin calculation system

**Subtasks:**
1. ⏳ Verify `cost_price` column exists in products table (DONE - from migration 013)
2. ⏳ Create profit margin calculation service
3. ⏳ Create profit margin endpoints
4. ⏳ Create seller hub margin dashboard data endpoint
5. ⏳ Create margin analysis reports
6. ⏳ Test margin calculations

**Endpoints:**
- `GET /vendor/:vendorId/products/margin-analysis` - Margin analysis
- `GET /vendor/:vendorId/products/:productId/margin` - Product margin
- `GET /vendor/:vendorId/sales/margin-report` - Sales margin report
- `POST /vendor/:vendorId/products/:productId/update-cost` - Update cost price

**Test Cases:**
- [ ] Calculate profit margin
- [ ] Get product margin
- [ ] Get margin analysis
- [ ] Get sales margin report
- [ ] Update cost price
- [ ] Margin calculations are accurate
- [ ] Low margin alerts

**Acceptance Criteria:**
- ✅ All endpoints functional
- ✅ Margin calculations are accurate
- ✅ Reports are complete
- ✅ All tests pass

---

## 🎯 PHASE 3: ENHANCED FEATURES

### **Task 3.1: Seller Analytics Enhancement** ⏳
**Status:** Partially implemented  
**Target:** Complete ecommerce-specific analytics

**Subtasks:**
1. ⏳ Enhance existing analytics endpoint
2. ⏳ Add product performance analytics
3. ⏳ Add sales trends analysis
4. ⏳ Add customer insights
5. ⏳ Add inventory analytics
6. ⏳ Create analytics endpoints
7. ⏳ Test all analytics

**Endpoints:**
- `GET /vendor/:vendorId/analytics/products` - Product analytics
- `GET /vendor/:vendorId/analytics/sales-trends` - Sales trends
- `GET /vendor/:vendorId/analytics/customers` - Customer insights
- `GET /vendor/:vendorId/analytics/inventory` - Inventory analytics

**Test Cases:**
- [ ] Product performance analytics
- [ ] Sales trends (daily, weekly, monthly)
- [ ] Customer insights
- [ ] Inventory analytics
- [ ] All analytics are accurate

**Acceptance Criteria:**
- ✅ All endpoints functional
- ✅ Analytics are accurate
- ✅ All tests pass

---

### **Task 3.2: Ecommerce Policies Completion** ⏳
**Status:** Partially implemented  
**Target:** Complete policy management system

**Subtasks:**
1. ⏳ Create database migration for `ecommerce_policies` table
2. ⏳ Create `EcommercePoliciesRepository` class
3. ⏳ Create policy endpoints (admin, vendor)
4. ⏳ Implement policy enforcement
5. ⏳ Integrate with order flow
6. ⏳ Test policy application

**Database Schema:**
```sql
CREATE TABLE ecommerce_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_type TEXT CHECK (policy_type IN ('return', 'shipping', 'warranty', 'refund')) NOT NULL,
    vendor_id UUID REFERENCES vendors(id),
    policy_data JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Endpoints:**
- `GET /vendor/:vendorId/policies` - List policies
- `POST /vendor/:vendorId/policies` - Create policy
- `PUT /vendor/:vendorId/policies/:policyId` - Update policy
- `GET /policies/product/:productId` - Get product policies
- `GET /admin/ecommerce/policies` - List all policies (admin)

**Test Cases:**
- [ ] Create policy
- [ ] Update policy
- [ ] Get product policies
- [ ] Policy enforcement on checkout
- [ ] Policy display in product pages

**Acceptance Criteria:**
- ✅ All endpoints functional
- ✅ Policies are enforced
- ✅ All tests pass

---

### **Task 3.3: Admin Ecommerce Dashboard** ⏳
**Status:** Missing  
**Target:** Complete admin dashboard

**Subtasks:**
1. ⏳ Create admin ecommerce overview endpoint
2. ⏳ Create vendor performance comparison endpoint
3. ⏳ Create platform commission tracking endpoint
4. ⏳ Create product management endpoints
5. ⏳ Create order management endpoints
6. ⏳ Create policy management endpoints
7. ⏳ Test all endpoints

**Endpoints:**
- `GET /admin/ecommerce/overview` - Marketplace overview
- `GET /admin/ecommerce/vendors` - Vendor list with metrics
- `GET /admin/ecommerce/products` - Product management
- `GET /admin/ecommerce/orders` - Order management
- `GET /admin/ecommerce/policies` - Policy management

**Test Cases:**
- [ ] Marketplace overview
- [ ] Vendor performance metrics
- [ ] Platform commission tracking
- [ ] Product management
- [ ] Order management

**Acceptance Criteria:**
- ✅ All endpoints functional
- ✅ All metrics are accurate
- ✅ All tests pass

---

## 🎯 PHASE 4: INTEGRATION & TESTING

### **Task 4.1: Complete Order Lifecycle** ⏳
**Status:** Partially implemented  
**Target:** Complete end-to-end order flow

**Subtasks:**
1. ⏳ Verify order creation flow
2. ⏳ Verify payment integration
3. ⏳ Verify order status updates
4. ⏳ Verify shipment creation
5. ⏳ Verify delivery confirmation
6. ⏳ Verify invoice generation
7. ⏳ Verify settlement
8. ⏳ End-to-end testing

**Test Cases:**
- [ ] Create order
- [ ] Process payment
- [ ] Update order status
- [ ] Create shipment
- [ ] Confirm delivery
- [ ] Generate invoice
- [ ] Process settlement
- [ ] Complete order lifecycle

**Acceptance Criteria:**
- ✅ Complete order lifecycle works
- ✅ All integrations functional
- ✅ All tests pass

---

### **Task 4.2: Payment & Settlement Integration** ⏳
**Status:** Partially implemented  
**Target:** Complete payment and settlement flow

**Subtasks:**
1. ⏳ Verify payment initiation
2. ⏳ Verify payment verification
3. ⏳ Verify automatic order status update
4. ⏳ Verify settlement automation
5. ⏳ Verify settlement reconciliation
6. ⏳ Test payment failure handling
7. ⏳ Test refund processing

**Test Cases:**
- [ ] Payment initiation
- [ ] Payment verification
- [ ] Order status update on payment
- [ ] Settlement automation
- [ ] Settlement reconciliation
- [ ] Payment failure handling
- [ ] Refund processing

**Acceptance Criteria:**
- ✅ Payment flow works correctly
- ✅ Settlement automation works
- ✅ All tests pass

---

### **Task 4.3: Logistics Integration** ⏳
**Status:** Partially implemented  
**Target:** Complete logistics integration

**Subtasks:**
1. ⏳ Verify Shiprocket integration
2. ⏳ Verify Delhivery integration
3. ⏳ Verify automatic shipment creation
4. ⏳ Verify tracking updates
5. ⏳ Verify delivery confirmation
6. ⏳ Test logistics flow

**Test Cases:**
- [ ] Create shipment
- [ ] Update tracking
- [ ] Confirm delivery
- [ ] Handle failed delivery
- [ ] Create return shipment

**Acceptance Criteria:**
- ✅ Logistics integration works
- ✅ All tests pass

---

### **Task 4.4: Comprehensive Testing** ⏳
**Status:** Not started  
**Target:** Complete test coverage

**Subtasks:**
1. ⏳ Create test suite for all endpoints
2. ⏳ Create integration tests
3. ⏳ Create end-to-end tests
4. ⏳ Performance testing
5. ⏳ Compliance testing
6. ⏳ Security testing

**Test Coverage:**
- [ ] All endpoints tested
- [ ] Integration tests pass
- [ ] End-to-end tests pass
- [ ] Performance tests pass
- [ ] Compliance tests pass
- [ ] Security tests pass

**Acceptance Criteria:**
- ✅ 100% test coverage
- ✅ All tests pass
- ✅ Performance is acceptable
- ✅ Compliance verified

---

## 📊 PROGRESS TRACKING

### **Phase 1: KV to SQL Migration**
- [ ] Task 1.1: Migrate Marketplace Products
- [ ] Task 1.2: Create GST Configuration Repository
- [ ] Task 1.3: Migrate Promotions
- [ ] Task 1.4: Migrate Settlement Automation
- [ ] Task 1.5: Migrate Ecommerce Routes

### **Phase 2: Core Missing Features**
- [ ] Task 2.1: GST Invoice Generation
- [ ] Task 2.2: Advertising Module
- [ ] Task 2.3: Profit Margin Tools

### **Phase 3: Enhanced Features**
- [ ] Task 3.1: Seller Analytics Enhancement
- [ ] Task 3.2: Ecommerce Policies Completion
- [ ] Task 3.3: Admin Ecommerce Dashboard

### **Phase 4: Integration & Testing**
- [ ] Task 4.1: Complete Order Lifecycle
- [ ] Task 4.2: Payment & Settlement Integration
- [ ] Task 4.3: Logistics Integration
- [ ] Task 4.4: Comprehensive Testing

---

## 🚀 EXECUTION RULES

1. **NO KV USAGE** - Strictly enforce SQL-only
2. **100% Tests Pass** - Move to next task only after all tests pass
3. **No Missing Components** - Complete all routes, handlers, integrations
4. **Wireframe Integration** - Ensure all UI components are wired
5. **Order Lifecycle** - Complete end-to-end flow
6. **Payment & Settlement** - Full integration
7. **No Hallucination** - Analyze before implementing

---

**Next Step:** Start with Task 1.1 - Migrate Marketplace Products

