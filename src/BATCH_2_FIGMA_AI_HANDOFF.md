# Batch 2 Figma AI Handoff

## Background
I'm developing Warmpawz, a multi-vendor pet marketplace on Supabase, where we are currently consolidating critical "P0" features (like Coupons and Payouts) into logical main menu sections. The goal is to ensure all functionality remains accessible within our mobile-first, orange-branded design while preparing for a future migration to AWS Lambda. We have recently resolved React key warnings and fixed a critical JSON parsing error in the promotions loading logic that was causing the application to crash.

## Current state
With the promotions loading error in `PromotionsManagement.tsx` and `PromotionsAdmin.tsx` now resolved, we are ready to proceed with the "Batch 2" implementation.

## Handoff Code

### Component 1: Customer Promotions List

**Endpoint:** `GET /promotions/active?category=&applicableTo=`

**Request Example:**
```javascript
const response = await fetch(
  'https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/promotions/active?category=booking&applicableTo=all',
  {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    }
  }
);
const data = await response.json();
// Success response:
// {
//   success: true,
//   promotions: [
//     {
//       id: "promo_xxx",
//       name: "Summer Sale",
//       description: "Get 20% off on all services",
//       type: "percentage",
//       value: 20,
//       minOrderAmount: 500,
//       maxDiscountAmount: 1000,
//       validFrom: "2025-01-27T00:00:00.000Z",
//       validUntil: "2025-12-31T23:59:59.000Z",
//       bannerImage: "https://storage.url/banner.jpg",
//       termsAndConditions: "Terms apply...",
//       priority: 1
//     }
//   ],
//   total: 5
// }
```

**Query Parameters:**
*   `category`: Optional, filter by category
*   `applicableTo`: Optional, filter by applicability (all, new_users, categories, services, vendors)

### Component 2: Coupon Code Input & Validation

**Endpoint:** `POST /coupons/validate`

**Request Example:**
```javascript
const response = await fetch(
  'https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/coupons/validate',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      code: 'SAVE10',
      orderAmount: 1000,
      customerId: 'customer_xxx',
      targetIds: ['service_xxx'] // Optional
    })
  }
);
const data = await response.json();
// Success response (valid):
// {
//   success: true,
//   valid: true,
//   coupon: {
//     id: "coupon_xxx",
//     code: "SAVE10",
//     type: "percentage",
//     value: 10,
//     discountAmount: 100,
//     finalAmount: 900,
//     minOrderAmount: 500,
//     maxDiscountAmount: null
//   }
// }
// Success response (invalid):
// {
//   success: true,
//   valid: false,
//   error: "Coupon has expired"
// }
```

**Validation Rules:**
*   `code`: Required, case-insensitive
*   `orderAmount`: Required, must be >= 0
*   `customerId`: Optional, for user-specific coupons
*   `targetIds`: Optional, for category/service-specific coupons

**Error Messages:**
*   "Invalid coupon code"
*   "Coupon is not active"
*   "Coupon has expired"
*   "Coupon usage limit reached"
*   "Minimum order amount of X required"
*   "Coupon not valid for this user"

### Component 3: Apply Coupon

**Endpoint:** `POST /coupons/apply`

**Request Example:**
```javascript
const response = await fetch(
  'https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/coupons/apply',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      code: 'SAVE10',
      orderAmount: 1000,
      customerId: 'customer_xxx',
      orderId: 'order_xxx', // Optional, for ecommerce orders
      bookingId: 'booking_xxx', // Optional, for service bookings
      targetIds: ['service_xxx'] // Optional
    })
  }
);
const data = await response.json();
// Success response:
// {
//   success: true,
//   usage: {
//     id: "usage_xxx",
//     couponId: "coupon_xxx",
//     couponCode: "SAVE10",
//     userId: "customer_xxx",
//     orderId: "order_xxx",
//     bookingId: null,
//     discountAmount: 100,
//     orderAmount: 1000,
//     usedAt: "2025-01-27T10:00:00.000Z"
//   },
//   coupon: {
//     id: "coupon_xxx",
//     code: "SAVE10",
//     type: "percentage",
//     value: 10,
//     discountAmount: 100,
//     finalAmount: 900,
//     usageCount: 5
//   }
// }
```
**Note:** This endpoint records the coupon usage and updates usage counts. Call this after validation when user confirms the order/booking.

### Component 4: Admin Promotion Creation Form

**Endpoint:** `POST /admin/promotions/create`

**Request Example:**
```javascript
const response = await fetch(
  'https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/admin/promotions/create',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Summer Sale 2025',
      description: 'Get 20% off on all services this summer',
      type: 'percentage', // 'percentage' | 'fixed' | 'free_shipping' | 'buy_x_get_y'
      value: 20, // Percentage (0-100) or fixed amount
      minOrderAmount: 500, // Optional
      maxDiscountAmount: 1000, // Optional
      validFrom: '2025-06-01T00:00:00.000Z',
      validUntil: '2025-08-31T23:59:59.000Z',
      usageLimit: 1000, // Optional, total usage limit
      userUsageLimit: 1, // Optional, per-user usage limit
      applicableTo: 'all', // 'all' | 'new_users' | 'categories' | 'services' | 'vendors'
      targetIds: [], // Optional, category/service/vendor IDs
      priority: 1, // Higher priority applied first
      bannerImage: 'https://storage.url/banner.jpg', // Optional
      termsAndConditions: 'Terms and conditions apply...',
      isActive: true
    })
  }
);
const data = await response.json();
// Success response:
// {
//   success: true,
//   promotion: {
//     id: "promo_xxx",
//     name: "Summer Sale 2025",
//     description: "Get 20% off on all services this summer",
//     type: "percentage",
//     value: 20,
//     minOrderAmount: 500,
//     maxDiscountAmount: 1000,
//     validFrom: "2025-06-01T00:00:00.000Z",
//     validUntil: "2025-08-31T23:59:59.000Z",
//     usageLimit: 1000,
//     usageCount: 0,
//     userUsageLimit: 1,
//     applicableTo: "all",
//     targetIds: [],
//     isActive: true,
//     priority: 1,
//     bannerImage: "https://storage.url/banner.jpg",
//     termsAndConditions: "Terms and conditions apply...",
//     createdAt: "2025-01-27T10:00:00.000Z",
//     updatedAt: "2025-01-27T10:00:00.000Z"
//   }
// }
```

**Validation Rules:**
*   `name`, `type`, `value`, `validFrom`, `validUntil`: Required
*   `type`: Must be one of: percentage, fixed, free_shipping, buy_x_get_y
*   `value`: For percentage, must be 0-100; for fixed, must be positive
*   `validUntil`: Must be after validFrom
*   `applicableTo`: Must be one of: all, new_users, categories, services, vendors

### Component 5: Admin Promotion List & Management

**Endpoint:** `GET /admin/promotions?status=&type=&search=&page=1&limit=50`

**Request Example:**
```javascript
const response = await fetch(
  'https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/admin/promotions?status=active&type=percentage&search=Summer&page=1&limit=50',
  {
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'apikey': SUPABASE_ANON_KEY
    }
  }
);
const data = await response.json();
// Success response:
// {
//   success: true,
//   promotions: [...],
//   pagination: {
//     page: 1,
//     limit: 50,
//     total: 25,
//     totalPages: 1
//   }
// }
```

**Query Parameters:**
*   `status`: all, active, inactive, expired
*   `type`: percentage, fixed, free_shipping, buy_x_get_y
*   `search`: Search in name or description
*   `page`: Page number (default: 1)
*   `limit`: Items per page (default: 50)

**Additional Endpoints:**
*   `PUT /admin/promotions/:promoId` - Update promotion
*   `DELETE /admin/promotions/:promoId` - Delete promotion
*   `POST /admin/promotions/:promoId/activate` - Activate promotion
*   `POST /admin/promotions/:promoId/deactivate` - Deactivate promotion
*   `GET /admin/promotions/:promoId/analytics` - Get promotion analytics

### Component 6: Admin Coupon Management

**Endpoints:**
*   `GET /admin/coupons?status=&search=&page=1&limit=50` - List coupons
*   `POST /admin/coupons/create` - Create single coupon
*   `POST /admin/coupons/bulk-generate` - Bulk generate coupons
*   `PUT /admin/coupons/:couponId` - Update coupon
*   `DELETE /admin/coupons/:couponId` - Delete coupon
*   `GET /admin/coupons/:couponId/usage` - Get usage analytics

**Create Single Coupon Example:**
```javascript
const response = await fetch(
  'https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/admin/coupons/create',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      code: 'WELCOME10',
      promotionId: 'promo_xxx', // Optional
      type: 'percentage',
      value: 10,
      minOrderAmount: 500,
      maxDiscountAmount: 500,
      validFrom: '2025-01-27T00:00:00.000Z',
      validUntil: '2025-12-31T23:59:59.000Z',
      usageLimit: 100, // Optional
      userId: 'customer_xxx', // Optional, user-specific coupon
      isActive: true
    })
  }
);
```

**Bulk Generate Coupons Example:**
```javascript
const response = await fetch(
  'https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/admin/coupons/bulk-generate',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prefix: 'SAVE',
      quantity: 100,
      format: 'alphanumeric', // 'alphanumeric' | 'numeric'
      length: 8,
      promotionId: 'promo_xxx', // Optional
      type: 'percentage',
      value: 15,
      minOrderAmount: 1000,
      maxDiscountAmount: 1000,
      validFrom: '2025-01-27T00:00:00.000Z',
      validUntil: '2025-12-31T23:59:59.000Z',
      usageLimit: 1, // Each coupon can be used once
      isActive: true
    })
  }
);
const data = await response.json();
// Success response:
// {
//   success: true,
//   message: "Successfully generated 100 coupons",
//   coupons: [
//     {
//       id: "coupon_xxx",
//       code: "SAVEABC123",
//       type: "percentage",
//       value: 15,
//       ...
//     },
//     ...
//   ],
//   total: 100
// }
```

**Bulk Generation Limits:**
*   Maximum 10,000 coupons per request
*   Code length: 4-20 characters
*   Format: alphanumeric (A-Z, 0-9) or numeric (0-9)

### UI Design Guidelines

**Color Scheme**
*   **Promotion Types:**
    *   percentage: Green (#4CAF50)
    *   fixed: Blue (#2196F3)
    *   free_shipping: Orange (#FF9800)
    *   buy_x_get_y: Purple (#9C27B0)
*   **Status Colors:**
    *   active: Green (#4CAF50)
    *   inactive: Gray (#9E9E9E)
    *   expired: Red (#F44336)

**Icons**
*   Promotion: 🎁
*   Coupon: 🎫
*   Discount: 💰
*   Percentage: %
*   Calendar: 📅
*   Users: 👥
*   Analytics: 📊

**Typography**
*   Promotion titles: Bold, 20-24px
*   Discount values: Bold, 28-32px
*   Body text: Regular, 14-16px
*   Terms: Small, 12px

**Spacing**
*   Card padding: 16px
*   Section spacing: 24px
*   Field spacing: 16px
*   Button spacing: 8px

### Testing Checklist
After implementing each component, test:

**Component 1: Promotions List**
*   [ ] Promotions load correctly
*   [ ] Filters work (category, applicableTo)
*   [ ] Banner images display
*   [ ] Countdown timer works (if implemented)
*   [ ] Click promotion navigates to details

**Component 2: Coupon Validation**
*   [ ] Valid coupon shows discount
*   [ ] Invalid coupon shows error
*   [ ] Expired coupon shows error
*   [ ] Minimum order amount validation
*   [ ] Discount calculation is correct

**Component 3: Apply Coupon**
*   [ ] Coupon application works
*   [ ] Usage is recorded
*   [ ] Order/booking amount updates
*   [ ] Error handling works

**Component 4: Admin Promotion Creation**
*   [ ] Form validation works
*   [ ] All promotion types work
*   [ ] Date pickers work
*   [ ] Image upload works (if implemented)
*   [ ] Preview mode works (if implemented)

**Component 5: Admin Promotion Management**
*   [ ] List loads correctly
*   [ ] Filters work
*   [ ] Activate/deactivate works
*   [ ] Edit works
*   [ ] Delete works
*   [ ] Analytics display correctly

**Component 6: Admin Coupon Management**
*   [ ] Single coupon creation works
*   [ ] Bulk generation works
*   [ ] Generated codes are unique
*   [ ] Usage analytics display correctly
*   [ ] Export works (if implemented)

### Next Steps
*   Implement Components: Use the examples above to implement all 6 components
*   Test Integration: Test each component with real backend
*   Error Handling: Ensure all error cases are handled
*   Loading States: Show loading indicators during API calls
*   Validation: Implement client-side validation
*   Responsive Design: Ensure mobile/tablet/desktop compatibility

### Support
If you encounter any issues:
*   Check the API endpoint documentation above
*   Verify authentication headers are correct
*   Check error responses for specific error messages
*   Test endpoints directly with Postman/curl first

### Backend Status
*   ✅ All 17+ endpoints implemented
*   ✅ Error handling complete
*   ✅ Validation complete
*   ✅ Discount calculation complete
*   ✅ Usage tracking complete
*   ✅ Analytics complete
*   ✅ Routes registered in index.tsx
*   ✅ Public promotions endpoint configured
*   ✅ Ready for frontend integration
