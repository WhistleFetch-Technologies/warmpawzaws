# 🚶 Pet Walking Services - Complete Testing Plan

## Document Information
| Field | Value |
|-------|-------|
| **Document Version** | 1.0 |
| **Created Date** | January 15, 2026 |
| **Vendor Type** | Dog Walker / Pet Walking Service |
| **Test Customer** | Vikram Singh (Pet: Rocky - Labrador) |
| **Estimated Testing Time** | 4-5 hours |

---

## 📋 TABLE OF CONTENTS
1. [Test Environment Setup](#1-test-environment-setup)
2. [Test Credentials](#2-test-credentials)
3. [Phase 1: Vendor Onboarding](#phase-1-vendor-onboarding)
4. [Phase 2: Vendor Dashboard Setup](#phase-2-vendor-dashboard-setup)
5. [Phase 3: Customer Booking Journey](#phase-3-customer-booking-journey)
6. [Phase 4: Service Delivery & Live Tracking](#phase-4-service-delivery--live-tracking)
7. [Phase 5: Payment & Revenue](#phase-5-payment--revenue)
8. [Phase 6: Post-Service Actions](#phase-6-post-service-actions)
9. [Edge Cases](#edge-cases)
10. [Troubleshooting Guide](#troubleshooting-guide)

---

## 1. Test Environment Setup

### 1.1 URLs You Will Need
| Application | URL | Purpose |
|-------------|-----|---------|
| Vendor Web App | `https://vendor.warmpawz.com` | For walker login |
| Customer Web App | `https://app.warmpawz.com` | For pet owner login |
| Admin Panel | `https://admin.warmpawz.com` | For admin approvals |

### 1.2 Browser Requirements
- **Recommended Browser**: Google Chrome (latest version)
- **Mobile Testing**: Test on actual mobile device for GPS features
- **Location Services**: Enable location permissions for live tracking tests

---

## 2. Test Credentials

### 2.1 Vendor Credentials (Dog Walker)
```
📧 Email: happypaws.walker@testmail.com
🔑 Password: Test@Walker2026!
📱 Phone: +91 98765 67890
```

### 2.2 Customer Credentials
```
📧 Email: vikram.singh.pet@testmail.com
🔑 Password: Test@Customer2026!
📱 Phone: +91 87654 09876
```

### 2.3 Test Payment Cards
```
✅ Success Card: 4111 1111 1111 1111
   Expiry: 12/28, CVV: 123
```

---

## PHASE 1: VENDOR ONBOARDING

### Step 1.1: Navigate to Registration

**Action:**
1. Go to `https://vendor.warmpawz.com`
2. Click "New vendor? Register here"
3. Select **"Dog Walking"** vendor type

---

### Step 1.2: Enter Basic Information

| Field | Value |
|-------|-------|
| Name | Arjun Kumar |
| Business Name | Happy Paws Dog Walking |
| Email | happypaws.walker@testmail.com |
| Phone | +91 98765 67890 |
| Password | Test@Walker2026! |

---

### Step 1.3: Enter Service Area

**Action:**
Define walking service area:

| Field | Value |
|-------|-------|
| Base Location | Koramangala, Bangalore |
| Service Radius | 5 km |
| Areas Covered | Koramangala, HSR Layout, Indiranagar, BTM Layout |

**Service Area Map:**
1. Click on map to set base location
2. Adjust radius slider to 5 km
3. Pin shows coverage area

---

### Step 1.4: Upload Documents (KYC)

| Document | Description |
|----------|-------------|
| ID Proof | Aadhaar Card |
| Address Proof | Utility Bill |
| Profile Photo | Professional photo |
| Police Verification | Police clearance certificate |
| Pet Handling Certificate (Optional) | Training certificate |

---

### Step 1.5: Set Walking Experience & Preferences

**Experience:**
| Field | Value |
|-------|-------|
| Years of Experience | 3 years |
| Dogs Walked (Lifetime) | 500+ |
| References | Available on request |

**Dog Size Preferences:**
- [x] Small Dogs (0-10 kg)
- [x] Medium Dogs (10-25 kg)
- [x] Large Dogs (25-40 kg)
- [ ] Extra Large Dogs (40+ kg) - Not comfortable

**Dog Temperament:**
- [x] Calm/Easy
- [x] Energetic
- [x] Needs training
- [ ] Aggressive - Not accepted

---

### Step 1.6: Set Walking Services & Pricing

**Walking Packages:**
| Service | Duration | Dogs | Price (₹) |
|---------|----------|------|-----------|
| Quick Walk | 20 mins | 1 | 150 |
| Standard Walk | 30 mins | 1 | 200 |
| Extended Walk | 45 mins | 1 | 300 |
| Power Walk | 60 mins | 1 | 400 |
| Group Walk | 30 mins | 2-3 | 150/dog |

**Subscription Packages:**
| Package | Walks/Month | Price (₹) |
|---------|-------------|-----------|
| Basic | 15 walks | 2,500 |
| Standard | 20 walks | 3,200 |
| Premium | 30 walks (daily) | 4,500 |

**Add-on Services:**
| Service | Price |
|---------|-------|
| Feeding during walk | +₹50 |
| Basic training commands | +₹100 |
| Photo updates | Free |
| GPS tracking | Included |

---

### Step 1.7: Set Availability

**Weekly Schedule:**
| Day | Morning (6-9 AM) | Evening (5-8 PM) | Status |
|-----|------------------|------------------|--------|
| Monday | ✅ | ✅ | Available |
| Tuesday | ✅ | ✅ | Available |
| Wednesday | ✅ | ✅ | Available |
| Thursday | ✅ | ✅ | Available |
| Friday | ✅ | ✅ | Available |
| Saturday | ✅ | ✅ | Available |
| Sunday | ✅ | ❌ | Morning only |

**Slots Per Time Period:**
- Morning: 3 slots (can walk 3 dogs in rotation)
- Evening: 3 slots

---

### Step 1.8: Bank Details

| Field | Value |
|-------|-------|
| Bank Name | Axis Bank |
| Account Holder | Arjun Kumar |
| Account Number | 917010012345678 |
| IFSC Code | UTIB0001234 |
| UPI ID | arjun@axisbank |

---

### Step 1.9: Submit for Approval

1. Review all information
2. Accept Terms & Conditions
3. Submit application
4. Wait for admin approval (24-48 hours)

---

## PHASE 2: VENDOR DASHBOARD SETUP

### Step 2.1: First Login

**Action:**
Login with: `happypaws.walker@testmail.com` / `Test@Walker2026!`

**Dashboard Shows:**
- 📊 Today's Schedule
- 🗓️ Upcoming Walks
- 📍 Live Tracking Status
- 💰 Earnings
- ⭐ Ratings

---

### Step 2.2: Complete Profile

| Field | Value |
|-------|-------|
| Bio | "Hi! I'm Arjun, a certified dog walker with 3 years experience. I love dogs and treat every pet like my own. I provide GPS-tracked walks with photo updates. Your furry friend is in safe hands!" |
| Profile Video (Optional) | Upload intro video |
| Certifications | Pet First Aid Certified |

---

### Step 2.3: Enable GPS Tracking

**Action:**
1. Go to Settings → Location Services
2. Enable GPS tracking
3. Allow background location access
4. Test GPS accuracy

**GPS Settings:**
| Setting | Value |
|---------|-------|
| Location Sharing | Always On during walks |
| Update Frequency | Every 30 seconds |
| Battery Optimization | Disabled for app |

---

### Step 2.4: Set Emergency Contacts

| Contact | Phone |
|---------|-------|
| Emergency Contact 1 | +91 98765 11111 |
| Nearby Vet | Dr. Pet Care: +91 80 4567 8901 |
| Police Helpline | 100 |

---

## PHASE 3: CUSTOMER BOOKING JOURNEY

> **Switch to Customer Browser**

### Step 3.1: Customer Login

**Action:**
Login with: `vikram.singh.pet@testmail.com` / `Test@Customer2026!`

---

### Step 3.2: Add Pet Profile

| Field | Value |
|-------|-------|
| Pet Name | Rocky |
| Pet Type | Dog |
| Breed | Labrador Retriever |
| Gender | Male |
| Age | 2 years |
| Weight | 30 kg |
| Neutered | Yes |

**Walking Preferences:**
| Field | Value |
|-------|-------|
| Energy Level | High - needs lots of exercise |
| Leash Behavior | Good, occasional pulling |
| Friendly with Dogs | Yes |
| Friendly with Strangers | Yes |
| Favorite Activities | Fetch, swimming, running |
| Commands Known | Sit, Stay, Come, Heel |

**Health Notes:**
| Field | Value |
|-------|-------|
| Allergies | None |
| Medications | None |
| Special Needs | None |
| Last Vaccination | Up to date |

---

### Step 3.3: Search for Dog Walkers

**Action:**
1. Click "Dog Walking" category
2. Enter your address: "123 Koramangala, Bangalore"
3. System shows walkers in your area

**Filters:**
- Time: Evening (5-8 PM)
- Walk Duration: 30 minutes
- Rating: 4+ stars

---

### Step 3.4: View Walker Profile

**Click on "Happy Paws Dog Walking"**

**Profile Shows:**
- Photo and bio
- Rating: 4.8 ⭐ (150 reviews)
- Walks completed: 500+
- Services and pricing
- Availability calendar
- Reviews

---

### Step 3.5: Book a Walk

**Action:**
1. Click "Book Walk"
2. Select Pet: Rocky
3. Select Walk Type: "Standard Walk" (30 mins - ₹200)
4. Select Date: Tomorrow
5. Select Time Slot: 6:00 PM

**Pickup Details:**
| Field | Value |
|-------|-------|
| Pickup Address | Flat 402, Tower A, Prestige Apartments, Koramangala |
| Pickup Instructions | Ring doorbell, security will guide |
| Where is Rocky? | Inside apartment |
| Who will hand over? | Vikram (owner) |

---

### Step 3.6: Add Special Instructions

| Field | Value |
|-------|-------|
| Walking Route Preference | Park nearby (within 500m) |
| Avoid Areas | Construction site on 5th cross |
| Special Instructions | Rocky loves to run, let him off-leash in fenced area if possible. He responds well to treats. |
| Photo Updates | Yes, please send photos! |

---

### Step 3.7: Review and Pay

**Booking Summary:**
```
🚶 Dog Walking - Standard (30 mins)
📍 Pickup: Prestige Apartments, Koramangala
📅 Tomorrow at 6:00 PM
🐕 Pet: Rocky (Labrador)
👤 Walker: Arjun Kumar

Price Breakdown:
├── Standard Walk (30 min): ₹200
├── Platform Fee:           ₹10
├── GST (18%):             ₹37.80
└── ────────────────────────
    Total:                 ₹247.80
```

**Payment:** Complete with test card

**Confirmation:**
- Booking ID: WP-WALK-2026011598765
- Walker contact shared
- GPS tracking link provided

---

## PHASE 4: SERVICE DELIVERY & LIVE TRACKING

### Step 4.1: Walker Receives Booking

> **Switch to Vendor Browser/App**

**Notification:**
```
🔔 New Walk Scheduled!
   Customer: Vikram Singh
   Pet: Rocky (Labrador, 30kg)
   Date: Tomorrow at 6:00 PM
   Pickup: Prestige Apartments, Koramangala
   Duration: 30 minutes
   
   [Accept] [Decline]
```

**Action:** Click "Accept"

---

### Step 4.2: Day of Walk - Navigate to Pickup

**At 5:45 PM (15 mins before):**

**Action:**
1. Walker opens app
2. Clicks "Start Navigation" to pickup location
3. Customer receives notification: "Your walker is on the way!"

**Customer Sees:**
- Walker's live location on map
- ETA to arrival
- Walker's photo and contact

---

### Step 4.3: Arrive at Pickup Location

**Action:**
1. Walker arrives at location
2. Clicks "I've Arrived"
3. Customer receives notification: "Walker has arrived!"

**Check-in Process:**
1. Meet customer/handover person
2. Verify pet: Rocky (check collar/tag)
3. Do quick health check:
   - [ ] Pet looks healthy
   - [ ] Collar/leash secure
   - [ ] No visible injuries
4. Click "Pet Received" to confirm

---

### Step 4.4: Start Walk - GPS Tracking Begins

**Action:**
1. Click "Start Walk"
2. GPS tracking activates automatically
3. Timer starts counting

**Customer Dashboard Shows:**
```
🐕 Rocky's Walk In Progress!

⏱️ Time Elapsed: 0:00
📍 Distance: 0.0 km
🗺️ [Live Map showing walker location]

Walker: Arjun Kumar
Status: Walking
Route: [Tracking line on map]
```

---

### Step 4.5: During Walk - Send Updates

**Action:**
Walker sends updates during walk:

**Photo Update 1 (at 5 mins):**
1. Click "Send Update"
2. Take photo of Rocky walking happily
3. Add caption: "Rocky is loving the evening breeze! 🐕"
4. Send

**Customer Receives:**
```
📸 Update from Walker
[Photo of Rocky]
"Rocky is loving the evening breeze! 🐕"
5:05 PM
```

**Photo Update 2 (at 15 mins):**
- Photo: Rocky playing fetch
- Caption: "Found a nice spot for some fetch! He's got energy! 🎾"

**Activity Markers (Added to map):**
- 🧴 Potty break at [location]
- 💧 Water break at [location]
- 🎾 Play time at [location]

---

### Step 4.6: Walk Route Tracking

**Customer View (Live):**
- Full walk route drawn on map
- Current location of walker + Rocky
- Distance covered: 1.8 km
- Time elapsed: 25 mins
- Estimated return: 5 mins

---

### Step 4.7: Return to Pickup Location

**Action:**
1. Walker heads back to pickup
2. Click "Returning to Pickup"
3. Customer notified: "Rocky is heading home!"

---

### Step 4.8: Complete Walk - Handover

**Action:**
1. Arrive at pickup location
2. Hand over Rocky to customer/designated person
3. Click "Walk Complete"

**Post-Walk Summary:**
| Metric | Value |
|--------|-------|
| Duration | 32 minutes |
| Distance | 2.1 km |
| Steps (approx) | 2,800 |
| Potty Breaks | 1 |
| Water Breaks | 1 |
| Behavior | Excellent! |

**Walker Notes:**
```
Rocky was amazing today! He had great energy and 
enjoyed playing fetch at the park. Had one potty 
break and drank water. Very well-behaved on leash.
See you tomorrow! 🐕
```

---

### Step 4.9: Customer Receives Walk Summary

**Customer App Shows:**

```
✅ Walk Completed!

Rocky's Walk Summary:
├── Duration: 32 minutes
├── Distance: 2.1 km
├── Route: [View Map]
├── Photos: 3 photos
└── Walker Notes: "Rocky was amazing..."

[View Full Route Map]
[View All Photos]
[Rate This Walk]
```

---

## PHASE 5: PAYMENT & REVENUE

### Step 5.1: Earnings (Vendor)

**Today's Earnings:**
```
Walk (Vikram - Rocky): ₹200
Commission (15%): -₹30
Net Earnings: ₹170
```

---

### Step 5.2: Subscription Management

**If customer has subscription:**
- Walk deducted from package
- Remaining walks shown
- Auto-renewal reminder

---

## PHASE 6: POST-SERVICE ACTIONS

### Step 6.1: Customer Reviews Walk

**Action:**
1. Customer clicks "Rate This Walk"
2. Rate:

| Field | Rating |
|-------|--------|
| Overall | ⭐⭐⭐⭐⭐ |
| Punctuality | ⭐⭐⭐⭐⭐ |
| Pet Handling | ⭐⭐⭐⭐⭐ |
| Communication | ⭐⭐⭐⭐⭐ |
| Review | "Arjun is fantastic! Rocky always comes back happy and tired. Love the photo updates and the detailed walk summary. The GPS tracking gives me peace of mind. Highly recommend!" |

---

### Step 6.2: Book Recurring Walks

**Action (Customer):**
1. Click "Subscribe" or "Book Regular Walks"
2. Select Package: "Standard - 20 walks/month"
3. Set schedule:
   - Days: Monday to Friday
   - Time: 6:00 PM
4. Complete payment: ₹3,200/month

**Expected:**
- All walks auto-scheduled
- Walker sees recurring appointments
- Customer can skip/modify individual walks

---

## EDGE CASES

### Edge Case 1: Walker Running Late

**Scenario:** Walker stuck in traffic

**Steps:**
1. Walker clicks "Running Late"
2. Enters ETA: "15 minutes delayed"
3. Customer notified with new ETA
4. Customer can wait or reschedule

---

### Edge Case 2: Dog Not Ready / Customer Not Home

**Scenario:** No one to hand over dog

**Steps:**
1. Walker arrives, no one answers
2. Waits 10 minutes
3. Calls customer (through app)
4. If no response: Marks as "Customer Unavailable"
5. Walk cancelled, customer charged cancellation fee

---

### Edge Case 3: Weather Issue

**Scenario:** Heavy rain starts during walk

**Steps:**
1. Walker clicks "Weather Alert"
2. Returns to pickup immediately
3. Walk duration adjusted
4. Partial walk completed
5. Customer notified, partial refund or reschedule offered

---

### Edge Case 4: Pet Injury During Walk

**Scenario:** Dog steps on glass

**Steps:**
1. Walker clicks "Emergency"
2. Contacts customer immediately
3. Takes to nearest vet if serious
4. Documents incident with photos
5. Insurance claim initiated if applicable

---

### Edge Case 5: Dog Gets Off Leash

**Scenario:** Leash breaks, dog runs

**Steps:**
1. Walker marks "Emergency - Pet Loose"
2. GPS still tracking walker (finds dog)
3. Customer notified immediately
4. Recovery efforts documented
5. Incident report filed

---

### Edge Case 6: Group Walk Issues

**Scenario:** Dogs not getting along

**Steps:**
1. Separate dogs immediately
2. Notify affected customers
3. Complete walks separately if possible
4. Document compatibility issue
5. Prevent future grouping

---

### Edge Case 7: GPS Signal Lost

**Scenario:** Walk in area with poor signal

**Steps:**
1. App notifies: "GPS signal weak"
2. Continues recording locally
3. Syncs when signal returns
4. Walk summary may have gaps
5. Customer notified of tracking issue

---

### Edge Case 8: Subscription Walk Cancellation

**Scenario:** Customer needs to skip a walk

**Steps:**
1. Customer opens scheduled walk
2. Clicks "Skip This Walk"
3. If 24+ hours notice: No penalty, walk saved
4. If <24 hours: Walk consumed
5. Walker notified of cancellation

---

### Edge Case 9: Walker Becomes Unavailable

**Scenario:** Walker gets sick before scheduled walks

**Steps:**
1. Walker marks as unavailable
2. System finds replacement walker
3. Customer notified of change
4. Customer can approve or reschedule
5. Substitute walker info shared

---

### Edge Case 10: Pet Potty Accident in Public Area

**Scenario:** Dog has accident, walker needs to clean

**Steps:**
1. Walker carries cleanup bags (required)
2. Cleans up properly
3. Marks on route map: "Cleanup done"
4. Documents for customer awareness
5. Professional behavior maintained

---

## TROUBLESHOOTING GUIDE

### GPS Not Working

**Solutions:**
1. Enable location services in phone settings
2. Ensure app has "Always" location permission
3. Disable battery optimization for app
4. Restart app
5. Check if phone has GPS hardware issue

---

### Photo Updates Not Sending

**Solutions:**
1. Check internet connection
2. Reduce photo quality/size
3. Retry in area with better signal
4. Photos will auto-send when signal returns

---

### Walk Timer Issues

**Solutions:**
1. Ensure walk was properly started
2. Check if app was running in background
3. Manual time adjustment available for disputes

---

## TEST COMPLETION CHECKLIST

### Vendor Onboarding
- [ ] Registration with service area
- [ ] Walking services and pricing set
- [ ] Subscription packages configured
- [ ] GPS enabled and tested
- [ ] Profile approved

### Customer Booking
- [ ] Pet profile with walking preferences
- [ ] Single walk booked
- [ ] Pickup details added
- [ ] Payment successful

### Service Delivery
- [ ] Walker navigation to pickup
- [ ] Pet check-in completed
- [ ] GPS tracking live
- [ ] Photo updates sent
- [ ] Walk route recorded
- [ ] Walk completed and summary generated

### Live Tracking
- [ ] Real-time location visible
- [ ] Route drawn on map
- [ ] Activity markers showing
- [ ] Distance/time accurate

### Post-Service
- [ ] Walk summary received
- [ ] Photos viewable
- [ ] Review submitted
- [ ] Subscription tested

---

## NOTES & OBSERVATIONS

| Date | Test Case | Issue Found | Severity | Notes |
|------|-----------|-------------|----------|-------|
| | | | | |

---

**End of Dog Walking Testing Plan**

---

*Document prepared for WarmPawz Functional Testing Team*
