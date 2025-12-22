# Data Access Layer (DAL)

## Overview

This directory contains the centralized data access layer for the SQL migration. All database operations must go through these repositories.

## Architecture

### `db.ts` - Centralized Database Client
- Singleton Supabase client instance
- Connection pooling managed automatically
- Transaction support
- Error handling utilities
- Query helpers (select, insert, update, delete, upsert)

### `repositories/` - Repository Pattern Modules
- One repository per domain entity
- All CRUD operations encapsulated
- No KV imports allowed
- Prepared statements only

## Usage

### Basic Usage

```typescript
import { getCustomersRepository } from "./lib/repositories/customers.ts";

// Get customer by ID
const customer = await getCustomersRepository().findById(customerId);

// Create customer
const newCustomer = await getCustomersRepository().create({
  phone: "+1234567890",
  email: "customer@example.com",
  full_name: "John Doe",
});

// Update customer
await getCustomersRepository().update(customerId, {
  email: "newemail@example.com",
});
```

### Using Multiple Repositories

```typescript
import {
  getCustomersRepository,
  getBookingsRepository,
  getPaymentsRepository,
} from "./lib/repositories/index.ts";

// Create booking with payment
const customer = await getCustomersRepository().findById(customerId);
const booking = await getBookingsRepository().create({
  customer_id: customerId,
  service_id: serviceId,
  booking_date: "2024-12-25",
  booking_time: "10:00:00",
  // ... other fields
});

const payment = await getPaymentsRepository().create({
  booking_id: booking.id,
  customer_id: customerId,
  amount: booking.total_amount,
  payment_method: "razorpay",
});
```

## Repository List

### Core Repositories (Implemented)
- ✅ `customers.ts` - Customer data access
- ✅ `vendors.ts` - Vendor data access
- ✅ `bookings.ts` - Booking data access
- ✅ `payments.ts` - Payment data access

### Additional Repositories (To Be Created)
- ⏳ `staff.ts` - Staff data access
- ⏳ `services.ts` - Service catalog access
- ⏳ `orders.ts` - E-commerce orders
- ⏳ `refunds.ts` - Refund management
- ⏳ `payouts.ts` - Payout management
- ⏳ `wallet.ts` - Wallet transactions
- ⏳ `notifications.ts` - Notification system
- ⏳ `otp.ts` - OTP token management
- ⏳ `settings.ts` - Platform settings
- ⏳ And more...

## Migration from KV

### Before (KV)
```typescript
import * as kv from "./kv_store.tsx";

// Get customer
const customerData = await kv.get(`customer:${customerId}`);
const customer = JSON.parse(customerData || "{}");

// Set customer
await kv.set(`customer:${customerId}`, JSON.stringify(customer));
```

### After (SQL Repository)
```typescript
import { getCustomersRepository } from "./lib/repositories/customers.ts";

// Get customer
const customer = await getCustomersRepository().findById(customerId);

// Update customer
await getCustomersRepository().update(customerId, { ...updates });
```

## Rules & Enforcement

### ❌ FORBIDDEN
- Importing `kv_store.tsx` or `kv-safe.tsx`
- Direct SQL queries outside repositories
- Raw SQL without prepared statements
- Bypassing repository layer

### ✅ REQUIRED
- All database access through repositories
- Use prepared statements (via Supabase client)
- Explicit transaction boundaries for multi-step operations
- Error handling using repository methods

## Testing

Repositories can be tested by:
1. Mocking the Supabase client
2. Using test database
3. Unit tests for each repository method

## Performance

- Connection pooling handled by Supabase client
- Indexes ensure fast queries
- Prepared statements prevent SQL injection
- Transactions ensure data consistency

## Next Steps

1. Create remaining repositories
2. Add data migration scripts
3. Update all endpoint functions to use repositories
4. Remove all KV imports

