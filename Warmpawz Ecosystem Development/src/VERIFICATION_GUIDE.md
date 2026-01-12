# Warmpawz: Master Verification & QA Guide

**Version:** 1.0  
**Purpose:** This guide serves as the "Acceptance Criteria" for the frontend implementation. Use this to verify that the UI, Flows, and Integrations are "Pixel-Perfect" and functionally correct according to the Master Guides.

---

## 🛠️ Verification Setup
1.  **Environment:** Localhost (No backend required).
2.  **Data Source:** Ensure `MockAPI` is serving data from `mockDataExtended.ts`.
3.  **Tools:** Chrome DevTools (Mobile View - iPhone 14 Pro Dimensions).

---

## 📱 Component 1: Customer App Verification

### 1. Global UI & Integrations
- [ ] **Navigation:** Verify Bottom Nav appears on Home, Bookings, Account. Hides on Booking Flow/Checkout.
- [ ] **Maps (Integration UI):**
    -   Go to Home -> Radar Map.
    -   *Check:* Map loads. Markers are visible.
    -   *Check:* Clicking a marker opens a "Quick View" bottom sheet for the vendor.
- [ ] **Search (Elastic-Mock):**
    -   Type "Vet". *Check:* Dropdown shows Vendors, Services, and Products.
    -   Type "Vomit". *Check:* "Problems" section appears. Click -> Goes to `ServicesByProblem`.

### 2. Service Booking Flows (Role Specific)

#### 🚑 Emergency & Medical
- [ ] **Ambulance (Uber-Style):**
    -   Click "Emergency SOS".
    -   *Check:* Location detected (Mock address shown).
    -   Click "Confirm SOS".
    -   *Check:* **Live Tracking Screen** appears. Car icon moves on map. Driver details shown.
- [ ] **Veterinary (Tele-Consult):**
    -   Select Vet -> "Video Consultation".
    -   *Check:* Time slots are clickable.
    -   Book & Pay.
    -   Go to "My Bookings" -> Click "Join Call".
    -   *Check:* **Video Interface** opens (Self-view + Remote-view placeholders). Mute/Camera buttons work.

#### 🍽️ Hospitality (Cafe & Resort)
- [ ] **Pet Cafe (Zomato-Style):**
    -   Open Cafe Profile. *Check:* Hero image slider, Menu tabs, Reviews.
    -   Click "Book Table". *Check:* Date/Time picker + Guest Count.
    -   *Check:* "Pre-order Food" accordion works.
- [ ] **Resort (Airbnb-Style):**
    -   Select Resort. *Check:* "Check-in" & "Check-out" date pickers.
    -   Select Room (Kennel vs Suite).
    -   *Check:* Price updates based on (Nights * Room Price).

#### 💊 Retail & Pharmacy
- [ ] **Pharmacy (Restricted):**
    -   Add "Prescription Drug" to cart.
    -   *Check:* Warning Modal "Upload Prescription" appears.
    -   Upload dummy file. *Check:* Progress bar -> Success tick.
- [ ] **E-Commerce Checkout:**
    -   Add 2 items to Cart.
    -   Go to Checkout.
    -   *Check:* **Tax Calculation:** Subtotal + 18% GST is displayed correctly.
    -   *Check:* **Address:** Clicking "Change" opens Address Book.
    -   *Check:* **Payment:** Click "Pay" -> Mock Razorpay Modal appears -> Success -> Order Tracking Screen.

---

## 🏢 Component 2: Vendor App Verification

### 1. Onboarding & Role Switching
- [ ] **Solo Onboarding:**
    -   Select "Dog Walker".
    -   *Check:* Form is short (Name, Phone, Service Area).
- [ ] **Business Onboarding:**
    -   Select "Pet Resort".
    -   *Check:* Form includes "Facility Photos", "GST", "Location".
- [ ] **Dashboard Adaptation:**
    -   Login as **Vet**. *Check:* "My Appointments", "Prescriptions" widgets visible.
    -   Login as **Cafe**. *Check:* "Table Reservations", "Menu Management" widgets visible.
    -   Login as **Seller**. *Check:* "Orders", "Inventory" widgets visible.

### 2. Service & Catalog Management
- [ ] **General Service Creation:**
    -   Go to Services -> Add New.
    -   Fill Form -> Save.
    -   *Check:* New service appears in the list immediately.
- [ ] **Cafe Menu:**
    -   Go to Menu Management.
    -   Add Item "Dog Pizza". Set Price ₹300. Toggle "Veg".
    -   *Check:* Item appears in "Main Course" category.
- [ ] **Resort Rooms:**
    -   Go to Facility -> Rooms.
    -   Add "Luxury Suite". Set Capacity: 2.
    -   *Check:* Room appears in inventory.

### 3. Operational Flows
- [ ] **Home Service (Walker/Vet):**
    -   Go to Bookings -> "Upcoming".
    -   Click "Start Service".
    -   *Check:* **GPS Tracker Screen** opens. "Slide to Finish" UI is visible.
- [ ] **Order Processing (Seller):**
    -   Go to "Orders".
    -   Click "Ship Order".
    -   *Check:* Status updates to "Shipped". Tracking ID input appears.

---

## 👮 Component 3: Admin & Governance Verification

### 1. Policy Enforcement
- [ ] **Cancellation & Refunds:**
    -   **Scenario:** Customer cancels a booking < 24 hrs before start.
    -   **Vendor Setting:** Policy is "Strict" (No refund < 24hrs).
    -   *Check:* Cancel Modal shows "Refund Amount: ₹0".
    -   **Change Setting:** Vendor changes policy to "Flexible".
    -   *Check:* Cancel Modal shows "Refund Amount: Full".

### 2. Settlement System
- [ ] **Commission Logic:**
    -   **Vendor Tier:** Silver (10% Commission).
    -   **Booking:** ₹1000.
    -   Go to Vendor Wallet.
    -   *Check:* Transaction shows "+₹900" (Net) and "-₹100" (Platform Fee).

---

## 🔌 Integration Simulation Checklist
*Even though backend is mocked, the UI must simulate the integration experience.*

| Integration | UI Expectation | Verification |
| :--- | :--- | :--- |
| **Maps (Google)** | Interactive map component with custom pins (Vendor Logos). | Zoom/Pan works. Pins are clickable. |
| **Payment (Razorpay)** | Bottom sheet or Modal with "Cards/UPI" options. | Loading spinner on click -> "Success" animation. |
| **Chat (Twilio)** | Chat window with bubbles. "Typing..." indicators. | Send message -> Appears instantly. |
| **Video (WebRTC)** | Split screen or Picture-in-Picture layout. | Controls (Mic/Video) toggle icons. |
| **Storage (S3)** | File Input with Progress Bar. | Upload -> Shows "Preview" thumbnail (not generic icon). |

---

## 🚦 Final Sign-Off Criteria
1.  **No "Undefined" Errors:** Navigate through every screen in the Master Guides. No red screens or console crashes.
2.  **Data Persistence (Session):** Reloading the page should keep the user logged in and Cart contents intact (Mock LocalStorage).
3.  **Visual Consistency:** All buttons use the primary Gradient Orange. All headings use "Inter". Padding is consistent (no elements hidden behind nav bars).

**If all checkboxes pass, the build is Production-Ready (Design-Wise).**
