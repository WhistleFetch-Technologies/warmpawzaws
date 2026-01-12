# Warmpawz Vendor & Admin: Complete 20-Role Implementation Guide

**Version:** 3.1 (Updated with Integration UI Details)
**Scope:** Covers all 20 Vendor Roles, Management Modules, and Admin Enforcements.

---

## 🏗️ Core Management Modules (Universal)

These 5 modules are the backbone of the Vendor App. Most roles use at least 3 of these.

### 1. Service Management (The "What")
*   **UI File:** `/components/vendor/VendorServiceManagementComplete.tsx`
*   **Create Flow:** Click "Add Service" -> Opens `/components/vendor/VendorServiceConfigurationScreen.tsx`.
*   **Data Endpoint:** `MockAPI.vendor.addService()`.
*   **Fields:** Name, Duration, Price, Service Style (Home/Center/Tele), Pet Types.
*   **Used By:** Vet, Groomer, Walker, Sitter, Photographer, Behaviorist, Funeral.

### 2. Staff Management (The "Who")
*   **UI File:** `/components/vendor/StaffManagement.tsx`
*   **Create Flow:** Click "Add Staff" -> Form (Name, Role, Photo, Skills).
*   **Data Endpoint:** `MockAPI.vendor.addStaff()`.
*   **Linking:** Services must be assigned to Staff to be bookable.
*   **Used By:** Clinics, Salons, Agencies, Resorts, Cafes.

### 3. Scheduling Management (The "When")
*   **UI File:** `/components/vendor/VendorScheduleManagement.tsx`
*   **Logic:**
    1.  **Global Hours:** Business open/close times.
    2.  **Staff Availability:** Per-staff shift configuration (Morning/Evening slots).
    3.  **Buffer Time:** Gap between appointments (defined in `VendorSettings.tsx`).
*   **Enforcement:** `VetBookingFlow` and others read this to generate slots.

### 4. Package Management (The "Bundles")
*   **UI File:** `/components/vendor/packages/PackageManagementContainer.tsx`
*   **Create Flow:** Define Package Name -> Select Sub-Services -> Set Total Sessions -> Set Discount Price.
*   **Data Model:** `MOCK_PACKAGES`.
*   **Used By:** Trainers (10 sessions), Groomers (Monthly Spa), Nutritionists (Meal Plans).

### 5. Settlement & Finance (The "Money")
*   **UI File:** `/components/vendor/SettlementDashboardEnhanced.tsx`
*   **Features:**
    *   **Wallet:** View Balance.
    *   **Payouts:** Request Withdrawal (MockAPI triggers bank transfer).
    *   **Commission:** Shows Platform Fee deduction (Tier-based).
*   **Tier Logic:** `/components/vendor/TierManagement.tsx`.

---

## 🔌 External Integrations UI Layer (Vendor Side)
*How vendors interact with simulated external tools.*

1.  **Driver Tracking (Maps):**
    *   **Used By:** Ambulance, Walker, Pet Taxi, Home Vet.
    *   **UI Requirement:** `/components/vendor/VendorGPSTrackingScreen.tsx`.
    *   **Function:** Must show a "Start Trip" button. Once started, show a map with "My Location" (Driver) and "Destination" (Customer). A "Slide to Arrive" slider handles status updates.
2.  **Tele-health Interface (Video):**
    *   **Used By:** Vets, Behaviorists, Trainers.
    *   **UI Requirement:** `/components/vendor/VendorVideoCallContainer.tsx`.
    *   **Function:** "Join Call" button from Appointment Details. Interface must have "Patient History" sidebar alongside the video view.
3.  **Document Verification (Admin/Reg):**
    *   **Used By:** Onboarding.
    *   **UI Requirement:** File Upload zones for GST/License. Must show "Verified" badge once status is `active`.

---

## 📋 Role-by-Role Implementation Matrix

### Group A: Medical & Wellness

#### 1. Veterinarian (Clinic / Home / Tele)
*   **Dashboard:** `/components/vendor/VendorDashboard.tsx` (Medical Widgets).
*   **Catalog:** Uses **Service Management**.
*   **Booking Action:**
    *   **Tele:** Launches `/components/vendor/VendorVideoCallContainer.tsx`.
    *   **Clinic:** Triggers `VendorPrescriptionModal.tsx` after consult.
*   **Specifics:** Must upload `Medical License` in Onboarding.

#### 2. Nutritionist
*   **Catalog:**
    *   **Consults:** Uses **Service Management**.
    *   **Meal Plans:** Uses `/components/vendor/NutritionistMealManager.tsx`.
*   **Booking Action:** `VendorDietCharts.tsx` to upload PDF plans.
*   **Feature:** Food Delivery Tracking integration.

#### 3. Pharmacy
*   **Catalog:** Uses `/components/vendor/seller/ProductCatalogManagement.tsx`.
*   **Inventory:** Must set `requires_prescription: true` for meds.
*   **Booking Action:** `/components/vendor/VendorPrescriptionVerification.tsx` (Approve/Reject uploaded Rx).

#### 4. Behaviorist
*   **Catalog:** Consultations + Training Packages.
*   **Specific UI:** `/components/vendor/VendorCounseling.tsx` (Session Notes).
*   **Client View:** `/components/customer/BehaviorJournal.tsx` (Shared progress).

#### 5. Ambulance (Emergency)
*   **Catalog:** **Service Management** (Base Fare, Per KM Rate).
*   **Onboarding:** Vehicle Registration upload.
*   **Action:**
    *   **Driver View:** `/components/vendor/VendorGPSTrackingScreen.tsx`.
    *   **Status:** "En Route", "Arrived", "Transporting".

---

### Group B: Service & Care

#### 6. Groomer
*   **Catalog:**
    *   **Services:** Bath, Haircut, Nail Clip.
    *   **Add-ons:** Tick Treatment, Spa.
*   **Mobile Grooming:** Uses `ServicePublishFormWithGPS.tsx` to set "Service Radius".
*   **Action:** Upload Before/After photos to `VendorGalleryManagement.tsx`.

#### 7. Dog Walker
*   **Catalog:** **Service Management** (Solo Walk, Group Walk).
*   **Action:**
    *   **Start Walk:** Triggers `/components/vendor/VendorGPSTrackingScreen.tsx`.
    *   **Live Updates:** Sends "Pee/Poo" events to customer.
*   **Staff:** "Walkers" are managed as staff under a "Walker Agency" admin.

#### 8. Pet Trainer
*   **Catalog:** **Package Management** (Puppy Class - 6 weeks).
*   **Action:** `/components/vendor/training/TrainingProgressDashboard.tsx`.
*   **Record Keeping:** Mark attendance, Grade skills (Sit, Stay).

#### 9. Pet Sitter (Home)
*   **Catalog:** Daily Rates / Hourly Rates.
*   **Specifics:** Simple "Solo Provider" dashboard.
*   **Action:** Check-in/Check-out with GPS validation.

#### 10. Pet Taxi
*   **Catalog:** Transport Services (One-way, Round-trip).
*   **Difference from Ambulance:** No medical equipment required.
*   **Action:** Driver Tracking app.

---

### Group C: Hospitality & Lifestyle

#### 11. Pet Resort (Luxury)
*   **Catalog:** `/components/vendor/BoardingRoomManager.tsx`.
*   **Inventory:** Suites, Deluxe Rooms, Cages.
*   **Booking Action:** `/components/vendor/resort/CheckInCheckOutPage.tsx`.
*   **Dashboard:** Occupancy Grid (Who is in which room).

#### 12. Boarding (Home/Kennel)
*   **Catalog:** Similar to Resort but simplified (Room Types).
*   **Action:** Daily Photo Updates via `VendorGalleryManagement`.

#### 13. Pet Cafe
*   **Catalog:** `/components/vendor/VendorCafeMenuManagement.tsx`.
*   **Inventory:** Tables (Managed in Settings).
*   **Booking Action:** `/components/vendor/cafe/TableReservationDashboard.tsx`.
*   **Feature:** Order Management for food served at tables.

#### 14. Pet Holiday (Travel Agent)
*   **Catalog:** `/components/vendor/HolidayPackageManagement.tsx`.
*   **Items:** "Goa Beach Trip", "Hill Station Hike".
*   **Details:** Itinerary, Inclusions, Dates.

#### 15. Photographer
*   **Catalog:** Session Packages (Portrait, Outdoor).
*   **Portfolio:** Critical usage of `VendorGalleryManagement.tsx`.
*   **Deliverable:** Digital Album upload.

---

### Group D: Retail & Specialized

#### 16. Store / Seller
*   **Catalog:** `/components/vendor/seller/ProductCatalogManagement.tsx`.
*   **Orders:** `/components/vendor/seller/SellerOrderManagement.tsx`.
*   **Logistics:** Integration with Delivery Partners (mocked status updates).

#### 17. Adoption Center / Shelter
*   **Catalog:** `/components/vendor/PetListingManager.tsx` (Not "Products" but "Pets").
*   **Fields:** Name, Breed, Age, Story, Vaccination Status.
*   **Action:** Process "Adoption Applications" (Approve/Interview).

#### 18. Breeder
*   **Catalog:** `/components/vendor/PetListingManager.tsx` (Litter Management).
*   **Details:** Sire/Dam info, KCI Registration papers.
*   **Action:** Deposit/Booking management for puppies.

#### 19. Insurance Provider
*   **Catalog:** `/components/vendor/insurance/PolicyPlanManager.tsx` (Plan Definitions).
*   **Action:** Claims Dashboard (`VendorClaimProcessing.tsx`).
*   **Role:** Generally an Admin or specialized partner role.

#### 20. Funeral / Memorial Service
*   **Catalog:** `/components/vendor/VendorMemorialServices.tsx`.
*   **Services:** Cremation, Burial, Urns, Memorial events.
*   **Sensitivity:** specialized UI with softer colors.

---

## 👮 Admin & Governance Wiring

### Policy Management
*   **UI:** `/components/vendor/VendorPolicyManagement.tsx`
*   **Function:**
    *   Vendor selects their **Cancellation Policy** (Flexible/Strict).
    *   Admin sets **Platform Commission** (e.g., 10% for Silver, 5% for Gold).
*   **Enforcement Point:** `MockAPI.booking.cancelBooking` calculates refund % based on this selection.

### Settlement Rules
*   **Auto-Settlement:**
    *   Triggered when `booking.status` becomes `completed`.
    *   Formula: `BookingAmount - (BookingAmount * VendorCommissionRate)`.
    *   Added to `VendorWallet`.
*   **UI:** Admin Reports show "Pending Settlements".

### Verification System
*   **UI:** `/components/vendor/VendorApplicationUnderReview.tsx`
*   **Flow:**
    1.  Vendor uploads docs (GST, License).
    2.  Status -> `under_review`.
    3.  Admin (simulated) clicks "Approve" in `MockAPI`.
    4.  Status -> `active`.
    5.  Vendor gets full dashboard access.

---

## 🛠️ Developer "Gap-Filling" Instructions

1.  **Missing Files:** If `VendorClaimProcessing.tsx` or `PolicyPlanManager.tsx` are missing in the repo, copy the structure from `VendorBookingManagement.tsx` and adapt the fields. The `MockAPI` already supports generic `updateStatus` calls that can work for claims.
2.  **Navigation:** Ensure `VendorDashboard.tsx` imports and renders these specific managers based on the `role_id`.
    *   *Example:* `if (role === 'role_cafe') return <VendorCafeMenuManagement />` inside the "Services" tab.
3.  **Data Handoff:**
    *   **Input:** User fills form -> `useState`.
    *   **Submit:** `MockAPI.role.specificAction(payload)`.
    *   **Refresh:** Call `loadData()` immediately after success to update the list.

