# Warmpawz Customer App: Complete Implementation & Experience Guide

**Version:** 3.1 (Updated with Integration UI Details)
**Scope:** End-to-End User Journeys, Service Buying (20 Roles), E-commerce, and Core Systems (Wallet, Profile, GST).

---

## 🏗️ Core Systems & User Account

These modules are accessible globally and drive the personalization of the app.

### 1. Authentication & Onboarding
*   **UI File:** `/components/customer/CustomerAuth.tsx`
*   **Flow:** Phone Input -> OTP (`MockAPI.auth.generateOTP`) -> Verify (`MockAPI.auth.verifyOTP`).
*   **New User:** Redirects to `/components/customer/CustomerOnboarding.tsx`.
*   **Data:** Creates session token. Stores `user_id` in local storage.

### 2. User Profile Management
*   **UI File:** `/components/customer/CustomerProfile.tsx`
*   **Sections:**
    *   **Personal Info:** Name, Email, Phone (`MockAPI.customer.updateProfile`).
    *   **Address Book:** Manage multiple delivery/service addresses.
        *   *Action:* Add/Edit/Delete Address.
        *   *Data:* Saved in `customer.addresses` array.
    *   **Payment Methods:** Saved Cards / UPI IDs (Tokenized display).

### 3. Pet Profile System (The "Why")
*   **UI File:** `/components/customer/PetProfileDashboard.tsx`
*   **Importance:** All bookings require a selected `pet_id`.
*   **Fields:** Name, Breed, Age, Weight, Gender, **Medical Documents**.
*   **Action:** `MockAPI.customer.addPet(formData)`.
*   **Integration UI:** File upload progress bar for Medical Records (Simulating S3 upload).

### 4. Wallet & Loyalty
*   **UI File:** `/components/customer/WalletPage.tsx`
*   **Display:** Current Balance (₹), Transaction History.
*   **Action:** "Top Up" -> Opens Payment Gateway Modal -> Updates Balance.
*   **Loyalty:** "Pawints" earned on bookings. Displayed in Header.

### 5. Global Search (Elastic-like)
*   **UI File:** `/components/customer/EnhancedSearchBar.tsx`
*   **Behavior:** Real-time debounce search.
*   **Scope:** Searches Vendors, Services, Products, and Problems (Symptoms).
*   **Result Handling:**
    *   *Vendor:* Navigates to Vendor Profile.
    *   *Service:* Navigates to Service Landing.
    *   *Product:* Navigates to Product Detail.

---

## 🔌 External Integrations UI Layer
*Even though logic is mocked, these UI elements must simulate real 3rd party tools.*

1.  **Maps (Google/Mapbox):**
    *   **Usage:** Radar Map, Live Tracking, Address Picker.
    *   **UI Requirement:** Must display an interactive map container (Leaflet or similar mock). Markers must use custom icons (e.g., Vet Cross, Cafe Cup).
2.  **Payment Gateway (Razorpay/Stripe):**
    *   **Usage:** Checkout, Wallet Top-up.
    *   **UI Requirement:** Do not just "auto-succeed". Show a Modal/Sheet simulating the Gateway selection (Card/UPI/Netbanking) -> Processing Spinner -> Success Animation.
3.  **Video Calls (Twilio/WebRTC):**
    *   **Usage:** Vet Tele-consult.
    *   **UI Requirement:** `/components/customer/VideoCallInterface.tsx` must show a "Waiting Room" -> "Connected" state with Mute/Camera controls and Picture-in-Picture view.

---

## 🛍️ Service Buying Experience (Role-by-Role)

### Group A: Medical & Emergency (High Trust)

#### 1. Veterinarian (Tele / Home / Clinic)
*   **Landing:** `/components/customer/VetServicesLanding.tsx`.
*   **Discovery:** Filter by "Near Me" or "Rating".
*   **Booking Flow:**
    1.  Select Doctor -> View Profile (Qualifications).
    2.  Select Service Type (Video/Visit).
    3.  Select Slot (from `MockAPI.vendor.getStaffAvailability`).
    4.  **Checkout:** Pay Consultation Fee.
    5.  **Post-Booking:** Join Video Call button appears 5 mins before slot.

#### 2. Ambulance (Emergency)
*   **UI:** `/components/customer/AmbulanceSOS.tsx`.
*   **Experience:** "Uber-like".
    1.  Click SOS.
    2.  Confirm Location (Auto-detected).
    3.  **Booking:** Instant confirmation (`MockAPI.integratedServices.bookAmbulance`).
    4.  **Live Tracking:** `/components/customer/AmbulanceRealTimeTracking.tsx`. Map shows driver path to user.

#### 3. Nutritionist (Subscription)
*   **UI:** `/components/customer/NutritionistServicesLanding.tsx`.
*   **Flow:** Book Consultation -> Nutritionist creates Diet Plan -> User subscribes to "Monthly Meal Plan".
*   **Tracking:** `/components/customer/NutritionistFoodDeliveryTracking.tsx` (Daily delivery status).

#### 4. Pharmacy (Prescription Based)
*   **UI:** `/components/customer/PharmacyStore.tsx`.
*   **Flow:**
    1.  Search Medicine.
    2.  Add to Cart.
    3.  **Validation:** If medicine is restricted, Modal asks to "Upload Prescription".
    4.  Checkout.

---

### Group B: Daily Care & Training

#### 5. Grooming (Home/Spa)
*   **UI:** `/components/customer/GroomingServicesLanding.tsx`.
*   **Flow:**
    1.  Select Service (Bath / Haircut).
    2.  Select "Mobile Van" or "Salon Visit".
    3.  Select Add-ons (Tick Bath).
    4.  Book Slot.

#### 6. Dog Walking (Recurring)
*   **UI:** `/components/customer/WalkingServicesLanding.tsx`.
*   **Flow:**
    1.  Select Walker.
    2.  Choose Package (10 Walks / 20 Walks).
    3.  Set Schedule (Morning 7 AM).
    4.  **Live:** Receive "Walk Started" notification & GPS map.

#### 7. Training & Behavior
*   **UI:** `/components/customer/TrainingServicesLanding.tsx`.
*   **Experience:** Book "Assessment Session" first. Then buy "Puppy Package".
*   **Progress:** View "Report Card" in `/components/customer/BehaviorJournal.tsx`.

---

### Group C: Lifestyle & Hospitality

#### 8. Pet Cafe (Zomato-Style)
*   **UI:** `/components/customer/PetCafeListingZomatoStyle.tsx`.
*   **Flow:**
    1.  Browse Cafes (Photos, Menu).
    2.  **Reserve Table:** Select Date, Time, Pax, Pet Count.
    3.  **Pre-Order:** (Optional) Add food from menu.
    4.  Pay Booking Fee (Adjustable against bill).

#### 9. Resort & Boarding
*   **UI:** `/components/customer/ResortServicesLanding.tsx`.
*   **Flow:**
    1.  Select Dates (Check-in / Check-out).
    2.  Browse Room Types (Kennel vs Suite).
    3.  Select Amenities (Pool Access, AC).
    4.  **Validation:** Must have vaccination record uploaded.
    5.  Pay Deposit.

#### 10. Pet Holidays (Travel)
*   **UI:** `/components/customer/PetHolidayServicesLanding.tsx`.
*   **Flow:** Browse Packages (Beach, Hills) -> View Itinerary -> Enquire/Book -> Pay Advance.

---

### Group D: Specialized Services

#### 11. Adoption
*   **UI:** `/components/customer/AdoptionServiceRouter.tsx`.
*   **Flow:** Browse Pets -> Filter (Breed, Age) -> "Apply for Adoption" -> Submit Form.

#### 12. Insurance
*   **UI:** `/components/customer/InsurancePolicyPurchase.tsx`.
*   **Flow:** Enter Pet Details -> Get Quote -> Select Plan -> Upload Pet Photo -> Pay Premium -> Download Policy.

#### 13. Matrimony / Mating
*   **UI:** `/components/customer/MatingDatingHub.tsx`.
*   **Flow:** Create Profile -> Swipe/Browse Matches -> Chat.

---

## 🛒 E-Commerce Shopping Experience

### 1. Product Discovery
*   **UI:** `/components/customer/ShopDashboard.tsx`.
*   **Features:** Categories (Food, Toys), "Best Sellers", "Deals".
*   **Product Detail:** `/components/shop/ProductDetail.tsx` (Images, Description, Reviews).

### 2. Cart & Checkout (The Money Flow)
*   **Cart:** `/components/shop/CartSheet.tsx` (Side drawer).
*   **Checkout Page:** `/components/shop/CheckoutPage.tsx`.
*   **Steps:**
    1.  Review Items.
    2.  **Address:** Select from saved or Add New.
    3.  **GST Calculation:**
        *   Logic: `Subtotal + (Subtotal * 0.18)`.
        *   Display: "Tax (18% GST)".
    4.  **Coupon:** Apply Code (e.g., "WELCOME50").
    5.  **Payment:** Select Mode (Wallet, UPI, Card).
    6.  **Place Order:** Calls `MockAPI.ecommerce.createOrder`.

### 3. Order Tracking
*   **UI:** `/components/customer/OrderTrackingView.tsx`.
*   **States:** Placed -> Packed -> Shipped -> Out for Delivery -> Delivered.

---

## 📡 API Contracts & Data Fetching

### Developer Rules
1.  **Always** use `MockAPI`. Never `fetch` directly.
2.  **Loading States:** Show Skeletons while `loading` is true.
3.  **Error Handling:** Wrap calls in `try/catch` and use `toast.error()`.

### Key Endpoints (Map to UI)

| User Action | MockAPI Method | Payload / Params |
| :--- | :--- | :--- |
| **Search** | `search.universalSearch` | `{ query: string }` |
| **Get Vendor** | `vendor.getProfile` | `vendorId` |
| **Get Slots** | `vendor.getStaff` | `vendorId` (Availability in staff obj) |
| **Book Service** | `booking.createBooking` | `{ vendor_id, service_id, date, slot, pet_id }` |
| **Add to Cart** | `ecommerce.updateCartItem` | `{ product_id, quantity }` |
| **Place Order** | `ecommerce.createOrder` | `{ cart_items, address, payment_method }` |
| **Get Policies** | `integratedServices.getCustomerPolicies` | `customerId` |
| **Upload File** | `customer.uploadPetMedicalDocument` | `{ pet_id, file }` |

---

## 🎨 Pixel-Perfect Implementation Details

### 1. Status Colors (Badges)
*   **Confirmed/Active:** `bg-green-100 text-green-800`
*   **Pending/Processing:** `bg-yellow-100 text-yellow-800`
*   **Cancelled/Rejected:** `bg-red-100 text-red-800`
*   **Completed:** `bg-blue-100 text-blue-800`

### 2. Validation Rules (Forms)
*   **Phone:** 10 digits required.
*   **Booking:** Date cannot be in past.
*   **Pet:** Name required.
*   **Address:** Pincode required (6 digits).

### 3. Mobile Responsiveness
*   **Bottom Nav:** Visible on all top-level screens. Hidden in sub-flows (Booking, Checkout).
*   **Touch Targets:** Buttons must be `h-10` or `h-12` (min 44px).
*   **Safe Area:** Ensure padding at bottom of scrolling lists (`pb-24`) so content isn't hidden behind Bottom Nav.

