# 🧪 Backend Integration Testing Guide

## ✅ READY FOR TESTING

**Date:** January 5, 2026  
**Status:** All 23 UI screens connected to backend APIs  
**Mock Data:** Completely removed

---

## 📋 PRE-TESTING CHECKLIST

### 1. Environment Configuration

#### **API Base URLs**
Verify API endpoints are configured correctly:

**Customer Web:**
```bash
# Check: apps/customer-web/lib/api-client.ts
# Uses: NEXT_PUBLIC_API_BASE_URL or runtime-config.js
# Default: dev.api.warmpawz.com (dev) | api.warmpawz.com (prod)
```

**Vendor Web:**
```bash
# Check: apps/vendor-web/lib/api-client.ts
# Uses: NEXT_PUBLIC_API_BASE_URL or runtime-config.js
```

**Admin Web:**
```bash
# Check: apps/admin-web/lib/api-client.ts
# Uses: NEXT_PUBLIC_API_BASE_URL or runtime-config.js
```

#### **Environment Variables**
Create `.env.local` files if needed:

```bash
# apps/customer-web/.env.local
NEXT_PUBLIC_API_BASE_URL=https://dev.api.warmpawz.com
NEXT_PUBLIC_UAT_MODE=true

# apps/vendor-web/.env.local
NEXT_PUBLIC_API_BASE_URL=https://dev.api.warmpawz.com
NEXT_PUBLIC_UAT_MODE=true

# apps/admin-web/.env.local
NEXT_PUBLIC_API_BASE_URL=https://dev.api.warmpawz.com
NEXT_PUBLIC_UAT_MODE=true
```

---

## 🎯 TESTING SCENARIOS BY APP

### **ADMIN WEB** (10 Screens)

#### 1. Service Catalog (`/catalog`)
**Endpoints to Test:**
- `GET /admin/service-catalog` - List all services
- `GET /service-catalog/categories` - List categories
- `POST /admin/service-catalog` - Create service
- `PUT /admin/service-catalog/:id` - Update service
- `DELETE /admin/service-catalog/:id` - Delete service
- `POST /admin/service-catalog/reorder` - Reorder services

**Test Cases:**
- ✅ Load services list
- ✅ Filter by category
- ✅ Create new service
- ✅ Edit existing service
- ✅ Delete service
- ✅ Reorder services (drag & drop)
- ✅ Toggle service status

**Expected Data Structure:**
```typescript
{
  services: [{
    id: string;
    service_id: string;
    service_name: string;
    display_name: string;
    category_id: string;
    applicable_roles: string[];
    base_price: number;
    status: 'active' | 'inactive';
  }]
}
```

---

#### 2. Platform Integrations (`/integrations`)
**Endpoints to Test:**
- `GET /admin/integrations/aws` - AWS config
- `GET /admin/integrations/razorpay` - Razorpay config
- `GET /admin/integrations/google-maps` - Maps config
- `GET /admin/integrations/shiprocket` - Shiprocket config
- `PUT /admin/integrations/aws` - Update AWS config
- `PUT /admin/integrations/razorpay` - Update Razorpay config
- `POST /admin/integrations/test-connection` - Test connection

**Test Cases:**
- ✅ Load all integration configs
- ✅ Update AWS S3/SNS/SES/Chime settings
- ✅ Update Razorpay credentials
- ✅ Update Google Maps API key
- ✅ Test connection for each service
- ✅ Verify connection status indicators

---

#### 3. Settlements Dashboard (`/settlements`)
**Endpoints to Test:**
- `GET /settlements?status=pending&year=2026` - List settlements
- `GET /settlements/summary` - Summary stats
- `POST /settlements/:id/process` - Process payout
- `POST /settlements/bulk-process` - Bulk process
- `GET /settlements/:id` - Settlement details

**Test Cases:**
- ✅ Load pending settlements
- ✅ View settlement summary
- ✅ Process individual payout
- ✅ Bulk process multiple settlements
- ✅ View settlement details modal
- ✅ Filter by status and year

---

#### 4. Governance Dashboard (`/governance`)
**Endpoints to Test:**
- `GET /admin/governance/status` - System status
- `GET /admin/governance/audit-log?limit=50` - Audit log
- `POST /admin/governance/invalidate-cache` - Invalidate cache
- `POST /admin/governance/propagate` - Propagate changes

**Test Cases:**
- ✅ Load system health status
- ✅ View cache statistics
- ✅ Invalidate specific caches
- ✅ Propagate configuration changes
- ✅ View audit log
- ✅ Check service health indicators

---

#### 5. Reports Builder (`/reports`)
**Endpoints to Test:**
- `GET /admin/reports/templates` - Report templates
- `GET /admin/reports/generated?limit=10` - Generated reports
- `GET /admin/reports/saved` - Saved reports
- `POST /admin/reports/generate` - Generate report
- `GET /admin/reports/:id/download` - Download report

**Test Cases:**
- ✅ Load report templates
- ✅ Select template and configure parameters
- ✅ Generate report (PDF/CSV/XLSX)
- ✅ View generated reports list
- ✅ Download report
- ✅ Save custom report

---

#### 6. Analytics Dashboard (`/analytics`)
**Endpoints to Test:**
- `GET /admin/analytics/kpis?period=30d` - KPIs
- `GET /admin/analytics/charts?period=30d` - Chart data
- `GET /admin/analytics/top-performers?period=30d` - Top performers

**Test Cases:**
- ✅ Load KPIs with trends
- ✅ View revenue charts
- ✅ View bookings charts
- ✅ View top vendors/services/cities
- ✅ Filter by date range
- ✅ Drill down into details

---

#### 7. Promotions Management (`/promotions`)
**Endpoints to Test:**
- `GET /admin/promotions?status=active` - List promotions
- `GET /admin/coupons?status=active` - List coupons
- `POST /admin/promotions` - Create promotion
- `PUT /admin/promotions/:id` - Update promotion
- `DELETE /admin/promotions/:id` - Delete promotion

**Test Cases:**
- ✅ Load promotions and coupons
- ✅ Create new promotion/coupon
- ✅ Edit existing promotion
- ✅ Toggle promotion status
- ✅ Set usage limits
- ✅ Filter by status

---

#### 8. Region Management (`/regions`)
**Endpoints to Test:**
- `GET /admin/regions` - List regions
- `POST /admin/regions` - Create region
- `PUT /admin/regions/:id` - Update region
- `DELETE /admin/regions/:id` - Delete region

**Test Cases:**
- ✅ Load regions list
- ✅ Create new region
- ✅ Edit region details
- ✅ Configure service radius
- ✅ Set timezone and currency
- ✅ View vendor/customer counts

---

#### 9. Tier System (`/tiers`)
**Endpoints to Test:**
- `GET /admin/tiers` - List tiers
- `POST /admin/tiers` - Create tier
- `PUT /admin/tiers/:id` - Update tier
- `DELETE /admin/tiers/:id` - Delete tier

**Test Cases:**
- ✅ Load tiers list
- ✅ Create new tier
- ✅ Configure commission rates
- ✅ Set tier requirements
- ✅ Assign benefits
- ✅ View vendor counts per tier

---

#### 10. Notification Broadcast (`/notifications`)
**Endpoints to Test:**
- `GET /admin/notifications` - List notifications
- `POST /admin/notifications` - Send notification
- `GET /admin/notifications/:id/analytics` - Delivery analytics

**Test Cases:**
- ✅ Load notification history
- ✅ Compose new notification
- ✅ Select target audience
- ✅ Choose channels (push/email/in-app)
- ✅ Schedule notification
- ✅ View delivery analytics

---

### **VENDOR WEB** (4 Screens)

#### 1. Bank Details (`/bank-details`)
**Endpoints to Test:**
- `GET /vendor/bank-accounts` - List bank accounts
- `GET /vendor/upi-accounts` - List UPI accounts
- `POST /vendor/bank-accounts` - Add bank account
- `PUT /vendor/bank-accounts/:id` - Update bank account
- `POST /vendor/bank-accounts/:id/verify` - Verify account
- `GET /vendor/bank-accounts/ifsc/:code` - IFSC lookup

**Test Cases:**
- ✅ Load bank and UPI accounts
- ✅ Add new bank account
- ✅ Add UPI ID
- ✅ Verify IFSC code
- ✅ Verify bank account
- ✅ Set primary account

---

#### 2. Settlements History (`/settlements`)
**Endpoints to Test:**
- `GET /vendor/settlements?status=completed&year=2026` - List settlements
- `GET /vendor/settlements/summary` - Summary stats
- `GET /vendor/settlements/:id/statement` - Download statement

**Test Cases:**
- ✅ Load settlement history
- ✅ View summary cards
- ✅ Filter by status and year
- ✅ Download settlement statement
- ✅ View settlement details

---

#### 3. Package Management (`/packages`)
**Endpoints to Test:**
- `GET /vendor/packages` - List packages
- `GET /vendor/services` - Available services
- `POST /vendor/packages` - Create package
- `PUT /vendor/packages/:id` - Update package
- `GET /vendor/packages/:id/enrollments` - View enrollments

**Test Cases:**
- ✅ Load packages list
- ✅ Create new package
- ✅ Add services to package
- ✅ Calculate discount
- ✅ View enrollments
- ✅ Toggle package status

---

#### 4. Subscription Plans (`/subscriptions`)
**Endpoints to Test:**
- `GET /vendor/subscriptions/plans` - List plans
- `GET /vendor/services` - Available services
- `POST /vendor/subscriptions/plans` - Create plan
- `PUT /vendor/subscriptions/plans/:id` - Update plan
- `GET /vendor/subscriptions/plans/:id/subscribers` - View subscribers

**Test Cases:**
- ✅ Load subscription plans
- ✅ Create new plan
- ✅ Configure billing cycle
- ✅ Set max bookings per cycle
- ✅ View subscribers
- ✅ Toggle plan status

---

### **CUSTOMER WEB** (9 Screens)

#### 1. E-Commerce Shop (`/shop`)
**Endpoints to Test:**
- `GET /ecommerce/products?category=food&pet_type=dog` - List products
- `GET /ecommerce/categories` - List categories
- `POST /ecommerce/cart/add` - Add to cart
- `GET /ecommerce/cart` - Get cart
- `POST /ecommerce/checkout` - Checkout

**Test Cases:**
- ✅ Load products list
- ✅ Filter by category and pet type
- ✅ Search products
- ✅ Add to cart
- ✅ View cart
- ✅ Checkout flow

---

#### 2. Rewards & Loyalty (`/rewards`)
**Endpoints to Test:**
- `GET /rewards/balance` - Points balance
- `GET /rewards/catalog` - Available rewards
- `GET /rewards/history` - Points history
- `GET /rewards/redeemed` - Redeemed rewards
- `POST /rewards/redeem` - Redeem reward

**Test Cases:**
- ✅ View points balance and tier
- ✅ Browse reward catalog
- ✅ Redeem reward
- ✅ View points history
- ✅ View redeemed rewards

---

#### 3. Medical Records (`/medical-records`)
**Endpoints to Test:**
- `GET /pets` - List pets
- `GET /medical-records?pet_id=1&type=consultation` - List records
- `GET /medical-records/vaccinations` - Vaccination history
- `GET /medical-records/:id/download` - Download record
- `POST /medical-records/:id/share` - Share record

**Test Cases:**
- ✅ Load pets list
- ✅ View medical records timeline
- ✅ Filter by pet and type
- ✅ View vaccination history
- ✅ Download record PDF
- ✅ Share record

---

#### 4. Chat Feature (`/chat`)
**Endpoints to Test:**
- `GET /chat/conversations` - List conversations
- `GET /chat/conversations/:id/messages` - Get messages
- `POST /chat/conversations/:id/messages` - Send message
- `POST /chat/conversations/:id/upload` - Upload file

**Test Cases:**
- ✅ Load conversations list
- ✅ Open conversation
- ✅ Send text message
- ✅ Upload file attachment
- ✅ Real-time message polling
- ✅ Mark as read

---

#### 5. Insurance Plans (`/insurance`)
**Endpoints to Test:**
- `GET /insurance/plans` - List plans
- `GET /insurance/policies` - Customer policies
- `GET /insurance/claims` - Claims history
- `POST /insurance/policies` - Purchase policy
- `POST /insurance/claims` - Submit claim

**Test Cases:**
- ✅ Browse insurance plans
- ✅ Compare plans
- ✅ Purchase policy
- ✅ View active policies
- ✅ Submit claim
- ✅ Track claim status

---

#### 6. Events Discovery (`/events`)
**Endpoints to Test:**
- `GET /events?category=adoption&city=Bangalore` - List events
- `GET /events/registrations` - My registrations
- `POST /events/:id/register` - Register for event
- `GET /events/:id/qr-code` - Get QR code

**Test Cases:**
- ✅ Browse events
- ✅ Filter by category and city
- ✅ View event details
- ✅ Register for event
- ✅ View my registrations
- ✅ Download QR code

---

#### 7. Donations Flow (`/donations`)
**Endpoints to Test:**
- `GET /donations/campaigns?status=active` - List campaigns
- `GET /donations/my-donations` - My donations
- `POST /donations/campaigns/:id/donate` - Make donation

**Test Cases:**
- ✅ Browse donation campaigns
- ✅ View campaign details
- ✅ Make donation
- ✅ View donation history
- ✅ Track campaign progress

---

#### 8. Referral System (`/referrals`)
**Endpoints to Test:**
- `GET /referrals/stats` - Referral statistics
- `GET /referrals/list` - Referred users
- `GET /referrals/rewards` - Reward history
- `POST /referrals/generate-link` - Generate referral link

**Test Cases:**
- ✅ View referral code and link
- ✅ Share referral link
- ✅ View referred users
- ✅ Track rewards earned
- ✅ View reward history

---

## 🔍 COMMON TESTING SCENARIOS

### **1. Empty State Testing**
- ✅ Test screens with no data (empty arrays)
- ✅ Verify "No data" messages display correctly
- ✅ Check loading states

### **2. Error Handling**
- ✅ Test API failures (500, 404, 401)
- ✅ Verify error messages display
- ✅ Check network timeout handling
- ✅ Test invalid data responses

### **3. Loading States**
- ✅ Verify loading indicators show during API calls
- ✅ Check skeleton loaders (if implemented)
- ✅ Ensure UI doesn't freeze

### **4. Data Validation**
- ✅ Verify API response structure matches TypeScript interfaces
- ✅ Test with missing optional fields
- ✅ Test with null/undefined values
- ✅ Verify date formatting

### **5. Authentication**
- ✅ Test with valid auth token
- ✅ Test with expired token (should redirect to login)
- ✅ Test with missing token
- ✅ Verify role-based access

---

## 🐛 TROUBLESHOOTING

### **Issue: API calls failing with CORS errors**
**Solution:**
- Check API Gateway CORS configuration
- Verify `Access-Control-Allow-Origin` headers
- Ensure preflight OPTIONS requests are handled

### **Issue: 401 Unauthorized errors**
**Solution:**
- Verify auth token is being sent in headers
- Check token expiration
- Verify token format (Bearer token)

### **Issue: Empty data arrays**
**Solution:**
- Check API response structure
- Verify data is nested correctly (e.g., `response.data` vs `response`)
- Check API endpoint returns expected format

### **Issue: TypeScript errors**
**Solution:**
- Verify API response types match interfaces
- Check for optional vs required fields
- Update TypeScript interfaces if API structure differs

### **Issue: Slow API responses**
**Solution:**
- Check backend Lambda cold starts
- Verify database query performance
- Consider adding request caching
- Implement pagination for large datasets

---

## 📊 TESTING CHECKLIST

### **Phase 1: Basic Functionality**
- [ ] All screens load without errors
- [ ] API calls are made correctly
- [ ] Data displays correctly
- [ ] Loading states work
- [ ] Error messages display

### **Phase 2: CRUD Operations**
- [ ] Create operations work
- [ ] Read operations work
- [ ] Update operations work
- [ ] Delete operations work
- [ ] Validation works

### **Phase 3: Edge Cases**
- [ ] Empty data states
- [ ] Error states
- [ ] Network failures
- [ ] Large datasets
- [ ] Concurrent requests

### **Phase 4: User Experience**
- [ ] Loading indicators
- [ ] Error messages
- [ ] Success notifications
- [ ] Form validation
- [ ] Navigation flow

---

## 🚀 QUICK START TESTING

### **1. Start Development Servers**

```bash
# Terminal 1: Customer Web
cd apps/customer-web
npm run dev

# Terminal 2: Vendor Web
cd apps/vendor-web
npm run dev

# Terminal 3: Admin Web
cd apps/admin-web
npm run dev
```

### **2. Open Browser DevTools**

- Open Network tab
- Filter by "Fetch/XHR"
- Monitor API calls
- Check request/response payloads

### **3. Test Each Screen**

1. Navigate to screen
2. Check Network tab for API calls
3. Verify response data
4. Test user interactions
5. Verify UI updates

---

## 📝 TESTING NOTES

### **API Response Format**
All APIs should return data in one of these formats:

```typescript
// Option 1: Direct array
[{ id: '1', name: 'Item' }]

// Option 2: Wrapped in object
{ data: [{ id: '1', name: 'Item' }] }

// Option 3: Named property
{ items: [{ id: '1', name: 'Item' }] }
```

The frontend code handles all three formats with fallbacks:
```typescript
setData(response.data || response.items || response || []);
```

### **Error Response Format**
APIs should return errors in this format:
```typescript
{
  error: string;
  message: string;
  statusCode: number;
}
```

---

## ✅ SUCCESS CRITERIA

- ✅ All 23 screens load data from backend APIs
- ✅ No mock data is displayed
- ✅ Error handling works correctly
- ✅ Loading states are shown
- ✅ User interactions trigger correct API calls
- ✅ Data updates reflect in UI
- ✅ TypeScript types match API responses

---

**Status:** ✅ **READY FOR BACKEND INTEGRATION TESTING**

**Next Steps:**
1. Configure API base URLs
2. Start development servers
3. Test each screen systematically
4. Document any API response format mismatches
5. Fix any TypeScript type issues
6. Verify error handling

