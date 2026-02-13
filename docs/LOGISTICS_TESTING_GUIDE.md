# 🚚 Logistics Testing Guide

## What Was Fixed

### 1. **Status Mismatch in `notify-logistics`**
   - **Issue**: When vendor clicks "Notify Logistics", it creates a `delivery_tracking` record with `status='assigned'` but no `logistics_partner_id` (no partner assigned yet)
   - **Fix**: Added clear comments explaining that `status='assigned'` means "available for assignment" until a partner accepts
   - **Location**: `meal-plans.ts` → `POST /meal/orders/:orderId/notify-logistics`

### 2. **Delivery Accept Endpoint Enhancement**
   - **Issue**: When a delivery partner accepts an order, it was creating a new `delivery_tracking` record even if one already existed from `notify-logistics`
   - **Fix**: Now checks if a tracking record exists and updates it instead of creating a duplicate
   - **Location**: `delivery-tracking.ts` → `POST /delivery/accept/:orderId`

### 3. **Test Helper Endpoint**
   - **Added**: `POST /delivery/test/create-partner` to create test delivery partners
   - **Purpose**: Makes it easier to test the logistics flow without manually creating partner records

---

## Complete Testing Flow

### Step 1: Vendor Notifies Logistics ✅ (You already did this)

**Endpoint:** `POST /meal/orders/:orderId/notify-logistics`

**Request:**
```bash
POST https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/meal/orders/3743f806-8996-4998-9246-1037a857fb2a/notify-logistics
```

**Response:**
```json
{
  "success": true,
  "message": "Logistics notified",
  "trackingId": "75c631ac-2762-46fa-a1d4-cc970e5ded1d"
}
```

**What Happens:**
- Creates `delivery_tracking` record with:
  - `status: 'assigned'` (means "available for assignment")
  - `logistics_partner_id: NULL` (no partner yet)
  - `assigned_at: timestamp` (time when logistics was notified)

---

### Step 2: Create Test Delivery Partner (Optional)

**Endpoint:** `POST /delivery/test/create-partner`

**Request:**
```bash
POST https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/delivery/test/create-partner
Content-Type: application/json

{
  "name": "Test Rider",
  "phone": "9876543210",
  "vehicleNumber": "KA-01-AB-1234",
  "vehicleType": "bike"
}
```

**Response:**
```json
{
  "success": true,
  "partnerId": "test_partner_1736789123456",
  "message": "Test delivery partner created...",
  "testEndpoints": {
    "viewAvailableOrders": "GET /delivery/available/test_partner_1736789123456?lat=12.9716&lng=77.5946",
    "acceptOrder": "POST /delivery/accept/:orderId",
    "viewActiveOrders": "GET /delivery/partner/test_partner_1736789123456/orders?status=active"
  }
}
```

**Note:** If `delivery_partners` table doesn't exist, you can use any UUID as `partnerId` for testing.

---

### Step 3: View Available Orders

**Endpoint:** `GET /delivery/available/:partnerId`

**Request:**
```bash
GET https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/delivery/available/TEST_PARTNER_ID?lat=12.9716&lng=77.5946&radius=10
```

**What It Checks:**
- `meal_orders.status = 'ready_for_pickup'`
- `meal_orders.logistics_type = 'warmpawz'`
- `meal_orders.logistics_partner_id IS NULL`

**Expected Response:**
```json
{
  "success": true,
  "availableOrders": [
    {
      "orderId": "3743f806-8996-4998-9246-1037a857fb2a",
      "orderNumber": "ML2602138489",
      "orderType": "meal",
      "vendorName": "Your Vendor Name",
      "totalAmount": "100.00",
      "deliveryFee": "50.00",
      "deliveryAddress": {
        "lat": 0,
        "lng": 0,
        "address": "48, Church St, Haridevpur...",
        "pincode": "560001"
      },
      "paymentMethod": "online"
    }
  ]
}
```

---

### Step 4: Delivery Partner Accepts Order

**Endpoint:** `POST /delivery/accept/:orderId`

**Request:**
```bash
POST https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/delivery/accept/3743f806-8996-4998-9246-1037a857fb2a
Content-Type: application/json

{
  "orderType": "meal",
  "partnerId": "TEST_PARTNER_ID",
  "partnerName": "Test Rider",
  "partnerPhone": "9876543210",
  "vehicleNumber": "KA-01-AB-1234"
}
```

**What Happens:**
1. Checks if order exists and is not already assigned
2. Checks if `delivery_tracking` record exists (from `notify-logistics`)
3. **If tracking exists**: Updates it with partner details
4. **If tracking doesn't exist**: Creates new tracking record
5. Generates 4-digit OTP
6. Updates `delivery_tracking`:
   - `logistics_partner_id: partnerId`
   - `delivery_person_name: partnerName`
   - `delivery_person_phone: partnerPhone`
   - `vehicle_number: vehicleNumber`
   - `status: 'heading_to_pickup'` (changed from 'assigned')
   - `delivery_otp: generated OTP`
7. Updates `meal_orders`:
   - `logistics_partner_id: partnerId`

**Response:**
```json
{
  "success": true,
  "tracking": {
    "id": "75c631ac-2762-46fa-a1d4-cc970e5ded1d",
    "status": "heading_to_pickup",
    "delivery_otp": "1234",
    ...
  },
  "deliveryOtp": "1234",
  "message": "Order accepted! Head to pickup location."
}
```

---

### Step 5: Verify Order Assignment

**Endpoint:** `GET /delivery/partner/:partnerId/orders`

**Request:**
```bash
GET https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/delivery/partner/TEST_PARTNER_ID/orders?status=active
```

**Response:**
```json
{
  "success": true,
  "orders": [
    {
      "trackingId": "75c631ac-2762-46fa-a1d4-cc970e5ded1d",
      "orderType": "meal",
      "orderNumber": "ML2602138489",
      "totalAmount": "100.00",
      "deliveryAddress": {...},
      "status": "heading_to_pickup",
      "deliveryOtp": "1234",
      "assignedAt": "2026-02-13T18:20:00.000Z"
    }
  ],
  "count": 1
}
```

---

### Step 6: Update Delivery Status (Optional)

**Endpoint:** `POST /delivery/:trackingId/update-status`

**Request:**
```bash
POST https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/delivery/75c631ac-2762-46fa-a1d4-cc970e5ded1d/update-status
Content-Type: application/json

{
  "status": "at_pickup"  // or "picked_up", "on_the_way", "nearby", "delivered"
}
```

**Valid Statuses:**
- `assigned` → `heading_to_pickup` → `at_pickup` → `picked_up` → `on_the_way` → `nearby` → `delivered`

---

## Quick Test Script

```bash
# 1. Notify logistics (already done)
# POST /meal/orders/3743f806-8996-4998-9246-1037a857fb2a/notify-logistics

# 2. Create test partner
PARTNER_ID=$(curl -X POST https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/delivery/test/create-partner \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Rider","phone":"9876543210"}' | jq -r '.partnerId')

echo "Partner ID: $PARTNER_ID"

# 3. View available orders
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/delivery/available/$PARTNER_ID?lat=12.9716&lng=77.5946"

# 4. Accept order
curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/delivery/accept/3743f806-8996-4998-9246-1037a857fb2a" \
  -H "Content-Type: application/json" \
  -d "{
    \"orderType\": \"meal\",
    \"partnerId\": \"$PARTNER_ID\",
    \"partnerName\": \"Test Rider\",
    \"partnerPhone\": \"9876543210\",
    \"vehicleNumber\": \"KA-01-AB-1234\"
  }"

# 5. View active orders
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/delivery/partner/$PARTNER_ID/orders?status=active"
```

---

## Database State After Each Step

### After Step 1 (Notify Logistics):
```sql
-- delivery_tracking
id: 75c631ac-2762-46fa-a1d4-cc970e5ded1d
meal_order_id: 3743f806-8996-4998-9246-1037a857fb2a
status: 'assigned'
logistics_partner_id: NULL
assigned_at: 2026-02-13T18:20:00Z

-- meal_orders
id: 3743f806-8996-4998-9246-1037a857fb2a
status: 'ready_for_pickup'
logistics_partner_id: NULL
```

### After Step 4 (Partner Accepts):
```sql
-- delivery_tracking
id: 75c631ac-2762-46fa-a1d4-cc970e5ded1d
meal_order_id: 3743f806-8996-4998-9246-1037a857fb2a
status: 'heading_to_pickup'  -- ✅ Updated
logistics_partner_id: TEST_PARTNER_ID  -- ✅ Updated
delivery_person_name: 'Test Rider'  -- ✅ Added
delivery_person_phone: '9876543210'  -- ✅ Added
vehicle_number: 'KA-01-AB-1234'  -- ✅ Added
delivery_otp: '1234'  -- ✅ Generated

-- meal_orders
id: 3743f806-8996-4998-9246-1037a857fb2a
status: 'ready_for_pickup'
logistics_partner_id: TEST_PARTNER_ID  -- ✅ Updated
```

---

## Troubleshooting

### Order doesn't appear in available orders?
- ✅ Check: `meal_orders.status = 'ready_for_pickup'`
- ✅ Check: `meal_orders.logistics_type = 'warmpawz'`
- ✅ Check: `meal_orders.logistics_partner_id IS NULL`

### "Order already assigned" error?
- The order already has a `logistics_partner_id` set
- Check the order status in the database

### Tracking record not found?
- The `notify-logistics` endpoint should create it
- Check if the endpoint was called successfully

---

## Next Steps

1. ✅ Test the complete flow end-to-end
2. ✅ Verify customer tracking page shows updates
3. ✅ Test status transitions (at_pickup → picked_up → on_the_way → delivered)
4. ✅ Verify OTP generation and verification
