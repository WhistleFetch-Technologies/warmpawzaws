# Pharmacy Dashboard Fixes

**Date:** 2026-01-26  
**Issues Fixed:** 2

## Issue 1: Services Loading Error

### Problem
- Error: `TypeError: s.forEach is not a function` and `i.map is not a function`
- The VendorCapabilityDashboard was trying to load services and expected an array, but the API might return a non-array response
- This was causing the pharmacy dashboard to fail loading

### Solution
1. **Fixed `loadServices` function** in `VendorCapabilityDashboard.tsx`:
   - Added check to ensure response is an array: `Array.isArray(servicesData) ? servicesData : []`
   - Set empty array on error to prevent crashes
   - Handle both `data.services` and `data` formats

2. **Fixed `services.map` call**:
   - Added safety check: `Array.isArray(services) && services.map(...)`
   - Prevents errors when services is not an array

### Files Changed
- `apps/vendor-web/components/vendor/VendorCapabilityDashboard.tsx`

---

## Issue 2: Invoice Upload Not Visible

### Problem
- User couldn't see the option to upload/update proforma invoice on vendor dashboard
- Invoice upload component was implemented but not prominently displayed

### Solution
1. **Added Invoice Upload Section** to `PharmacyOrderDashboard.tsx`:
   - Shows for orders with status: `accepted`, `confirmed`, or `invoice_generated`
   - Prominent visual design with amber background and border
   - Clear heading and description
   - Status badge when invoice is already sent

2. **Enhanced Visibility**:
   - Added section header with icon
   - Added status indicator ("Invoice Sent" badge)
   - Added helpful description text
   - Wrapped in visually distinct container

### Invoice Upload Shows For:
- ✅ `accepted` - New order, needs invoice
- ✅ `confirmed` - Order confirmed, needs invoice
- ✅ `invoice_generated` - Invoice sent, can update if needed

### Files Changed
- `apps/vendor-web/components/vendor/pharmacy/PharmacyOrderDashboard.tsx`

---

## How to Access Invoice Upload

1. **Navigate to Pharmacy Orders Dashboard:**
   - Go to `/pharmacy/orders` in vendor web app

2. **View Active Orders:**
   - Click on "Active Orders" tab
   - Find orders with status: "Accepted", "Confirmed", or "Invoice Sent"

3. **Upload Invoice:**
   - Scroll to the "Proforma Invoice" section (amber-colored box)
   - Click "Click to upload invoice"
   - Select image or PDF file (max 5MB)
   - Enter invoice amount
   - Click "Submit Invoice"

4. **Update Existing Invoice:**
   - If invoice is already sent (status: "Invoice Sent")
   - You'll see "Invoice Sent" badge
   - Click "Upload New" to update the invoice

---

## Visual Design

The invoice upload section features:
- 🟡 Amber background (`bg-amber-50`) for visibility
- 📄 Receipt icon for clear identification
- ✅ Status badge when invoice is sent
- 📝 Helpful description text
- 📤 Upload component with preview

---

## Testing

### Test Case 1: Services Loading
1. Login as pharmacy vendor
2. Navigate to pharmacy orders
3. ✅ Should load without errors
4. ✅ No "forEach is not a function" errors

### Test Case 2: Invoice Upload Visibility
1. Accept an incoming order
2. Go to "Active Orders" tab
3. ✅ Should see "Proforma Invoice" section
4. ✅ Should be able to upload invoice
5. ✅ After upload, status should update

### Test Case 3: Invoice Update
1. View order with "Invoice Sent" status
2. ✅ Should see "Invoice Sent" badge
3. ✅ Should be able to upload new invoice

---

## Deployment

Both fixes are ready for deployment:
- ✅ Code changes complete
- ✅ Error handling improved
- ✅ UI/UX enhanced
- ✅ Ready to deploy
