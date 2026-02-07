# Pharmacy Order Flow - Uber-like Prescription Delivery

## Overview

This document outlines the complete pharmacy order flow, from prescription creation by vet to medicine delivery to customer.

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PHARMACY ORDER FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. VET CONSULTATION                                                         │
│     ├── Customer books vet consultation (tele/home/clinic)                  │
│     ├── Vet examines pet and creates prescription                           │
│     └── Prescription saved to customer's medical records                     │
│                                                                              │
│  2. PRESCRIPTION TO ORDER                                                    │
│     ├── Customer views prescription in app                                   │
│     ├── Clicks "Order Medicine" button                                       │
│     └── Prescription attached to order request                               │
│                                                                              │
│  3. NEARBY PHARMACY BROADCAST (Uber-like)                                   │
│     ├── System finds pharmacies within 20km radius                          │
│     ├── Order broadcast sent to all matching pharmacies                     │
│     ├── Push notification: "New prescription order nearby"                   │
│     └── Order appears in pharmacy dashboard "Incoming Orders"               │
│                                                                              │
│  4. PHARMACY ACCEPTANCE                                                      │
│     ├── Pharmacy reviews prescription                                        │
│     ├── Checks medicine availability                                         │
│     ├── Options: Accept / Reject / Partial (some items unavailable)        │
│     └── If accepted → Customer notified "Pharmacy confirmed"               │
│                                                                              │
│  5. INVOICE GENERATION                                                       │
│     ├── Customer sees: "Calculating your invoice..."                        │
│     ├── Pharmacy generates proforma invoice                                  │
│     │   ├── Medicine prices                                                  │
│     │   ├── Delivery fee (based on distance)                                │
│     │   └── Taxes                                                            │
│     └── Invoice sent to customer for approval                               │
│                                                                              │
│  6. PAYMENT OPTIONS                                                          │
│     ├── Customer reviews invoice                                             │
│     ├── Payment options:                                                     │
│     │   ├── Pay Now (Razorpay - UPI/Card/Netbanking)                        │
│     │   └── Cash on Delivery (COD)                                          │
│     └── Customer confirms payment method                                     │
│                                                                              │
│  7. DELIVERY DISPATCH                                                        │
│     ├── If COD → Order dispatched immediately                               │
│     ├── If Online → Order dispatched after payment success                  │
│     ├── Delivery partner assigned (Dunzo/Porter/Own fleet)                  │
│     └── ETA calculated based on distance + traffic                          │
│                                                                              │
│  8. REAL-TIME TRACKING                                                       │
│     ├── Customer sees live delivery map                                      │
│     ├── Status updates:                                                      │
│     │   ├── "Pharmacy is preparing your order"                              │
│     │   ├── "Order picked up by delivery partner"                           │
│     │   ├── "Delivery partner is on the way"                                │
│     │   └── "Arriving in X minutes"                                         │
│     └── Notifications at each stage                                         │
│                                                                              │
│  9. DELIVERY COMPLETION                                                      │
│     ├── Delivery partner arrives                                             │
│     ├── If COD → Collect payment                                            │
│     ├── Customer receives medicines                                          │
│     ├── OTP verification for delivery                                        │
│     └── Order marked complete                                                │
│                                                                              │
│  10. SETTLEMENT                                                              │
│      ├── Pharmacy earnings calculated                                        │
│      ├── Platform commission deducted                                        │
│      ├── Delivery partner fee deducted                                       │
│      └── Net amount added to pharmacy settlement                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Pharmacy Dashboard Components

### 1. Incoming Orders Panel
```
┌─────────────────────────────────────────────────────────────────┐
│ 🔔 INCOMING ORDERS (3 new)                                      │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📋 Order #PH-2026-001                    ⏱️ Expires in 2min │ │
│ │ Distance: 3.2 km | Customer: Rahul S.                      │ │
│ │ Prescription: Dr. Priya Sharma (ABC Vet Clinic)            │ │
│ │                                                             │ │
│ │ Items:                                                      │ │
│ │ • Amoxicillin 500mg (10 tablets)                           │ │
│ │ • Metronidazole 200mg (14 tablets)                         │ │
│ │ • Probiotics for dogs (1 bottle)                           │ │
│ │                                                             │ │
│ │ [👁️ View Rx] [✅ Accept] [❌ Reject] [⚠️ Partial]          │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Availability Check Modal
```
┌─────────────────────────────────────────────────────────────────┐
│ ✅ CONFIRM AVAILABILITY                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ □ ✅ Amoxicillin 500mg (10 tablets)     Stock: 50    Price: ₹120│
│ □ ✅ Metronidazole 200mg (14 tablets)   Stock: 30    Price: ₹85 │
│ □ ❌ Probiotics for dogs (1 bottle)     OUT OF STOCK            │
│                                                                  │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ 💡 Suggest alternative for unavailable items?              │   │
│ │ [Probiotic Alternative - Brand X] ₹180                     │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│     [Cancel]  [Accept with Alternatives]  [Accept Partial]      │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Invoice Generation
```
┌─────────────────────────────────────────────────────────────────┐
│ 🧾 GENERATE INVOICE - Order #PH-2026-001                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ITEMS                                           PRICE            │
│ ─────────────────────────────────────────────────────────────── │
│ Amoxicillin 500mg x 10                          ₹120.00         │
│ Metronidazole 200mg x 14                        ₹85.00          │
│ Probiotic Alternative - Brand X                 ₹180.00         │
│                                                  ─────────       │
│ Subtotal                                         ₹385.00        │
│ GST (5%)                                         ₹19.25         │
│ Delivery Fee (3.2 km)                            ₹40.00         │
│                                                  ═════════       │
│ TOTAL                                            ₹444.25        │
│                                                                  │
│ Estimated Delivery: 35-45 minutes                               │
│                                                                  │
│              [📤 Send Invoice to Customer]                       │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Order Tracking Dashboard
```
┌─────────────────────────────────────────────────────────────────┐
│ 📦 ACTIVE ORDERS                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ #PH-2026-001 | Rahul S. | 3.2 km                                │
│ Status: 🚴 Out for Delivery | ETA: 12 min                       │
│ Delivery: Dunzo - Suresh K. | 📞 +91 98765xxxxx                 │
│ [View Map] [Call Customer] [Call Delivery]                      │
│                                                                  │
│ ─────────────────────────────────────────────────────────────── │
│                                                                  │
│ #PH-2026-002 | Priya M. | 5.8 km                                │
│ Status: 📦 Preparing | Pickup in 5 min                          │
│ [Mark Ready for Pickup]                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Customer App Components

### 1. Prescription Card with Order Button
```
┌─────────────────────────────────────────────────────────────────┐
│ 📋 PRESCRIPTION                                                  │
│ Dr. Priya Sharma | ABC Vet Clinic                               │
│ Date: 15 Jan 2026                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ For: Bruno (Golden Retriever, 4 years)                          │
│ Diagnosis: Bacterial Infection                                   │
│                                                                  │
│ Medications:                                                     │
│ 1. Amoxicillin 500mg - 1 tablet twice daily for 5 days         │
│ 2. Metronidazole 200mg - 1 tablet twice daily for 7 days       │
│ 3. Probiotics - 1 scoop daily with food                         │
│                                                                  │
│ [📥 Download PDF]     [🛒 Order Medicine]                        │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Finding Pharmacy Screen
```
┌─────────────────────────────────────────────────────────────────┐
│                    🔍 Finding Nearby Pharmacies                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                         ⏳                                       │
│                   [Animated Loader]                              │
│                                                                  │
│         Searching pharmacies within 20 km...                    │
│                                                                  │
│         Found 5 pharmacies                                       │
│         Sending your prescription...                             │
│                                                                  │
│         ────────────────────────────────                        │
│         🏪 PetMeds Pharmacy (2.1 km) - Checking...              │
│         🏪 Healthy Paws (3.5 km) - Checking...                  │
│         🏪 VetCare Pharmacy (5.2 km) - Checking...              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Pharmacy Confirmed
```
┌─────────────────────────────────────────────────────────────────┐
│                    ✅ Pharmacy Confirmed!                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│         🏪 PetMeds Pharmacy                                      │
│         ⭐ 4.8 (234 orders)                                      │
│         📍 2.1 km away                                           │
│                                                                  │
│         ─────────────────────────────────                       │
│                                                                  │
│         🧾 Calculating your invoice...                           │
│         [Loading animation]                                      │
│                                                                  │
│         This usually takes 1-2 minutes                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Invoice & Payment Screen
```
┌─────────────────────────────────────────────────────────────────┐
│ 🧾 YOUR ORDER INVOICE                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ PetMeds Pharmacy                                                 │
│ Order #PH-2026-001                                               │
│                                                                  │
│ ─────────────────────────────────────────────────────────────── │
│ Amoxicillin 500mg x 10                          ₹120.00         │
│ Metronidazole 200mg x 14                        ₹85.00          │
│ Probiotics                                      ₹180.00         │
│ ─────────────────────────────────────────────────────────────── │
│ Subtotal                                        ₹385.00         │
│ GST (5%)                                        ₹19.25          │
│ Delivery (2.1 km)                               ₹35.00          │
│ ═══════════════════════════════════════════════════════════════ │
│ TOTAL                                           ₹439.25         │
│                                                                  │
│ 🚴 Estimated Delivery: 30-40 minutes                            │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Choose Payment Method                                        │ │
│ │                                                              │ │
│ │ ○ 💳 Pay Now (UPI/Card/Netbanking)                          │ │
│ │ ○ 💵 Cash on Delivery                                        │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│              [Confirm & Place Order]                             │
└─────────────────────────────────────────────────────────────────┘
```

### 5. Live Tracking Screen
```
┌─────────────────────────────────────────────────────────────────┐
│ 📍 TRACK YOUR ORDER                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                                                              │ │
│ │                    [LIVE MAP]                                │ │
│ │        🏪 ─────────── 🚴 ─────────── 🏠                      │ │
│ │      Pharmacy       Delivery        Your Home               │ │
│ │                                                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ 🚴 Delivery Partner: Suresh K.                                  │
│ 📞 +91 98765xxxxx                                               │
│                                                                  │
│ ⏱️ Arriving in 8 minutes                                        │
│                                                                  │
│ ─────────────────────────────────────────────────────────────── │
│ ✅ Order Placed                           10:30 AM              │
│ ✅ Pharmacy Confirmed                     10:32 AM              │
│ ✅ Order Prepared                         10:45 AM              │
│ ✅ Picked Up                              10:50 AM              │
│ 🔄 On the Way                             Now                   │
│ ○ Delivered                               Est. 11:00 AM         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## API Endpoints Required

### Pharmacy Order Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/pharmacy/orders/broadcast` | POST | Broadcast order to nearby pharmacies |
| `/pharmacy/orders/accept` | POST | Pharmacy accepts order |
| `/pharmacy/orders/reject` | POST | Pharmacy rejects order |
| `/pharmacy/orders/:id/availability` | POST | Confirm item availability |
| `/pharmacy/orders/:id/invoice` | POST | Generate invoice |
| `/pharmacy/orders/:id/dispatch` | POST | Dispatch for delivery |
| `/pharmacy/orders/:id/track` | GET | Get real-time tracking |

### Customer Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/customer/prescriptions/:id/order` | POST | Create order from prescription |
| `/customer/orders/:id/payment` | POST | Process payment |
| `/customer/orders/:id/track` | GET | Track order |

### Delivery Partner Integration

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/delivery/estimate` | POST | Get ETA and delivery fee |
| `/delivery/book` | POST | Book delivery partner |
| `/delivery/track/:id` | GET | Track delivery |

## Database Schema Updates

### orders table additions
```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS prescription_id UUID REFERENCES prescriptions(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pharmacy_response_deadline TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_data JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_partner VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_partner_id VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_eta TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_otp VARCHAR(6);
```

### pharmacy_order_broadcasts table (new)
```sql
CREATE TABLE pharmacy_order_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  pharmacy_id UUID REFERENCES vendors(id),
  status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected, expired
  broadcast_time TIMESTAMP DEFAULT NOW(),
  response_time TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Configuration (Admin Panel)

### Pharmacy Settings
- **Service Radius**: 5km - 50km (configurable per pharmacy)
- **Order Timeout**: 2-10 minutes (time to respond to broadcast)
- **Max Concurrent Orders**: 1-50

### Delivery Settings
- **Delivery Partners**: Dunzo, Porter, Own Fleet
- **Base Delivery Fee**: ₹30-50
- **Per KM Rate**: ₹8-15
- **Free Delivery Above**: ₹500-1000

### Payment Settings
- **COD Enabled**: Yes/No
- **Online Payment Only Above**: ₹1000
- **Platform Commission**: 5-15%

## Implementation Priority

1. **Phase 1: Core Flow** (Week 1-2)
   - Order broadcast to pharmacies
   - Accept/Reject workflow
   - Basic invoice generation

2. **Phase 2: Payment & Delivery** (Week 3-4)
   - Razorpay integration
   - COD flow
   - Delivery partner integration

3. **Phase 3: Real-time Tracking** (Week 5-6)
   - Live map tracking
   - Push notifications
   - ETA updates

4. **Phase 4: Polish** (Week 7-8)
   - UI refinements
   - Error handling
   - Analytics
