# Subscription Service Configuration Guide

## Overview
Warmpawz platform now supports subscription-based services with flexible configurations for weekly and monthly plans. This feature is especially useful for recurring services like dog walking, grooming sessions, pet training, and more.

## Database Structure

### Service Object with Subscription Configuration
```typescript
{
  id: string;
  name: string;
  code: string;
  description: string;
  basePrice: number;  // One-time service price
  duration: string;
  status: 'active' | 'inactive';
  serviceType: 'at-home' | 'at-center';
  gstInclusion: string;
  gstRate: number;
  showFinalPrice: boolean;
  
  // Subscription Configuration (Optional)
  subscriptionConfig: {
    enabled: boolean;
    subscriptionType: 'weekly' | 'monthly' | 'one-time';
    
    sessionConfig: {
      walksPerDay: number;        // 1 or 2 sessions per day
      sessionDuration: string;     // e.g., '30min', '1hr'
      numberOfDays: number;        // Total days the subscription runs
      daysOfWeek: string[];        // ['monday', 'tuesday', 'wednesday', ...]
    };
    
    pricing: {
      weekly: {
        oneWalk: number;   // Price for 1 session/day weekly plan
        twoWalks: number;  // Price for 2 sessions/day weekly plan
      };
      monthly: {
        oneWalk: number;   // Price for 1 session/day monthly plan
        twoWalks: number;  // Price for 2 sessions/day monthly plan
      };
    };
  };
}
```

## API Endpoints

### 1. Create Service with Subscription
**POST** `/make-server-3dd53475/admin/catalog/services/create`

```json
{
  "serviceName": "Daily Dog Walking",
  "serviceCode": "WALK-001",
  "description": "Professional dog walking service",
  "parentCategory": "cat_123",
  "subCategory": "sub_456",
  "basePrice": 500,
  "duration": "30min",
  "serviceType": "at-home",
  "gstInclusion": "inclusive",
  "gstRate": 18,
  
  "enableSubscription": true,
  "subscriptionType": "weekly",
  "walksPerDay": 1,
  "sessionDuration": "30min",
  "numberOfDays": 7,
  "daysOfWeek": ["monday", "tuesday", "wednesday", "thursday", "friday"],
  
  "weeklyOneWalkPrice": 2500,
  "weeklyTwoWalksPrice": 4500,
  "monthlyOneWalkPrice": 9500,
  "monthlyTwoWalksPrice": 17000
}
```

### 2. Get All Services
**GET** `/make-server-3dd53475/catalog/services`

Query Parameters:
- `categoryId` (optional): Filter by category
- `subCategoryId` (optional): Filter by subcategory
- `includeSubscriptions=true` (optional): Only return services with subscription plans

### 3. Get Service by ID
**GET** `/make-server-3dd53475/catalog/services/:serviceId`

Returns service with full details including category and subcategory information.

### 4. Get Subscription Plans for a Service
**GET** `/make-server-3dd53475/catalog/services/:serviceId/subscriptions`

Returns available subscription plans for the service:

```json
{
  "success": true,
  "subscriptionsEnabled": true,
  "serviceName": "Daily Dog Walking",
  "basePrice": 500,
  "plans": [
    {
      "type": "weekly",
      "sessionsPerDay": 1,
      "sessionDuration": "30min",
      "numberOfDays": 7,
      "daysOfWeek": ["monday", "tuesday", "wednesday", "thursday", "friday"],
      "price": 2500,
      "displayName": "Weekly - 1 Session/Day"
    },
    {
      "type": "weekly",
      "sessionsPerDay": 2,
      "sessionDuration": "30min",
      "numberOfDays": 7,
      "daysOfWeek": ["monday", "tuesday", "wednesday", "thursday", "friday"],
      "price": 4500,
      "displayName": "Weekly - 2 Sessions/Day"
    }
  ]
}
```

## UI Components

### CreateServiceModal
Enhanced modal for creating services with subscription configuration:
- Toggle to enable/disable subscription plans
- Subscription type selection (Weekly/Monthly/One-time)
- Session configuration (sessions per day, duration, number of days)
- Day of week picker
- Pricing fields for different plan combinations

### ServiceSubscriptionPreview
Display component showing subscription plan details and pricing options.

## Usage Examples

### For Vendor App
Vendors can view available subscription services and their pricing:

```typescript
// Fetch services with subscriptions
const response = await fetch(
  `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/catalog/services?includeSubscriptions=true`
);
const { services } = await response.json();
```

### For Customer App
Customers can browse subscription plans and book recurring services:

```typescript
// Get subscription plans for a service
const response = await fetch(
  `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/catalog/services/${serviceId}/subscriptions`
);
const { plans } = await response.json();

// Display plan options to customer
plans.forEach(plan => {
  console.log(`${plan.displayName}: ₹${plan.price}`);
});
```

## Features

✅ **Flexible Subscription Types**: Weekly, Monthly, or One-time services
✅ **Configurable Sessions**: 1 or 2 sessions per day
✅ **Day Selection**: Choose specific days of the week for service delivery
✅ **Multiple Pricing Tiers**: Different pricing for different plan combinations
✅ **Database Persistence**: All configurations stored in KV store
✅ **Full CRUD Operations**: Create, Read, Update, Delete subscription configurations
✅ **Service Type Support**: Works with both "at-home" and "at-center" services
✅ **GST Integration**: Subscription pricing supports GST configuration

## Visual Indicators

Services with subscription plans enabled are marked with:
- 📅 **Subscription** badge in the service list
- Blue "Weekly/Monthly Plans Available" text
- Subscription preview component showing all plan details

## Implementation Notes

1. **Backward Compatibility**: Services without `subscriptionConfig` will continue to work as one-time services
2. **Pricing Flexibility**: Vendors can set different prices for different combinations of subscription type and sessions per day
3. **Day Configuration**: `daysOfWeek` array allows fine-grained control over service delivery schedule
4. **Update Support**: Existing services can be edited to add or modify subscription configurations
5. **Validation**: The system validates that required pricing fields are provided when subscriptions are enabled

## Next Steps

To integrate subscription services into vendor and customer apps:
1. Use the GET endpoints to fetch services with subscription configurations
2. Display subscription plan options in a user-friendly format
3. Allow customers to select their preferred plan (weekly/monthly, 1 or 2 sessions)
4. Create bookings with subscription metadata for recurring service scheduling
5. Implement subscription management features (pause, resume, cancel)
