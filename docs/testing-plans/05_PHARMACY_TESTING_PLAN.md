# 💊 Pet Pharmacy Services - Complete Testing Plan

## Document Information
| Field | Value |
|-------|-------|
| **Document Version** | 1.0 |
| **Created Date** | January 15, 2026 |
| **Vendor Type** | Pet Pharmacy / Veterinary Pharmacy |
| **Test Customer** | Arun Krishnan (Pet: Buddy - Beagle) |
| **Estimated Testing Time** | 4-5 hours |

---

## 📋 TABLE OF CONTENTS
1. [Test Environment Setup](#1-test-environment-setup)
2. [Test Credentials](#2-test-credentials)
3. [Phase 1: Vendor Onboarding](#phase-1-vendor-onboarding)
4. [Phase 2: Inventory & Catalog Setup](#phase-2-inventory--catalog-setup)
5. [Phase 3: Customer Order Journey](#phase-3-customer-order-journey)
6. [Phase 4: Prescription Processing](#phase-4-prescription-processing)
7. [Phase 5: Order Fulfillment & Delivery](#phase-5-order-fulfillment--delivery)
8. [Phase 6: Post-Delivery & Refills](#phase-6-post-delivery--refills)
9. [Edge Cases](#edge-cases)
10. [Troubleshooting Guide](#troubleshooting-guide)

---

## 1. Test Environment Setup

### 1.1 URLs
| Application | URL |
|-------------|-----|
| Vendor Web App | `https://vendor.warmpawz.com` |
| Customer Web App | `https://app.warmpawz.com` |
| Admin Panel | `https://admin.warmpawz.com` |

---

## 2. Test Credentials

### 2.1 Vendor Credentials (Pharmacy)
```
📧 Email: petmeds.pharmacy@testmail.com
🔑 Password: Test@Pharma2026!
📱 Phone: +91 98765 78901
```

### 2.2 Customer Credentials
```
📧 Email: arun.krishnan.pet@testmail.com
🔑 Password: Test@Customer2026!
📱 Phone: +91 87654 87654
```

---

## PHASE 1: VENDOR ONBOARDING

### Step 1.1: Registration

**Action:**
1. Go to `https://vendor.warmpawz.com`
2. Click "Register"
3. Select **"Pet Pharmacy"** vendor type

---

### Step 1.2: Enter Basic Information

| Field | Value |
|-------|-------|
| Pharmacy Name | PetMeds Plus Pharmacy |
| Owner Name | Dr. Suresh Nair |
| Email | petmeds.pharmacy@testmail.com |
| Phone | +91 98765 78901 |
| Password | Test@Pharma2026! |
| Pharmacist License # | PH/KER/2020/12345 |

---

### Step 1.3: Pharmacy Address

| Field | Value |
|-------|-------|
| Address | Shop 12, Medical Complex |
| Area | MG Road |
| City | Kochi |
| State | Kerala |
| Pincode | 682016 |
| Landmark | Near City Hospital |

**Delivery Options:**
- [x] Store Pickup
- [x] Home Delivery
- [x] Express Delivery (2-4 hours)

---

### Step 1.4: Upload Documents (MANDATORY)

| Document | Description | Importance |
|----------|-------------|------------|
| Pharmacy License | Valid drug license | CRITICAL |
| Pharmacist Registration | Registered pharmacist on staff | CRITICAL |
| GST Certificate | For billing | Required |
| Drug License (21B/20B) | For prescription drugs | CRITICAL |
| FSSAI License | For pet food/supplements | Required |
| Narcotics License | If stocking controlled substances | If applicable |

**Verification Note:**
> ⚠️ Pharmacy requires STRICT document verification. All drug licenses must be valid and verified before approval.

---

### Step 1.5: Set Operating Hours

| Day | Open | Close | Status |
|-----|------|-------|--------|
| Mon-Sat | 8:00 AM | 10:00 PM | Open |
| Sunday | 9:00 AM | 6:00 PM | Open |

**24/7 Availability:** No (select if applicable)

---

### Step 1.6: Pharmacy Capabilities

**Services Offered:**
- [x] Prescription Medications
- [x] OTC Pet Medicines
- [x] Veterinary Supplies
- [x] Pet Supplements & Vitamins
- [x] Prescription Refills
- [x] Medication Compounding
- [x] Pet Food (Prescription Diet)

**Delivery Settings:**
| Setting | Value |
|---------|-------|
| Free Delivery Above | ₹500 |
| Delivery Fee | ₹50 |
| Express Delivery Fee | ₹100 |
| Delivery Radius | 15 km |
| Same-Day Cutoff | 4:00 PM |

---

### Step 1.7: Bank Details & Submit

| Field | Value |
|-------|-------|
| Bank | Federal Bank |
| Account | 12340000567890 |
| IFSC | FDRL0001234 |

Submit for approval.

---

## PHASE 2: INVENTORY & CATALOG SETUP

### Step 2.1: Login After Approval

**Dashboard Features:**
- 📊 Dashboard
- 📦 Orders
- 💊 Inventory
- 📋 Prescriptions
- 🚚 Deliveries
- 💰 Earnings

---

### Step 2.2: Add Product Categories

**Create Categories:**
| Category | Description |
|----------|-------------|
| Prescription Medications | Requires valid Rx |
| Antibiotics | Prescription required |
| Dewormers | OTC & Rx |
| Flea & Tick | Preventatives |
| Vaccines (Storage) | Vet-administered |
| Supplements | Vitamins, joint support |
| Prescription Diets | Rx food |
| First Aid | Wound care, bandages |
| Grooming Medical | Medicated shampoos |

---

### Step 2.3: Add Products to Inventory

**Prescription Medications (Sample):**

| Product | Category | Rx Required | Price (₹) | Stock |
|---------|----------|-------------|-----------|-------|
| Cephalexin 250mg (10 tabs) | Antibiotics | Yes | 180 | 50 |
| Amoxicillin 500mg (10 tabs) | Antibiotics | Yes | 150 | 45 |
| Otomax Ear Drops 15ml | Ear Medications | Yes | 450 | 30 |
| Metacam 0.5mg/ml 30ml | Pain Relief | Yes | 850 | 20 |
| Apoquel 16mg (10 tabs) | Allergy | Yes | 2,500 | 15 |
| Rimadyl 100mg (20 tabs) | Pain Relief | Yes | 1,200 | 25 |

**OTC Medications:**

| Product | Category | Rx Required | Price (₹) | Stock |
|---------|----------|-------------|-----------|-------|
| Drontal Plus Dewormer (Single) | Dewormers | No | 250 | 100 |
| Frontline Plus (1 Pipette) | Flea & Tick | No | 550 | 80 |
| Bravecto Chewable (4.5-10kg) | Flea & Tick | No | 1,800 | 40 |
| Nutri-Coat Supplement 200ml | Supplements | No | 350 | 60 |
| Calcium Tablets (60 tabs) | Supplements | No | 280 | 70 |

**How to Add Product:**
1. Click "Add Product"
2. Enter product details:
   - Name, Brand, Category
   - Prescription required: Yes/No
   - Price, MRP, Discount
   - Stock quantity
   - Expiry date
   - Batch number
3. Upload product image
4. Save

---

### Step 2.4: Set Stock Alerts

| Setting | Value |
|---------|-------|
| Low Stock Alert | When < 10 units |
| Out of Stock Alert | Immediate |
| Expiry Alert | 30 days before |

---

## PHASE 3: CUSTOMER ORDER JOURNEY

> **Switch to Customer Browser**

### Step 3.1: Customer Login

Login: `arun.krishnan.pet@testmail.com` / `Test@Customer2026!`

---

### Step 3.2: Add Pet Profile

| Field | Value |
|-------|-------|
| Pet Name | Buddy |
| Pet Type | Dog |
| Breed | Beagle |
| Age | 5 years |
| Weight | 12 kg |
| Allergies | None known |
| Current Medications | None |

---

### Step 3.3: Scenario A - Order OTC Product (No Prescription)

**Action:**
1. Click "Pharmacy" or "Pet Medicines"
2. Browse or search: "Dewormer"
3. Find "Drontal Plus Dewormer"
4. Click "Add to Cart"

**Product Page Shows:**
- Product name and image
- Price: ₹250
- Description and usage
- No prescription required ✓
- Dosage calculator (optional)
- "Add to Cart" button

---

### Step 3.4: Add More OTC Items

**Add to Cart:**
| Product | Qty | Price |
|---------|-----|-------|
| Drontal Plus Dewormer | 1 | ₹250 |
| Nutri-Coat Supplement 200ml | 1 | ₹350 |
| Frontline Plus (1 Pipette) | 1 | ₹550 |

---

### Step 3.5: View Cart & Checkout

**Cart Summary:**
```
🛒 Your Cart (3 items)

├── Drontal Plus Dewormer x1      ₹250
├── Nutri-Coat Supplement x1      ₹350
├── Frontline Plus x1             ₹550
├── ────────────────────────────────
├── Subtotal                      ₹1,150
├── Delivery Fee                  FREE (above ₹500)
├── GST (12%)                     ₹138
└── ────────────────────────────────
    Total                         ₹1,288
```

---

### Step 3.6: Select Delivery Option

**Delivery Options:**
| Option | Time | Fee |
|--------|------|-----|
| Standard Delivery | 1-2 days | Free |
| Same-Day Delivery | By 9 PM | +₹50 |
| Express Delivery | 2-4 hours | +₹100 |

Select: **Same-Day Delivery**

---

### Step 3.7: Enter Delivery Address

| Field | Value |
|-------|-------|
| Full Name | Arun Krishnan |
| Phone | +91 87654 87654 |
| Address | Flat 305, Lakshmi Apartments |
| Area | Panampilly Nagar |
| City | Kochi |
| Pincode | 682036 |
| Landmark | Near SBI ATM |

---

### Step 3.8: Complete Payment

**Order Summary:**
```
Order Total: ₹1,338 (₹1,288 + ₹50 delivery)
```

Pay with test card.

**Order Confirmed:**
- Order ID: WP-PHARM-2026011523456
- Estimated Delivery: Today by 9 PM
- Track order link provided

---

## PHASE 4: PRESCRIPTION PROCESSING

### Step 4.1: Scenario B - Order Prescription Medication

> **Customer needs medication from vet prescription**

**Prerequisite:** Customer has digital prescription from vet (from earlier vet visit)

**Action:**
1. Customer goes to "My Prescriptions" (from vet booking)
2. Finds prescription from Dr. PawCare
3. Clicks "Order Medicines from Prescription"

**Prescription Details:**
```
📋 Prescription #RX-VET-123456

Doctor: Dr. Rahul Verma
Clinic: Dr. PawCare Veterinary Clinic
Date: [Yesterday]
Valid Until: [30 days from issue]

For: Buddy (Beagle, 12 kg)
Diagnosis: Ear Infection (Otitis Externa)

Medications:
1. Otomax Ear Drops 15ml
   - 4 drops twice daily x 7 days
   
2. Cephalexin 250mg
   - 1 tablet twice daily x 5 days
```

---

### Step 4.2: Select Pharmacy for Prescription

**Action:**
1. System shows nearby pharmacies
2. Select "PetMeds Plus Pharmacy"
3. System sends prescription to pharmacy

**Pharmacy Selection Shows:**
| Pharmacy | Distance | Price | Availability |
|----------|----------|-------|--------------|
| PetMeds Plus | 3 km | ₹630 | ✓ In Stock |
| Other Pharmacy | 5 km | ₹680 | ✓ In Stock |

---

### Step 4.3: Pharmacy Receives Prescription Order

> **Switch to Vendor (Pharmacy) Browser**

**Notification:**
```
🔔 New Prescription Order!

Customer: Arun Krishnan
Pet: Buddy (Beagle)

Prescription ID: RX-VET-123456
Prescribing Vet: Dr. Rahul Verma

Items:
├── Otomax Ear Drops 15ml - ₹450
├── Cephalexin 250mg (10 tabs) - ₹180
└── Total: ₹630

Status: ⏳ Awaiting Verification

[Verify Prescription] [Reject]
```

---

### Step 4.4: Verify Prescription

**Action:**
1. Click "Verify Prescription"
2. Pharmacist reviews:
   - Valid prescription date ✓
   - Valid vet signature ✓
   - Correct dosages ✓
   - No interactions ✓
3. Click "Approve Prescription"

**Verification Checklist:**
- [ ] Prescription not expired (within validity period)
- [ ] Issuing veterinarian verified
- [ ] Patient (pet) details match
- [ ] Medications appropriate for condition
- [ ] Dosages within safe limits
- [ ] No drug interactions

---

### Step 4.5: Customer Notified of Approval

> **Customer Receives:**
```
✅ Prescription Approved!

Your prescription has been verified.
Order is being prepared.

Order ID: WP-PHARM-2026011534567
Estimated Delivery: Tomorrow by 2 PM

[Track Order]
```

---

### Step 4.6: Prepare Order

> **Pharmacy Side**

**Action:**
1. Go to "Orders" → "Pending Preparation"
2. Find order WP-PHARM-2026011534567
3. Click "Prepare Order"

**Preparation Checklist:**
- [ ] Pick Otomax Ear Drops (Batch: OTM2025A, Exp: Dec 2026)
- [ ] Pick Cephalexin 250mg x10 (Batch: CPH2025B, Exp: Nov 2026)
- [ ] Verify quantities
- [ ] Check expiry dates
- [ ] Add dosage stickers/labels
- [ ] Pack securely

4. Scan barcodes for inventory update
5. Click "Order Ready"

---

## PHASE 5: ORDER FULFILLMENT & DELIVERY

### Step 5.1: Assign Delivery

**Action:**
1. Order marked as "Ready for Pickup/Delivery"
2. Assign to delivery partner or self-delivery

**Delivery Assignment:**
| Option | Details |
|--------|---------|
| Self Delivery | Pharmacy's own delivery person |
| Partner Delivery | Third-party delivery |
| Customer Pickup | Customer collects from store |

Select: **Self Delivery**

---

### Step 5.2: Dispatch Order

**Action:**
1. Click "Dispatch"
2. Enter delivery person details
3. Start tracking

**Customer Notified:**
```
🚚 Order Dispatched!

Your medicines are on the way!
Delivery Person: Rajan
Phone: +91 98xxx xxxxx

Estimated Arrival: 30 minutes

[Track Delivery]
```

---

### Step 5.3: Customer Tracks Delivery

**Customer Sees:**
- Live location of delivery (if GPS enabled)
- ETA updates
- Delivery person contact
- Order contents

---

### Step 5.4: Complete Delivery

**Action:**
1. Delivery person arrives
2. Hands over package
3. Customer confirms receipt in app
4. OR Delivery person marks as delivered

**Delivery Confirmation:**
- Customer signs/OTP verification
- Photo proof (optional)
- Delivery notes

---

### Step 5.5: Customer Receives Order

**Customer Actions:**
1. Receives package
2. Verifies contents
3. Clicks "Confirm Delivery" in app

**Order Shows:**
```
✅ Order Delivered!

Order: WP-PHARM-2026011534567
Delivered: [Date & Time]

Items:
├── Otomax Ear Drops 15ml ✓
├── Cephalexin 250mg (10 tabs) ✓

Dosage Instructions Included ✓

[Need Help?] [Reorder] [Rate Pharmacy]
```

---

## PHASE 6: POST-DELIVERY & REFILLS

### Step 6.1: Medication Reminder Setup

**Customer Action:**
1. Go to delivered order
2. Click "Set Medication Reminders"
3. Set for each medication:

**Otomax Ear Drops:**
| Field | Value |
|-------|-------|
| Pet | Buddy |
| Medication | Otomax Ear Drops |
| Dosage | 4 drops |
| Frequency | Twice daily |
| Times | 8:00 AM, 8:00 PM |
| Duration | 7 days |

**Cephalexin:**
| Field | Value |
|-------|-------|
| Pet | Buddy |
| Medication | Cephalexin 250mg |
| Dosage | 1 tablet |
| Frequency | Twice daily (after food) |
| Times | 9:00 AM, 9:00 PM |
| Duration | 5 days |

**Customer Receives:**
Push notifications at set times:
```
💊 Medication Reminder

Time to give Buddy his medicine!

Cephalexin 250mg - 1 tablet
Give after food

[Mark as Given] [Snooze 30 min]
```

---

### Step 6.2: Refill Reminder

**For recurring medications, system sends:**
```
🔄 Refill Reminder

Buddy's Frontline Plus is due for refill!
Last ordered: 30 days ago
Recommended: Order now for continuous protection

[Quick Reorder] [Remind Later]
```

---

### Step 6.3: Quick Reorder

**Action:**
1. Customer clicks "Reorder" on past order
2. Same items pre-selected
3. Confirm and pay
4. Order placed instantly

---

### Step 6.4: Prescription Refill

**For prescription medications:**

**Scenario:** Prescription allows refills

**Customer Action:**
1. Go to prescription
2. Check if refills remaining
3. Click "Request Refill"
4. Pharmacy receives refill request
5. Pharmacist verifies refills available
6. Order processed

**Refill Limits:**
- Some Rx: No refills (single use)
- Some Rx: 2-3 refills allowed
- Antibiotics: Usually no refills
- Chronic medications: Monthly refills

---

### Step 6.5: Customer Reviews Pharmacy

**Action:**
1. Click "Rate Pharmacy"
2. Submit review:

| Field | Rating/Value |
|-------|--------------|
| Overall | ⭐⭐⭐⭐⭐ |
| Order Accuracy | ⭐⭐⭐⭐⭐ |
| Packaging | ⭐⭐⭐⭐⭐ |
| Delivery Speed | ⭐⭐⭐⭐ |
| Review | "Fast delivery and proper packaging. Medicines were exactly as prescribed. Clear dosage labels included. Very professional service!" |

---

## EDGE CASES

### Edge Case 1: Prescription Expired

**Scenario:** Customer tries to order from expired prescription

**Expected:**
- System blocks order
- Message: "This prescription has expired. Please get a new prescription from your vet."
- Option to book vet appointment

---

### Edge Case 2: Prescription Medication Out of Stock

**Scenario:** Pharmacy doesn't have prescribed medication

**Steps:**
1. Pharmacy receives order
2. Marks item as "Out of Stock"
3. Customer notified
4. Options offered:
   - Wait for restock
   - Try another pharmacy
   - Contact vet for alternative

---

### Edge Case 3: Wrong Medication Delivered

**Scenario:** Customer receives wrong medicine

**Steps:**
1. Customer clicks "Report Issue"
2. Selects "Wrong Item Received"
3. Uploads photo of received item
4. Pharmacy notified immediately
5. Correct item dispatched urgently
6. Wrong item collected (for controlled substances)

**Critical:** For prescription medications, this is a HIGH PRIORITY issue.

---

### Edge Case 4: Medication Damaged in Transit

**Scenario:** Package arrived damaged

**Steps:**
1. Customer reports damaged package
2. Uploads photos
3. Refund or replacement processed
4. Delivery partner liability assessed

---

### Edge Case 5: Controlled Substance Order

**Scenario:** Order includes controlled medication

**Additional Steps:**
1. Extra verification required
2. ID proof may be needed at delivery
3. Signature mandatory
4. Chain of custody documented
5. No delivery to proxy allowed

---

### Edge Case 6: Prescription Verification Failed

**Scenario:** Pharmacist suspects fraudulent prescription

**Steps:**
1. Pharmacist flags for review
2. Contacts prescribing vet to verify
3. If cannot verify: Order rejected
4. Customer notified of rejection reason
5. Reported to admin if fraud suspected

---

### Edge Case 7: Customer Refuses Delivery

**Scenario:** Customer not available or refuses

**Steps:**
1. Delivery person marks "Refused/Unavailable"
2. Order returned to pharmacy
3. Customer contacted
4. Reschedule or refund processed

---

### Edge Case 8: Price Change After Order

**Scenario:** Price changed between order and delivery

**Expected:**
- Price locked at time of order
- Customer pays original price
- Pharmacy absorbs difference (or vice versa)

---

### Edge Case 9: Multiple Prescriptions for Same Pet

**Scenario:** Two vets prescribed conflicting medications

**Steps:**
1. Pharmacist notices interaction
2. Flags for review
3. Contacts customer and vets
4. Resolves conflict before dispensing
5. Documents communication

---

### Edge Case 10: Returns Request

**Scenario:** Customer wants to return unopened medication

**Policy:**
- Prescription medications: NO RETURNS (legal requirement)
- OTC sealed products: May be returned within 7 days
- Opened products: NO RETURNS

---

## TROUBLESHOOTING GUIDE

### Problem: Prescription Not Showing

**Solutions:**
1. Check if vet uploaded prescription
2. Verify prescription linked to correct pet
3. Check prescription validity dates
4. Contact vet clinic to resend

---

### Problem: Delivery Address Not Serviceable

**Solutions:**
1. Enter nearby landmark
2. Select different pharmacy
3. Choose store pickup option

---

### Problem: Payment Stuck for Pharmacy Order

**Solutions:**
1. Do not retry payment immediately
2. Check bank statement
3. Contact support with transaction ID
4. Refund processed if double charged

---

## TEST COMPLETION CHECKLIST

### Vendor Onboarding
- [ ] Pharmacy registration with licenses
- [ ] Product catalog created
- [ ] Prescription capabilities enabled
- [ ] Delivery settings configured
- [ ] Approved and active

### Customer OTC Order
- [ ] OTC products browsed and added
- [ ] Cart and checkout working
- [ ] Payment successful
- [ ] Delivery tracking working
- [ ] Order delivered

### Prescription Order
- [ ] Prescription accessible from vet visit
- [ ] Order from prescription working
- [ ] Pharmacy received prescription
- [ ] Verification completed
- [ ] Order fulfilled

### Post-Delivery
- [ ] Medication reminders set
- [ ] Refill reminder received
- [ ] Quick reorder working
- [ ] Review submitted

### Edge Cases
- [ ] Expired prescription blocked
- [ ] Out of stock handling
- [ ] Wrong item reported
- [ ] Returns tested

---

## NOTES & OBSERVATIONS

| Date | Test Case | Issue Found | Severity | Notes |
|------|-----------|-------------|----------|-------|
| | | | | |

---

**End of Pet Pharmacy Testing Plan**

---

*Document prepared for WarmPawz Functional Testing Team*
