# E-Commerce Multivendor Marketplace - Implementation Plan

**Date:** January 2026  
**Priority:** High - Critical Gaps  
**Timeline:** 4-6 weeks

---

## PHASE 1: VENDOR PRODUCT MANAGEMENT (Week 1-2)

### **Task 1.1: Vendor Product Management UI**
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 3-4 days

**Files to Create:**
- `apps/vendor-web/app/products/page.tsx` - Product list & management
- `apps/vendor-web/components/vendor/products/ProductList.tsx` - Product listing component
- `apps/vendor-web/components/vendor/products/AddProductModal.tsx` - Add product form
- `apps/vendor-web/components/vendor/products/EditProductModal.tsx` - Edit product form
- `apps/vendor-web/components/vendor/products/ProductForm.tsx` - Shared form component

**Backend Endpoints Required:**
- `GET /vendor/:vendorId/products` - List vendor products
- `POST /vendor/:vendorId/products` - Create product
- `PUT /vendor/:vendorId/products/:productId` - Update product
- `DELETE /vendor/:vendorId/products/:productId` - Delete product
- `GET /ecommerce/categories` - Get categories (existing)

**Features:**
- ✅ Product list with search/filter
- ✅ Add product (name, description, price, stock, images, HSN code, GST rate)
- ✅ Edit product
- ✅ Delete product (with confirmation)
- ✅ Bulk actions (activate/deactivate)
- ✅ Stock management
- ✅ Image upload (S3 integration)
- ✅ Category selection

**Acceptance Criteria:**
- [ ] Vendor can view all their products
- [ ] Vendor can add new products with all required fields
- [ ] Vendor can edit existing products
- [ ] Vendor can delete products
- [ ] Product images can be uploaded
- [ ] Stock levels can be updated
- [ ] Products appear in customer shop after creation

---

### **Task 1.2: Backend Product Management Endpoints**
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 2-3 days

**Files to Create/Update:**
- `backend/lambda/src/endpoints/vendor-products.ts` - New endpoint file
- Update `backend/lambda/src/index.ts` - Register endpoints

**Endpoints to Implement:**
```typescript
GET    /vendor/:vendorId/products          // List vendor products
POST   /vendor/:vendorId/products          // Create product
GET    /vendor/:vendorId/products/:id      // Get product details
PUT    /vendor/:vendorId/products/:id      // Update product
DELETE /vendor/:vendorId/products/:id      // Delete product
POST   /vendor/:vendorId/products/:id/images // Upload product images
PUT    /vendor/:vendorId/products/:id/stock  // Update stock
```

**Database Operations:**
- Use existing `products` table
- Add image URLs to `images` JSONB column
- Update `stock` column
- Set `vendor_id` from path parameter
- Validate vendor ownership

**Acceptance Criteria:**
- [ ] All CRUD operations work
- [ ] Vendor can only manage their own products
- [ ] Image uploads work (S3 integration)
- [ ] Stock updates are atomic
- [ ] Products are validated before creation

---

## PHASE 2: VENDOR ORDER MANAGEMENT (Week 2-3)

### **Task 2.1: Vendor Order Management UI**
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 3-4 days

**Files to Create:**
- `apps/vendor-web/app/orders/page.tsx` - Order list & management
- `apps/vendor-web/components/vendor/orders/OrderList.tsx` - Order listing
- `apps/vendor-web/components/vendor/orders/OrderCard.tsx` - Order card component
- `apps/vendor-web/components/vendor/orders/OrderDetailsModal.tsx` - Order details
- `apps/vendor-web/components/vendor/orders/OrderStatusUpdate.tsx` - Status update component

**Backend Endpoints Required:**
- `GET /vendor/:vendorId/orders` - List vendor orders
- `GET /orders/:orderId` - Get order details (existing)
- `PUT /orders/:orderId/status` - Update order status (existing)
- `POST /orders/:orderId/cancel` - Cancel order (existing)
- `POST /logistics/shiprocket/create-order` - Create shipment (existing)

**Features:**
- ✅ Order list with filters (status, date range)
- ✅ Order details view
- ✅ Update order status (pending → confirmed → processing → shipped → delivered)
- ✅ Cancel order (with reason)
- ✅ Create shipment (Shiprocket integration)
- ✅ View customer details
- ✅ View order items
- ✅ Print shipping label
- ✅ Order search

**Acceptance Criteria:**
- [ ] Vendor can view all their orders
- [ ] Vendor can filter orders by status
- [ ] Vendor can update order status
- [ ] Vendor can cancel orders
- [ ] Vendor can create shipments
- [ ] Order details show all information
- [ ] Status updates trigger notifications

---

### **Task 2.2: Backend Vendor Order Endpoints**
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 1-2 days

**Files to Create/Update:**
- `backend/lambda/src/endpoints/vendor-orders.ts` - New endpoint file
- Update `backend/lambda/src/index.ts` - Register endpoints

**Endpoints to Implement:**
```typescript
GET /vendor/:vendorId/orders              // List vendor orders
GET /vendor/:vendorId/orders/stats        // Order statistics
GET /vendor/:vendorId/orders/:orderId    // Get vendor order details
```

**Database Queries:**
- Filter orders by `vendor_id`
- Join with `order_items` and `products`
- Include customer information
- Calculate order statistics

**Acceptance Criteria:**
- [ ] Vendor can only see their own orders
- [ ] Orders include all necessary details
- [ ] Statistics are accurate
- [ ] Performance is optimized (indexes)

---

## PHASE 3: SELLER DASHBOARD & ANALYTICS (Week 3-4)

### **Task 3.1: Seller Dashboard UI**
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 4-5 days

**Files to Create:**
- `apps/vendor-web/app/seller/page.tsx` - Seller dashboard
- `apps/vendor-web/components/vendor/seller/SellerDashboard.tsx` - Main dashboard component
- `apps/vendor-web/components/vendor/seller/SalesOverview.tsx` - Sales overview cards
- `apps/vendor-web/components/vendor/seller/ProductPerformance.tsx` - Product performance chart
- `apps/vendor-web/components/vendor/seller/RevenueChart.tsx` - Revenue chart
- `apps/vendor-web/components/vendor/seller/TopProducts.tsx` - Top products list
- `apps/vendor-web/components/vendor/seller/OrderTrends.tsx` - Order trends chart

**Backend Endpoints Required:**
- `GET /vendor/:vendorId/analytics/sales` - Sales analytics (NEW)
- `GET /vendor/:vendorId/analytics/products` - Product performance (NEW)
- `GET /vendor/:vendorId/analytics/revenue` - Revenue analytics (existing)
- `GET /vendor/:vendorId/orders/stats` - Order statistics (from Task 2.2)

**Features:**
- ✅ Sales overview (total sales, orders, average order value)
- ✅ Revenue chart (daily/weekly/monthly)
- ✅ Product performance (top selling products)
- ✅ Order trends (orders over time)
- ✅ Customer metrics (new vs returning)
- ✅ Conversion rate
- ✅ Period filters (today, week, month, year)
- ✅ Export reports (CSV/PDF)

**Acceptance Criteria:**
- [ ] Dashboard loads with all metrics
- [ ] Charts render correctly
- [ ] Period filters work
- [ ] Data is accurate
- [ ] Export functionality works
- [ ] Performance is good (caching)

---

### **Task 3.2: Backend Seller Analytics Endpoints**
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 2-3 days

**Files to Create/Update:**
- `backend/lambda/src/endpoints/vendor-analytics.ts` - Update existing file
- Add new handlers for seller-specific analytics

**Endpoints to Implement:**
```typescript
GET /vendor/:vendorId/analytics/sales     // Sales analytics
GET /vendor/:vendorId/analytics/products  // Product performance
GET /vendor/:vendorId/analytics/export    // Export analytics data
```

**Analytics to Calculate:**
- Total sales (revenue)
- Total orders
- Average order value
- Top selling products
- Revenue by day/week/month
- Order trends
- Customer metrics
- Conversion rates

**Database Queries:**
- Aggregate orders by vendor
- Join with products for product analytics
- Calculate time-based metrics
- Use date range filters

**Acceptance Criteria:**
- [ ] All analytics are accurate
- [ ] Queries are optimized
- [ ] Date ranges work correctly
- [ ] Export generates correct data

---

## PHASE 4: SELLER APPROVAL WORKFLOW (Week 4-5)

### **Task 4.1: Seller Role Approval UI (Admin)**
**Priority:** 🟡 HIGH  
**Estimated Time:** 2-3 days

**Files to Create/Update:**
- `apps/admin-web/app/vendors/page.tsx` - Update existing
- `apps/admin-web/components/admin/vendors/SellerApprovalModal.tsx` - New component
- `apps/admin-web/components/admin/vendors/SellerList.tsx` - New component

**Backend Endpoints Required:**
- `GET /admin/vendors/sellers` - List sellers pending approval (NEW)
- `POST /admin/vendors/:vendorId/approve-seller` - Approve seller role (NEW)
- `POST /admin/vendors/:vendorId/reject-seller` - Reject seller role (NEW)

**Features:**
- ✅ List vendors with seller role pending
- ✅ View vendor details
- ✅ Approve seller role
- ✅ Reject seller role (with reason)
- ✅ Filter by status
- ✅ Bulk approval

**Acceptance Criteria:**
- [ ] Admin can see pending seller approvals
- [ ] Admin can approve/reject sellers
- [ ] Approval triggers seller dashboard access
- [ ] Rejection sends notification

---

### **Task 4.2: Seller Role Backend**
**Priority:** 🟡 HIGH  
**Estimated Time:** 2 days

**Files to Create/Update:**
- `backend/lambda/src/endpoints/admin-vendors.ts` - Update existing
- Database: Add `seller_status` to `vendors` table (migration)

**Endpoints to Implement:**
```typescript
GET  /admin/vendors/sellers               // List sellers
POST /admin/vendors/:vendorId/approve-seller  // Approve seller
POST /admin/vendors/:vendorId/reject-seller   // Reject seller
```

**Database Changes:**
- Add `seller_status` column: `pending`, `approved`, `rejected`
- Add `seller_approved_at` timestamp
- Add `seller_approved_by` (admin ID)

**Acceptance Criteria:**
- [ ] Seller status is tracked
- [ ] Approval workflow works
- [ ] Notifications are sent
- [ ] Seller dashboard is accessible after approval

---

## PHASE 5: CUSTOMER ORDER HISTORY (Week 5-6)

### **Task 5.1: Customer E-Commerce Order History UI**
**Priority:** 🟡 HIGH  
**Estimated Time:** 3-4 days

**Files to Create:**
- `apps/customer-web/app/orders/page.tsx` - Update existing or create new
- `apps/customer-web/components/customer/orders/OrderList.tsx` - Order list
- `apps/customer-web/components/customer/orders/OrderCard.tsx` - Order card
- `apps/customer-web/components/customer/orders/OrderTracking.tsx` - Tracking component

**Backend Endpoints Required:**
- `GET /orders/customer/:customerId` - Get customer orders (existing)
- `GET /orders/:orderId/tracking` - Get tracking info (existing)
- `GET /orders/:orderId/invoice` - Get invoice (existing)

**Features:**
- ✅ List all customer orders (e-commerce)
- ✅ Filter by status
- ✅ View order details
- ✅ Track order shipment
- ✅ Download invoice
- ✅ Cancel order (if allowed)
- ✅ Reorder functionality

**Acceptance Criteria:**
- [ ] Customer can view all orders
- [ ] Order details are complete
- [ ] Tracking works
- [ ] Invoice download works
- [ ] Cancellation works (if within time limit)

---

## PHASE 6: ENHANCEMENTS (Week 6+)

### **Task 6.1: Order Tracking UI (Customer)**
**Priority:** 🟡 MEDIUM  
**Estimated Time:** 2 days

**Files to Create:**
- `apps/customer-web/app/orders/[id]/tracking/page.tsx` - Tracking page

**Features:**
- ✅ Real-time shipment tracking
- ✅ Status updates
- ✅ Estimated delivery date
- ✅ Delivery agent contact

---

### **Task 6.2: Product Reviews System**
**Priority:** 🟡 MEDIUM  
**Estimated Time:** 3-4 days

**Files to Create:**
- `apps/customer-web/components/products/ProductReviews.tsx`
- `apps/customer-web/components/products/ReviewForm.tsx`
- Database migration: `product_reviews` table

**Features:**
- ✅ Review products
- ✅ Rate products (1-5 stars)
- ✅ View reviews
- ✅ Filter reviews
- ✅ Report inappropriate reviews

---

### **Task 6.3: Comprehensive Export**
**Priority:** 🟢 LOW  
**Estimated Time:** 2-3 days

**Files to Update:**
- `apps/vendor-web/components/vendor/seller/SellerDashboard.tsx` - Add export
- `backend/lambda/src/endpoints/vendor-analytics.ts` - Export endpoint

**Features:**
- ✅ Export sales data (CSV/PDF)
- ✅ Export product performance (CSV/PDF)
- ✅ Export order history (CSV/PDF)
- ✅ Export analytics reports (PDF)

---

## IMPLEMENTATION PRIORITY

### **Week 1-2: Critical Vendor Features**
1. ✅ Vendor Product Management UI
2. ✅ Backend Product Endpoints
3. ✅ Vendor Order Management UI
4. ✅ Backend Vendor Order Endpoints

### **Week 3-4: Analytics & Approval**
5. ✅ Seller Dashboard UI
6. ✅ Seller Analytics Endpoints
7. ✅ Seller Approval Workflow

### **Week 5-6: Customer Features**
8. ✅ Customer Order History
9. ✅ Order Tracking UI

### **Week 6+: Enhancements**
10. ⚠️ Product Reviews
11. ⚠️ Comprehensive Export

---

## SUCCESS METRICS

- [ ] Vendors can manage products (add/edit/delete)
- [ ] Vendors can manage orders (view/update/cancel)
- [ ] Sellers have analytics dashboard
- [ ] Admin can approve sellers
- [ ] Customers can view order history
- [ ] All buttons have working handlers
- [ ] All flows are complete
- [ ] AWS Serverless compatible

---

## RISKS & MITIGATION

**Risk 1: Image Upload Complexity**
- **Mitigation:** Use existing S3 integration, create reusable image upload component

**Risk 2: Performance with Large Product Catalogs**
- **Mitigation:** Implement pagination, caching, database indexes

**Risk 3: Real-time Order Updates**
- **Mitigation:** Use polling or WebSocket for status updates

**Risk 4: Analytics Query Performance**
- **Mitigation:** Pre-aggregate data, use materialized views, cache results

---

**Document Version:** 1.0  
**Status:** Ready for Implementation  
**Next Action:** Begin Phase 1 - Vendor Product Management

