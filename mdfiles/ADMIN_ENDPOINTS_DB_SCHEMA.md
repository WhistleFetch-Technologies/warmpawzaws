# Admin Endpoints Database Schema

## ✅ Database Tables Status

### Existing Tables (Already in Schema)
- ✅ `platform_settings` - Used by `/admin/settings/*` endpoints
- ✅ `settlements` - Used by `/admin/settlements/*` endpoints
- ✅ `vendors` - Used by `/admin/vendors/*` endpoints
- ✅ `customers` - Used by `/admin/analytics/customers` endpoint
- ✅ `bookings` - Used by analytics and transaction endpoints
- ✅ `orders` - Used by analytics and transaction endpoints
- ✅ `payments` - Used by transaction endpoints (fallback)
- ✅ `refund_tiers` - General refund tiers (different from vendor_refund_tiers)
- ✅ `tiers` - Used by `/admin/tiers` endpoint
- ✅ `admins` - Used by `/admin/users` endpoint
- ✅ `service_categories` - Used by `/admin/catalog/categories` endpoint

### Missing Tables (Created in Migration 053)
- ❌ `support_tickets` - **CREATED** in `053_admin_endpoints_tables.sql`
- ❌ `chat_sessions` - **CREATED** in `053_admin_endpoints_tables.sql`
- ❌ `transactions` - **CREATED** in `053_admin_endpoints_tables.sql`
- ❌ `vendor_payment_rules` - **CREATED** in `053_admin_endpoints_tables.sql`
- ❌ `vendor_refund_tiers` - **CREATED** in `053_admin_endpoints_tables.sql`
- ❌ `vendor_support_requests` - **CREATED** in `053_admin_endpoints_tables.sql`
- ❌ `compliance_issues` - **CREATED** in `053_admin_endpoints_tables.sql`

## 📋 Migration Script

**File:** `db/migrations/053_admin_endpoints_tables.sql`

**To Run:**
```bash
cd db
node run-migration.js migrations/053_admin_endpoints_tables.sql
```

Or run all migrations:
```bash
cd db
node run-migration-all.js
```

## 🔗 Table to Endpoint Mapping

### Support Endpoints
- `/admin/support/tickets` → `support_tickets`
- `/admin/support/stats` → `support_tickets` (aggregated)
- `/admin/support/chat-sessions` → `chat_sessions`
- `/admin/support/vendor-tickets` → `support_tickets` (filtered by vendor_id)

### Transaction Endpoints
- `/admin/transactions` → `transactions`
- `/admin/transactions/stats` → `transactions` (aggregated)
- `/admin/transactions/export` → `transactions` (CSV export)

### Vendor Settings Endpoints
- `/admin/vendor-settings/payment-rules` → `vendor_payment_rules`
- `/admin/vendor-settings/refund-tiers` → `vendor_refund_tiers`

### Vendor Management Endpoints
- `/admin/vendors/compliance-issues` → `compliance_issues`
- `/admin/vendors/clarification-requests` → `vendor_applications` (existing) + `vendors.notes`
- `/admin/vendors/deactivation-requests` → `vendors` (filtered by status)
- `/admin/vendors/reverification-requests` → `vendors` (filtered by status)

## 📊 API Contracts

### Response Format Standard
All endpoints return:
```json
{
  "success": true,
  "data": {...},  // or specific key like "tickets", "stats", etc.
  "timestamp": "2026-01-02T..."
}
```

### Error Format
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Pagination Format
```json
{
  "success": true,
  "data": [...],
  "total": 100,
  "limit": 50,
  "offset": 0
}
```

## 🔄 Data Flow

### Support Tickets Flow
1. UI calls `/admin/support/tickets`
2. API queries `support_tickets` table
3. Returns formatted tickets array
4. UI displays tickets

### Transactions Flow
1. UI calls `/admin/transactions`
2. API queries `transactions` table (or falls back to `payments` + `bookings`)
3. Returns formatted transactions array
4. UI displays transactions

### Vendor Settings Flow
1. UI calls `/admin/vendor-settings/payment-rules`
2. API queries `vendor_payment_rules` table
3. Returns rules array
4. UI displays/edits rules
5. UI calls POST/PUT to update
6. API updates `vendor_payment_rules` table

## ✅ Next Steps

1. **Run Migration:**
   ```bash
   cd db
   node run-migration.js migrations/053_admin_endpoints_tables.sql
   ```

2. **Verify Tables:**
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN (
     'support_tickets', 
     'chat_sessions', 
     'transactions', 
     'vendor_payment_rules', 
     'vendor_refund_tiers',
     'vendor_support_requests',
     'compliance_issues'
   );
   ```

3. **Test Endpoints:**
   ```bash
   ./scripts/test-admin-endpoints.sh
   ```

## 📝 Notes

- All tables use UUID primary keys
- All tables have `created_at` and `updated_at` timestamps
- All tables have proper indexes for common queries
- All tables have foreign key constraints where applicable
- All tables use `IF NOT EXISTS` to prevent errors on re-run
