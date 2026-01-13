# Loyalty Segmentation System - Implementation Complete

## Overview

A comprehensive segmentation system for loyalty rules that allows you to define customer/vendor segments using database queries and rule-based conditions, then use these segments in loyalty rules instead of hardcoded category names.

## Problem Solved

**Before**: Loyalty rules could only match by:
- Plain text category names (e.g., "Medicine", "Grooming")
- Hardcoded conditions in JSONB
- No way to define reusable segments
- No UI to manage segments

**After**: 
- ✅ Define segments with flexible criteria (categories, tiers, purchase history, location, etc.)
- ✅ Segments evaluated dynamically using database queries
- ✅ Segments can be reused across multiple rules
- ✅ UI to create and manage segments
- ✅ Rules reference segments by ID
- ✅ Cached segment assignments for performance

## Architecture

### 1. Database Schema

**Tables Created:**
- `loyalty_segments` - Segment definitions with criteria
- `customer_segment_assignments` - Cached customer segment memberships
- `vendor_segment_assignments` - Cached vendor segment memberships

**Migration Files:**
- `db/migrations/044_loyalty_segments_system.sql` - Creates tables and default segments
- `db/migrations/045_update_loyalty_rules_with_segments.sql` - Updates rules to use segments

### 2. Backend Services

**Segmentation Service** (`backend/lambda/src/lib/services/loyalty-segmentation-service.ts`):
- Evaluates customer/vendor segments using database queries
- Supports multiple criteria types (categories, tiers, purchase history, etc.)
- Caches segment assignments for performance
- Supports AND/OR logic for criteria matching

**Updated Loyalty Points Service** (`backend/lambda/src/lib/services/loyalty-points-service.ts`):
- Now checks `segment_ids` in rule conditions
- Uses segmentation service to verify customer belongs to required segments
- Falls back to legacy category/tier matching for backward compatibility

### 3. API Endpoints

**Segment Management** (`/admin/loyalty-segments`):
- `GET /admin/loyalty-segments` - List all segments
- `GET /admin/loyalty-segments/:id` - Get segment details
- `POST /admin/loyalty-segments` - Create segment
- `PUT /admin/loyalty-segments/:id` - Update segment
- `DELETE /admin/loyalty-segments/:id` - Delete segment

**Customer Segments**:
- `GET /admin/customers/:customerId/segments` - Get customer's segments
- `POST /admin/customers/:customerId/segments/recalculate` - Recalculate segments

### 4. Admin UI

**Component**: `apps/admin-web/components/admin/loyalty/LoyaltySegmentsManagement.tsx`
- Full CRUD interface for segments
- Visual criteria builder
- Segment preview and management
- Can be integrated into loyalty page or used standalone

## Segment Criteria Types

Segments support the following criteria (all optional):

### Category-Based
```json
{
  "service_categories": ["Medicine", "Grooming", "category-uuid"]
}
```

### Tier-Based
```json
{
  "customer_tiers": ["gold", "platinum", "silver"]
}
```

### Purchase History
```json
{
  "purchase_history": {
    "min_purchases": 5,
    "max_purchases": 100,
    "min_amount": 10000,
    "max_amount": 100000
  }
}
```

### Registration Date
```json
{
  "registration_date": {
    "before": "2024-01-01",
    "after": "2023-01-01"
  }
}
```

### Pet Count
```json
{
  "pet_count": {
    "min": 1,
    "max": 5
  }
}
```

### Location
```json
{
  "location": {
    "cities": ["Mumbai", "Delhi"],
    "states": ["Maharashtra"],
    "pincodes": ["400001", "400002"]
  }
}
```

### Vendor IDs
```json
{
  "vendor_ids": ["vendor-uuid-1", "vendor-uuid-2"]
}
```

### Service Types
```json
{
  "service_types": ["at_vendor", "at_home", "online"]
}
```

### Special Flags
```json
{
  "first_purchase": true,
  "birthday_month": true,
  "has_pet_profile": true,
  "has_health_records": true
}
```

## Using Segments in Loyalty Rules

### Method 1: Reference Segments by ID

```json
{
  "action_name": "buy_medicine",
  "conditions": {
    "segment_ids": ["segment-uuid-1", "segment-uuid-2"]
  }
}
```

### Method 2: Combine Segments with Other Conditions

```json
{
  "action_name": "premium_medicine_purchase",
  "conditions": {
    "segment_ids": ["medicine-buyers-segment-id"],
    "customer_tiers": ["gold", "platinum"],
    "amount_min": 2000
  }
}
```

### Method 3: Legacy Category Matching (Still Supported)

```json
{
  "action_name": "buy_medicine",
  "conditions": {
    "service_categories": ["Medicine"]
  }
}
```

## Default Segments Created

The migration creates these default segments:

1. **Medicine Buyers** - Customers who purchase medicines
2. **Grooming Service Users** - Customers who book grooming services
3. **Vet Consultation Users** - Customers who book vet consultations
4. **Pet Food Buyers** - Customers who purchase pet food
5. **Insurance Buyers** - Customers who purchase pet insurance
6. **Gold Tier Customers** - Gold tier loyalty customers
7. **Platinum Tier Customers** - Platinum tier loyalty customers
8. **First Time Buyers** - Customers making their first purchase
9. **Birthday Month Customers** - Customers with pets having birthday this month
10. **Regular Customers** - Customers with 5+ purchases
11. **High Value Customers** - Customers with ₹10,000+ lifetime spend
12. **Doorstep Service Users** - Customers who use doorstep services
13. **In-Clinic Service Users** - Customers who use in-clinic services
14. **Online Service Users** - Customers who use online services

## Example: Creating a Segment via API

```typescript
// Create a segment for "High-Value Medicine Buyers"
POST /admin/loyalty-segments
{
  "segment_name": "High-Value Medicine Buyers",
  "segment_type": "customer",
  "description": "Customers who purchase medicines and have spent ₹10,000+",
  "criteria": {
    "service_categories": ["Medicine"],
    "purchase_history": {
      "min_amount": 10000
    }
  },
  "match_type": "all", // All criteria must match
  "is_active": true,
  "priority": 150
}
```

## Example: Using Segment in Rule

```typescript
// Create a loyalty rule that uses the segment
POST /admin/loyalty-action-rules
{
  "action_name": "buy_medicine_premium",
  "action_category": "loyalty",
  "user_type": "customer",
  "points_type": "per_amount",
  "points_value": 15, // 15 points per ₹1000
  "base_amount": 1000,
  "conditions": {
    "segment_ids": ["high-value-medicine-buyers-segment-id"]
  },
  "priority": 200, // Higher priority than default
  "is_active": true
}
```

## Performance Considerations

1. **Caching**: Segment assignments are cached in `customer_segment_assignments` table
2. **Recalculation**: Segments are recalculated when:
   - Segment criteria are updated
   - Customer makes a purchase
   - Manual recalculation is triggered
3. **Indexes**: Proper indexes on segment tables for fast lookups

## Integration with Existing Rules

- Existing rules continue to work (backward compatible)
- Rules can use both segments AND legacy category matching
- Segments are evaluated first, then other conditions
- Priority system ensures correct rule matching

## UI Integration

The `LoyaltySegmentsManagement` component can be:
1. Added as a tab in the loyalty page
2. Used as a standalone page
3. Embedded in platform settings

Example integration:
```tsx
import { LoyaltySegmentsManagement } from '@/components/admin/loyalty/LoyaltySegmentsManagement';

// In your page
<Tabs>
  <TabsList>
    <TabsTrigger value="rules">Rules</TabsTrigger>
    <TabsTrigger value="segments">Segments</TabsTrigger>
  </TabsList>
  <TabsContent value="rules">
    {/* Existing rules management */}
  </TabsContent>
  <TabsContent value="segments">
    <LoyaltySegmentsManagement />
  </TabsContent>
</Tabs>
```

## Testing

To test the segmentation system:

1. **Create a segment** via UI or API
2. **Assign it to a loyalty rule** by adding `segment_ids` to conditions
3. **Make a transaction** that should match the segment
4. **Verify points are awarded** correctly
5. **Check segment assignments** via `/admin/customers/:id/segments`

## Migration Steps

1. Run migration `044_loyalty_segments_system.sql` to create tables
2. Run migration `045_update_loyalty_rules_with_segments.sql` to update rules
3. Deploy backend with new endpoints
4. Deploy frontend with segment management UI
5. Test segment creation and rule matching

## Future Enhancements

- [ ] Segment analytics (how many customers in each segment)
- [ ] Segment-based campaigns
- [ ] Automatic segment assignment triggers
- [ ] Segment templates
- [ ] A/B testing with segments
- [ ] Segment export/import

---

**Date**: 2025-01-12  
**Status**: ✅ Complete  
**Version**: 1.0
