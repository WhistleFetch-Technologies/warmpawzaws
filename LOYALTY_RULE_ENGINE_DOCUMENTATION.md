# Loyalty Rule Engine Documentation

## Overview

The Loyalty Rule Engine evaluates conditions from the `loyalty_action_rules.conditions` JSONB field against transaction metadata and database queries to determine which loyalty rule should apply.

## Problem Solved

**Before**: Rules were matched only by `action_name` and `user_type`, with no way to:
- Apply different point rates for different service categories
- Target specific vendors
- Segment customers by tier
- Apply rules based on transaction amount ranges
- Check customer purchase history

**After**: Rules are evaluated using a comprehensive rule engine that:
- ✅ Matches rules based on service categories
- ✅ Filters by vendor IDs
- ✅ Checks amount ranges
- ✅ Evaluates customer tiers/segments
- ✅ Queries database for customer history
- ✅ Applies rules based on transaction metadata

## Rule Conditions Structure

The `conditions` JSONB field in `loyalty_action_rules` supports the following structure:

```json
{
  "service_categories": ["category-id-1", "category-id-2", "Medicine", "Grooming"],
  "vendor_ids": ["vendor-uuid-1", "vendor-uuid-2"],
  "amount_min": 1000,
  "amount_max": 50000,
  "customer_tiers": ["gold", "platinum", "premium"],
  "first_purchase": true,
  "birthday_month": true,
  "service_types": ["at_vendor", "at_home", "online"]
}
```

### Condition Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `service_categories` | `string[]` | Array of service category IDs or names | `["Medicine", "Grooming", "category-uuid"]` |
| `vendor_ids` | `string[]` | Array of vendor UUIDs | `["vendor-uuid-1", "vendor-uuid-2"]` |
| `amount_min` | `number` | Minimum transaction amount (in rupees) | `1000` |
| `amount_max` | `number` | Maximum transaction amount (in rupees) | `50000` |
| `customer_tiers` | `string[]` | Array of customer tier names | `["gold", "platinum"]` |
| `first_purchase` | `boolean` | Only apply for first purchase | `true` |
| `birthday_month` | `boolean` | Only apply during pet's birthday month | `true` |
| `service_types` | `string[]` | Array of service types | `["at_vendor", "at_home"]` |

## How It Works

### 1. Rule Matching Flow

```
Transaction → Get Candidate Rules → Evaluate Conditions → Return Best Match
```

1. **Get Candidate Rules**: Fetch all rules matching `action_name` and `user_type`, ordered by `priority DESC`
2. **Evaluate Conditions**: For each rule, evaluate its `conditions` against:
   - Transaction metadata (from `AwardPointsParams.metadata`)
   - Database queries (customer tier, purchase history, etc.)
3. **Return Best Match**: Return the first rule that matches all conditions

### 2. Condition Evaluation

The rule engine evaluates conditions in this order:

1. **Service Category**: Checks if transaction's service category matches required categories
   - Uses `metadata.serviceCategoryId` or queries booking/service tables
   - Supports both category IDs and names

2. **Vendor ID**: Checks if transaction's vendor matches required vendors
   - Uses `metadata.vendorId` or queries booking/order tables

3. **Amount Range**: Validates transaction amount is within min/max range
   - Uses `params.amount`

4. **Customer Tier**: Checks customer's tier/segment
   - Uses `metadata.customerTier` or queries `customer_tiers` table

5. **First Purchase**: Validates if this is customer's first purchase
   - Queries `loyalty_transactions` table

6. **Birthday Month**: Checks if customer's pet has birthday this month
   - Queries `pets` table for `date_of_birth`

7. **Service Type**: Validates booking service type (at_vendor, at_home, online)
   - Queries `bookings.service_type`

### 3. Database Queries

The rule engine automatically queries the database when metadata is not provided:

- **Service Category**: `bookings → services → service_categories`
- **Vendor ID**: `bookings.vendor_id` or `orders.vendor_id`
- **Customer Tier**: `customer_tiers.tier` or `customer_loyalty_points.tier`
- **First Purchase**: `loyalty_transactions` count
- **Birthday Month**: `pets.date_of_birth`
- **Service Type**: `bookings.service_type`

## Usage Examples

### Example 1: Category-Specific Points

**Rule**: "Earn 10 points per ₹1000 spent on Medicine purchases"

```sql
INSERT INTO loyalty_action_rules (
  action_name,
  action_category,
  user_type,
  points_type,
  points_value,
  base_amount,
  conditions,
  priority
) VALUES (
  'buy_medicine',
  'loyalty',
  'customer',
  'per_amount',
  10,
  1000,
  '{"service_categories": ["Medicine", "medicine-category-uuid"]}'::jsonb,
  100
);
```

**Transaction Metadata**:
```typescript
await loyaltyPointsService.awardPoints({
  customerId: 'customer-uuid',
  actionName: 'buy_medicine',
  amount: 5000,
  referenceType: 'booking',
  referenceId: 'booking-uuid',
  metadata: {
    serviceCategoryId: 'medicine-category-uuid',
    serviceCategoryName: 'Medicine',
    vendorId: 'vendor-uuid'
  }
});
```

### Example 2: Vendor-Specific Bonus

**Rule**: "Earn 2x points for purchases from Premium Partners"

```sql
INSERT INTO loyalty_action_rules (
  action_name,
  action_category,
  user_type,
  points_type,
  points_value,
  base_amount,
  conditions,
  priority
) VALUES (
  'purchase',
  'loyalty',
  'customer',
  'per_amount',
  20, -- 2x normal rate
  1000,
  '{"vendor_ids": ["premium-vendor-1", "premium-vendor-2"]}'::jsonb,
  150 -- Higher priority
);
```

### Example 3: Tier-Based Benefits

**Rule**: "Gold tier customers earn 15 points per ₹1000 (vs 10 for regular)"

```sql
INSERT INTO loyalty_action_rules (
  action_name,
  action_category,
  user_type,
  points_type,
  points_value,
  base_amount,
  conditions,
  priority
) VALUES (
  'purchase',
  'loyalty',
  'customer',
  'per_amount',
  15,
  1000,
  '{"customer_tiers": ["gold", "platinum"]}'::jsonb,
  150 -- Higher priority than default
);
```

### Example 4: First Purchase Bonus

**Rule**: "Earn 500 bonus points on first purchase"

```sql
INSERT INTO loyalty_action_rules (
  action_name,
  action_category,
  user_type,
  points_type,
  points_value,
  conditions,
  frequency_type,
  priority
) VALUES (
  'first_purchase_bonus',
  'loyalty',
  'customer',
  'fixed',
  500,
  '{"first_purchase": true}'::jsonb,
  'one_time',
  200 -- Highest priority
);
```

### Example 5: Birthday Month Multiplier

**Rule**: "2x points during pet's birthday month"

```sql
INSERT INTO loyalty_action_rules (
  action_name,
  action_category,
  user_type,
  points_type,
  points_value,
  base_amount,
  conditions,
  multiplier_conditions,
  priority
) VALUES (
  'birthday_booking',
  'loyalty',
  'customer',
  'per_amount',
  10,
  1000,
  '{"birthday_month": true}'::jsonb,
  '{"birthday_month": 2}'::jsonb, -- 2x multiplier
  200
);
```

### Example 6: Complex Rule (Multiple Conditions)

**Rule**: "Gold tier customers earn 20 points per ₹1000 on Medicine purchases from Premium Partners, minimum ₹2000"

```sql
INSERT INTO loyalty_action_rules (
  action_name,
  action_category,
  user_type,
  points_type,
  points_value,
  base_amount,
  min_amount,
  conditions,
  priority
) VALUES (
  'premium_medicine_purchase',
  'loyalty',
  'customer',
  'per_amount',
  20,
  1000,
  2000,
  '{
    "service_categories": ["Medicine"],
    "vendor_ids": ["premium-vendor-1", "premium-vendor-2"],
    "customer_tiers": ["gold", "platinum"],
    "amount_min": 2000
  }'::jsonb,
  200
);
```

## Calling the Service

### From Booking Completion

```typescript
import { loyaltyPointsService } from '@/lib/services/loyalty-points-service';

// After booking is completed and paid
await loyaltyPointsService.awardPoints({
  customerId: booking.customer_id,
  actionName: 'book_grooming', // or 'book_vet_consultation', etc.
  amount: booking.total_amount,
  referenceType: 'booking',
  referenceId: booking.id,
  metadata: {
    serviceCategoryId: service.category_id,
    serviceCategoryName: service.category_name,
    serviceId: booking.service_id,
    vendorId: booking.vendor_id,
    bookingId: booking.id
  }
});
```

### From Order Completion

```typescript
// After order is completed and paid
await loyaltyPointsService.awardPoints({
  customerId: order.customer_id,
  actionName: 'purchase_pet_food', // or 'buy_product', etc.
  amount: order.total_amount,
  referenceType: 'order',
  referenceId: order.id,
  metadata: {
    serviceCategoryId: order.category_id,
    vendorId: order.vendor_id,
    orderId: order.id
  }
});
```

## Priority System

Rules are evaluated in **priority order** (highest first). The first matching rule is applied.

**Priority Guidelines**:
- `200`: Special promotions, first purchase bonuses, birthday multipliers
- `150`: Tier-specific rules, vendor-specific bonuses
- `100`: Category-specific rules
- `50`: Default/general rules

## Best Practices

1. **Always provide metadata**: Include `serviceCategoryId`, `vendorId`, etc. in metadata to avoid database queries
2. **Use specific action names**: Create specific actions like `buy_medicine`, `book_grooming` instead of generic `purchase`
3. **Set appropriate priorities**: Higher priority for more specific rules
4. **Test conditions**: Verify conditions match expected transactions
5. **Monitor rule matches**: Check logs for `[Rule Engine]` messages

## Troubleshooting

### Rule Not Matching

Check logs for messages like:
```
[Rule Engine] Category mismatch: rule requires [...], got [...]
[Rule Engine] Vendor mismatch: rule requires [...], got [...]
```

**Common Issues**:
1. **Category mismatch**: Ensure `metadata.serviceCategoryId` matches rule's `service_categories`
2. **Vendor mismatch**: Verify `metadata.vendorId` is in rule's `vendor_ids`
3. **Amount out of range**: Check `amount_min` and `amount_max` conditions
4. **Tier mismatch**: Verify customer tier matches `customer_tiers` array

### Debug Mode

Enable detailed logging by checking:
- `✅ [Rule Engine] Matched rule: ...` - Rule matched successfully
- `⚠️ [Rule Engine] No rule matched conditions` - No rule matched
- `[Rule Engine] Category mismatch: ...` - Condition failed

## Migration from Old System

If you have existing rules without conditions, they will continue to work (they match by default). To add conditions:

1. Update existing rules with `conditions` JSONB field
2. Test with sample transactions
3. Monitor rule matches in logs
4. Adjust priorities as needed

## Database Schema

The rule engine uses these tables:
- `loyalty_action_rules` - Rule definitions
- `bookings` - Booking information
- `orders` - Order information
- `services` - Service details
- `service_categories` - Category information
- `customer_tiers` - Customer tier/segment
- `pets` - Pet information (for birthday checks)
- `loyalty_transactions` - Transaction history (for first purchase checks)

---

**Date**: 2025-01-12
**Status**: ✅ Implemented
**Version**: 1.0
