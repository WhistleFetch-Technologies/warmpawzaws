# Route Ordering Guide

**Last Updated:** 2026-01-28

## Critical Rule

**Specific routes MUST be registered BEFORE parameterized routes.**

In Hono (and most web frameworks), route matching is done in registration order. The first matching route wins. If a parameterized route like `/customer/:customerId` is registered before a specific route like `/customer/notifications`, the parameterized route will catch the request and treat "notifications" as a customer ID.

## Route Registration Order

### Phase 1: Enhanced Handlers (Priority)
These are the new, improved handlers that should take precedence:

```typescript
registerAuthEndpointsEnhanced(app);
registerVendorOnboardingEndpointsEnhanced(app);
registerVendorOnboardingFixes(app);
registerPaymentEndpointsEnhanced(app);
```

### Phase 2: Core Endpoints
```typescript
registerRoleEndpoints(app);
registerRoleSeedingEndpoints(app);
registerOnboardingFormManagementEndpoints(app);
registerVendorDashboardEndpoints(app);
```

### Phase 3: Specific Routes (BEFORE Parameterized Routes)
**CRITICAL:** These must come before any parameterized routes:

```typescript
// Customer-specific routes (before /customer/:customerId)
registerBehaviorJournalEndpoints(app);           // /customer/behavior-journal
registerNotificationEndpoints(app);              // /customer/notifications
registerServiceDiscoveryEndpoints(app);          // /customer/vendors/search, /customer/discover-services, etc.
registerServiceCatalogEndpoints(app);            // /services/:serviceId
registerCustomerPhoneConvenienceEndpoints(app);  // /customer/bookings?phone=, /customer/cart/:phone
registerCustomerProfileEndpoints(app);            // /customer/profile, /customer/profile/:id

// Other specific routes
registerFollowupRescheduleEndpoints(app);        // /followup/create, /vendor/reschedule-policy
```

### Phase 4: Parameterized Routes
These can match any value, so they must come AFTER specific routes:

```typescript
registerCustomerEndpointsEnhanced(app);          // /customer/:customerId (parameterized - must be last)
```

### Phase 5: Other Endpoints
All other endpoints can be registered in any order (no conflicts):

```typescript
registerGpsTrackingEndpoints(app);
registerAdminEndpoints(app);
registerVideoCallEndpoints(app);
// ... all other endpoints
```

## Known Route Patterns

### Customer Routes
- ✅ `/customer/behavior-journal` - Specific (before parameterized)
- ✅ `/customer/notifications` - Specific (before parameterized)
- ✅ `/customer/vendors/search` - Specific (before parameterized)
- ✅ `/customer/profile` - Specific (before parameterized)
- ✅ `/customer/profile/:id` - Specific with param (before parameterized)
- ✅ `/customer/:customerId` - Parameterized (must be last)

### Service Routes
- ✅ `/services/:serviceId` - Parameterized (registered early, no conflict)
- ✅ `/service-catalog/categories` - Specific

### Vendor Routes
- ✅ `/vendor/reschedule-policy` - Specific
- ✅ `/vendor/available-slots` - Specific
- ✅ `/vendor/:vendorId` - Parameterized (if exists)

### Booking Routes
- ✅ `/bookings/create` - Specific
- ✅ `/bookings/available-slots` - Specific
- ✅ `/bookings/:bookingId` - Parameterized (if exists)

## Route Conflict Detection

### How to Identify Conflicts

1. **Check route patterns:**
   - If you have `/customer/notifications` and `/customer/:customerId`
   - The parameterized route will match first if registered first
   - Result: `/customer/notifications` returns 404 or wrong data

2. **Test route matching:**
   ```typescript
   // BAD - Parameterized first
   app.get('/customer/:customerId', handler1);
   app.get('/customer/notifications', handler2);
   // Request to /customer/notifications → handler1 runs with customerId="notifications"
   
   // GOOD - Specific first
   app.get('/customer/notifications', handler2);
   app.get('/customer/:customerId', handler1);
   // Request to /customer/notifications → handler2 runs correctly
   ```

### Common Conflict Patterns

| Pattern | Conflict? | Solution |
|---------|----------|----------|
| `/customer/:id` before `/customer/notifications` | ✅ Yes | Register specific route first |
| `/services/:id` before `/services/categories` | ✅ Yes | Register specific route first |
| `/vendor/:id` before `/vendor/settings` | ✅ Yes | Register specific route first |
| `/bookings/:id` before `/bookings/create` | ✅ Yes | Register specific route first |

## Adding New Routes

### Checklist

1. ✅ **Identify route pattern:**
   - Is it specific? (e.g., `/customer/notifications`)
   - Is it parameterized? (e.g., `/customer/:customerId`)

2. ✅ **Check for conflicts:**
   - Search for similar routes in existing endpoints
   - Check if parameterized routes exist for the same prefix

3. ✅ **Register in correct order:**
   - Specific routes → Register in Phase 3
   - Parameterized routes → Register in Phase 4 or later

4. ✅ **Add documentation:**
   - Document the route in this file
   - Add comments in handler registration

### Example: Adding New Customer Route

```typescript
// ❌ WRONG - Adding to wrong phase
registerCustomerEndpointsEnhanced(app);  // Parameterized - Phase 4
registerNewCustomerSpecificRoute(app);   // Specific - but registered after parameterized!

// ✅ CORRECT - Add to Phase 3 (before parameterized)
registerBehaviorJournalEndpoints(app);
registerNotificationEndpoints(app);
registerNewCustomerSpecificRoute(app);   // Specific - Phase 3
// ... other specific routes
registerCustomerEndpointsEnhanced(app);  // Parameterized - Phase 4
```

## Testing Route Order

### Manual Testing

1. Start the Lambda locally
2. Test each specific route:
   ```bash
   curl http://localhost:3000/customer/notifications
   curl http://localhost:3000/customer/behavior-journal
   ```
3. Verify they return correct data (not 404 or wrong handler)

### Automated Testing

Add route conflict tests:

```typescript
describe('Route Ordering', () => {
  it('should match specific routes before parameterized routes', async () => {
    const response = await app.request('/customer/notifications');
    expect(response.status).toBe(200);
    // Should not be handled by /customer/:customerId
  });
});
```

## Current Route Registration Order

See `backend/lambda/src/handler/index.ts` for the complete registration order.

### Key Sections:

1. **Lines 255-263:** Enhanced handlers
2. **Lines 264-272:** Specific routes (before parameterized)
3. **Line 274:** Parameterized customer route (must be after specific routes)
4. **Lines 275+:** All other endpoints

## Troubleshooting

### Issue: Route returns 404 but endpoint exists

**Possible causes:**
1. Route registered after parameterized route
2. Route pattern doesn't match (typo, wrong method)
3. Route handler throws error before response

**Solution:**
1. Check registration order in `handler/index.ts`
2. Verify route pattern matches request
3. Check handler logs for errors

### Issue: Route returns wrong data

**Possible causes:**
1. Parameterized route catching specific route
2. Wrong handler registered for route
3. Route conflict with similar pattern

**Solution:**
1. Verify route registration order
2. Check if parameterized route exists for same prefix
3. Move specific route before parameterized route

## Best Practices

1. ✅ **Always register specific routes before parameterized routes**
2. ✅ **Group related routes together**
3. ✅ **Add comments explaining route order**
4. ✅ **Document new routes in this file**
5. ✅ **Test route matching after changes**
6. ✅ **Use route prefixes consistently** (e.g., `/customer/*`, `/vendor/*`)

## Route Prefix Guidelines

| Prefix | Specific Routes | Parameterized Routes |
|--------|----------------|---------------------|
| `/customer/` | `notifications`, `behavior-journal`, `profile` | `:customerId` |
| `/vendor/` | `reschedule-policy`, `available-slots`, `settings` | `:vendorId` |
| `/bookings/` | `create`, `available-slots` | `:bookingId` |
| `/services/` | `categories` | `:serviceId` |

---

**Remember: When in doubt, register specific routes first!**
