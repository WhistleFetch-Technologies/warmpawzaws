# ✂️ Pet Grooming Services - Complete Testing Plan

## Document Information
| Field | Value |
|-------|-------|
| **Document Version** | 1.0 |
| **Created Date** | January 15, 2026 |
| **Vendor Type** | Pet Grooming Salon / Mobile Groomer |
| **Test Customer** | Ananya Patel (Pet: Muffin - Persian Cat) |
| **Estimated Testing Time** | 4-5 hours |

---

## 📋 TABLE OF CONTENTS
1. [Test Environment Setup](#1-test-environment-setup)
2. [Test Credentials](#2-test-credentials)
3. [Phase 1: Vendor Onboarding](#phase-1-vendor-onboarding)
4. [Phase 2: Vendor Dashboard Setup](#phase-2-vendor-dashboard-setup)
5. [Phase 3: Customer Booking Journey](#phase-3-customer-booking-journey)
6. [Phase 4: Service Delivery](#phase-4-service-delivery)
7. [Phase 5: Payment & Revenue](#phase-5-payment--revenue)
8. [Phase 6: Post-Service Actions](#phase-6-post-service-actions)
9. [Edge Cases](#edge-cases)
10. [Troubleshooting Guide](#troubleshooting-guide)

---

## 1. Test Environment Setup

### 1.1 URLs You Will Need
| Application | URL | Purpose |
|-------------|-----|---------|
| Vendor Web App | `https://vendor.warmpawz.com` | For groomer login |
| Customer Web App | `https://app.warmpawz.com` | For pet owner login |
| Admin Panel | `https://admin.warmpawz.com` | For admin approvals |

### 1.2 Browser Requirements
- **Recommended Browser**: Google Chrome (latest version)
- **Screen Resolution**: Minimum 1366x768
- **Clear cache before testing**: Press `Ctrl+Shift+Delete`

### 1.3 Before You Begin
1. Open TWO browser windows side by side
2. Keep notepad ready for issue logging
3. Take screenshots at major steps

---

## 2. Test Credentials

### 2.1 Vendor Credentials (Grooming Salon)
```
📧 Email: pawspa.grooming@testmail.com
🔑 Password: Test@Groom2026!
📱 Phone: +91 98765 12345
```

### 2.2 Customer Credentials
```
📧 Email: ananya.patel.pet@testmail.com
🔑 Password: Test@Customer2026!
📱 Phone: +91 87654 21098
```

### 2.3 Test Payment Cards
```
✅ Success Card: 4111 1111 1111 1111
   Expiry: 12/28, CVV: 123

❌ Decline Card: 4000 0000 0000 0002
   Expiry: 12/28, CVV: 123
```

---

## PHASE 1: VENDOR ONBOARDING

### What is this phase?
> A new pet grooming salon or mobile groomer registers on WarmPawz to offer grooming services.

---

### Step 1.1: Navigate to Vendor Registration

**Action:**
1. Open browser and go to: `https://vendor.warmpawz.com`
2. Click on "New vendor? Register here"

**What you should see:**
- WarmPawz vendor login page
- Registration link at the bottom

---

### Step 1.2: Select Vendor Type

**Action:**
1. On the vendor type selection screen
2. Click on **"Grooming"** or **"Pet Spa"** option

**What you should see:**
- Grooming icon (scissors, comb, or pet with bubbles)
- Description: "Offer grooming services to pets"

**Expected Result:** 
- Grooming option highlighted
- "Continue" button becomes active

---

### Step 1.3: Enter Basic Information

**Action:**
Fill in the following:

| Field | Value to Enter |
|-------|----------------|
| Salon/Business Name | PawSpa Premium Grooming |
| Owner Name | Ritu Mehra |
| Email | pawspa.grooming@testmail.com |
| Phone Number | +91 98765 12345 |
| Password | Test@Groom2026! |
| Confirm Password | Test@Groom2026! |

**Also Select:**
- [ ] Salon-based grooming (Fixed location)
- [ ] Mobile grooming (Home visits)
- [x] Both

---

### Step 1.4: Enter Address Information

**Action:**
Fill in salon address:

| Field | Value to Enter |
|-------|----------------|
| Address Line 1 | Unit 5, Pet Paradise Plaza |
| Address Line 2 | Andheri West |
| City | Mumbai |
| State | Maharashtra |
| Pincode | 400053 |
| Landmark | Opposite Metro Station |

**For Mobile Grooming Service Area:**
- Service Radius: 15 km
- Areas Served: Andheri, Juhu, Bandra, Khar, Santacruz

---

### Step 1.5: Upload Documents (KYC)

**Documents Required:**

| Document Type | What to Upload |
|---------------|----------------|
| Business Registration | Shop establishment certificate |
| GST Certificate | GST registration (if applicable) |
| PAN Card | Business/personal PAN |
| Salon Photos | 3-5 photos of grooming area |
| Groomer Certifications | Professional grooming certificates |
| Insurance (Optional) | Liability insurance for pets |

**How to Upload:**
1. Click "Upload" next to each document
2. Select file from computer
3. Wait for upload completion
4. Verify thumbnail/filename appears

---

### Step 1.6: Set Grooming Specializations

**Action:**
Select pet types and specializations:

**Pet Types Served:**
- [x] Dogs
- [x] Cats
- [ ] Rabbits
- [ ] Guinea Pigs
- [ ] Birds

**Dog Sizes:**
- [x] Small (0-10 kg)
- [x] Medium (10-25 kg)
- [x] Large (25-40 kg)
- [x] Extra Large (40+ kg)

**Specializations:**
- [x] Full Grooming
- [x] Bath & Blow Dry
- [x] Hair Cutting/Styling
- [x] Nail Trimming
- [x] Ear Cleaning
- [x] Teeth Cleaning
- [x] De-matting
- [x] De-shedding Treatment
- [x] Flea & Tick Treatment
- [x] Breed-specific Styling
- [x] Show/Competition Grooming
- [ ] Creative Coloring (Safe pet dyes)

---

### Step 1.7: Set Working Hours

**Regular Hours:**
| Day | Opening Time | Closing Time | Status |
|-----|--------------|--------------|--------|
| Monday | 10:00 AM | 07:00 PM | ✅ Open |
| Tuesday | 10:00 AM | 07:00 PM | ✅ Open |
| Wednesday | 10:00 AM | 07:00 PM | ✅ Open |
| Thursday | 10:00 AM | 07:00 PM | ✅ Open |
| Friday | 10:00 AM | 07:00 PM | ✅ Open |
| Saturday | 09:00 AM | 08:00 PM | ✅ Open |
| Sunday | 09:00 AM | 06:00 PM | ✅ Open |

---

### Step 1.8: Add Grooming Services & Packages

**Action:**
Add services with pricing:

**Individual Services:**
| Service Name | Duration | Price (₹) - Small Dog | Medium | Large | Cat |
|--------------|----------|----------------------|--------|-------|-----|
| Bath & Blow Dry | 45 mins | 600 | 800 | 1000 | 700 |
| Full Grooming | 90 mins | 1200 | 1500 | 1800 | 1400 |
| Haircut/Styling | 60 mins | 800 | 1000 | 1200 | 900 |
| Nail Trimming | 15 mins | 150 | 150 | 200 | 150 |
| Ear Cleaning | 15 mins | 150 | 150 | 150 | 150 |
| Teeth Brushing | 15 mins | 200 | 200 | 200 | 200 |
| De-matting | 30 mins | 400 | 500 | 600 | 500 |
| De-shedding Treatment | 45 mins | 600 | 800 | 1000 | 700 |
| Flea Treatment | 30 mins | 500 | 600 | 700 | 500 |

**Package Deals:**
| Package Name | Includes | Duration | Price (₹) |
|--------------|----------|----------|-----------|
| Basic Spa | Bath + Nail Trim + Ear Clean | 60 mins | 800 |
| Premium Spa | Full Groom + Teeth + De-shed | 120 mins | 2000 |
| Royal Treatment | Everything + Massage + Aromatherapy | 150 mins | 3000 |

**How to Add:**
1. Click "Add Service"
2. Enter service name
3. Set duration
4. Enter prices for each pet size/type
5. Add description
6. Click Save

---

### Step 1.9: Set Up Bank Details

**Action:**
Enter payment details:

| Field | Value |
|-------|-------|
| Bank Name | ICICI Bank |
| Account Holder | Ritu Mehra |
| Account Number | 012345678901 |
| IFSC Code | ICIC0001234 |
| Account Type | Current Account |
| UPI ID | pawspa@icici |

---

### Step 1.10: Review and Submit

**Action:**
1. Review all information on summary screen
2. Verify all services and prices are correct
3. Check Terms & Conditions
4. Click "Submit for Approval"

**Expected Result:**
- Success message displayed
- Pending approval status shown
- Email confirmation sent

---

## PHASE 2: VENDOR DASHBOARD SETUP

### Step 2.1: First Login After Approval

**Action:**
1. Go to `https://vendor.warmpawz.com`
2. Login with: `pawspa.grooming@testmail.com` / `Test@Groom2026!`

**Dashboard Menu Items:**
- 📊 Dashboard
- 📅 Bookings
- ✂️ Services
- 📷 Gallery
- 💰 Earnings
- ⭐ Reviews
- ⚙️ Settings

---

### Step 2.2: Complete Profile

**Action:**
Add profile details:

| Field | Value |
|-------|-------|
| Profile Photo | Upload salon logo |
| Cover Photo | Upload salon interior photo |
| About | "PawSpa Premium Grooming offers luxury grooming services for dogs and cats. Our certified groomers use premium, pet-safe products and provide personalized care for every furry friend. We specialize in breed-specific styling and spa treatments." |
| Tagline | "Where Every Pet Gets the Royal Treatment" |

---

### Step 2.3: Upload Gallery Photos

**Action:**
1. Go to "Gallery" section
2. Upload at least 10 photos:
   - Before/After grooming shots
   - Salon interior
   - Happy pets
   - Grooming stations
   - Products used

**Photo Categories:**
- Grooming Area (3 photos)
- Before & After (4 photos)
- Happy Customers (3 photos)

---

### Step 2.4: Configure Appointment Slots

**Action:**
1. Go to Settings → Scheduling
2. Set configurations:

| Setting | Value |
|---------|-------|
| Groomers Available | 3 (can handle 3 pets simultaneously) |
| Minimum Slot Duration | 30 minutes |
| Buffer Between Appointments | 15 minutes |
| Max Appointments/Day | 15 |
| Advance Booking Days | 14 days |
| Cancellation Window | 6 hours before |

---

### Step 2.5: Set Mobile Grooming Options

**Action (if mobile grooming enabled):**

| Setting | Value |
|---------|-------|
| Home Visit Fee | ₹200 extra |
| Minimum Order for Home Visit | ₹800 |
| Vehicle | Equipped grooming van |
| Service Area | 15 km radius |
| Equipment Carried | Full grooming setup |

---

## PHASE 3: CUSTOMER BOOKING JOURNEY

> **Switch to Customer Browser Window**

### Step 3.1: Customer Login

**Action:**
1. Open `https://app.warmpawz.com`
2. Login: `ananya.patel.pet@testmail.com` / `Test@Customer2026!`

---

### Step 3.2: Add Pet Profile

**Action:**
Create pet profile:

| Field | Value |
|-------|-------|
| Pet Name | Muffin |
| Pet Type | Cat |
| Breed | Persian |
| Gender | Female |
| Date of Birth | 20-June-2023 |
| Weight | 4 kg |
| Color | White with gray patches |
| Spayed | Yes |

**Coat Information:**
| Field | Value |
|-------|-------|
| Coat Type | Long-haired |
| Coat Condition | Slight matting |
| Last Grooming | 2 months ago |
| Grooming Frequency | Monthly |

**Temperament:**
| Field | Value |
|-------|-------|
| Behavior with Strangers | Shy initially, warms up |
| Behavior during Grooming | Calm, dislikes water |
| Any Aggression | No |
| Special Handling Notes | Handle gently, speak softly |

---

### Step 3.3: Search for Grooming Services

**Action:**
1. From home page, click "Grooming" category
2. Or search: "Cat grooming near me"
3. Apply filters:
   - Pet Type: Cat
   - Distance: Within 10 km
   - Rating: 4+ stars
   - Services: Full Grooming

**What you should see:**
- List of grooming salons
- Photos, ratings, prices
- "PawSpa Premium Grooming" should appear

---

### Step 3.4: View Groomer Profile

**Action:**
Click on "PawSpa Premium Grooming"

**Profile Should Show:**
- Salon photos and gallery
- Services with pricing
- Reviews and ratings
- Working hours
- "Book Now" button

**Cat Services Displayed:**
- Full Grooming (Cat) - ₹1400
- Bath & Blow Dry (Cat) - ₹700
- De-matting (Cat) - ₹500

---

### Step 3.5: Select Service and Schedule

**Action:**
1. Click "Book Now"
2. Select Service: "Full Grooming" (Cat - ₹1400)
3. Select Pet: Muffin
4. Choose: "Visit Salon" or "Home Visit" → Select "Visit Salon"
5. Select Date: Day after tomorrow
6. View available slots:

**Available Slots:**
```
Morning:
[10:00 AM] [10:30 AM] [11:00 AM] [11:30 AM]

Afternoon:
[02:00 PM] [02:30 PM] [03:00 PM] [03:30 PM] [04:00 PM]
```

7. Select "02:00 PM"

---

### Step 3.6: Add Service Details

**Action:**
Fill in grooming preferences:

| Field | Value |
|-------|-------|
| Grooming Style | Standard breed cut |
| Special Requests | Please be gentle, Muffin is shy. Focus on de-matting around ears and belly. |
| Allergies | None known |
| Preferred Products | Hypoallergenic shampoo if available |
| Pick up after | I'll wait at salon |

**Add-on Services (Optional):**
- [ ] Nail Trimming (+₹150) ✓ Selected
- [ ] Ear Cleaning (+₹150) ✓ Selected
- [ ] Teeth Brushing (+₹200)
- [ ] Cologne Spray (+₹100) ✓ Selected

**Updated Total:** ₹1400 + ₹150 + ₹150 + ₹100 = ₹1800

---

### Step 3.7: Review Booking Summary

**Booking Summary:**
```
📍 PawSpa Premium Grooming
📅 [Date] at 02:00 PM
🐱 Pet: Muffin (Persian Cat)
✂️ Service: Full Grooming

Services:
├── Full Grooming (Cat):     ₹1,400
├── Nail Trimming:           ₹150
├── Ear Cleaning:            ₹150
├── Cologne Spray:           ₹100
├── Platform Fee:            ₹45
├── GST (18%):              ₹332.10
└── ────────────────────────────
    Total:                  ₹2,177.10
```

---

### Step 3.8: Make Payment

**Action:**
1. Select payment method: UPI
2. Enter UPI ID or scan QR code
3. Complete payment

**For Card Payment:**
```
Card: 4111 1111 1111 1111
Expiry: 12/28
CVV: 123
```

**Expected Result:**
- Payment success
- Booking confirmed
- Booking ID: WP-GROOM-2026011567890

---

### Step 3.9: Booking Confirmation

**Confirmation Screen Shows:**
- Booking ID
- Salon address with map directions
- What to bring: "Just bring Muffin! We have everything needed."
- Preparation tips: "Avoid feeding 2 hours before appointment"
- Contact number (for emergencies)

---

## PHASE 4: SERVICE DELIVERY

> **Switch to Vendor Browser Window**

### Step 4.1: Vendor Receives Booking

**Notification:**
```
🔔 New Grooming Booking!
   Customer: Ananya Patel
   Pet: Muffin (Persian Cat)
   Service: Full Grooming + Add-ons
   Date: [Date] at 02:00 PM
   
   [View Details]
```

---

### Step 4.2: View Booking Details

**Action:**
1. Go to Bookings → Upcoming
2. Click on Muffin's appointment

**Booking Details Show:**
- Customer info
- Pet details including coat type, temperament
- Services booked
- Special requests highlighted
- "Check-In" button

---

### Step 4.3: Day of Appointment - Check-In

**Action:**
1. When customer arrives with Muffin
2. Click "Check-In" button
3. Confirm pet condition check:

**Pre-Grooming Checklist:**
- [ ] Pet ID verified (matches booking)
- [ ] Overall health check - looks healthy
- [ ] Skin condition noted - no visible issues
- [ ] Coat condition noted - matting as expected
- [ ] Any injuries or sensitive areas - None
- [ ] Customer signed consent form

4. Click "Start Grooming"

---

### Step 4.4: During Grooming - Update Progress

**Action:**
Throughout the grooming session, update status:

**Progress Updates:**
1. Click "Update Status"
2. Select stage:
   - [ ] Arrived/Checked In ✓
   - [ ] Pre-Grooming Assessment ✓
   - [ ] Bath in Progress ✓
   - [ ] Drying ✓
   - [ ] Hair Cutting ✓
   - [ ] Final Touches ✓
   - [ ] Ready for Pickup

**Customer Receives Notifications:**
```
🛁 Muffin is enjoying her bath!
✂️ Muffin's haircut is in progress
✨ Muffin is looking fabulous and almost ready!
```

---

### Step 4.5: Upload Before/After Photos

**Action:**
1. Click "Add Photos"
2. Take/upload photos:
   - Before grooming (showing matting)
   - During grooming
   - After grooming (glamour shot!)

3. Add to customer's pet profile

**Photo Upload Tips:**
- Good lighting
- Show the pet clearly
- Highlight the grooming results

---

### Step 4.6: Add Grooming Notes

**Action:**
Add notes for customer:

```
Grooming Notes for Muffin:
- Removed significant matting from ears and belly area
- Used hypoallergenic shampoo as requested
- Nails trimmed, ears cleaned thoroughly
- Applied flea prevention treatment (complimentary)
- Coat is silky and healthy!

Recommendations:
- Brush daily to prevent matting
- Next grooming recommended in 4-6 weeks
- Consider de-shedding treatment for summer
```

---

### Step 4.7: Complete Grooming

**Action:**
1. Mark grooming complete
2. Click "Ready for Pickup"
3. Customer receives notification

**Notification to Customer:**
```
✨ Muffin is ready for pickup!
   Your furry friend is looking fabulous.
   Please collect from PawSpa Premium Grooming.
   
   [View Before/After Photos]
```

---

### Step 4.8: Customer Pickup & Checkout

**Action:**
1. When customer picks up pet
2. Click "Customer Picked Up"
3. Show before/after photos to customer
4. Hand over any recommendations

---

## PHASE 5: PAYMENT & REVENUE

### Step 5.1: View Earnings (Vendor)

**Action:**
Go to Earnings dashboard:

```
Today's Earnings: ₹1,800
├── Grooming (Ananya - Muffin): ₹1,800

This Week: ₹1,800
This Month: ₹1,800

Pending Settlement: ₹1,800
Commission (12%): ₹216
Net Earnings: ₹1,584
```

---

### Step 5.2: Transaction Breakdown

**Transaction Details:**
```
Booking ID: WP-GROOM-2026011567890
Customer: Ananya Patel
Pet: Muffin (Persian Cat)
Services: Full Grooming + Add-ons

Gross Amount: ₹2,177.10
├── Platform Commission (12%): -₹216
├── GST Component: -₹332.10
└── ────────────────────────────
    Net Earnings: ₹1,629
```

---

## PHASE 6: POST-SERVICE ACTIONS

### Step 6.1: Customer Views Completed Booking

> **Switch to Customer Browser**

**Action:**
1. Go to "My Bookings" → "Completed"
2. Find Muffin's grooming

**Shows:**
- Before/After photos
- Grooming notes
- "Rate & Review" button
- "Book Again" button
- "View Recommendations"

---

### Step 6.2: View Before/After Photos

**Action:**
1. Click "View Photos"
2. See transformation gallery
3. Download or share photos

---

### Step 6.3: Customer Submits Review

**Action:**
1. Click "Rate & Review"
2. Fill in:

| Field | Value |
|-------|-------|
| Overall Rating | ⭐⭐⭐⭐⭐ (5 stars) |
| Grooming Quality | ⭐⭐⭐⭐⭐ |
| Cleanliness | ⭐⭐⭐⭐⭐ |
| Pet Handling | ⭐⭐⭐⭐⭐ |
| Value for Money | ⭐⭐⭐⭐ |
| Review Text | "Muffin has never looked better! The team at PawSpa was so gentle with her, and she's usually very nervous. The de-matting was done perfectly without any stress. Love the before/after photos they sent! Will definitely be back." |
| Upload Photo | Upload Muffin's new look |

3. Submit review

---

### Step 6.4: Vendor Responds

> **Switch to Vendor Browser**

**Action:**
1. View new review
2. Reply:
```
Thank you, Ananya! Muffin was such a sweetheart 🐱
We're so glad she's comfortable with us now. 
See you in 4-6 weeks for her next spa day!
Enjoy those silky purrs! ✨
```

---

### Step 6.5: Customer Books Again (Recurring)

**Action (Customer):**
1. Click "Book Again" on completed appointment
2. Service and preferences pre-filled
3. Just select new date
4. Quick rebooking completed

---

## EDGE CASES

### Edge Case 1: Customer Cancellation

**Scenario:** Cancel 3 hours before (within 6-hour window)

**Expected:**
- Warning: "Cancellation within 6 hours. 50% cancellation fee applies."
- If confirmed: ₹900 refund (50% of ₹1800)
- Vendor compensated for preparation time

---

### Edge Case 2: Pet Behavior Issue During Grooming

**Scenario:** Cat becomes aggressive and grooming cannot continue

**Test Steps:**
1. Vendor clicks "Report Issue"
2. Selects: "Pet behavior - cannot complete service"
3. Documents with photo/video
4. Partial service completion noted

**Expected:**
- Customer notified
- Partial refund calculated
- Incident recorded
- Safety protocols followed

---

### Edge Case 3: Additional Service Discovered

**Scenario:** Groomer finds severe matting requiring extra work

**Test Steps:**
1. Vendor clicks "Request Additional Service"
2. Selects "De-matting (Severe)" - ₹300 extra
3. Customer receives notification with approval request
4. Customer approves from app

**Expected:**
- Service added to booking
- Additional charge applied
- Customer confirmation required before proceeding

---

### Edge Case 4: Mobile Grooming - Location Issue

**Scenario:** Groomer cannot find customer's address

**Test Steps:**
1. Groomer clicks "Contact Customer"
2. If no response: "Report Location Issue"
3. Wait time of 15 minutes applied

**Expected:**
- Customer charged waiting fee if unreachable
- Groomer can cancel after wait period
- Rescheduling offered

---

### Edge Case 5: Pet Health Issue Discovered

**Scenario:** Groomer notices skin condition during bath

**Test Steps:**
1. Groomer documents finding
2. Takes photos
3. Notes: "Skin irritation on belly area"
4. Recommends vet visit

**Expected:**
- Health alert sent to customer
- Vet recommendation added
- Grooming completed with caution
- Medical notes saved to pet profile

---

### Edge Case 6: Home Visit - Equipment Issue

**Scenario:** Water/electricity not available at customer location

**Test Steps:**
1. Groomer reports issue
2. Options: Wait for fix, Reschedule, Salon visit

**Expected:**
- Rescheduling options provided
- No cancellation fee if customer's fault
- Alternative arrangements offered

---

### Edge Case 7: Double Booking

**Scenario:** Same pet booked at two salons

**System Check:**
- Pet profile shows existing booking
- Warning: "Muffin has a grooming appointment on [date]"
- Allow or block based on timing

---

### Edge Case 8: No-Show (Customer)

**Scenario:** Customer doesn't arrive within 30 minutes

**Test Steps:**
1. Vendor waits 30 minutes
2. Marks as "No Show"
3. Confirms no-show

**Expected:**
- Customer charged no-show fee (50%)
- Vendor receives compensation
- No-show recorded on customer profile

---

### Edge Case 9: Groomer Running Late

**Scenario:** Previous appointment took longer

**Test Steps:**
1. Vendor updates status: "Running 20 minutes late"
2. Customer receives notification
3. Customer can choose to wait or reschedule

**Expected:**
- Automated notification sent
- Customer given options
- If rescheduled: No fee charged

---

### Edge Case 10: Package/Subscription Booking

**Scenario:** Customer has monthly grooming package

**Test Steps:**
1. Customer with active package books
2. Package credits applied automatically
3. Only extra services charged

**Expected:**
- Package session deducted
- Clear display of remaining sessions
- Add-ons charged separately

---

## TROUBLESHOOTING GUIDE

### Problem: Pet Size Pricing Incorrect

**Solution:**
1. Vendor updates pet size categories in settings
2. Refreshes service pricing
3. Customer re-selects service

---

### Problem: Gallery Photos Not Uploading

**Solution:**
1. Check file size (max 5MB)
2. Use JPG/PNG format
3. Check internet connection
4. Compress image and retry

---

### Problem: Slot Not Available Despite Open Hours

**Solution:**
1. Check if groomers are already booked
2. Verify buffer time settings
3. Check for blocked dates/holidays
4. Increase groomer capacity if needed

---

### Problem: Before/After Photos Not Visible to Customer

**Solution:**
1. Ensure photos are marked as "Share with Customer"
2. Check photo upload status
3. Resend photos manually

---

## TEST COMPLETION CHECKLIST

### Vendor Onboarding
- [ ] Registration completed
- [ ] Pet types and sizes configured
- [ ] All services added with pricing
- [ ] Gallery photos uploaded
- [ ] Mobile grooming configured (if applicable)

### Customer Booking
- [ ] Pet profile created with grooming details
- [ ] Salon search working
- [ ] Add-on services selectable
- [ ] Payment successful
- [ ] Confirmation received

### Service Delivery
- [ ] Check-in process working
- [ ] Progress updates sent
- [ ] Before/after photos uploaded
- [ ] Grooming notes added
- [ ] Checkout completed

### Post-Service
- [ ] Photos visible to customer
- [ ] Review submitted
- [ ] Vendor response working
- [ ] Book again functionality working

### Edge Cases
- [ ] Cancellation tested
- [ ] Pet behavior issue tested
- [ ] Additional service request tested
- [ ] No-show tested

---

## NOTES & OBSERVATIONS

| Date | Test Case | Issue Found | Severity | Notes |
|------|-----------|-------------|----------|-------|
| | | | | |
| | | | | |

---

**End of Grooming Testing Plan**

---

*Document prepared for WarmPawz Functional Testing Team*
