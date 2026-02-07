# 🏥 Veterinary Services - Complete Testing Plan

## Document Information
| Field | Value |
|-------|-------|
| **Document Version** | 1.0 |
| **Created Date** | January 15, 2026 |
| **Vendor Type** | Veterinary Clinic / Vet Doctor |
| **Test Customer** | Priya Sharma (Pet: Bruno - Golden Retriever) |
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
| Vendor Web App | `https://vendor.warmpawz.com` | For vet clinic/doctor login |
| Customer Web App | `https://app.warmpawz.com` | For pet owner login |
| Admin Panel | `https://admin.warmpawz.com` | For admin approvals (if needed) |

### 1.2 Browser Requirements
- **Recommended Browser**: Google Chrome (latest version)
- **Alternative**: Firefox, Safari, Edge
- **Screen Resolution**: Minimum 1366x768
- **Clear cache before testing**: Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)

### 1.3 Before You Begin
1. Open TWO browser windows side by side (one for Vendor, one for Customer)
2. Keep a notepad ready to write down any issues
3. Take screenshots at each major step (Press `PrtSc` or `Cmd+Shift+4` on Mac)

---

## 2. Test Credentials

### 2.1 Vendor Credentials (Vet Clinic)
```
📧 Email: dr.pawcare.vet@testmail.com
🔑 Password: Test@Vet2026!
📱 Phone: +91 98765 43210
```

### 2.2 Customer Credentials
```
📧 Email: priya.sharma.pet@testmail.com
🔑 Password: Test@Customer2026!
📱 Phone: +91 87654 32109
```

### 2.3 Test Payment Cards
```
✅ Success Card: 4111 1111 1111 1111
   Expiry: 12/28
   CVV: 123

❌ Decline Card: 4000 0000 0000 0002
   Expiry: 12/28
   CVV: 123
```

---

## PHASE 1: VENDOR ONBOARDING

### What is this phase?
> This is where a new veterinary clinic registers on WarmPawz platform to offer their services to pet owners.

---

### Step 1.1: Navigate to Vendor Registration

**Action:**
1. Open your browser
2. Go to URL: `https://vendor.warmpawz.com`
3. You will see a landing page with login form

**What you should see:**
- WarmPawz logo at the top
- "Welcome to WarmPawz Vendor Portal" heading
- Email and Password input fields
- "Sign In" button
- "New vendor? Register here" link at the bottom

**Next Step:** Click on "New vendor? Register here" link

---

### Step 1.2: Select Vendor Type

**Action:**
1. After clicking register link, you'll see vendor type selection screen
2. Look for different vendor categories displayed as cards/tiles
3. Click on **"Veterinary"** or **"Vet Clinic"** option

**What you should see:**
- Grid of vendor types: Veterinary, Grooming, Walking, Training, Pharmacy, Nutrition, E-commerce
- Each type has an icon and description
- Veterinary icon shows a medical cross or stethoscope

**Expected Result:** 
- Veterinary option gets highlighted/selected
- "Continue" or "Next" button becomes active

**Next Step:** Click "Continue" or "Next"

---

### Step 1.3: Enter Basic Information

**Action:**
Fill in the following details:

| Field | Value to Enter |
|-------|----------------|
| Clinic/Business Name | Dr. PawCare Veterinary Clinic |
| Owner/Doctor Name | Dr. Rahul Verma |
| Email | dr.pawcare.vet@testmail.com |
| Phone Number | +91 98765 43210 |
| Password | Test@Vet2026! |
| Confirm Password | Test@Vet2026! |

**Validation Points to Check:**
- [ ] Email field shows error if invalid email format (test with "invalid@")
- [ ] Phone field only accepts numbers
- [ ] Password must be at least 8 characters with uppercase, lowercase, number, and special character
- [ ] "Confirm Password" must match "Password"

**Expected Result:**
- All fields show green checkmarks or no error messages
- "Next" button becomes clickable

---

### Step 1.4: Enter Address Information

**Action:**
Fill in the following address details:

| Field | Value to Enter |
|-------|----------------|
| Address Line 1 | Shop No. 12, Ground Floor |
| Address Line 2 | Green Valley Complex |
| City | Mumbai |
| State | Maharashtra |
| Pincode | 400001 |
| Landmark (Optional) | Near City Mall |

**Additional Steps:**
1. If there's a map picker, click on the map to set exact location
2. OR enter coordinates if asked: Latitude: 19.0760, Longitude: 72.8777

**What you should see:**
- Address autocomplete suggestions as you type
- Map showing your selected location
- Pin marker on the map at your address

---

### Step 1.5: Upload Documents (KYC)

**Action:**
You need to upload the following documents:

| Document Type | What to Upload | File Format |
|---------------|----------------|-------------|
| Veterinary License | Valid vet registration certificate | PDF or Image |
| Business Registration | Shop establishment certificate | PDF or Image |
| PAN Card | Business or personal PAN | PDF or Image |
| GST Certificate | GST registration (if applicable) | PDF or Image |
| Clinic Photos | 2-3 photos of the clinic | JPG/PNG |

**How to Upload:**
1. Click on "Upload" or "Choose File" button next to each document type
2. Select the file from your computer
3. Wait for upload progress bar to complete
4. You should see a preview thumbnail or filename after successful upload

**Test Files:** Use sample PDF/images from test data folder or create dummy files named:
- `vet_license.pdf`
- `business_reg.pdf`
- `pan_card.jpg`
- `gst_cert.pdf`
- `clinic_photo1.jpg`

**Expected Result:**
- All mandatory documents show "Uploaded" or green checkmark
- Continue button becomes active

---

### Step 1.6: Set Veterinary Qualifications

**Action:**
Fill in professional details:

| Field | Value to Enter |
|-------|----------------|
| Veterinary Registration Number | MVC/2020/12345 |
| Qualification | BVSc & AH (Bachelor of Veterinary Science) |
| Years of Experience | 8 |
| Specializations | Select: General Practice, Surgery, Dentistry |
| Languages Spoken | Select: English, Hindi, Marathi |

**Specialization Options to Select (choose 3-4):**
- [x] General Practice
- [x] Surgery
- [x] Dentistry
- [ ] Dermatology
- [ ] Cardiology
- [ ] Orthopedics
- [ ] Oncology
- [ ] Emergency Care

**Expected Result:**
- At least one specialization is selected
- Registration number is validated (no special characters)

---

### Step 1.7: Set Working Hours

**Action:**
Set the clinic's operating schedule:

**Regular Hours:**
| Day | Opening Time | Closing Time | Status |
|-----|--------------|--------------|--------|
| Monday | 09:00 AM | 08:00 PM | ✅ Open |
| Tuesday | 09:00 AM | 08:00 PM | ✅ Open |
| Wednesday | 09:00 AM | 08:00 PM | ✅ Open |
| Thursday | 09:00 AM | 08:00 PM | ✅ Open |
| Friday | 09:00 AM | 08:00 PM | ✅ Open |
| Saturday | 10:00 AM | 06:00 PM | ✅ Open |
| Sunday | 10:00 AM | 02:00 PM | ✅ Open |

**Break Time (Optional):**
| Break Name | Start Time | End Time |
|------------|------------|----------|
| Lunch Break | 01:00 PM | 02:00 PM |

**How to Set:**
1. For each day, click on the time dropdown
2. Select opening time from the list
3. Select closing time from the list
4. Toggle the "Open/Closed" switch if needed

---

### Step 1.8: Add Services Offered

**Action:**
Add veterinary services with pricing:

| Service Name | Duration | Price (₹) | Description |
|--------------|----------|-----------|-------------|
| General Consultation | 30 mins | 500 | Basic health checkup and consultation |
| Vaccination | 20 mins | 800 | All standard pet vaccinations |
| Deworming | 15 mins | 300 | Deworming treatment |
| Dental Checkup | 45 mins | 1200 | Complete dental examination |
| Minor Surgery | 60 mins | 3500 | Minor surgical procedures |
| Emergency Care | 60 mins | 2000 | Emergency treatment |
| Lab Tests | 30 mins | 1500 | Blood work, urine analysis |
| X-Ray | 30 mins | 2500 | Radiographic imaging |

**How to Add Each Service:**
1. Click "Add Service" or "+" button
2. Enter service name in the text field
3. Select duration from dropdown (15 mins, 30 mins, 45 mins, 60 mins)
4. Enter price in the price field (numbers only)
5. Add description (optional but recommended)
6. Click "Save" or checkmark icon

**After Adding All Services:**
- You should see all 8 services listed
- Each service shows edit and delete options
- Total services count displayed somewhere

---

### Step 1.9: Set Up Bank Details

**Action:**
Enter payment receiving details:

| Field | Value to Enter |
|-------|----------------|
| Bank Name | HDFC Bank |
| Account Holder Name | Dr. Rahul Verma |
| Account Number | 50100012345678 |
| Confirm Account Number | 50100012345678 |
| IFSC Code | HDFC0001234 |
| Account Type | Current Account |
| UPI ID (Optional) | drpawcare@hdfcbank |

**Validation Points:**
- [ ] Account number must be 9-18 digits
- [ ] IFSC code must be 11 characters (4 letters + 7 alphanumeric)
- [ ] Account numbers must match

---

### Step 1.10: Review and Submit

**Action:**
1. Review all entered information on the summary screen
2. Check the checkbox for Terms & Conditions
3. Check the checkbox for Privacy Policy
4. Click "Submit for Approval" button

**What you should see on summary screen:**
- Business Name: Dr. PawCare Veterinary Clinic
- Type: Veterinary
- Address: Complete address shown
- Documents: All showing "Uploaded"
- Services: 8 services listed with prices
- Working Hours: Weekly schedule displayed

**Expected Result After Submit:**
- Success message: "Your application has been submitted successfully!"
- Message about approval timeline: "You will receive an email within 24-48 hours"
- Redirect to a "Pending Approval" status page

---

### Step 1.11: Admin Approval (Backend Step)

> **Note:** In production, this is done by WarmPawz admin team. For testing, you may need admin access.

**If you have Admin Access:**
1. Open admin panel: `https://admin.warmpawz.com`
2. Login with admin credentials
3. Go to "Pending Approvals" or "Vendor Applications"
4. Find "Dr. PawCare Veterinary Clinic"
5. Review details and documents
6. Click "Approve" button

**Expected Result:**
- Vendor status changes to "Approved"
- Vendor receives approval email
- Vendor can now login and access full dashboard

---

## PHASE 2: VENDOR DASHBOARD SETUP

### Step 2.1: First Login After Approval

**Action:**
1. Go to `https://vendor.warmpawz.com`
2. Enter credentials:
   - Email: `dr.pawcare.vet@testmail.com`
   - Password: `Test@Vet2026!`
3. Click "Sign In"

**What you should see:**
- Welcome message or first-time setup wizard
- Dashboard with various menu options
- Profile completion indicator (if applicable)

**Dashboard Menu Items Expected:**
- 📊 Dashboard (Home)
- 📅 Bookings
- 🐕 Services
- 💊 Medical Records
- 💰 Earnings
- ⚙️ Settings
- 👤 Profile

---

### Step 2.2: Complete Profile Setup

**Action:**
1. Click on "Profile" or "Complete Your Profile" prompt
2. Add/verify the following:

| Field | Value |
|-------|-------|
| Profile Photo | Upload a professional photo |
| About/Bio | "Dr. PawCare Veterinary Clinic has been serving pets and their families for over 8 years. We specialize in comprehensive pet healthcare with modern facilities and caring staff." |
| Consultation Fee Display | ₹500 onwards |
| Emergency Availability | Yes |
| Home Visit Available | Yes (+₹200 extra) |

---

### Step 2.3: Configure Appointment Slots

**Action:**
1. Go to "Schedule" or "Appointment Settings"
2. Set slot configuration:

| Setting | Value |
|---------|-------|
| Slot Duration | 30 minutes |
| Buffer Between Slots | 10 minutes |
| Max Appointments/Day | 20 |
| Advance Booking Days | 30 days |
| Cancellation Window | 4 hours before appointment |

**How to Configure:**
1. Navigate to Settings → Scheduling
2. Set each parameter using dropdowns or input fields
3. Click "Save Changes"

---

### Step 2.4: Enable Additional Features

**Action:**
Enable these features from settings:

| Feature | Toggle | Description |
|---------|--------|-------------|
| Video Consultation | ON | Allow online video consultations |
| Chat Support | ON | Allow customers to message |
| Prescription Management | ON | Digital prescriptions |
| Lab Reports Upload | ON | Upload test results |
| Vaccination Reminders | ON | Auto-remind customers |
| Follow-up Scheduling | ON | Schedule follow-ups |

**Expected Result:**
- Each feature shows as enabled
- Additional menu items may appear for enabled features

---

## PHASE 3: CUSTOMER BOOKING JOURNEY

> **Switch to Customer Browser Window Now**

### Step 3.1: Customer Login

**Action:**
1. Open `https://app.warmpawz.com` in a new browser/incognito window
2. Enter customer credentials:
   - Email: `priya.sharma.pet@testmail.com`
   - Password: `Test@Customer2026!`
3. Click "Sign In"

**What you should see:**
- Customer dashboard/home page
- Search bar at the top
- Categories: Vet, Grooming, Walking, etc.
- "My Pets" section
- "Upcoming Bookings" section

---

### Step 3.2: Add Pet (If Not Already Added)

**Action:**
1. Click on "My Pets" or "Add Pet" button
2. Fill in pet details:

| Field | Value |
|-------|-------|
| Pet Name | Bruno |
| Pet Type | Dog |
| Breed | Golden Retriever |
| Gender | Male |
| Date of Birth | 15-March-2022 |
| Weight | 28 kg |
| Color | Golden |
| Neutered/Spayed | No |
| Microchip Number | 123456789012345 |

**Medical History:**
| Field | Value |
|-------|-------|
| Allergies | None |
| Current Medications | None |
| Last Vaccination Date | 01-July-2025 |
| Last Vet Visit | 01-July-2025 |

3. Upload a photo of Bruno
4. Click "Save Pet"

**Expected Result:**
- Bruno appears in "My Pets" section
- Pet profile shows with photo and details

---

### Step 3.3: Search for Veterinary Services

**Action:**
1. From the home page, click on "Veterinary" or "Vet" category
2. OR use search bar and type "Vet near me"
3. Apply filters:
   - Distance: Within 10 km
   - Rating: 4+ stars
   - Availability: Today or Tomorrow

**What you should see:**
- List of veterinary clinics/doctors
- Each listing shows:
  - Clinic name and photo
  - Rating and review count
  - Distance from your location
  - Starting price
  - "Book Now" button

**Find and Click on:** "Dr. PawCare Veterinary Clinic"

---

### Step 3.4: View Vendor Profile

**Action:**
1. Click on "Dr. PawCare Veterinary Clinic" listing
2. Review the profile page

**What you should see:**
- Clinic banner/photo
- Clinic name and rating
- Address with map
- Working hours
- Services list with prices:
  - General Consultation - ₹500
  - Vaccination - ₹800
  - etc.
- Reviews section
- "Book Appointment" button

**Verification Points:**
- [ ] All information matches what vendor entered during onboarding
- [ ] Services and prices are correct
- [ ] Working hours are displayed
- [ ] Contact information is visible (but may be masked)

---

### Step 3.5: Select Service and Time Slot

**Action:**
1. Click "Book Appointment" button
2. Select Service: "General Consultation" (₹500)
3. Select Pet: "Bruno" from your pets list
4. Select Date: Tomorrow's date
5. View available time slots

**Available Time Slots Display:**
```
Morning:
[09:00 AM] [09:40 AM] [10:20 AM] [11:00 AM] [11:40 AM]

Afternoon:
[02:00 PM] [02:40 PM] [03:20 PM] [04:00 PM] [04:40 PM]

Evening:
[05:20 PM] [06:00 PM] [06:40 PM] [07:20 PM]
```

6. Click on "10:20 AM" slot

**Expected Result:**
- Selected slot gets highlighted
- "Continue" button becomes active
- Slot shows as "Selected" with checkmark

---

### Step 3.6: Add Appointment Details

**Action:**
1. On the next screen, add visit reason:

| Field | Value |
|-------|-------|
| Reason for Visit | Regular health checkup, Bruno has been scratching his ears frequently |
| Symptoms (if any) | Ear scratching, slight redness in ear |
| Duration of Symptoms | 3 days |
| Attach Photos (Optional) | Upload a photo of Bruno's ear if available |
| Special Requests | None |

2. Click "Continue to Payment"

---

### Step 3.7: Review Booking Summary

**Action:**
Review the booking summary screen:

**Booking Summary Should Show:**
```
📍 Dr. PawCare Veterinary Clinic
📅 [Tomorrow's Date] at 10:20 AM
🐕 Pet: Bruno (Golden Retriever)
💉 Service: General Consultation

Price Breakdown:
├── Consultation Fee:     ₹500
├── Platform Fee:         ₹25
├── GST (18%):           ₹94.50
└── ─────────────────────────
    Total:               ₹619.50
```

**Apply Coupon (Optional):**
1. Click "Have a coupon code?"
2. Enter: `FIRSTVET` (if available)
3. Click "Apply"
4. Check if discount is applied

---

### Step 3.8: Make Payment

**Action:**
1. Select Payment Method:
   - Credit/Debit Card
   - UPI
   - Net Banking
   - Wallet

2. For Card Payment:
   - Click on "Credit/Debit Card"
   - Enter test card details:
     ```
     Card Number: 4111 1111 1111 1111
     Expiry: 12/28
     CVV: 123
     Name: Priya Sharma
     ```
   - Click "Pay ₹619.50"

3. Wait for payment processing (5-10 seconds)

**Expected Result:**
- Payment success message
- Booking confirmation screen
- Booking ID displayed (e.g., "WP-VET-2026011512345")
- Confirmation email/SMS sent

---

### Step 3.9: View Booking Confirmation

**Action:**
1. Note down the Booking ID: `WP-VET-2026011512345`
2. Check the confirmation details:

**Confirmation Screen Should Show:**
- ✅ "Booking Confirmed!" message
- Booking ID
- Date and Time
- Clinic name and address
- Directions button (opens maps)
- Add to Calendar button
- Share booking option

3. Click "Add to Calendar" and verify calendar event is created
4. Click "View My Bookings" to go to bookings list

---

## PHASE 4: SERVICE DELIVERY

> **Switch to Vendor Browser Window**

### Step 4.1: Vendor Receives Booking Notification

**Action:**
1. In vendor dashboard, check the notification bell icon
2. You should see a new notification

**Notification Should Show:**
```
🔔 New Booking Received!
   Customer: Priya Sharma
   Pet: Bruno (Golden Retriever)
   Service: General Consultation
   Date: [Tomorrow] at 10:20 AM
   Booking ID: WP-VET-2026011512345
```

3. Click on the notification to view booking details

---

### Step 4.2: View Booking in Dashboard

**Action:**
1. Go to "Bookings" from the main menu
2. Click on "Upcoming" tab
3. Find the booking from Priya Sharma

**Booking Card Should Show:**
- Customer name and photo
- Pet name and type
- Service booked
- Date and time
- Booking status: "Confirmed"
- "View Details" button
- "Start Consultation" button (will be active at appointment time)

---

### Step 4.3: View Customer and Pet Details

**Action:**
1. Click "View Details" on the booking
2. Review the complete information:

**Customer Information:**
- Name: Priya Sharma
- Phone: +91 87654 32109 (may be masked until appointment)
- Previous visits: 0 (new customer)

**Pet Information:**
- Name: Bruno
- Type: Dog
- Breed: Golden Retriever
- Age: ~4 years
- Weight: 28 kg
- Medical History: View history button

**Visit Reason:**
- "Regular health checkup, Bruno has been scratching his ears frequently"
- Symptoms: Ear scratching, slight redness

---

### Step 4.4: Day of Appointment - Check-In Customer

> **On the appointment day, at appointment time**

**Action (Vendor):**
1. When customer arrives, go to the booking
2. Click "Check-In" or "Start Appointment" button
3. Confirm check-in

**Expected Result:**
- Booking status changes from "Confirmed" to "In Progress"
- Timer starts showing appointment duration
- Customer receives notification of check-in

---

### Step 4.5: Conduct Consultation

**During the consultation, vendor can:**

1. **View Pet History:**
   - Click "View Medical Records"
   - See previous visits, vaccinations, treatments

2. **Take Notes:**
   - Click "Add Notes"
   - Enter: "Physical examination completed. Mild ear infection observed in left ear. Ear appears red with slight discharge. Recommended ear cleaning and medication."

3. **Record Vitals:**
   | Vital | Value |
   |-------|-------|
   | Weight | 28 kg |
   | Temperature | 101.5°F |
   | Heart Rate | 80 bpm |
   | Respiratory Rate | 20 breaths/min |

4. **Record Diagnosis:**
   - Primary Diagnosis: "Otitis Externa (Ear Infection)"
   - Severity: Mild
   - Affected Area: Left Ear

---

### Step 4.6: Create Prescription

**Action:**
1. Click "Add Prescription" button
2. Add medications:

**Medication 1:**
| Field | Value |
|-------|-------|
| Medicine Name | Otomax Ear Drops |
| Type | Ear Drops |
| Dosage | 4 drops |
| Frequency | Twice daily (morning and night) |
| Duration | 7 days |
| Instructions | Clean ear with cotton before applying. Apply in left ear only. |

**Medication 2:**
| Field | Value |
|-------|-------|
| Medicine Name | Cephalexin 250mg |
| Type | Tablet |
| Dosage | 1 tablet |
| Frequency | Twice daily after food |
| Duration | 5 days |
| Instructions | Give with food to avoid stomach upset |

3. Add general instructions:
   - "Keep ears dry - avoid bathing for 7 days"
   - "Return for follow-up in 7 days"
   - "Contact immediately if symptoms worsen"

4. Click "Generate Prescription"

**Expected Result:**
- Prescription PDF is generated
- Prescription is visible to customer in their app
- Digital signature of vet is added

---

### Step 4.7: Schedule Follow-up (Optional)

**Action:**
1. Click "Schedule Follow-up"
2. Set follow-up date: 7 days from today
3. Add note: "Check ear infection progress"
4. Click "Schedule"

**Expected Result:**
- Follow-up appointment created
- Customer receives notification about follow-up
- Follow-up appears in both vendor and customer calendars

---

### Step 4.8: Complete Appointment

**Action:**
1. After prescription is created, click "Complete Appointment"
2. Confirm completion
3. Add any final notes if needed

**Expected Result:**
- Booking status changes to "Completed"
- Payment is released to vendor (settlement initiated)
- Customer receives completion notification
- Review request is sent to customer

---

## PHASE 5: PAYMENT & REVENUE

### Step 5.1: View Earnings (Vendor)

**Action:**
1. Go to "Earnings" from the main menu
2. View today's earnings

**Earnings Dashboard Should Show:**
```
Today's Earnings: ₹500
├── Consultation (Priya - Bruno): ₹500

This Week: ₹500
This Month: ₹500

Pending Settlement: ₹500
Next Settlement Date: [2 business days from now]
```

---

### Step 5.2: View Transaction Details

**Action:**
1. Click on the transaction "Priya - Bruno - Consultation"
2. View breakdown:

**Transaction Details:**
```
Booking ID: WP-VET-2026011512345
Customer: Priya Sharma
Service: General Consultation
Gross Amount: ₹619.50
├── Platform Commission (10%): -₹50
├── GST Deducted: -₹94.50
└── ─────────────────────────
    Net Earnings: ₹475

Settlement Status: Pending
Expected Settlement: [Date]
```

---

### Step 5.3: View Settlement History

**Action:**
1. Go to "Settlements" tab
2. View past settlements (may be empty for new vendor)

**Settlement Information:**
- Settlement Cycle: Weekly (every Monday)
- Minimum Threshold: ₹500
- Bank Account: HDFC Bank ****5678

---

## PHASE 6: POST-SERVICE ACTIONS

### Step 6.1: Customer Views Completed Appointment

> **Switch to Customer Browser Window**

**Action:**
1. Go to "My Bookings" or "Booking History"
2. Click on "Past" or "Completed" tab
3. Find the consultation with Dr. PawCare

**Completed Booking Should Show:**
- Status: Completed ✓
- Date and time of visit
- Service received
- "View Details" button
- "View Prescription" button
- "Rate & Review" button
- "Book Again" button

---

### Step 6.2: View Prescription (Customer)

**Action:**
1. Click "View Prescription"
2. Prescription opens showing:
   - Doctor name and clinic
   - Date of prescription
   - Pet name
   - Diagnosis
   - Medications with dosage
   - General instructions
   - Vet's digital signature

3. Click "Download PDF" to save prescription
4. Click "Order Medicines" (if pharmacy integration available)

---

### Step 6.3: Customer Submits Review

**Action:**
1. Click "Rate & Review" button
2. Fill in review:

| Field | Value |
|-------|-------|
| Overall Rating | ⭐⭐⭐⭐⭐ (5 stars) |
| Cleanliness | ⭐⭐⭐⭐⭐ (5 stars) |
| Staff Behavior | ⭐⭐⭐⭐⭐ (5 stars) |
| Value for Money | ⭐⭐⭐⭐ (4 stars) |
| Written Review | "Excellent experience! Dr. Verma was very gentle with Bruno and explained everything clearly. The clinic is clean and well-equipped. Bruno's ear infection is already improving after 2 days. Highly recommended!" |
| Add Photos (Optional) | Upload a photo of happy Bruno |

3. Check "Recommend this clinic" checkbox
4. Click "Submit Review"

**Expected Result:**
- Thank you message displayed
- Review appears on clinic profile
- Vendor receives notification of new review

---

### Step 6.4: Vendor Views Review

> **Switch to Vendor Browser Window**

**Action:**
1. Check notifications - new review notification
2. Go to "Reviews" section from menu
3. View the new review

**Review Display:**
```
⭐⭐⭐⭐⭐ 5.0
Priya Sharma - Bruno (Golden Retriever)
General Consultation | [Date]

"Excellent experience! Dr. Verma was very gentle with Bruno..."

[Reply to Review] button
```

---

### Step 6.5: Vendor Responds to Review

**Action:**
1. Click "Reply to Review"
2. Enter response:
   ```
   Thank you so much, Priya! We're glad Bruno is feeling better. 
   Please don't forget the follow-up appointment next week. 
   Looking forward to seeing you and Bruno again! 🐕
   ```
3. Click "Post Reply"

**Expected Result:**
- Reply appears below the review
- Customer receives notification of reply

---

### Step 6.6: Customer Receives Follow-up Reminder

**On the day before follow-up appointment:**

**Customer Should Receive:**
- Push notification
- Email reminder
- SMS reminder (if enabled)

**Notification Content:**
```
🔔 Reminder: Follow-up appointment tomorrow!
   Dr. PawCare Veterinary Clinic
   [Date] at [Time]
   Pet: Bruno
   
   [Confirm] [Reschedule] [Cancel]
```

---

## EDGE CASES

### Edge Case 1: Customer Cancellation

**Scenario:** Customer cancels booking 2 hours before appointment

**Test Steps:**
1. Customer goes to "My Bookings"
2. Clicks "Cancel Booking"
3. Selects reason: "Pet is not feeling well enough to travel"
4. Confirms cancellation

**Expected Behavior:**
- If cancelled within 4-hour window: Full refund
- If cancelled within 2 hours: Partial refund (50%) or no refund based on policy
- Vendor receives cancellation notification
- Time slot becomes available again

---

### Edge Case 2: Vendor Cancellation

**Scenario:** Vendor has emergency and needs to cancel

**Test Steps:**
1. Vendor goes to booking
2. Clicks "Cancel Booking"
3. Selects reason: "Emergency - Doctor unavailable"
4. Adds note: "Sincere apologies, emergency situation"
5. Confirms cancellation

**Expected Behavior:**
- Customer receives full refund
- Customer gets notification with apology
- Customer offered priority rebooking
- Vendor cancellation recorded (affects rating if frequent)

---

### Edge Case 3: Customer No-Show

**Scenario:** Customer doesn't arrive for appointment

**Test Steps:**
1. Vendor waits 15 minutes past appointment time
2. Customer has not checked in
3. Vendor marks as "No Show"
4. Confirms no-show

**Expected Behavior:**
- Booking marked as "No Show"
- Vendor receives partial payment (no-show fee)
- Customer receives notification
- No-show recorded on customer profile

---

### Edge Case 4: Rescheduling

**Scenario:** Customer wants to change appointment time

**Test Steps (Customer):**
1. Go to booking details
2. Click "Reschedule"
3. Select new date/time
4. Confirm reschedule

**Expected Behavior:**
- If rescheduled 24+ hours before: Free reschedule
- If rescheduled within 24 hours: May incur fee
- Vendor receives notification of change
- New time slot booked, old slot released

---

### Edge Case 5: Payment Failure

**Scenario:** Payment fails during booking

**Test Steps:**
1. Customer proceeds to payment
2. Use decline card: 4000 0000 0000 0002
3. Attempt payment

**Expected Behavior:**
- Error message: "Payment failed. Please try another payment method."
- Booking NOT confirmed
- Time slot still held for 10 minutes
- Customer can retry with different method

---

### Edge Case 6: Double Booking Attempt

**Scenario:** Two customers try to book same slot simultaneously

**Test Steps:**
1. Customer A selects 10:20 AM slot
2. Customer B also selects 10:20 AM slot (before A completes)
3. Customer A completes payment first
4. Customer B tries to complete payment

**Expected Behavior:**
- Customer A booking succeeds
- Customer B sees: "This slot is no longer available"
- Customer B asked to select different slot
- No double booking occurs

---

### Edge Case 7: Emergency Booking

**Scenario:** Customer needs urgent same-day appointment

**Test Steps:**
1. Customer searches for "Emergency Vet"
2. Filters by "Available Now" or "Emergency Services"
3. Sees emergency surcharge notice
4. Books emergency slot

**Expected Behavior:**
- Emergency slots shown separately
- Higher pricing displayed clearly (e.g., ₹2000 instead of ₹500)
- Faster confirmation process
- Vendor receives urgent notification

---

### Edge Case 8: Refund Request

**Scenario:** Customer disputes service quality

**Test Steps:**
1. Customer goes to completed booking
2. Clicks "Report Issue" or "Request Refund"
3. Selects reason: "Service not as described"
4. Provides details

**Expected Behavior:**
- Support ticket created
- Vendor notified
- Admin reviews case
- Decision communicated to both parties

---

### Edge Case 9: Network Disconnection During Payment

**Scenario:** Internet drops during payment processing

**Test Steps:**
1. Customer initiates payment
2. Disconnect internet momentarily
3. Reconnect

**Expected Behavior:**
- Payment status shows "Pending" or "Processing"
- Customer can check status in "My Bookings"
- System auto-verifies payment status
- If paid: Booking confirmed
- If not paid: Booking cancelled, slot released

---

### Edge Case 10: Multiple Pets Same Appointment

**Scenario:** Customer wants to bring 2 pets

**Test Steps:**
1. During booking, look for "Add Another Pet" option
2. Add second pet if available
3. Complete booking

**Expected Behavior:**
- Some services allow multiple pets
- Additional charges may apply
- Both pets listed in booking
- Longer time slot allocated if needed

---

## TROUBLESHOOTING GUIDE

### Problem: Cannot Login

**Symptoms:** "Invalid credentials" error

**Solutions:**
1. Check caps lock is off
2. Verify email spelling
3. Click "Forgot Password" to reset
4. Clear browser cache and cookies
5. Try incognito/private window

---

### Problem: Slots Not Showing

**Symptoms:** No available time slots displayed

**Solutions:**
1. Check if vendor has set working hours
2. Try selecting a different date
3. Vendor may be fully booked
4. Check if vendor is on holiday
5. Refresh the page

---

### Problem: Payment Page Not Loading

**Symptoms:** Blank payment screen or timeout

**Solutions:**
1. Refresh the page
2. Disable ad-blockers
3. Try different browser
4. Check internet connection
5. Clear cache and cookies

---

### Problem: Booking Confirmation Not Received

**Symptoms:** No email/SMS after payment

**Solutions:**
1. Check spam/junk folder
2. Verify phone number in profile
3. Check "My Bookings" in app - may already be confirmed
4. Wait 5 minutes and check again
5. Contact support if still not received

---

### Problem: Map Location Wrong

**Symptoms:** Clinic shows incorrect location

**Solutions (Vendor):**
1. Go to Profile → Address
2. Click "Update Location"
3. Use map picker to set correct pin
4. Verify address details
5. Save changes

---

## TEST COMPLETION CHECKLIST

Use this checklist to ensure all tests are completed:

### Vendor Onboarding
- [ ] Vendor registration completed
- [ ] All documents uploaded
- [ ] Services added with pricing
- [ ] Working hours set
- [ ] Bank details configured
- [ ] Profile approved

### Customer Booking
- [ ] Customer logged in
- [ ] Pet profile created
- [ ] Vendor search working
- [ ] Slot selection working
- [ ] Payment successful
- [ ] Confirmation received

### Service Delivery
- [ ] Vendor received notification
- [ ] Check-in completed
- [ ] Medical records updated
- [ ] Prescription created
- [ ] Appointment completed

### Post-Service
- [ ] Customer review submitted
- [ ] Vendor responded to review
- [ ] Earnings reflected
- [ ] Settlement details correct

### Edge Cases
- [ ] Cancellation tested
- [ ] Rescheduling tested
- [ ] No-show tested
- [ ] Payment failure tested
- [ ] Refund tested

---

## NOTES & OBSERVATIONS

Use this space to record any bugs, issues, or observations during testing:

| Date | Test Case | Issue Found | Severity | Notes |
|------|-----------|-------------|----------|-------|
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |

---

**End of Veterinary Testing Plan**

---

*Document prepared for WarmPawz Functional Testing Team*
*For questions, contact: testing@warmpawz.com*
