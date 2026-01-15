# 🛒 Pet E-commerce Services - Complete Testing Plan

## Document Information
| Field | Value |
|-------|-------|
| **Document Version** | 1.0 |
| **Created Date** | January 15, 2026 |
| **Vendor Type** | Pet Products Seller / E-commerce Store |
| **Test Customer** | Rahul Gupta (Pet: Charlie - Pomeranian) |
| **Estimated Testing Time** | 4-5 hours |

---

## 📋 TABLE OF CONTENTS
1. [Test Environment Setup](#1-test-environment-setup)
2. [Test Credentials](#2-test-credentials)
3. [Phase 1: Vendor Onboarding](#phase-1-vendor-onboarding)
4. [Phase 2: Product Catalog Setup](#phase-2-product-catalog-setup)
5. [Phase 3: Customer Shopping Journey](#phase-3-customer-shopping-journey)
6. [Phase 4: Order Processing & Fulfillment](#phase-4-order-processing--fulfillment)
7. [Phase 5: Returns & Customer Service](#phase-5-returns--customer-service)
8. [Phase 6: Analytics & Growth](#phase-6-analytics--growth)
9. [Edge Cases](#edge-cases)
10. [Troubleshooting Guide](#troubleshooting-guide)

---

## 1. Test Environment Setup

### 1.1 URLs
| Application | URL |
|-------------|-----|
| Vendor Web App | `https://vendor.warmpawz.com` |
| Customer Web App | `https://app.warmpawz.com` |

---

## 2. Test Credentials

### 2.1 Vendor Credentials (Seller)
```
📧 Email: pawsome.store@testmail.com
🔑 Password: Test@Store2026!
📱 Phone: +91 98765 89012
```

### 2.2 Customer Credentials
```
📧 Email: rahul.gupta.pet@testmail.com
🔑 Password: Test@Customer2026!
📱 Phone: +91 87654 98765
```

---

## PHASE 1: VENDOR ONBOARDING

### Step 1.1: Registration

**Action:**
1. Go to `https://vendor.warmpawz.com`
2. Select **"E-commerce / Pet Store"** vendor type

---

### Step 1.2: Enter Business Information

| Field | Value |
|-------|-------|
| Store Name | Pawsome Pet Supplies |
| Owner Name | Vikash Agarwal |
| Email | pawsome.store@testmail.com |
| Phone | +91 98765 89012 |
| Password | Test@Store2026! |

**Business Type:**
- [x] Online Only
- [ ] Physical Store + Online
- [ ] Manufacturer/Brand

---

### Step 1.3: Warehouse/Pickup Address

| Field | Value |
|-------|-------|
| Address | Warehouse 5, Industrial Estate |
| Area | Whitefield |
| City | Bangalore |
| State | Karnataka |
| Pincode | 560066 |
| Contact | Warehouse Manager: +91 98765 00000 |

---

### Step 1.4: Upload Documents

| Document | Description |
|----------|-------------|
| Business Registration | Incorporation certificate |
| GST Certificate | For invoicing |
| PAN Card | Business PAN |
| FSSAI License | If selling pet food |
| Brand Authorization | For branded products |
| Bank Statement | For verification |

---

### Step 1.5: Product Categories Selection

**What will you sell:**
- [x] Pet Food (Dry & Wet)
- [x] Treats & Chews
- [x] Toys
- [x] Beds & Furniture
- [x] Collars & Leashes
- [x] Grooming Supplies
- [x] Health & Wellness
- [x] Clothing & Accessories
- [x] Bowls & Feeders
- [x] Travel & Carriers
- [x] Training Supplies

---

### Step 1.6: Shipping Configuration

| Setting | Value |
|---------|-------|
| Shipping Partner | Self + Third-party |
| Free Shipping Above | ₹999 |
| Standard Shipping | ₹70 |
| Express Shipping | ₹150 |
| Same-Day Delivery | ₹200 (select cities) |
| Shipping Zones | Pan-India |
| Processing Time | 1-2 days |

---

### Step 1.7: Return Policy

| Policy | Value |
|--------|-------|
| Return Window | 7 days |
| Refund Method | Original payment method |
| Return Shipping | Free for defective items |
| Non-Returnable Items | Food (opened), Customized items |
| Exchange Available | Yes |

---

### Step 1.8: Bank Details & Submit

| Field | Value |
|-------|-------|
| Bank | Axis Bank |
| Account | 920010012345678 |
| IFSC | UTIB0001234 |

Submit for approval.

---

## PHASE 2: PRODUCT CATALOG SETUP

### Step 2.1: Login After Approval

**Dashboard Features:**
- 📊 Dashboard (Sales overview)
- 📦 Products
- 🛒 Orders
- 📈 Analytics
- 💰 Payments
- ⚙️ Settings

---

### Step 2.2: Add Product Categories

**Create Store Categories:**
| Category | Subcategories |
|----------|---------------|
| Dog Food | Dry Food, Wet Food, Treats |
| Cat Food | Dry Food, Wet Food, Treats |
| Toys | Chew Toys, Interactive, Plush |
| Accessories | Collars, Leashes, Harnesses |
| Beds | Beds, Blankets, Mats |
| Grooming | Shampoos, Brushes, Nail Care |
| Clothing | Sweaters, Raincoats, Costumes |
| Travel | Carriers, Car Accessories |

---

### Step 2.3: Add Products

**Sample Product 1 - Dog Food:**

| Field | Value |
|-------|-------|
| Product Name | Royal Canin Medium Adult Dry Dog Food |
| Category | Dog Food > Dry Food |
| Brand | Royal Canin |
| SKU | RC-MED-ADULT-4KG |
| Price | ₹3,200 |
| MRP | ₹3,500 |
| Discount | 9% off |
| Stock | 50 units |

**Variants:**
| Size | Price | Stock |
|------|-------|-------|
| 4 kg | ₹3,200 | 50 |
| 10 kg | ₹6,800 | 25 |
| 15 kg | ₹9,500 | 15 |

**Product Details:**
| Field | Value |
|-------|-------|
| Description | Complete nutrition for medium breed adult dogs (11-25 kg) |
| Key Features | - Supports bone & joint health<br>- Highly digestible proteins<br>- Omega fatty acids for coat |
| Suitable For | Medium breed dogs, 1-7 years |
| Ingredients | [List ingredients] |
| Feeding Guide | [Table based on weight] |

**Images:**
- Main image (product pack)
- Back label
- Feeding chart
- Lifestyle image (dog eating)

---

**Sample Product 2 - Toy:**

| Field | Value |
|-------|-------|
| Product Name | KONG Classic Dog Toy - Medium |
| Category | Toys > Chew Toys |
| Brand | KONG |
| SKU | KONG-CLS-MED |
| Price | ₹850 |
| MRP | ₹950 |
| Stock | 75 units |

**Variants:**
| Size | For Dogs | Price |
|------|----------|-------|
| Small | 0-10 kg | ₹650 |
| Medium | 10-25 kg | ₹850 |
| Large | 25-40 kg | ₹1,050 |
| X-Large | 40+ kg | ₹1,250 |

---

**Sample Product 3 - Accessory:**

| Field | Value |
|-------|-------|
| Product Name | Premium Leather Dog Collar |
| Category | Accessories > Collars |
| Brand | Pawsome Originals |
| SKU | PSO-COL-LEA-001 |
| Price | ₹1,200 |
| Colors | Brown, Black, Tan |
| Sizes | S, M, L, XL |
| Material | Genuine Leather |

---

### Step 2.4: Set Up Promotions

**Create Promotion:**
| Field | Value |
|-------|-------|
| Promo Name | New Year Pet Sale |
| Discount | 15% off |
| Category | All Products |
| Start Date | Jan 15, 2026 |
| End Date | Jan 31, 2026 |
| Coupon Code | NEWYEAR15 |
| Min Order | ₹500 |
| Max Discount | ₹500 |

---

### Step 2.5: Configure Inventory Alerts

| Alert | Threshold |
|-------|-----------|
| Low Stock | < 10 units |
| Out of Stock | 0 units |
| Reorder Point | 15 units |

---

## PHASE 3: CUSTOMER SHOPPING JOURNEY

> **Switch to Customer Browser**

### Step 3.1: Customer Login

Login: `rahul.gupta.pet@testmail.com` / `Test@Customer2026!`

---

### Step 3.2: Add Pet Profile

| Field | Value |
|-------|-------|
| Pet Name | Charlie |
| Pet Type | Dog |
| Breed | Pomeranian |
| Age | 2 years |
| Weight | 3.5 kg |
| Gender | Male |
| Size | Small |

---

### Step 3.3: Browse Shop

**Action:**
1. Click "Shop" from main menu
2. See featured products, categories

**Shop Homepage Shows:**
- Banner: "New Year Pet Sale - 15% Off!"
- Featured Products
- Popular Categories
- New Arrivals
- Deals of the Day

---

### Step 3.4: Search & Filter Products

**Action:**
1. Search: "Small dog toys"
2. Apply filters:
   - Pet Size: Small
   - Price: ₹500 - ₹1,000
   - Rating: 4+ stars
   - Brand: KONG

**Results Show:**
- KONG Classic - Small (₹650)
- KONG Puppy Toy (₹600)
- [Other products...]

---

### Step 3.5: View Product Details

**Click on "KONG Classic Dog Toy - Small"**

**Product Page Shows:**
- Product images (zoomable)
- Name, brand, rating
- Price: ₹650 (MRP ₹750 - 13% off)
- Size selector: S, M, L, XL
- Quantity selector
- "Add to Cart" button
- "Buy Now" button
- Delivery estimate
- Return policy
- Reviews

**Delivery Check:**
1. Enter pincode: 560001
2. Result: "Delivery by [Date] - FREE"

---

### Step 3.6: Add to Cart

**Action:**
1. Select Size: Small
2. Quantity: 1
3. Click "Add to Cart"
4. Success message: "Added to cart!"
5. Cart icon shows: 1 item

---

### Step 3.7: Continue Shopping

**Add More Items:**
| Product | Qty | Price |
|---------|-----|-------|
| KONG Classic Small | 1 | ₹650 |
| Premium Leather Collar (S, Brown) | 1 | ₹1,200 |
| Chicken Jerky Treats 100g | 2 | ₹200 x 2 = ₹400 |
| Squeaky Plush Toy | 1 | ₹350 |

---

### Step 3.8: View Cart

**Cart Page:**
```
🛒 Your Cart (5 items)

┌─────────────────────────────────────────┐
│ KONG Classic Dog Toy - Small            │
│ Size: Small | Qty: 1                    │
│ ₹650  [- 1 +]  [Remove]                │
├─────────────────────────────────────────┤
│ Premium Leather Collar                  │
│ Size: S, Color: Brown | Qty: 1          │
│ ₹1,200  [- 1 +]  [Remove]              │
├─────────────────────────────────────────┤
│ Chicken Jerky Treats 100g               │
│ Qty: 2                                  │
│ ₹400 (₹200 x 2)  [- 2 +]  [Remove]     │
├─────────────────────────────────────────┤
│ Squeaky Plush Toy                       │
│ Qty: 1                                  │
│ ₹350  [- 1 +]  [Remove]                │
└─────────────────────────────────────────┘

Subtotal:         ₹2,600
Shipping:         FREE (above ₹999)
                  ─────────
Total:            ₹2,600

[Apply Coupon] [Proceed to Checkout]
```

---

### Step 3.9: Apply Coupon

**Action:**
1. Click "Apply Coupon"
2. Enter: NEWYEAR15
3. Click "Apply"

**Result:**
```
✅ Coupon Applied!
NEWYEAR15 - 15% off (Max ₹500)

Subtotal:         ₹2,600
Discount:         -₹390 (15%)
Shipping:         FREE
                  ─────────
Total:            ₹2,210

You saved ₹390!
```

---

### Step 3.10: Checkout

**Action:**
1. Click "Proceed to Checkout"
2. Confirm delivery address:

| Field | Value |
|-------|-------|
| Name | Rahul Gupta |
| Phone | +91 87654 98765 |
| Address | 42, Palm Grove Apartments |
| Area | Koramangala |
| City | Bangalore |
| Pincode | 560095 |
| Type | Home |

3. Delivery slot: Standard (2-4 days)

---

### Step 3.11: Select Payment Method

**Payment Options:**
- Credit/Debit Card
- UPI
- Net Banking
- EMI (for orders above ₹3,000)
- Wallets
- Cash on Delivery (+₹50)

**Select:** UPI

**Pay:**
1. Enter UPI ID or scan QR
2. Complete payment

**Order Confirmed:**
```
✅ Order Placed Successfully!

Order ID: WP-ORD-2026011545678
Total Paid: ₹2,210

Items: 5 products
Delivery: [Date] (2-4 days)

[Track Order] [View Order Details]
```

---

## PHASE 4: ORDER PROCESSING & FULFILLMENT

### Step 4.1: Vendor Receives Order

> **Switch to Vendor Browser**

**Notification:**
```
🔔 New Order Received!

Order ID: WP-ORD-2026011545678
Customer: Rahul Gupta
Items: 5 products
Total: ₹2,210

[View Order]
```

---

### Step 4.2: View Order Details

**Order Page:**
```
📦 Order #WP-ORD-2026011545678

Customer: Rahul Gupta
Phone: +91 87654 98765

Delivery Address:
42, Palm Grove Apartments
Koramangala, Bangalore - 560095

Items:
├── KONG Classic Small x1       ₹650
├── Leather Collar S/Brown x1   ₹1,200
├── Chicken Jerky x2            ₹400
├── Squeaky Plush Toy x1        ₹350
├── ─────────────────────────────
├── Subtotal                    ₹2,600
├── Discount (NEWYEAR15)        -₹390
├── Shipping                    FREE
└── Total                       ₹2,210

Payment: Paid (UPI)

Status: [New] → [Processing] → [Packed] → [Shipped] → [Delivered]

[Process Order]
```

---

### Step 4.3: Process Order

**Action:**
1. Click "Process Order"
2. System checks inventory (auto)
3. Pick list generated

**Pick List:**
```
📋 Pick List - Order #WP-ORD-2026011545678

Location: Rack A3  | KONG Classic Small    | 1 pc  | □
Location: Rack B2  | Leather Collar S/Brn  | 1 pc  | □
Location: Rack C1  | Chicken Jerky 100g    | 2 pcs | □
Location: Rack A1  | Squeaky Plush Toy     | 1 pc  | □

[Mark Picked] [Print Pick List]
```

4. Pick items and check boxes
5. Click "Mark Picked"

---

### Step 4.4: Pack Order

**Action:**
1. Status changes to "Packing"
2. Pack items securely
3. Generate shipping label:

**Shipping Label:**
```
┌─────────────────────────────────────────┐
│ WARMPAWZ - Pawsome Pet Supplies         │
│                                         │
│ TO:                                     │
│ RAHUL GUPTA                             │
│ 42, Palm Grove Apartments               │
│ Koramangala, Bangalore                  │
│ Karnataka - 560095                      │
│ Ph: +91 87654 98765                     │
│                                         │
│ Order: WP-ORD-2026011545678             │
│ Items: 5 | Weight: 1.2 kg               │
│                                         │
│ [BARCODE]                               │
│ AWB: SHIP123456789                      │
└─────────────────────────────────────────┘
```

4. Print label
5. Attach to package
6. Click "Mark Packed"

---

### Step 4.5: Ship Order

**Action:**
1. Click "Ship Order"
2. Select shipping partner: Delhivery
3. Enter AWB: SHIP123456789
4. Schedule pickup or drop at hub

**Customer Notified:**
```
📦 Order Shipped!

Your order is on its way!

Order: WP-ORD-2026011545678
Tracking: SHIP123456789
Carrier: Delhivery

Estimated Delivery: [Date]

[Track Shipment]
```

---

### Step 4.6: Customer Tracks Order

> **Customer Side**

**Tracking Page:**
```
📍 Track Your Order

Order: WP-ORD-2026011545678
Status: In Transit

Timeline:
├── ✅ Order Placed - [Date, Time]
├── ✅ Order Confirmed - [Date, Time]
├── ✅ Packed - [Date, Time]
├── ✅ Shipped - [Date, Time]
│   └── AWB: SHIP123456789
├── ✅ In Transit - Bangalore Hub
├── ⏳ Out for Delivery
└── ⏳ Delivered

Expected: [Date]
```

---

### Step 4.7: Order Delivered

**Action:**
1. Delivery person delivers package
2. Customer signs/provides OTP
3. Carrier marks as delivered
4. System updates order status

**Customer Receives:**
```
✅ Order Delivered!

Your order has been delivered.

Please confirm you received all items:
├── KONG Classic Small ✓
├── Leather Collar ✓
├── Chicken Jerky x2 ✓
├── Squeaky Plush Toy ✓

[Confirm Receipt] [Report Issue]

[Rate & Review Products]
```

---

## PHASE 5: RETURNS & CUSTOMER SERVICE

### Step 5.1: Customer Wants to Return Item

**Scenario:** Collar size doesn't fit

**Action:**
1. Customer goes to "My Orders"
2. Finds order, clicks "Return Items"
3. Selects: "Premium Leather Collar"
4. Reason: "Size doesn't fit"
5. Request: Exchange for Medium size

**Return Request Form:**
| Field | Value |
|-------|-------|
| Item | Premium Leather Collar - S |
| Reason | Wrong size/Doesn't fit |
| Action | Exchange |
| Exchange For | Medium size |
| Pickup Preference | [Date, Time slot] |
| Comments | Charlie has grown, need medium |

6. Submit return request

---

### Step 5.2: Vendor Receives Return Request

> **Vendor Side**

**Notification:**
```
🔄 Return/Exchange Request

Order: WP-ORD-2026011545678
Item: Premium Leather Collar - S/Brown
Request: Exchange for Medium

Reason: Size doesn't fit
Days since delivery: 2 (within 7-day window)

[Approve] [Reject] [Contact Customer]
```

---

### Step 5.3: Approve Return

**Action:**
1. Click "Approve"
2. Schedule pickup
3. Prepare exchange item (Medium collar)

**Customer Notified:**
```
✅ Return Approved!

Your return request has been approved.

Pickup scheduled: [Date], 10 AM - 1 PM
Please keep the item packed and ready.

Exchange item (Leather Collar - Medium) 
will be delivered within 2-3 days after pickup.

[Track Return]
```

---

### Step 5.4: Complete Exchange

**Process:**
1. Pickup person collects Small collar
2. Vendor ships Medium collar
3. Customer receives Medium collar
4. Exchange complete

---

### Step 5.5: Refund Scenario

**Scenario:** Customer wants refund instead

**Process:**
1. Request refund instead of exchange
2. Vendor approves
3. Item picked up
4. Refund processed (₹1,200)
5. Refund to original payment method (3-5 days)

**Customer Sees:**
```
💰 Refund Processed!

Amount: ₹1,200
Method: UPI (original payment)
Expected: 3-5 business days

Refund ID: REF-123456
```

---

### Step 5.6: Customer Reviews Products

**Action:**
1. Customer clicks "Review Products"
2. Reviews each product:

**KONG Classic Toy:**
| Field | Value |
|-------|-------|
| Rating | ⭐⭐⭐⭐⭐ |
| Title | Charlie loves it! |
| Review | "Perfect size for my Pomeranian. Very durable, Charlie has been chewing on it for days. Great quality!" |
| Add Photos | [Photo of Charlie with toy] |

---

## PHASE 6: ANALYTICS & GROWTH

### Step 6.1: Vendor Views Dashboard

**Sales Dashboard:**
```
📊 Store Performance

Today: ₹12,500 (8 orders)
This Week: ₹68,000 (45 orders)
This Month: ₹2,85,000 (180 orders)

Top Products:
1. Royal Canin Medium 4kg - 25 units
2. KONG Classic - 20 units
3. Chicken Jerky - 35 units

Avg Order Value: ₹1,580
Conversion Rate: 3.2%
Return Rate: 2.1%
```

---

### Step 6.2: Inventory Management

**Low Stock Alerts:**
```
⚠️ Low Stock Items

├── Royal Canin Medium 4kg - 8 left
├── KONG Classic Large - 5 left
├── Chicken Jerky 200g - 7 left

[Reorder] [View All]
```

---

### Step 6.3: Customer Analytics

**Customer Insights:**
- New vs Returning: 60% / 40%
- Top Customer Locations: Bangalore, Mumbai, Delhi
- Popular Pet Types: Dogs (70%), Cats (25%), Others (5%)
- Peak Order Times: 8-10 PM

---

## EDGE CASES

### Edge Case 1: Product Out of Stock After Order

**Scenario:** Item goes OOS after customer orders

**Steps:**
1. System flags order
2. Vendor notified immediately
3. Options:
   - Wait for restock (customer informed)
   - Partial shipment
   - Cancel item and refund
4. Customer chooses preference

---

### Edge Case 2: Wrong Product Delivered

**Scenario:** Customer receives different item

**Steps:**
1. Customer reports: "Wrong item"
2. Photos required
3. Correct item shipped immediately
4. Wrong item pickup scheduled
5. Vendor investigates warehouse error

---

### Edge Case 3: Damaged Product Received

**Scenario:** Product damaged during shipping

**Steps:**
1. Customer reports with photos
2. Immediate replacement authorized
3. No pickup needed for low-value items
4. Insurance claim filed if applicable

---

### Edge Case 4: Address Delivery Failed

**Scenario:** Customer not available, multiple attempts failed

**Steps:**
1. 3 delivery attempts made
2. Customer notified each time
3. If all fail: Return to seller
4. Refund processed minus shipping

---

### Edge Case 5: COD Order - Customer Refuses

**Scenario:** Customer refuses to pay at delivery

**Steps:**
1. Order returned to seller
2. Customer notified
3. COD privilege may be revoked
4. Pattern monitored for abuse

---

### Edge Case 6: Partial Order Cancellation

**Scenario:** Customer wants to remove one item after order

**Steps:**
1. If not shipped: Item removed, refund processed
2. If shipped: Full delivery, then return
3. Partial cancel fee may apply

---

### Edge Case 7: Duplicate Order

**Scenario:** Customer places same order twice by mistake

**Steps:**
1. System may flag potential duplicate
2. Customer contacted before shipping
3. One order cancelled if confirmed duplicate

---

### Edge Case 8: Promotional Abuse

**Scenario:** Customer creates multiple accounts for coupons

**Steps:**
1. System detects (same address/phone/device)
2. Orders flagged
3. Accounts may be blocked
4. Coupons invalidated

---

### Edge Case 9: International Shipping Request

**Scenario:** Customer requests shipping outside India

**Steps:**
1. Currently not supported
2. Message: "We currently ship within India only"
3. Collect interest for future expansion

---

### Edge Case 10: Bulk Order

**Scenario:** Business customer wants 100 units

**Steps:**
1. Contact vendor directly option
2. Special pricing negotiation
3. Separate invoice and shipping
4. Bulk discount applied

---

## TROUBLESHOOTING GUIDE

### Problem: Cart Not Updating

**Solutions:**
1. Refresh page
2. Clear browser cache
3. Log out and log in again
4. Check internet connection

---

### Problem: Payment Failed

**Solutions:**
1. Try different payment method
2. Check card/bank limits
3. Ensure 3D Secure completion
4. Contact bank if repeated failures

---

### Problem: Tracking Not Updating

**Solutions:**
1. Allow 12-24 hours for first scan
2. Check carrier website directly
3. Contact seller if 48+ hours no update

---

## TEST COMPLETION CHECKLIST

### Vendor Onboarding
- [ ] Seller registration complete
- [ ] Product catalog created (10+ products)
- [ ] Variants configured
- [ ] Shipping settings done
- [ ] Approved and live

### Customer Shopping
- [ ] Product search and filter
- [ ] Product details viewed
- [ ] Add to cart working
- [ ] Apply coupon working
- [ ] Checkout complete
- [ ] Payment successful

### Order Fulfillment
- [ ] Vendor received order
- [ ] Order processed
- [ ] Pick and pack completed
- [ ] Shipping label generated
- [ ] Order shipped
- [ ] Tracking working
- [ ] Delivery confirmed

### Returns & Refunds
- [ ] Return request submitted
- [ ] Return approved
- [ ] Exchange processed
- [ ] Refund processed
- [ ] Review submitted

### Analytics
- [ ] Sales dashboard accurate
- [ ] Low stock alerts working
- [ ] Customer analytics visible

---

## NOTES & OBSERVATIONS

| Date | Test Case | Issue Found | Severity | Notes |
|------|-----------|-------------|----------|-------|
| | | | | |

---

**End of E-commerce Testing Plan**

---

*Document prepared for WarmPawz Functional Testing Team*
