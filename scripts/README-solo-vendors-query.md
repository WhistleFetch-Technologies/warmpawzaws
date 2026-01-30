# List Solo Vendors and Their Enabled Services

## Overview
This script provides SQL queries to list all solo vendors and their associated enabled services from the database.

## Files
- `scripts/list-solo-vendors-services.sql` - SQL queries ready to run in your database
- `scripts/list-solo-vendors-services.js` - Node.js script (requires database connection)

## Usage

### Option 1: Run SQL Query Directly
1. Connect to your database (using psql, pgAdmin, or any SQL client)
2. Copy and run the queries from `scripts/list-solo-vendors-services.sql`

### Option 2: Use Node.js Script
```bash
# Make sure you have .env.development file with database credentials
node scripts/list-solo-vendors-services.js
```

## What the Queries Show

### Query 1: Detailed List
Shows all solo vendors with their enabled services, including:
- Vendor information (ID, name, phone, email, status)
- Role information
- Service details (name, category, style, price, duration)
- Service status (enabled, published)

### Query 2: Summary by Vendor
Shows a count of enabled services by style (at_home, tele, at_center) for each solo vendor.

### Query 3: Grouped View
Shows services grouped by vendor and service style, with aggregated service names and categories.

## Understanding Solo Vendors

Solo vendors are identified by:
- `vendor_identity.vendor_type = 'solo'` OR
- `vendors.vendor_configuration = 'solo'`

Solo vendors typically offer:
- `at_home` services (home visits)
- `tele` services (teleconsultation)
- They should NOT offer `at_center` services (clinic-based)

## Database Tables Used
- `vendors` - Main vendor table
- `vendor_identity` - Vendor identity and type information
- `roles` - Role definitions
- `vendor_services` - Vendor-service associations
- `service_catalog` - Service definitions

## Notes
- Only enabled services (`is_enabled = true`) are shown
- Services are ordered by vendor name, service style, and service name
- The query uses LEFT JOINs to ensure all vendors are shown even if some relationships are missing
