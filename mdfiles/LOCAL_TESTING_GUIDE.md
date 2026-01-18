# Local Testing Guide - Mock Data Mode

**Date:** January 2026  
**Purpose:** Test UI components and flows without database connection

---

## 🎯 Overview

Since the database is in AWS RDS and not reachable locally, we've implemented:
- ✅ Mock data services
- ✅ API client with automatic fallback
- ✅ Complete wireframe integration
- ✅ Data handoff between components

---

## 🚀 Quick Start

### **1. Enable Mock Data Mode**

**Option A: Via Browser Console**
```javascript
// Open browser console and run:
enableMockData()
// This will reload the page with mock data enabled
```

**Option B: Via LocalStorage**
```javascript
localStorage.setItem('useMockData', 'true')
window.location.reload()
```

**Option C: Environment Variable**
```bash
# In .env.local
NEXT_PUBLIC_USE_MOCK_DATA=true
```

### **2. Start Development Servers**

```bash
# Terminal 1: Vendor Web
cd apps/vendor-web
npm run dev
# Opens on http://localhost:3002

# Terminal 2: Customer Web
cd apps/customer-web
npm run dev
# Opens on http://localhost:3003

# Terminal 3: Admin Web
cd apps/admin-web
npm run dev
# Opens on http://localhost:3001
```

---

## 🧪 Testing Flows

### **Flow 1: Vendor Product Management**

1. **Navigate to:** `http://localhost:3002/products`
2. **Test:**
   - ✅ View products list (mock data)
   - ✅ Click "Add Product"
   - ✅ Fill form and submit (mock save)
   - ✅ Edit existing product
   - ✅ Delete product
   - ✅ Toggle product status
   - ✅ Filter by category
   - ✅ Search products

**Expected:** All UI interactions work, mock data displays correctly

---

### **Flow 2: Vendor Order Management**

1. **Navigate to:** `http://localhost:3002/orders`
2. **Test:**
   - ✅ View orders list (mock data)
   - ✅ See order statistics
   - ✅ Filter by status/date
   - ✅ Click "View Details" - modal opens
   - ✅ Click "Update Status" - status update modal
   - ✅ Click "Create Shipment" (mock)
   - ✅ Click "Cancel" order

**Expected:** All modals open, data flows correctly, mock operations succeed

---

### **Flow 3: Seller Dashboard**

1. **Navigate to:** `http://localhost:3002/seller`
2. **Test:**
   - ✅ View sales overview cards
   - ✅ See revenue chart (mock data)
   - ✅ See order trends chart
   - ✅ View top products
   - ✅ View performance by category
   - ✅ Change period filter (today/week/month/year)
   - ✅ Click "Export CSV" (mock)

**Expected:** All charts render, data updates on filter change

---

### **Flow 4: Seller Approval (Admin)**

1. **Navigate to:** `http://localhost:3001/sellers`
2. **Test:**
   - ✅ View sellers list (mock data)
   - ✅ Filter by status (pending/approved/rejected)
   - ✅ Click "Review" on pending seller
   - ✅ Click "Approve Seller" (mock)
   - ✅ Click "Reject Seller" with reason (mock)
   - ✅ See approval/rejection status

**Expected:** All actions work, status updates correctly

---

### **Flow 5: Customer Order History**

1. **Navigate to:** `http://localhost:3003/orders`
2. **Test:**
   - ✅ View orders list (mock data)
   - ✅ See order statistics
   - ✅ Filter by status
   - ✅ Click "View Details"
   - ✅ Click "Track Order" (if shipped)
   - ✅ Click "Cancel" (if pending)
   - ✅ Click "Download Invoice" (if delivered)

**Expected:** All actions work, navigation flows correctly

---

### **Flow 6: Order Tracking**

1. **Navigate to:** `http://localhost:3003/orders/order-2/tracking`
2. **Test:**
   - ✅ See tracking number
   - ✅ View status timeline
   - ✅ See shipment details
   - ✅ View status history
   - ✅ Click "Track on Carrier Site" (opens link)
   - ✅ Click "View Order Details"
   - ✅ Click "Back to Orders"

**Expected:** Timeline renders correctly, all links work

---

## 🔍 Wireframe Verification

### **Product Management Page**
- ✅ Header with title and "Add Product" button
- ✅ Filters (search, category, status)
- ✅ Product grid with cards
- ✅ Product card shows: image, name, price, stock, status
- ✅ Action buttons (Edit, Activate/Deactivate, Delete)
- ✅ Empty state when no products

### **Order Management Page**
- ✅ Header with title
- ✅ Statistics cards (total, pending, confirmed, etc.)
- ✅ Filters (search, status, date)
- ✅ Order list with cards
- ✅ Order card shows: order number, customer, amount, status
- ✅ Action buttons (View Details, Update Status, Create Shipment, Cancel)

### **Seller Dashboard**
- ✅ Header with period selector and export button
- ✅ Sales overview cards (6 cards)
- ✅ Revenue chart (bar chart)
- ✅ Order trends chart (stacked bars)
- ✅ Top products list
- ✅ Performance by category

### **Customer Order History**
- ✅ Header with title
- ✅ Statistics cards
- ✅ Filters
- ✅ Order list with cards
- ✅ Order card shows: order number, items, vendor, amount, status
- ✅ Action buttons (View Details, Track, Cancel, Invoice)

### **Order Tracking**
- ✅ Header with order number
- ✅ Tracking number display
- ✅ Status timeline (vertical steps)
- ✅ Shipment details
- ✅ Status history
- ✅ Action buttons

---

## 📊 Data Handoff Verification

### **Product → Order Flow**
1. Create product in vendor-web/products
2. Product appears in customer-web/shop (mock)
3. Customer adds to cart
4. Customer places order
5. Order appears in vendor-web/orders

### **Order → Tracking Flow**
1. Vendor updates order status to "shipped"
2. Tracking number generated (mock)
3. Customer views order in /orders
4. Customer clicks "Track Order"
5. Tracking page shows status timeline

### **Seller Approval → Dashboard Flow**
1. Admin approves seller
2. Seller status changes to "approved"
3. Seller can access /seller dashboard
4. Dashboard shows analytics (mock)

---

## 🐛 Troubleshooting

### **Mock Data Not Loading**
```javascript
// Check if mock mode is enabled
console.log(localStorage.getItem('useMockData'))

// Enable manually
localStorage.setItem('useMockData', 'true')
window.location.reload()
```

### **Components Not Rendering**
- Check browser console for errors
- Verify all imports are correct
- Check if mock data service is loaded

### **Data Not Updating**
- Mock operations are simulated (no real persistence)
- Refresh page to see changes reset
- Check console for mock operation logs

---

## ✅ Success Criteria

- [x] All UI components render
- [x] All buttons have handlers
- [x] All modals open/close correctly
- [x] Data flows between components
- [x] Wireframe matches implementation
- [x] Mock data displays correctly
- [x] All navigation flows work
- [x] No console errors

---

## 📝 Notes

- Mock data is reset on page reload
- Operations are simulated (no real API calls)
- All data is client-side only
- Perfect for UI/UX testing without database

---

**Status:** ✅ **READY FOR LOCAL TESTING**

