# Warmpawz End-to-End (E2E) Validation & User Guide

This document serves as the master validation guide for testing the Warmpawz platform across all 20 vendor roles. It covers the entire lifecycle from **Vendor Onboarding** to **Customer Booking** and **Service Fulfillment**.

> **⚠️ TESTER NOTICE:** Some advanced vendor roles (Resort, Cafe, Breeder) currently utilize the *Generic Service Architecture*. While vendors can create these services, the *Customer App* specific booking flows for these niches are currently marked as "Coming Soon" in the production build. These gaps are detailed in Section 6.

---

## 1. Medical Services (Vet, Nutritionist, Behaviorist)

### A. Vendor Journey (Provider)
**Role:** `veterinarian`, `pet_clinic`, `pet_nutritionist`, `pet_behaviorist`

1.  **Onboarding:**
    *   **Signup:** Use a fresh phone number (e.g., `9999999901`).
    *   **Selection:** Choose "Pet Clinic" or "Veterinarian".
    *   **Documents:** Upload Dummy "Veterinary License" & "GST Certificate".
    *   **Validation:** Admin must approve this profile via Admin Portal.
2.  **Service Setup:**
    *   Go to **Service Management**.
    *   Select **"Book at Clinic"** or **"Tele Consultation"**.
    *   Enable standard services (e.g., "General Consultation", "Vaccination").
    *   *Optional:* Create a "Custom Service" (e.g., "Dental Surgery") via the "Create" button.
3.  **Schedule Management:**
    *   Go to **Schedule**.
    *   Click "Manage Availability".
    *   Set working hours (e.g., Mon-Fri, 9 AM - 6 PM).
    *   *Staff:* Go to **Staff Management**, add a "Junior Vet", and assign them specific slots.

### B. Customer Journey (User)
1.  **Discovery:**
    *   Open Customer App -> Click **"Vet Consultation"**.
    *   Select **"Find a Doctor"** or **"Book Clinic Visit"**.
    *   Filter by "Video Consult" or "Clinic Visit".
2.  **Booking:**
    *   Select the Vendor Profile created above.
    *   Choose Service: "General Consultation".
    *   Select Date & Time Slot.
    *   **Payment:** Complete payment via Razorpay (Test Mode).
3.  **Fulfillment (The "Happy Path"):**
    *   **Tele-Health:**
        *   Vendor Dashboard: Shows "Upcoming Consultation".
        *   Action: Click **"Start Call"** (uses internal video bridge).
        *   Post-Call: Click **"Add Prescription"** -> Select Medicine -> Send.
    *   **Clinic Visit:**
        *   Customer arrives.
        *   Vendor clicks **"Check In"** on Dashboard.
        *   Vendor clicks **"Complete"** after service.

---

## 2. Home & Mobile Services (Groomer, Walker, Ambulance)

### A. Vendor Journey
**Role:** `pet_groomer`, `pet_walker`, `pet_ambulance`

1.  **Onboarding:**
    *   **Selection:** Choose "Pet Groomer" or "Pet Walker".
    *   **Documents:** **Police Verification Certificate (PVC)** is MANDATORY.
    *   **Location:** Pin exact home base location (used for radius calculation).
2.  **Service Setup:**
    *   Select **"Home Services"**.
    *   Enable "Full Grooming" or "Daily Walk".
    *   **Pricing:** Set custom price (e.g., ₹500).
3.  **Live Tracking Setup (Walker/Ambulance Only):**
    *   Ensure "GPS Permissions" are allowed in browser.

### B. Customer Journey
1.  **Discovery:**
    *   Customer App -> **"Grooming"** or **"Walking"**.
    *   App filters vendors within 5-10km radius.
2.  **Booking:**
    *   Select Service -> Choose "Home Visit".
    *   Select Time Slot.
    *   Pay & Confirm.
3.  **Fulfillment (OTP Flow):**
    *   **Start:** Vendor travels to customer location.
    *   **Arrival:** Vendor opens booking in Dashboard.
    *   **Action:** Vendor requests **Start OTP**.
    *   **Customer:** Finds OTP in "My Bookings".
    *   **Execution:** Vendor enters OTP -> **"Start Service"**.
    *   **Tracking:** (For Walkers) Map updates live location.
    *   **Completion:** Vendor clicks "Complete Service".

---

## 3. Retail & Commerce (Pet Store, Pharmacy)

### A. Vendor Journey
**Role:** `pet_product`, `pet_pharmacy`

1.  **Onboarding:**
    *   **Selection:** Choose "Pet Products Store".
    *   **Documents:** Shop Act License (or Drug License for Pharmacy).
2.  **Store Setup:**
    *   Dashboard auto-switches to **Commerce Mode** (Schedule hidden).
    *   Go to **"Business Hub"** -> **"Inventory"**.
    *   **Add Product:** Upload Image, Name, SKU, Price, Stock Count.
    *   *Low Stock:* Set alert threshold (e.g., 5 items).
3.  **Order Management:**
    *   Watch the **"Orders"** tab for incoming purchases.

### B. Customer Journey
1.  **Discovery:**
    *   Customer App -> **"Shop"** or **"Pharmacy"**.
    *   Browse Categories (Food, Toys, Medicine).
    *   *Pharmacy:* Upload Prescription (Required for Rx meds).
2.  **Checkout:**
    *   Add to Cart -> Checkout.
    *   Address Selection -> Payment.
3.  **Fulfillment:**
    *   Vendor Dashboard -> **"Orders"**.
    *   Action: **"Accept Order"** -> **"Mark Shipped"** (Enter Tracking #) -> **"Mark Delivered"**.

---

## 4. Facility & Hospitality (Resort, Cafe, Boarding)

### A. Vendor Journey
**Role:** `pet_resort`, `pet_cafe`, `pet_boarder`

1.  **Onboarding:**
    *   **Documents:** Facility Photos (Mandatory).
2.  **Facility Setup (Generic Workaround):**
    *   *Current System Limitation:* No dedicated "Room Builder" or "Table Map".
    *   **Action:** Go to **Service Management**.
    *   **Create Service:** Name it "Deluxe Room (Per Night)" or "Table Reservation (4 Pax)".
    *   **Price:** Set price per unit.
3.  **Packages:**
    *   Use **"Package Management"** to create "Weekend Getaway" (3 Days + Spa).

### B. Customer Journey
1.  **Discovery:**
    *   Customer App -> **"Boarding"** (Resort/Cafe landing pages are currently "Coming Soon").
    *   Select Vendor -> View "Services" (Rooms listed as services).
2.  **Booking:**
    *   Select "Deluxe Room" -> Choose Dates.
    *   Book -> Pay.

---

## 5. Implementation Gaps & Next Steps

The following gaps were identified during E2E validation. These features are partially implemented on the Vendor side (via generic tools) but are **missing or incomplete on the Customer App**.

| Vendor Role | Feature Gap | Current Behavior | Recommended Fix |
| :--- | :--- | :--- | :--- |
| **Pet Resort** | Room Inventory | Vendors create Rooms as "Services". No check-in/check-out logic. | Build `ResortBookingFlow` in Customer App with Date Range Picker. |
| **Pet Cafe** | Table Reservation | Vendors create Tables as "Services". No time-slot/pax logic. | Build `CafeReservationFlow` in Customer App with Pax selector. |
| **Pet Breeder** | Live Animal Catalog | Uses generic Product Inventory. No "Pedigree" or "Litter" fields. | Add `BreederCatalogView` with specialized animal profile fields. |
| **Ambulance** | Emergency Dispatch | Uses standard booking slots. No "Instant SOS" button. | Implement "Emergency SOS" button bypassing standard schedule. |
| **Adoption** | Pet Matching | Basic list view. No compatibility matching algorithm. | Implement "Adoption Questionnaire" in Customer App. |

### ⚠️ Critical "Coming Soon" Screens
The following Customer App routes currently lead to a "Coming Soon" placeholder and need immediate development to enable E2E testing for these specific roles:
1.  `ResortServicesLanding`
2.  `PetCafeServicesLanding`
3.  `BreederServicesLanding`
4.  `PhotographyServicesLanding`
5.  `RelocationServicesLanding`

---

## 6. Test Data & Credentials

*   **Admin Portal:** Access via `/admin` (No auth required in Dev).
*   **OTP Code:** `123456` (Hardcoded for testing).
*   **Test Payment:** Use Razorpay Test Card data.
*   **Staff Login:** Create staff in Vendor Dashboard, then use their phone number to login.

This document confirms that while the **Core Platform (Vet, Retail, Walker)** is 100% E2E ready, the **Specialized Verticals (Resort, Cafe)** require frontend development on the Customer App to be fully viable.
