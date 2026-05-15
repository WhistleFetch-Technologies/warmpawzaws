# E-Commerce Seller Setup Guide

## Overview

This document explains how to check for and create e-commerce sellers in the local PostgreSQL database.

## Requirements Analysis

### What Makes a Vendor an E-Commerce Seller?

An e-commerce seller is identified by:

1. **Role-based identification:**
   - Role name: `seller`, `pet_products_store`, `product_seller`, `pet_product`, or `pet_product_seller`

2. **Schema-based identification:**
   - `seller_status` column in `vendors` table is NOT NULL
   - Values: `'not_applied'`, `'pending'`, `'approved'`, `'rejected'`

### Required Records for a Complete E-Commerce Seller

1. **`roles` table:**
   - Must have an e-commerce role (seller, pet_products_store, etc.)
   - Role must be `is_active = true`

2. **`vendor_identity` table:**
   - Phone number (unique)
   - Email
   - `selected_role_id` pointing to e-commerce role
   - `vendor_type` = `'business'` or `'seller'`
   - `onboarding_status` = `'APPROVED'` or `'ACTIVATED'`
   - `full_name` and `business_name`
   - `vendor_id` (linked to vendors table)

3. **`vendors` table:**
   - All basic vendor fields (phone, email, business_name, owner_name, address, etc.)
   - `role_id` pointing to e-commerce role
   - `status` = `'active'` or `'approved'`
   - `seller_status` = `'approved'` (critical for e-commerce identification)
   - `is_active` = `true`
   - `is_deleted` = `false`
   - `category` = `'retail'` or similar

4. **Optional but Recommended:**
   - **`products` table:** At least one product to make the seller functional
   - **`ecommerce_categories` table:** Product categories for categorization
   - **`vendor_bank_details` table:** Bank account for payouts

## Script Usage

### Prerequisites

1. PostgreSQL database running locally or accessible
2. Environment variables set (see below)

### Environment Variables

Set one of these options:

**Option 1: DATABASE_URL**
```bash
export DATABASE_URL="postgresql://postgres:password@localhost:5432/warmpawz"
```

**Option 2: Individual Components**
```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=warmpawz
export DB_USER=postgres
export DB_PASSWORD=your_password
```

### Running the Script

```bash
cd warmpawzApp/warmpawzaws/backend/lambda
node check-and-create-ecommerce-seller.js
```

### What the Script Does

1. **Checks for existing e-commerce sellers:**
   - Queries vendors with e-commerce roles or `seller_status IS NOT NULL`
   - If found, displays them and exits

2. **If none exist, creates:**
   - **Role:** Finds or creates `seller` role
   - **vendor_identity:** Creates identity record with phone, email, role
   - **vendors:** Creates vendor record with:
     - `seller_status = 'approved'`
     - `status = 'active'`
     - All required fields (address, city, state, etc.)
   - **Link:** Links vendor_identity to vendor
   - **Product:** Creates a sample product (if products table exists)

3. **Output:**
   - Displays summary of created records
   - Provides vendor ID and details for testing

## Test Data Created

The script creates:

- **Phone:** +919876543210
- **Email:** ecommerce-seller@warmpawz.com
- **Business Name:** WarmPawz Test Store
- **Owner Name:** Test Seller Owner
- **Location:** Mumbai, Maharashtra, 400001
- **Role:** seller (or first available e-commerce role)
- **Seller Status:** approved
- **Vendor Status:** active
- **Sample Product:** Premium Dog Food - Test Product (₹999.00)

## Verification

After running the script, verify the seller exists:

```sql
-- Check vendor
SELECT v.id, v.business_name, v.phone, v.seller_status, r.name as role_name
FROM vendors v
LEFT JOIN roles r ON v.role_id = r.id
WHERE v.seller_status = 'approved'
  AND (v.is_deleted IS NULL OR v.is_deleted = false);

-- Check vendor_identity
SELECT vi.id, vi.phone, vi.email, vi.onboarding_status, vi.vendor_id
FROM vendor_identity vi
WHERE vi.phone = '9876543210';

-- Check products
SELECT p.id, p.name, p.price, p.status
FROM products p
WHERE p.vendor_id = '<vendor_id_from_above>';
```

## Testing Endpoints

After creating the seller, test these endpoints:

```bash
# Get top e-commerce sellers
curl http://localhost:3000/admin/ecommerce/top-sellers?limit=5

# Get e-commerce analytics
curl http://localhost:3000/admin/ecommerce/analytics/platform
```

## Troubleshooting

### Error: "relation 'roles' does not exist"
- Run database migrations first
- Check that all required tables exist

### Error: "duplicate key value violates unique constraint"
- A vendor with the same phone already exists
- The script handles this with ON CONFLICT, but check if phone number needs to be changed

### Error: "role does not exist"
- The script will create a basic 'seller' role if none exists
- If this fails, manually create the role first

### No sellers showing in endpoint
- Verify `seller_status = 'approved'` in vendors table
- Verify role name matches one of: seller, pet_products_store, product_seller, pet_product, pet_product_seller
- Verify `is_deleted = false`
- Verify `is_active = true`

## Next Steps

After creating the e-commerce seller:

1. **Add more products** to the seller
2. **Create orders** to test revenue analytics
3. **Test seller approval workflow** if needed
4. **Add bank details** for payout testing
