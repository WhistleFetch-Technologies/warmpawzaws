# Catalog & Services Endpoints Audit

## 📋 UI Endpoints Called

### From `apps/admin-web/app/catalog/page.tsx`:
- ✅ `GET /admin/service-catalog?groupBy=subcategory` - EXISTS
- ✅ `GET /service-catalog/categories` - EXISTS
- ✅ `GET /admin/catalog/stats` - EXISTS
- ✅ `POST /admin/service-catalog` - EXISTS
- ✅ `PUT /admin/service-catalog/:id` - EXISTS
- ✅ `DELETE /admin/service-catalog/:id` - NEEDS CHECK
- ✅ `PUT /admin/service-catalog/:id` (for status/display_order) - EXISTS

### From `apps/admin-web/components/admin/catalog/AddCategoryModal.tsx`:
- ❌ `POST /admin/catalog/categories` - **MISSING**

### From `apps/admin-web/components/admin/catalog/AddServiceModal.tsx`:
- ❌ `POST /admin/catalog/services` - **MISSING**

### From `apps/admin-web/components/admin/catalog/AddProductModal.tsx`:
- ❌ `POST /admin/catalog/products` - **MISSING**

### From `apps/admin-web/components/admin/catalog/PricingRulesModal.tsx`:
- ❌ `POST /admin/catalog/pricing-rules` - **MISSING**

### From `apps/admin-web/components/admin/catalog/BulkEditModal.tsx`:
- ❌ `POST /admin/catalog/{itemType}s/bulk-edit` - **MISSING**

## 🔍 Backend Status

### Existing Endpoints (GET only):
- ✅ `GET /admin/catalog/categories` - EXISTS in `admin-advanced.ts`
- ✅ `GET /admin/catalog/products` - EXISTS in `admin-advanced.ts`
- ✅ `GET /admin/catalog/services` - EXISTS in `admin-advanced.ts`
- ✅ `GET /admin/catalog/stats` - EXISTS in `admin-advanced.ts`
- ✅ `GET /admin/catalog/tags` - EXISTS in `admin-advanced.ts`
- ✅ `GET /admin/catalog/product-services` - EXISTS in `admin-advanced.ts`
- ✅ `GET /admin/catalog/pricing-inventory` - EXISTS in `admin-advanced.ts`
- ✅ `GET /admin/catalog/pricing-rules` - EXISTS in `admin-advanced.ts`
- ✅ `GET /admin/catalog/bulk-operations` - EXISTS in `admin-advanced.ts`
- ✅ `GET /admin/service-catalog` - EXISTS in `service-catalog.ts`
- ✅ `POST /admin/service-catalog` - EXISTS in `service-catalog.ts`
- ✅ `PUT /admin/service-catalog/:id` - EXISTS in `service-catalog.ts`

### Missing Endpoints (POST/PUT/DELETE):
- ❌ `POST /admin/catalog/categories` - **MISSING**
- ❌ `PUT /admin/catalog/categories/:id` - **MISSING**
- ❌ `DELETE /admin/catalog/categories/:id` - **MISSING**
- ❌ `POST /admin/catalog/services` - **MISSING**
- ❌ `PUT /admin/catalog/services/:id` - **MISSING**
- ❌ `DELETE /admin/catalog/services/:id` - **MISSING**
- ❌ `POST /admin/catalog/products` - **MISSING**
- ❌ `PUT /admin/catalog/products/:id` - **MISSING**
- ❌ `DELETE /admin/catalog/products/:id` - **MISSING**
- ❌ `POST /admin/catalog/pricing-rules` - **MISSING**
- ❌ `PUT /admin/catalog/pricing-rules/:id` - **MISSING**
- ❌ `DELETE /admin/catalog/pricing-rules/:id` - **MISSING**
- ❌ `POST /admin/catalog/{itemType}s/bulk-edit` - **MISSING**
- ❌ `DELETE /admin/service-catalog/:id` - **NEEDS CHECK**

## 🗄️ Database Tables Status

### Existing Tables:
- ✅ `service_catalog` - EXISTS (from migration 019)
- ✅ `service_categories` - EXISTS (in schema.sql)
- ✅ `services` - EXISTS (in schema.sql)
- ✅ `products` - EXISTS (in schema.sql)
- ✅ `pricing_rules` - NEEDS CHECK

### Table Structure Check:
- `service_catalog` - Has all required fields
- `service_categories` - Has: id, name, description, parent_category_id, display_order, is_active
- `services` - Has: id, vendor_id, name, description, category, price, duration_minutes
- `products` - NEEDS CHECK

## ⚠️ Issues Found

1. **Missing POST/PUT/DELETE endpoints** for catalog operations
2. **DELETE /admin/service-catalog/:id** - Need to verify exists
3. **pricing_rules table** - Need to verify exists
4. **Bulk operations endpoint** - Missing implementation
