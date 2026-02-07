# Dashboard Enhancement Phase 5 - Plan
## Replace 10 Placeholders with Functional Sections

**Date:** 2026-01-28  
**Status:** 📋 **PLANNING**  
**Goal:** Replace 10 default placeholders with functional dashboard sections

---

## Selected Capabilities for Enhancement

Based on API availability and business importance, the following 10 capabilities will be enhanced:

### Communication (3)
1. **chat** - `/communication/messages`
   - API: `/chat/booking/:bookingId/conversation`
   - Show: Unread messages count, recent conversations
   - Route: `/communication/messages`

2. **video_call** - `/communication/video`
   - API: `/video-call/:bookingId`
   - Show: Upcoming video calls count
   - Route: `/communication/video`

3. **notifications** - `/communication/notifications`
   - API: `/notifications?userId=&userType=vendor`
   - Show: Unread notifications count
   - Route: `/communication/notifications`

### Finance (2)
4. **settlements** - `/finance/settlements`
   - API: `/vendor/:vendorId/settlements`
   - Show: Pending settlements count, total settled amount
   - Route: `/finance/settlements`

5. **bank_account** - `/finance/bank`
   - API: `/vendor/:vendorId/bank-details`
   - Show: Account verification status, last 4 digits
   - Route: `/finance/bank`

### Services (3)
6. **orders** - `/pharmacy/orders`
   - API: `/vendor/:vendorId/orders`, `/vendor/:vendorId/orders/stats`
   - Show: Pending orders count, total orders
   - Route: `/pharmacy/orders`

7. **packages** - `/services/packages`
   - API: `/vendor/:vendorId/packages`
   - Show: Packages count, active packages
   - Route: `/services/packages`

8. **subscriptions** - `/services/subscriptions`
   - API: `/vendor/:vendorId/subscriptions`
   - Show: Active subscriptions count
   - Route: `/services/subscriptions`

### Operations (2)
9. **inventory** - `/pharmacy/inventory`
   - API: `/vendor/:vendorId/products`
   - Show: Total products count, low stock items
   - Route: `/pharmacy/inventory`

10. **gps_tracking** - `/schedule/gps`
    - API: `/gps/tracking/:bookingId`
    - Show: Active tracking sessions count
    - Route: `/schedule/gps`

---

## Implementation Pattern

All sections will follow the standard design pattern:
- Load data from APIs
- Display summary statistics (counts, status)
- Show loading states
- Link to full management pages
- Follow Warmpawz design standards

---

## Next Steps

1. Create functional sections for each capability
2. Integrate with existing APIs
3. Add to dashboard routing in `CapabilitySection`
4. Test and verify functionality
