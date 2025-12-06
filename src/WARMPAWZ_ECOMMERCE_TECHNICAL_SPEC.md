# Warmpawz Multi-Vendor E-Commerce Platform - Technical Specification

**Version:** 1.0  
**Date:** December 2, 2025  
**Platform:** Supabase Edge Functions + React/TypeScript Frontend  
**Architecture:** Three-tier (Frontend → Server → Database)

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Backend API Endpoints](#backend-api-endpoints)
4. [Database Schema](#database-schema)
5. [Vendor Roles & Permissions](#vendor-roles--permissions)
6. [Component Structure](#component-structure)
7. [Business Logic](#business-logic)
8. [Integration Guidelines](#integration-guidelines)
9. [Testing & Validation](#testing--validation)
10. [Security Considerations](#security-considerations)

---

## 1. System Overview

### 1.1 Project Description
Warmpawz is a comprehensive pet service aggregator featuring a multi-vendor marketplace for pet products. The platform enables:
- **Customers**: Browse 8+ product categories, search, cart management, order tracking
- **Sellers**: Complete seller portal with catalog management, inventory, invoicing, commission tracking
- **Admins**: Marketplace management including seller approval, product moderation, analytics, promotions

### 1.2 Key Features
- ✅ 15+ Backend API Endpoints
- ✅ 100% Vendor Role Coverage (20 roles)
- ✅ End-to-End Shopping Flow
- ✅ Unified Cart Navigation
- ✅ GST Invoicing System
- ✅ Commission Calculation Engine
- ✅ Inventory Management
- ✅ Seller Portal (11 components)
- ✅ Admin E-Commerce System (10 components)

### 1.3 Technology Stack
- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Supabase Edge Functions (Deno runtime)
- **Server Framework**: Hono
- **Database**: Supabase Postgres with KV Store abstraction
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage (private buckets)

---

## 2. Architecture

### 2.1 Three-Tier Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND LAYER                       │
│  /App.tsx, /components/*, /components/vendor/seller/*   │
│            /components/admin/ecommerce/*                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ HTTPS Requests
                     │ Bearer Token Auth
                     │
┌────────────────────▼────────────────────────────────────┐
│                     SERVER LAYER                         │
│     /supabase/functions/server/index.tsx                │
│     /supabase/functions/server/ecommerce_routes.tsx     │
│     Hono Web Server + Route Handlers                    │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ Supabase Client
                     │ Service Role Key
                     │
┌────────────────────▼────────────────────────────────────┐
│                    DATABASE LAYER                        │
│     Supabase Postgres + KV Store Table                  │
│     /supabase/functions/server/kv_store.tsx (PROTECTED)  │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Server Configuration

**Base URL**: `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`

**Route Prefix**: All routes must be prefixed with `/make-server-3dd53475`

**CORS**: Open CORS headers required

**Authentication**: 
- Public routes: `Bearer ${publicAnonKey}`
- Protected routes: `Bearer ${accessToken}` (user session token)

**Imports Location**: `/utils/supabase/info.tsx`
```typescript
import { projectId, publicAnonKey } from './utils/supabase/info';
```

---

## 3. Backend API Endpoints

### 3.1 Endpoint Inventory (15+ APIs)

All endpoints are defined in `/supabase/functions/server/ecommerce_routes.tsx` and mounted in `/supabase/functions/server/index.tsx`.

#### 3.1.1 Product Management

##### **GET** `/make-server-3dd53475/ecommerce/products`
**Description**: Get all active products (public)  
**Auth**: Optional (Bearer publicAnonKey)  
**Query Params**:
- `category` (optional): Filter by category
- `search` (optional): Search term
- `limit` (optional): Results limit
- `offset` (optional): Pagination offset

**Response**:
```typescript
{
  products: Array<{
    id: string;
    sellerId: string;
    sellerName: string;
    name: string;
    description: string;
    category: string;
    price: number;
    originalPrice?: number;
    imageUrl: string;
    stock: number;
    sku: string;
    gstRate: number; // 5, 12, 18, 28
    status: 'active' | 'pending' | 'rejected' | 'outofstock';
    createdAt: string;
    updatedAt: string;
  }>
}
```

##### **POST** `/make-server-3dd53475/ecommerce/products`
**Description**: Create new product (seller only)  
**Auth**: Required (Bearer accessToken)  
**Body**:
```typescript
{
  name: string;
  description: string;
  category: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  stock: number;
  sku: string;
  gstRate: number; // 5, 12, 18, 28
}
```

**Response**:
```typescript
{
  success: true;
  productId: string;
  message: "Product created and pending approval";
}
```

##### **GET** `/make-server-3dd53475/ecommerce/products/:productId`
**Description**: Get single product details  
**Auth**: Optional  
**Response**: Single product object

##### **PUT** `/make-server-3dd53475/ecommerce/products/:productId`
**Description**: Update product (seller only, own products)  
**Auth**: Required  
**Body**: Partial product object  
**Response**: `{ success: true, message: "Product updated" }`

##### **DELETE** `/make-server-3dd53475/ecommerce/products/:productId`
**Description**: Delete product (seller only, own products)  
**Auth**: Required  
**Response**: `{ success: true, message: "Product deleted" }`

---

#### 3.1.2 Seller Portal APIs

##### **GET** `/make-server-3dd53475/ecommerce/seller/products`
**Description**: Get all products for logged-in seller  
**Auth**: Required  
**Response**: Array of seller's products (all statuses)

##### **GET** `/make-server-3dd53475/ecommerce/seller/orders`
**Description**: Get all orders for logged-in seller's products  
**Auth**: Required  
**Query Params**:
- `status` (optional): Filter by order status

**Response**:
```typescript
{
  orders: Array<{
    orderId: string;
    orderItemId: string;
    customerId: string;
    customerName: string;
    customerEmail: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    gstAmount: number;
    commissionRate: number; // 10-20%
    commissionAmount: number;
    sellerEarnings: number; // totalAmount - commissionAmount
    status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
    createdAt: string;
    deliveryAddress: object;
  }>
}
```

##### **GET** `/make-server-3dd53475/ecommerce/seller/dashboard`
**Description**: Get seller analytics and metrics  
**Auth**: Required  
**Response**:
```typescript
{
  totalProducts: number;
  activeProducts: number;
  pendingProducts: number;
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenue: number;
  totalCommission: number;
  totalEarnings: number; // revenue - commission
  monthlyRevenue: number;
  recentOrders: Array<Order>; // Last 10
  lowStockProducts: Array<Product>; // stock < 10
}
```

##### **POST** `/make-server-3dd53475/ecommerce/seller/commission-calculator`
**Description**: Calculate commission for given parameters  
**Auth**: Required  
**Body**:
```typescript
{
  orderAmount: number;
  gstRate: number;
  productCategory?: string;
}
```

**Response**:
```typescript
{
  orderAmount: number;
  gstAmount: number;
  totalAmount: number; // with GST
  commissionRate: number; // 10-20% based on category
  commissionAmount: number;
  sellerEarnings: number;
  breakdown: {
    baseAmount: number;
    gst: number;
    platformCommission: number;
    netEarnings: number;
  }
}
```

##### **POST** `/make-server-3dd53475/ecommerce/seller/generate-invoice`
**Description**: Generate GST-compliant invoice for order  
**Auth**: Required  
**Body**:
```typescript
{
  orderId: string;
  orderItemId: string;
}
```

**Response**:
```typescript
{
  invoice: {
    invoiceNumber: string; // AUTO-GENERATED: WP-INV-{timestamp}-{random}
    invoiceDate: string;
    sellerDetails: {
      name: string;
      gstNumber?: string;
      address?: string;
    };
    customerDetails: {
      name: string;
      email: string;
      address: object;
    };
    items: Array<{
      productName: string;
      quantity: number;
      unitPrice: number;
      gstRate: number;
      gstAmount: number;
      totalAmount: number;
    }>;
    subtotal: number;
    totalGst: number;
    grandTotal: number;
    commissionAmount: number;
    sellerEarnings: number;
  }
}
```

##### **PUT** `/make-server-3dd53475/ecommerce/seller/inventory/:productId`
**Description**: Update inventory stock  
**Auth**: Required  
**Body**:
```typescript
{
  stock: number;
  operation?: 'set' | 'increment' | 'decrement'; // default: 'set'
}
```

**Response**: `{ success: true, newStock: number }`

---

#### 3.1.3 Order Management APIs

##### **POST** `/make-server-3dd53475/ecommerce/orders`
**Description**: Create new order (checkout)  
**Auth**: Required  
**Body**:
```typescript
{
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  deliveryAddress: {
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  paymentMethod: 'cod' | 'online';
}
```

**Response**:
```typescript
{
  success: true;
  orderId: string;
  orderNumber: string; // WP-ORD-{timestamp}
  totalAmount: number;
  items: Array<OrderItem>;
  estimatedDelivery: string; // 5-7 business days
}
```

**Business Logic**:
1. Validate all products exist and have sufficient stock
2. Calculate per-item pricing with GST
3. Calculate commission per seller
4. Deduct stock quantities
5. Create order record with status 'pending'
6. Return order confirmation

##### **GET** `/make-server-3dd53475/ecommerce/orders`
**Description**: Get customer's orders  
**Auth**: Required  
**Response**: Array of customer's orders

##### **GET** `/make-server-3dd53475/ecommerce/orders/:orderId`
**Description**: Get order details with tracking  
**Auth**: Required  
**Response**:
```typescript
{
  orderId: string;
  orderNumber: string;
  customerId: string;
  status: string;
  items: Array<{
    productId: string;
    productName: string;
    sellerId: string;
    sellerName: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    status: string;
    trackingNumber?: string;
  }>;
  deliveryAddress: object;
  paymentMethod: string;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  statusHistory: Array<{
    status: string;
    timestamp: string;
    note?: string;
  }>;
}
```

##### **PUT** `/make-server-3dd53475/ecommerce/orders/:orderId/items/:itemId/status`
**Description**: Update order item status (seller only)  
**Auth**: Required  
**Body**:
```typescript
{
  status: 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  trackingNumber?: string; // required for 'shipped'
  note?: string;
}
```

**Response**: `{ success: true, message: "Order status updated" }`

---

#### 3.1.4 Admin Management APIs

##### **GET** `/make-server-3dd53475/ecommerce/admin/sellers`
**Description**: Get all sellers with pet_product role  
**Auth**: Required (Admin only)  
**Response**:
```typescript
{
  sellers: Array<{
    userId: string;
    email: string;
    businessName?: string;
    gstNumber?: string;
    status: 'active' | 'suspended';
    totalProducts: number;
    totalOrders: number;
    totalRevenue: number;
    joinedAt: string;
  }>
}
```

##### **GET** `/make-server-3dd53475/ecommerce/admin/products/pending`
**Description**: Get all products pending approval  
**Auth**: Required (Admin only)  
**Response**: Array of products with status 'pending'

##### **PUT** `/make-server-3dd53475/ecommerce/admin/products/:productId/approve`
**Description**: Approve product  
**Auth**: Required (Admin only)  
**Response**: `{ success: true, message: "Product approved" }`

##### **PUT** `/make-server-3dd53475/ecommerce/admin/products/:productId/reject`
**Description**: Reject product  
**Auth**: Required (Admin only)  
**Body**: `{ reason: string }`  
**Response**: `{ success: true, message: "Product rejected" }`

##### **GET** `/make-server-3dd53475/ecommerce/admin/analytics`
**Description**: Get marketplace analytics  
**Auth**: Required (Admin only)  
**Response**:
```typescript
{
  totalSellers: number;
  activeSellers: number;
  totalProducts: number;
  activeProducts: number;
  pendingProducts: number;
  totalOrders: number;
  totalRevenue: number;
  totalCommission: number;
  avgOrderValue: number;
  topCategories: Array<{ category: string; count: number; revenue: number }>;
  topSellers: Array<{ sellerId: string; name: string; revenue: number; orders: number }>;
  revenueByMonth: Array<{ month: string; revenue: number; commission: number }>;
}
```

##### **POST** `/make-server-3dd53475/ecommerce/admin/commission-config`
**Description**: Update commission rates  
**Auth**: Required (Admin only)  
**Body**:
```typescript
{
  category?: string; // if not provided, sets default rate
  commissionRate: number; // 0-100 (percentage)
}
```

**Response**: `{ success: true, message: "Commission rate updated" }`

##### **GET** `/make-server-3dd53475/ecommerce/admin/commission-config`
**Description**: Get current commission configuration  
**Auth**: Required (Admin only)  
**Response**:
```typescript
{
  default: number;
  categories: {
    [category: string]: number;
  }
}
```

---

#### 3.1.5 Cart Management (Frontend State)

**Note**: Cart is managed in frontend state (localStorage + React Context). No backend API required initially.

If persistence needed later, create:
- `POST /make-server-3dd53475/ecommerce/cart` - Save cart
- `GET /make-server-3dd53475/ecommerce/cart` - Get cart
- `PUT /make-server-3dd53475/ecommerce/cart` - Update cart

---

## 4. Database Schema

### 4.1 KV Store Keys

The platform uses Supabase KV Store (`kv_store_3dd53475` table) accessed via `/supabase/functions/server/kv_store.tsx` (PROTECTED FILE).

**Available Functions**:
- `kv.get(key)` - Returns single value
- `kv.set(key, value)` - Set single value
- `kv.del(key)` - Delete single value
- `kv.mget([keys])` - Get multiple values (returns array)
- `kv.mset(object)` - Set multiple key-value pairs
- `kv.mdel([keys])` - Delete multiple keys
- `kv.getByPrefix(prefix)` - Get all keys starting with prefix (returns array)

### 4.2 Key Structure

#### Products
```
Key: product:{productId}
Value: {
  id: string;
  sellerId: string;
  sellerName: string;
  name: string;
  description: string;
  category: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  stock: number;
  sku: string;
  gstRate: number;
  status: 'active' | 'pending' | 'rejected' | 'outofstock';
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}
```

#### Seller Products Index
```
Key: seller_products:{sellerId}
Value: [productId1, productId2, ...] // Array of product IDs
```

#### Orders
```
Key: order:{orderId}
Value: {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  items: Array<{
    id: string; // order item ID
    productId: string;
    productName: string;
    sellerId: string;
    sellerName: string;
    quantity: number;
    unitPrice: number;
    gstRate: number;
    gstAmount: number;
    totalAmount: number;
    commissionRate: number;
    commissionAmount: number;
    sellerEarnings: number;
    status: string;
    trackingNumber?: string;
  }>;
  deliveryAddress: object;
  paymentMethod: string;
  totalAmount: number;
  status: string; // overall order status
  createdAt: string;
  updatedAt: string;
  statusHistory: Array<{ status: string; timestamp: string; note?: string }>;
}
```

#### Customer Orders Index
```
Key: customer_orders:{customerId}
Value: [orderId1, orderId2, ...] // Array of order IDs
```

#### Seller Orders Index
```
Key: seller_orders:{sellerId}
Value: [orderId1, orderId2, ...] // Array of order IDs containing seller's products
```

#### Invoices
```
Key: invoice:{invoiceNumber}
Value: {
  invoiceNumber: string;
  invoiceDate: string;
  orderId: string;
  orderItemId: string;
  sellerId: string;
  sellerDetails: object;
  customerDetails: object;
  items: Array<object>;
  subtotal: number;
  totalGst: number;
  grandTotal: number;
  commissionAmount: number;
  sellerEarnings: number;
  createdAt: string;
}
```

#### Commission Configuration
```
Key: commission_config
Value: {
  default: 15; // Default commission rate (%)
  categories: {
    'Food & Treats': 10,
    'Toys & Accessories': 15,
    'Grooming & Care': 12,
    'Health & Wellness': 18,
    // ... other categories
  }
}
```

#### Seller Metadata
```
Key: seller_meta:{sellerId}
Value: {
  userId: string;
  email: string;
  businessName?: string;
  gstNumber?: string;
  status: 'active' | 'suspended';
  joinedAt: string;
  totalProducts: number; // cached count
  totalOrders: number; // cached count
  totalRevenue: number; // cached sum
}
```

#### Categories List
```
Key: product_categories
Value: [
  'Food & Treats',
  'Toys & Accessories',
  'Grooming & Care',
  'Health & Wellness',
  'Beds & Furniture',
  'Apparel & Costumes',
  'Bowls & Feeders',
  'Travel & Outdoor'
]
```

---

## 5. Vendor Roles & Permissions

### 5.1 Pet Product Seller Role

**Role ID**: `pet_product`

**Permissions**:
- Create, read, update, delete own products
- View own orders
- Generate invoices for own orders
- Update order status for own products
- Manage own inventory
- View own analytics
- Calculate commissions

**Access Level**: Seller Portal (`/components/vendor/seller/*`)

### 5.2 Admin Role

**Permission Check**: User must have admin privileges (implementation-specific)

**Permissions**:
- View all sellers
- Approve/reject products
- View all orders
- View marketplace analytics
- Configure commission rates
- Manage seller accounts (suspend/activate)

**Access Level**: Admin E-Commerce Tab (`/components/admin/ecommerce/*`)

---

## 6. Component Structure

### 6.1 Seller Portal Components (`/components/vendor/seller/`)

1. **SellerDashboard.tsx**
   - Overview metrics (revenue, orders, products)
   - Recent orders table
   - Quick actions
   - Low stock alerts

2. **SellerProductCatalog.tsx**
   - Product listing with filters
   - Add new product button
   - Edit/delete actions
   - Status badges (active, pending, rejected, out of stock)

3. **SellerProductForm.tsx**
   - Create/edit product form
   - Image upload
   - Category selection
   - GST rate selection
   - Inventory input
   - SKU generation

4. **SellerOrders.tsx**
   - Order listing with filters (status)
   - Order details modal
   - Update status action
   - Tracking number input
   - Invoice generation button

5. **SellerInventory.tsx**
   - Products with stock levels
   - Quick update stock input
   - Low stock warnings
   - Bulk update option

6. **SellerInvoicing.tsx**
   - Generated invoices list
   - Generate new invoice
   - Download/print invoice
   - GST breakdown view

7. **SellerCommissionCalculator.tsx**
   - Input form (order amount, GST rate, category)
   - Real-time calculation
   - Commission breakdown
   - Earnings projection

8. **SellerAnalytics.tsx**
   - Revenue charts
   - Order trends
   - Top products
   - Category performance

9. **SellerProfile.tsx**
   - Business information
   - GST number
   - Bank details
   - Contact information

10. **SellerSettings.tsx**
    - Notification preferences
    - Payment settings
    - Shipping settings

11. **SellerSupport.tsx**
    - Help center
    - Contact support
    - FAQ

### 6.2 Admin E-Commerce Components (`/components/admin/ecommerce/`)

1. **ECommerceDashboard.tsx**
   - Marketplace overview
   - Key metrics (GMV, commission, orders)
   - Growth charts
   - Quick actions

2. **SellerManagement.tsx**
   - All sellers list
   - Activate/suspend sellers
   - View seller details
   - Performance metrics

3. **ProductApprovals.tsx**
   - Pending products queue
   - Approve/reject actions
   - Product preview
   - Rejection reason input

4. **OrderManagement.tsx**
   - All orders view
   - Filter by status, seller, customer
   - Order details
   - Dispute resolution

5. **CommissionConfig.tsx**
   - Default commission rate
   - Category-specific rates
   - Update commission form
   - Historical changes log

6. **MarketplaceAnalytics.tsx**
   - Revenue analytics
   - Commission breakdown
   - Top sellers
   - Top products
   - Category performance
   - Monthly trends

7. **PromotionManagement.tsx**
   - Create deals/offers
   - Banner management
   - Featured products
   - Discount codes

8. **PolicyManagement.tsx**
   - Seller policies
   - Return/refund rules
   - Shipping policies
   - Commission policies

9. **CategoryManagement.tsx**
   - Add/edit categories
   - Category images
   - Commission rates per category

10. **ReportsExport.tsx**
    - Generate reports
    - Export data (CSV, PDF)
    - Sales reports
    - Commission reports
    - Tax reports

### 6.3 Customer Shopping Components

**Location**: `/components/*` (main app)

Key components:
- **ShopDashboard.tsx** - Main shopping interface with categories
- **ProductCard.tsx** - Product display card
- **ProductDetails.tsx** - Product details modal/page
- **CartIcon.tsx** - Cart icon with badge (opens ShopDashboard)
- **CheckoutFlow.tsx** - Multi-step checkout
- **OrderTracking.tsx** - Track order status
- **OrderHistory.tsx** - Customer's past orders

### 6.4 Integration Points

#### VendorApp.tsx
```typescript
// Automatically route pet_product sellers to seller portal
if (userVendorRole === 'pet_product') {
  return <SellerDashboard />;
}
```

#### AdminApp.tsx
```typescript
// Add E-Commerce tab to admin navigation
const adminTabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'vendors', label: 'Vendor Management' },
  { id: 'ecommerce', label: 'E-Commerce' }, // NEW TAB
  // ... other tabs
];

// Render E-Commerce components when tab active
{activeTab === 'ecommerce' && <ECommerceDashboard />}
```

#### App.tsx - Cart Navigation
```typescript
// Cart icon opens ShopDashboard instead of separate cart view
const handleCartClick = () => {
  setCurrentView('shop'); // Opens ShopDashboard
  setShopView('cart'); // Sets ShopDashboard to cart view
};
```

---

## 7. Business Logic

### 7.1 GST Calculation

**GST Rates**: 5%, 12%, 18%, 28% (India standard rates)

**Formula**:
```typescript
const gstAmount = (price * quantity * gstRate) / 100;
const totalAmount = (price * quantity) + gstAmount;
```

**Example**:
```
Product Price: ₹1000
Quantity: 2
GST Rate: 18%

Base Amount: ₹2000
GST Amount: ₹360 (2000 * 18 / 100)
Total Amount: ₹2360
```

### 7.2 Commission Calculation

**Default Rate**: 15%

**Category-Specific Rates**:
- Food & Treats: 10%
- Toys & Accessories: 15%
- Health & Wellness: 18%
- Others: 15% (default)

**Formula**:
```typescript
const commissionAmount = totalAmount * (commissionRate / 100);
const sellerEarnings = totalAmount - commissionAmount;
```

**Example**:
```
Order Total (with GST): ₹2360
Commission Rate: 15%

Commission: ₹354 (2360 * 15 / 100)
Seller Earnings: ₹2006 (2360 - 354)
```

### 7.3 Order Workflow

**Status Flow**:
1. **pending** - Order placed, awaiting seller confirmation
2. **confirmed** - Seller confirmed order
3. **shipped** - Order shipped with tracking number
4. **delivered** - Order delivered to customer
5. **cancelled** - Order cancelled (by customer or seller)

**Business Rules**:
- Stock is deducted immediately upon order placement
- Commission is calculated per order item (seller-specific)
- Each seller in multi-seller order has independent item status
- Customer can cancel before "shipped" status
- Seller must provide tracking number when marking "shipped"

### 7.4 Product Approval Workflow

**Status Flow**:
1. **pending** - Newly created product awaiting admin review
2. **active** - Approved and visible to customers
3. **rejected** - Rejected by admin with reason
4. **outofstock** - Active but out of stock (auto-set when stock = 0)

**Business Rules**:
- New products start in "pending" status
- Only "active" products appear in customer search
- Sellers can edit "pending" or "rejected" products and resubmit
- Admins see all "pending" products in approval queue
- Rejection requires a reason message

### 7.5 Inventory Management

**Stock Operations**:
- **set** - Set absolute stock value
- **increment** - Add to current stock
- **decrement** - Subtract from current stock

**Auto-Updates**:
- Stock decremented on order placement
- Stock incremented on order cancellation
- Status auto-changed to "outofstock" when stock = 0
- Status auto-changed to "active" when stock > 0 (if previously approved)

**Low Stock Alert**: Trigger when stock < 10 units

### 7.6 Invoice Generation

**Invoice Number Format**: `WP-INV-{timestamp}-{random4digit}`

**Required Fields**:
- Invoice number (auto-generated)
- Invoice date
- Seller details (name, GST number, address)
- Customer details (name, email, address)
- Line items (product, qty, unit price, GST rate, GST amount, total)
- Subtotal, total GST, grand total
- Commission amount, seller earnings

**GST Compliance**:
- Show GST breakup per item
- Show total GST amount
- Include seller GST number
- Include customer billing address

---

## 8. Integration Guidelines

### 8.1 Server Setup

**File**: `/supabase/functions/server/index.tsx`

```typescript
import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { ecommerceRoutes } from './ecommerce_routes.tsx';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger(console.log));

// Mount e-commerce routes
app.route('/make-server-3dd53475/ecommerce', ecommerceRoutes);

// Error handling
app.onError((err, c) => {
  console.error(`Error: ${err.message}`, err);
  return c.json({ error: err.message }, 500);
});

// Start server
Deno.serve(app.fetch);
```

### 8.2 E-Commerce Routes File

**File**: `/supabase/functions/server/ecommerce_routes.tsx`

```typescript
import { Hono } from 'npm:hono';
import { createClient } from 'npm:@supabase/supabase-js';
import * as kv from './kv_store.tsx';

const ecommerce = new Hono();

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Auth helper
async function authenticateUser(request: Request) {
  const accessToken = request.headers.get('Authorization')?.split(' ')[1];
  if (!accessToken) {
    return null;
  }
  
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) {
    return null;
  }
  
  return user;
}

// Example route implementation
ecommerce.get('/products', async (c) => {
  try {
    const category = c.req.query('category');
    const search = c.req.query('search');
    
    // Get all products
    const allProducts = await kv.getByPrefix('product:');
    
    // Filter active products
    let products = allProducts.filter(p => p.status === 'active');
    
    // Apply filters
    if (category) {
      products = products.filter(p => p.category === category);
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      products = products.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        p.description.toLowerCase().includes(searchLower)
      );
    }
    
    return c.json({ products });
  } catch (error) {
    console.error('Error fetching products:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ... implement all other routes following the API specification above

export { ecommerce as ecommerceRoutes };
```

### 8.3 Frontend API Client

**File**: `/utils/api/ecommerce.ts` (Create this)

```typescript
import { projectId, publicAnonKey } from '../supabase/info';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/ecommerce`;

interface ApiOptions {
  method?: string;
  body?: any;
  token?: string;
}

async function apiCall(endpoint: string, options: ApiOptions = {}) {
  const { method = 'GET', body, token } = options;
  
  const headers: HeadersInit = {
    'Authorization': `Bearer ${token || publicAnonKey}`,
    'Content-Type': 'application/json',
  };
  
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API request failed');
  }
  
  return response.json();
}

// Product APIs
export const productApi = {
  getAll: (params?: { category?: string; search?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/products${query ? '?' + query : ''}`);
  },
  
  getById: (id: string) => apiCall(`/products/${id}`),
  
  create: (data: any, token: string) => 
    apiCall('/products', { method: 'POST', body: data, token }),
  
  update: (id: string, data: any, token: string) => 
    apiCall(`/products/${id}`, { method: 'PUT', body: data, token }),
  
  delete: (id: string, token: string) => 
    apiCall(`/products/${id}`, { method: 'DELETE', token }),
};

// Seller APIs
export const sellerApi = {
  getProducts: (token: string) => apiCall('/seller/products', { token }),
  
  getOrders: (token: string, status?: string) => {
    const query = status ? `?status=${status}` : '';
    return apiCall(`/seller/orders${query}`, { token });
  },
  
  getDashboard: (token: string) => apiCall('/seller/dashboard', { token }),
  
  calculateCommission: (data: any, token: string) =>
    apiCall('/seller/commission-calculator', { method: 'POST', body: data, token }),
  
  generateInvoice: (data: any, token: string) =>
    apiCall('/seller/generate-invoice', { method: 'POST', body: data, token }),
  
  updateInventory: (productId: string, data: any, token: string) =>
    apiCall(`/seller/inventory/${productId}`, { method: 'PUT', body: data, token }),
};

// Order APIs
export const orderApi = {
  create: (data: any, token: string) =>
    apiCall('/orders', { method: 'POST', body: data, token }),
  
  getAll: (token: string) => apiCall('/orders', { token }),
  
  getById: (id: string, token: string) => apiCall(`/orders/${id}`, { token }),
  
  updateItemStatus: (orderId: string, itemId: string, data: any, token: string) =>
    apiCall(`/orders/${orderId}/items/${itemId}/status`, { 
      method: 'PUT', 
      body: data, 
      token 
    }),
};

// Admin APIs
export const adminApi = {
  getSellers: (token: string) => apiCall('/admin/sellers', { token }),
  
  getPendingProducts: (token: string) => apiCall('/admin/products/pending', { token }),
  
  approveProduct: (id: string, token: string) =>
    apiCall(`/admin/products/${id}/approve`, { method: 'PUT', token }),
  
  rejectProduct: (id: string, reason: string, token: string) =>
    apiCall(`/admin/products/${id}/reject`, { 
      method: 'PUT', 
      body: { reason }, 
      token 
    }),
  
  getAnalytics: (token: string) => apiCall('/admin/analytics', { token }),
  
  getCommissionConfig: (token: string) => apiCall('/admin/commission-config', { token }),
  
  updateCommissionConfig: (data: any, token: string) =>
    apiCall('/admin/commission-config', { method: 'POST', body: data, token }),
};
```

### 8.4 Using APIs in Components

**Example: SellerDashboard.tsx**

```typescript
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { sellerApi } from '../../utils/api/ecommerce';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

export function SellerDashboard() {
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const supabase = createClient(
    `https://${projectId}.supabase.co`,
    publicAnonKey
  );
  
  useEffect(() => {
    loadDashboard();
  }, []);
  
  async function loadDashboard() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No active session');
        return;
      }
      
      const data = await sellerApi.getDashboard(session.access_token);
      setDashboard(data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div className="p-6">
      <h1>Seller Dashboard</h1>
      <div className="grid grid-cols-3 gap-4 mt-4">
        <div className="p-4 bg-white rounded-lg shadow">
          <h3>Total Revenue</h3>
          <p className="text-2xl">₹{dashboard?.totalRevenue || 0}</p>
        </div>
        <div className="p-4 bg-white rounded-lg shadow">
          <h3>Total Orders</h3>
          <p className="text-2xl">{dashboard?.totalOrders || 0}</p>
        </div>
        <div className="p-4 bg-white rounded-lg shadow">
          <h3>Active Products</h3>
          <p className="text-2xl">{dashboard?.activeProducts || 0}</p>
        </div>
      </div>
      
      {/* Recent orders, low stock alerts, etc. */}
    </div>
  );
}
```

---

## 9. Testing & Validation

### 9.1 Backend Testing Checklist

- [ ] All 15+ endpoints return correct response format
- [ ] Authentication properly blocks unauthorized access
- [ ] Authorization checks prevent cross-seller data access
- [ ] GST calculation is accurate for all rates
- [ ] Commission calculation matches business rules
- [ ] Stock deduction/increment works correctly
- [ ] Order status transitions follow workflow
- [ ] Invoice generation includes all required fields
- [ ] Admin-only routes reject non-admin users
- [ ] Error messages are descriptive and logged

### 9.2 Frontend Integration Checklist

- [ ] Seller dashboard loads correct metrics
- [ ] Product catalog displays all products
- [ ] Product form creates/updates products
- [ ] Order list shows seller's orders only
- [ ] Inventory updates reflect immediately
- [ ] Commission calculator shows accurate breakdown
- [ ] Invoice generation downloads correctly
- [ ] Admin can approve/reject products
- [ ] Admin analytics show marketplace data
- [ ] Customer can browse and add to cart
- [ ] Checkout flow creates order successfully
- [ ] Order tracking displays status correctly

### 9.3 Test Scenarios

**Scenario 1: Complete Shopping Flow**
1. Customer browses products
2. Adds items to cart (multiple sellers)
3. Proceeds to checkout
4. Enters delivery address
5. Confirms order
6. Receives order confirmation
7. Tracks order status

**Scenario 2: Seller Order Fulfillment**
1. Seller receives new order notification
2. Views order details
3. Confirms order
4. Updates status to "shipped" with tracking
5. Marks as "delivered"
6. Generates invoice

**Scenario 3: Product Approval**
1. Seller creates new product
2. Product enters "pending" status
3. Admin reviews product
4. Admin approves product
5. Product becomes visible to customers

**Scenario 4: Commission Calculation**
1. Order placed with GST product
2. System calculates GST amount
3. System calculates commission based on category
4. Seller earnings = Total - Commission
5. Invoice reflects all calculations

---

## 10. Security Considerations

### 10.1 Authentication & Authorization

**Critical Rules**:
- ✅ NEVER expose `SUPABASE_SERVICE_ROLE_KEY` to frontend
- ✅ Always validate access tokens in protected routes
- ✅ Check user authorization for resource access (e.g., seller can only edit own products)
- ✅ Validate admin status before allowing admin operations

**Implementation Pattern**:
```typescript
// In protected route
const user = await authenticateUser(c.req.raw);
if (!user) {
  return c.json({ error: 'Unauthorized' }, 401);
}

// For seller-specific resources
const product = await kv.get(`product:${productId}`);
if (product.sellerId !== user.id) {
  return c.json({ error: 'Forbidden' }, 403);
}
```

### 10.2 Data Validation

**Input Validation**:
- Validate all request bodies
- Sanitize search inputs
- Validate numeric ranges (price > 0, stock >= 0, GST rate in [5, 12, 18, 28])
- Validate enum values (status, paymentMethod, etc.)

**Example**:
```typescript
if (!data.name || data.name.trim().length === 0) {
  return c.json({ error: 'Product name is required' }, 400);
}

if (data.price <= 0) {
  return c.json({ error: 'Price must be greater than 0' }, 400);
}

if (![5, 12, 18, 28].includes(data.gstRate)) {
  return c.json({ error: 'Invalid GST rate' }, 400);
}
```

### 10.3 Error Handling

**Best Practices**:
- Log all errors with context
- Return user-friendly error messages
- Never expose internal implementation details
- Use appropriate HTTP status codes

**Example**:
```typescript
try {
  // ... operation
} catch (error) {
  console.error(`Error creating product for seller ${user.id}:`, error);
  return c.json({ 
    error: 'Failed to create product. Please try again.' 
  }, 500);
}
```

### 10.4 Rate Limiting

**Recommendation**: Implement rate limiting for public endpoints
- Product search: 100 requests/minute per IP
- Order creation: 10 requests/minute per user
- Invoice generation: 20 requests/minute per seller

**Note**: Not implemented in initial version but should be added for production.

---

## 11. Implementation Roadmap

### Phase 1: Backend Foundation (PRIORITY)
- [ ] Set up `/supabase/functions/server/ecommerce_routes.tsx`
- [ ] Implement product CRUD endpoints
- [ ] Implement seller endpoints (products, orders, dashboard)
- [ ] Implement order management endpoints
- [ ] Test all endpoints with Postman/curl

### Phase 2: Seller Portal Integration
- [ ] Create `/utils/api/ecommerce.ts` API client
- [ ] Integrate SellerDashboard with API
- [ ] Integrate SellerProductCatalog with API
- [ ] Integrate SellerOrders with API
- [ ] Integrate SellerInventory with API
- [ ] Test seller workflows end-to-end

### Phase 3: Admin Integration
- [ ] Implement admin endpoints
- [ ] Integrate admin components with API
- [ ] Test product approval workflow
- [ ] Test analytics display

### Phase 4: Customer Shopping
- [ ] Integrate product browsing with API
- [ ] Integrate checkout with order creation API
- [ ] Integrate order tracking with API
- [ ] Test complete shopping flow

### Phase 5: Advanced Features
- [ ] Invoice PDF generation
- [ ] Email notifications (order confirmation, status updates)
- [ ] Advanced analytics (charts, trends)
- [ ] Bulk operations (bulk product upload, bulk inventory update)
- [ ] Export functionality (CSV, PDF reports)

---

## 12. Cursor Integration Instructions

### 12.1 Initial Setup

**Step 1**: Create the main e-commerce routes file
```
Create file: /supabase/functions/server/ecommerce_routes.tsx
Implement all endpoints from Section 3 (Backend API Endpoints)
```

**Step 2**: Mount routes in server index
```
Edit file: /supabase/functions/server/index.tsx
Import and mount ecommerce routes
```

**Step 3**: Create frontend API client
```
Create file: /utils/api/ecommerce.ts
Implement all API client functions from Section 8.3
```

### 12.2 Development Approach

**For each endpoint group**:

1. **Implement backend route** in `ecommerce_routes.tsx`
   - Add route handler
   - Implement authentication if required
   - Implement business logic
   - Add error handling
   - Add logging

2. **Test backend route** using curl or Postman
   ```bash
   curl -X GET \
     https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/ecommerce/products \
     -H "Authorization: Bearer ${publicAnonKey}"
   ```

3. **Implement frontend API client** in `ecommerce.ts`
   - Add client function
   - Handle authentication token
   - Handle errors

4. **Integrate with component**
   - Import API client
   - Call API function
   - Handle loading state
   - Handle error state
   - Display data

5. **Test end-to-end**
   - Test success path
   - Test error cases
   - Test edge cases

### 12.3 Code Generation Prompts for Cursor

**Prompt 1: Generate Product Endpoints**
```
Based on the Warmpawz technical spec, implement all product management endpoints in /supabase/functions/server/ecommerce_routes.tsx:
- GET /ecommerce/products (with category and search filters)
- POST /ecommerce/products (seller auth required)
- GET /ecommerce/products/:productId
- PUT /ecommerce/products/:productId (seller auth, own products only)
- DELETE /ecommerce/products/:productId (seller auth, own products only)

Use the KV store structure from the spec. Include proper error handling and logging.
```

**Prompt 2: Generate Seller Endpoints**
```
Based on the Warmpawz technical spec, implement all seller portal endpoints in /supabase/functions/server/ecommerce_routes.tsx:
- GET /ecommerce/seller/products
- GET /ecommerce/seller/orders
- GET /ecommerce/seller/dashboard
- POST /ecommerce/seller/commission-calculator
- POST /ecommerce/seller/generate-invoice
- PUT /ecommerce/seller/inventory/:productId

Use the exact response formats from Section 3.1.2 of the spec.
```

**Prompt 3: Generate Order Endpoints**
```
Based on the Warmpawz technical spec, implement order management endpoints with the complete order workflow including stock deduction, commission calculation, and multi-seller order handling.
```

**Prompt 4: Generate Admin Endpoints**
```
Based on the Warmpawz technical spec, implement all admin e-commerce endpoints with proper admin authorization checks and analytics aggregation.
```

**Prompt 5: Integrate Seller Dashboard**
```
Integrate the SellerDashboard component with the backend API. Use the API client from /utils/api/ecommerce.ts and display all metrics from the /seller/dashboard endpoint. Handle loading and error states.
```

### 12.4 Common Issues & Solutions

**Issue**: CORS errors
**Solution**: Ensure `app.use('*', cors())` is in server index.tsx

**Issue**: Authentication fails
**Solution**: Check Authorization header format: `Bearer ${token}`

**Issue**: KV store returns null
**Solution**: Verify key format matches spec exactly (e.g., `product:${id}`)

**Issue**: Commission calculation incorrect
**Solution**: Ensure commission is calculated on totalAmount (including GST)

**Issue**: Stock not updating
**Solution**: Check KV store update logic and ensure both product and seller_products index are updated

---

## 13. API Testing Collection

### 13.1 Environment Variables
```
BASE_URL=https://{{projectId}}.supabase.co/functions/v1/make-server-3dd53475/ecommerce
PUBLIC_KEY={{publicAnonKey}}
ACCESS_TOKEN={{userAccessToken}}
SELLER_ID={{sellerId}}
PRODUCT_ID={{productId}}
ORDER_ID={{orderId}}
```

### 13.2 Sample Requests

**Get All Products**
```bash
curl -X GET "${BASE_URL}/products" \
  -H "Authorization: Bearer ${PUBLIC_KEY}"
```

**Create Product (Seller)**
```bash
curl -X POST "${BASE_URL}/products" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Premium Dog Food 10kg",
    "description": "Nutritious food for adult dogs",
    "category": "Food & Treats",
    "price": 2500,
    "originalPrice": 3000,
    "imageUrl": "https://example.com/image.jpg",
    "stock": 50,
    "sku": "DOG-FOOD-001",
    "gstRate": 5
  }'
```

**Get Seller Dashboard**
```bash
curl -X GET "${BASE_URL}/seller/dashboard" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```

**Calculate Commission**
```bash
curl -X POST "${BASE_URL}/seller/commission-calculator" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "orderAmount": 2500,
    "gstRate": 5,
    "productCategory": "Food & Treats"
  }'
```

**Create Order**
```bash
curl -X POST "${BASE_URL}/orders" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "productId": "prod_123", "quantity": 2 }
    ],
    "deliveryAddress": {
      "fullName": "John Doe",
      "phone": "9876543210",
      "addressLine1": "123 Main St",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001"
    },
    "paymentMethod": "cod"
  }'
```

**Approve Product (Admin)**
```bash
curl -X PUT "${BASE_URL}/admin/products/${PRODUCT_ID}/approve" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```

---

## 14. Database Initialization

### 14.1 Initial Data Setup

**Commission Config**
```typescript
// Run this once on server startup or via admin panel
await kv.set('commission_config', {
  default: 15,
  categories: {
    'Food & Treats': 10,
    'Toys & Accessories': 15,
    'Grooming & Care': 12,
    'Health & Wellness': 18,
    'Beds & Furniture': 15,
    'Apparel & Costumes': 20,
    'Bowls & Feeders': 12,
    'Travel & Outdoor': 15,
  }
});
```

**Product Categories**
```typescript
await kv.set('product_categories', [
  'Food & Treats',
  'Toys & Accessories',
  'Grooming & Care',
  'Health & Wellness',
  'Beds & Furniture',
  'Apparel & Costumes',
  'Bowls & Feeders',
  'Travel & Outdoor',
]);
```

### 14.2 Sample Data (for testing)

**Sample Products**
```typescript
const sampleProducts = [
  {
    id: 'prod_001',
    sellerId: 'seller_001',
    sellerName: 'PetMart India',
    name: 'Premium Dog Food 10kg',
    description: 'High-quality nutrition for adult dogs',
    category: 'Food & Treats',
    price: 2500,
    originalPrice: 3000,
    imageUrl: 'https://images.unsplash.com/photo-dog-food',
    stock: 50,
    sku: 'DOG-FOOD-001',
    gstRate: 5,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  // ... more sample products
];

for (const product of sampleProducts) {
  await kv.set(`product:${product.id}`, product);
}
```

---

## 15. Next Steps & Enhancements

### 15.1 MVP Completion (Current Phase)
- ✅ Complete all 15+ backend endpoints
- ✅ Integrate all seller portal components
- ✅ Integrate all admin components
- ✅ Test complete shopping flow
- ✅ Test seller order fulfillment
- ✅ Test admin product approval

### 15.2 Production Readiness
- [ ] Add comprehensive error handling
- [ ] Implement rate limiting
- [ ] Add request logging and monitoring
- [ ] Set up automated testing (unit + integration)
- [ ] Performance optimization (caching, indexing)
- [ ] Security audit

### 15.3 Advanced Features
- [ ] Email notifications (SendGrid/Postmark integration)
- [ ] SMS notifications for order updates
- [ ] PDF invoice generation (jsPDF library)
- [ ] Image upload to Supabase Storage
- [ ] Product image gallery (multiple images)
- [ ] Product reviews and ratings
- [ ] Wishlist functionality
- [ ] Advanced search (filters, sorting)
- [ ] Bulk product import (CSV)
- [ ] Seller performance analytics
- [ ] Customer analytics
- [ ] Discount codes and coupons
- [ ] Flash sales and deals
- [ ] Product recommendations
- [ ] Multi-language support
- [ ] Multi-currency support

### 15.4 Integrations
- [ ] Payment gateway (Razorpay, Stripe)
- [ ] Shipping providers (Delhivery, Shiprocket)
- [ ] Logistics tracking APIs
- [ ] Accounting software (Tally, Zoho Books)
- [ ] CRM integration
- [ ] Marketing automation

---

## 16. Contact & Support

**Project**: Warmpawz Multi-Vendor E-Commerce Platform  
**Version**: 1.0  
**Last Updated**: December 2, 2025

This document serves as the complete technical specification for implementing the Warmpawz e-commerce backend and integrating it with the existing frontend components. Follow the implementation roadmap in Section 11 and use the Cursor integration instructions in Section 12 for efficient development.

---

## Appendix A: Quick Reference

### Key Files
- `/supabase/functions/server/index.tsx` - Main server entry
- `/supabase/functions/server/ecommerce_routes.tsx` - E-commerce routes (TO BE CREATED)
- `/supabase/functions/server/kv_store.tsx` - KV store utilities (PROTECTED)
- `/utils/api/ecommerce.ts` - Frontend API client (TO BE CREATED)
- `/utils/supabase/info.tsx` - Supabase config
- `/components/vendor/seller/*` - Seller portal (11 components)
- `/components/admin/ecommerce/*` - Admin e-commerce (10 components)

### Key Constants
- Route prefix: `/make-server-3dd53475`
- Vendor role: `pet_product`
- Default commission: 15%
- GST rates: 5%, 12%, 18%, 28%
- Low stock threshold: 10 units
- Order statuses: pending, confirmed, shipped, delivered, cancelled
- Product statuses: active, pending, rejected, outofstock

### KV Key Patterns
- `product:{id}` - Product data
- `seller_products:{sellerId}` - Seller's product IDs
- `order:{id}` - Order data
- `customer_orders:{customerId}` - Customer's order IDs
- `seller_orders:{sellerId}` - Seller's order IDs
- `invoice:{invoiceNumber}` - Invoice data
- `seller_meta:{sellerId}` - Seller metadata
- `commission_config` - Commission rates
- `product_categories` - Category list

---

**END OF TECHNICAL SPECIFICATION**
