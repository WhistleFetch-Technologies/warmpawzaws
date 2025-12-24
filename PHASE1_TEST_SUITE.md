# 🧪 PHASE 1 TEST SUITE - KV TO SQL MIGRATION

**Date:** 2024-12-23  
**Phase:** Phase 1 - KV to SQL Migration  
**Objective:** Verify 100% SQL migration with zero KV usage

---

## ✅ TEST CATEGORIES

### **1. Marketplace Products (Task 1.1)**

#### Test 1.1.1: Create Product
```bash
POST /make-server-3dd53475/vendor/vendor_9611377119/marketplace-products
{
  "name": "Test Product",
  "category": "Toys",
  "price": 299,
  "stock": 50,
  "description": "Test product description"
}
```
**Expected:** Product created in SQL, returns product with ID

#### Test 1.1.2: Get Vendor Products
```bash
GET /make-server-3dd53475/vendor/vendor_9611377119/marketplace-products
```
**Expected:** Returns products from SQL, includes image URLs

#### Test 1.1.3: Update Product
```bash
PUT /make-server-3dd53475/vendor/vendor_9611377119/marketplace-products/{productId}
{
  "price": 349,
  "stock": 40
}
```
**Expected:** Product updated in SQL

#### Test 1.1.4: Update Stock
```bash
PATCH /make-server-3dd53475/vendor/vendor_9611377119/marketplace-products/{productId}/stock
{
  "stock": 30,
  "operation": "set"
}
```
**Expected:** Stock updated in SQL

#### Test 1.1.5: Delete Product
```bash
DELETE /make-server-3dd53475/vendor/vendor_9611377119/marketplace-products/{productId}
```
**Expected:** Product deleted from SQL, images removed from S3

#### Test 1.1.6: Public Browse Products
```bash
GET /make-server-3dd53475/public/marketplace-products?category=Toys&search=test
```
**Expected:** Returns products from SQL with filters applied

#### Test 1.1.7: Upload Product Image
```bash
POST /make-server-3dd53475/vendor/vendor_9611377119/marketplace-products/media/upload
FormData: file, productId
```
**Expected:** Image uploaded to S3, product updated in SQL

---

### **2. GST Configuration (Task 1.2)**

#### Test 1.2.1: Create GST Config
```bash
POST /make-server-3dd53475/admin/finance/gst-config
{
  "hsn_code": "12345678",
  "category": "Pet Food",
  "gst_rate": 18,
  "cgst_rate": 9,
  "sgst_rate": 9
}
```
**Expected:** GST config created in SQL

#### Test 1.2.2: Get All GST Configs
```bash
GET /make-server-3dd53475/admin/finance/gst-config
```
**Expected:** Returns all GST configs from SQL

#### Test 1.2.3: Update GST Config
```bash
PUT /make-server-3dd53475/admin/finance/gst-config/{configId}
{
  "gst_rate": 12
}
```
**Expected:** GST config updated in SQL

#### Test 1.2.4: Get GST Config by HSN
```bash
GET /make-server-3dd53475/admin/finance/gst-config/hsn/12345678
```
**Expected:** Returns GST config for HSN code

#### Test 1.2.5: Delete GST Config
```bash
DELETE /make-server-3dd53475/admin/finance/gst-config/{configId}
```
**Expected:** GST config deleted from SQL

---

### **3. Promotions (Task 1.3)**

#### Test 1.3.1: Create Promotion
```bash
POST /make-server-3dd53475/admin/promotions
{
  "title": "Festive Sale",
  "discountPercentage": 20,
  "minOrderAmount": 500,
  "startDate": "2024-12-01",
  "endDate": "2024-12-31",
  "applicableServices": ["grooming", "boarding"],
  "priority": 10
}
```
**Expected:** Promotion created in SQL

#### Test 1.3.2: Get Active Promotions
```bash
GET /make-server-3dd53475/promotions/active?serviceType=grooming&vendorRoleId=pet_groomer
```
**Expected:** Returns active promotions from SQL, filtered by criteria

#### Test 1.3.3: Apply Promotion
```bash
POST /make-server-3dd53475/promotions/apply
{
  "promotionId": "{promoId}",
  "amount": 1000,
  "customerId": "{customerId}"
}
```
**Expected:** Discount calculated, usage count incremented in SQL

#### Test 1.3.4: Get All Promotions (Admin)
```bash
GET /make-server-3dd53475/admin/promotions
```
**Expected:** Returns all promotions from SQL

#### Test 1.3.5: Update Promotion
```bash
PUT /make-server-3dd53475/admin/promotions/{promotionId}
{
  "discountPercentage": 25
}
```
**Expected:** Promotion updated in SQL

#### Test 1.3.6: Delete Promotion
```bash
DELETE /make-server-3dd53475/admin/promotions/{promotionId}
```
**Expected:** Promotion soft-deleted (is_active = false) in SQL

---

### **4. Settlement Automation (Task 1.4)**

#### Test 1.4.1: Create Settlement
```bash
POST /make-server-3dd53475/payment/settlement/process-razorpay
{
  "vendorId": "vendor_9611377119",
  "bookingId": "{bookingId}",
  "amount": 1000,
  "commission": 150
}
```
**Expected:** Settlement created in SQL with correct vendor ID resolution

#### Test 1.4.2: Get Pending Settlements
```bash
GET /make-server-3dd53475/payment/settlement/pending
```
**Expected:** Returns pending settlements from SQL

#### Test 1.4.3: Get Vendor Settlements
```bash
GET /make-server-3dd53475/payment/settlement/vendor/vendor_9611377119
```
**Expected:** Returns vendor settlements from SQL

#### Test 1.4.4: Update Settlement Status
```bash
PUT /make-server-3dd53475/payment/settlement/{settlementId}/status
{
  "status": "completed",
  "razorpayPayoutId": "payout_123"
}
```
**Expected:** Settlement status updated in SQL, processed_at set

#### Test 1.4.5: Auto-Schedule Settlement
```bash
POST /make-server-3dd53475/payment/settlement/auto-schedule
{
  "vendorId": "vendor_9611377119",
  "frequency": "weekly"
}
```
**Expected:** Settlement schedule created/updated in SQL

---

### **5. Ecommerce Routes (Task 1.5)**

#### Test 1.5.1: Get Commission Settings
```bash
GET /make-server-3dd53475/ecommerce/commission/settings
```
**Expected:** Returns commission settings from platform_settings table

#### Test 1.5.2: Update Commission Settings
```bash
PUT /make-server-3dd53475/ecommerce/commission/settings
{
  "defaultRate": 18,
  "rules": [],
  "vendorTiers": []
}
```
**Expected:** Commission settings saved to platform_settings table

#### Test 1.5.3: Get Vendor Commission
```bash
GET /make-server-3dd53475/ecommerce/commission/vendor/vendor_9611377119
```
**Expected:** Returns vendor commission rate and earnings from SQL

#### Test 1.5.4: Get Categories
```bash
GET /make-server-3dd53475/ecommerce/categories
```
**Expected:** Returns categories from SQL, seeds defaults if empty

#### Test 1.5.5: Create Category
```bash
POST /make-server-3dd53475/ecommerce/categories
{
  "name": "Test Category",
  "description": "Test description"
}
```
**Expected:** Category created in SQL

#### Test 1.5.6: Update Categories (Bulk)
```bash
PUT /make-server-3dd53475/ecommerce/categories
{
  "categories": [
    { "id": "{catId}", "name": "Updated Name" },
    { "name": "New Category" }
  ]
}
```
**Expected:** Categories updated/created in SQL

#### Test 1.5.7: Get Pending Products
```bash
GET /make-server-3dd53475/ecommerce/admin/products/pending
```
**Expected:** Returns pending products from SQL

#### Test 1.5.8: Get Admin Orders
```bash
GET /make-server-3dd53475/ecommerce/admin/orders?status=pending&limit=10
```
**Expected:** Returns orders from SQL with filters

#### Test 1.5.9: Get Logistics Vendors
```bash
GET /make-server-3dd53475/ecommerce/logistics/vendors
```
**Expected:** Returns logistics partners from SQL

#### Test 1.5.10: Get Seller Analytics
```bash
GET /make-server-3dd53475/ecommerce/analytics/seller/vendor_9611377119
```
**Expected:** Returns analytics calculated from SQL data

#### Test 1.5.11: Get Platform Analytics
```bash
GET /make-server-3dd53475/ecommerce/analytics/platform
```
**Expected:** Returns platform analytics from SQL

#### Test 1.5.12: Get Detailed Analytics
```bash
GET /make-server-3dd53475/ecommerce/analytics?days=30
```
**Expected:** Returns detailed analytics with time series from SQL

---

## 🔍 VERIFICATION CHECKS

### **KV Usage Check**
```bash
# Search for any remaining KV imports
grep -r "import.*kv" supabase/functions/make-server-3dd53475/*-sql.tsx
grep -r "kv\." supabase/functions/make-server-3dd53475/*-sql.tsx
```
**Expected:** Zero matches

### **Database Verification**
```sql
-- Verify products exist
SELECT COUNT(*) FROM products WHERE vendor_id IS NOT NULL;

-- Verify GST configs exist
SELECT COUNT(*) FROM gst_configurations;

-- Verify promotions exist
SELECT COUNT(*) FROM promotions;

-- Verify settlements exist
SELECT COUNT(*) FROM settlements;

-- Verify categories exist
SELECT COUNT(*) FROM ecommerce_categories;

-- Verify commission settings exist
SELECT * FROM platform_settings WHERE setting_key = 'ecommerce_commission';
```

### **Vendor ID Resolution Check**
- All endpoints using `vendor_` prefix should resolve to UUID
- Test with both UUID and `vendor_` prefix

---

## 📊 TEST EXECUTION

### **Automated Test Script**
```bash
# Run all Phase 1 tests
npm run test:phase1

# Run specific test category
npm run test:phase1:products
npm run test:phase1:gst
npm run test:phase1:promotions
npm run test:phase1:settlements
npm run test:phase1:ecommerce-routes
```

### **Manual Test Checklist**
- [ ] All product CRUD operations work
- [ ] GST configuration CRUD works
- [ ] Promotions CRUD and application work
- [ ] Settlement creation and status updates work
- [ ] Commission settings save/retrieve work
- [ ] Categories CRUD work
- [ ] Analytics calculations are accurate
- [ ] Vendor ID resolution works for all endpoints
- [ ] No KV usage in any migrated file
- [ ] All data persists in SQL

---

## ✅ ACCEPTANCE CRITERIA

1. **Zero KV Usage** - No KV imports or calls in migrated files
2. **100% SQL** - All operations use SQL repositories
3. **Data Persistence** - All data saved to SQL tables
4. **Vendor ID Resolution** - Handles both UUID and `vendor_` prefix
5. **Error Handling** - Proper error messages and status codes
6. **Performance** - Response times < 500ms for simple queries
7. **Data Integrity** - Foreign keys and constraints respected

---

## 🚀 NEXT PHASE

**Phase 2** can only begin after:
- ✅ All Phase 1 tests pass (100%)
- ✅ Zero KV usage verified
- ✅ All endpoints functional
- ✅ Database migrations applied
- ✅ Vendor ID resolution working

---

**Status:** Ready for testing

