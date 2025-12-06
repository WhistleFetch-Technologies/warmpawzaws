# Figma Vendor Services Frontend Handoff

**Date:** January 27, 2025
**Status:** Ready for Design & Development

This document outlines the required UI components and screens for the Vendor Services system, covering onboarding, dashboards, service management, and customer booking flows.

---

## 1. Vendor Onboarding Flow UI

### Screens & Components
*   **Waiting for Approval Screen**:
    *   **Purpose**: Displayed after initial submission.
    *   **UI Elements**: Status indicator (Pending/Under Review), estimated timeline (24-48 hours), contact support link.
    *   **State**: Read-only.

*   **"You are Approved" Screen**:
    *   **Purpose**: Welcome screen after approval.
    *   **UI Elements**: Success animation, "Get Started" CTA button.
    *   **Action**: Transitions user to Dashboard (sets `isActive: true`).

*   **Rejection → Choose Role Screen**:
    *   **Purpose**: If rejected, allow user to correct or choose a different role.
    *   **UI Elements**: Rejection reason display (red alert), "Edit Application" button, "Choose Different Role" link.

*   **Onboarding Form with Required Edits**:
    *   **Purpose**: For "Correction Required" or "Clarification Requested" status.
    *   **UI Elements**: Form pre-filled with previous data. Highlighted fields needing correction. Admin notes displayed at the top.

*   **Initial Onboarding Form**:
    *   **Purpose**: Main registration.
    *   **UI Elements**: Multi-step wizard (Personal Info -> Professional Info -> Documents -> Bank Details). Progress bar. Document upload with preview.

---

## 2. Vendor Dashboard (Dynamic)

### Screens & Components
*   **Dynamic Vendor Dashboard**:
    *   **Purpose**: Main landing page tailored to `roleId`.
    *   **UI Elements**: Stats cards (Revenue, Bookings), "Quick Actions" grid (Manage Services, Add Staff), Notifications widget.
    *   **Logic**: Hides sections not relevant to the specific role (e.g., no "Staff" for individual walkers if configured).

*   **Service Management UI**:
    *   **Purpose**: Add/Edit services.
    *   **UI Elements**: List of active services. Toggle switch for availability. Price input (locked for Platform services). "Add Custom Service" button.

*   **Schedule Management**:
    *   **Purpose**: Set operating hours.
    *   **UI Elements**: Weekly grid. Time range sliders. "Apply to all days" button. Exception dates calendar.

*   **Staff Management**:
    *   **Purpose**: List and manage staff members.
    *   **UI Elements**: Staff list with status (Active/Inactive/On Leave). "Add Staff" button. Performance stats per staff.

*   **Revenue Dashboard**:
    *   **Purpose**: Financial overview.
    *   **UI Elements**: Charts (Daily/Weekly/Monthly). Transaction history table. Export CSV button.

*   **Payouts**:
    *   **Purpose**: Manage bank account and view payouts.
    *   **UI Elements**: Current balance. "Withdraw" button (if applicable). Payout history. Bank account details view.

*   **Settings**:
    *   **Purpose**: General vendor settings.
    *   **UI Elements**: Profile edit, Notification preferences, Password change.

*   **Advertising Dashboard**:
    *   **Purpose**: Manage promoted listings.
    *   **UI Elements**: Active campaigns list. "Create Ad" flow. Budget settings. Impression/Click stats.

---

## 3. Staff Creation & Scheduling

### Screens & Components
*   **Staff Creation Form**:
    *   **Purpose**: Add new staff member.
    *   **UI Elements**: Name, Phone, Role inputs. **Service Style Checkboxes** (At Home, At Center, Tele). Service selection list (filtered by vendor enabled services).

*   **Staff Availability Form**:
    *   **Purpose**: Set specific availability for staff.
    *   **UI Elements**: Weekly calendar. Per-day checkboxes for Service Styles (e.g., "Available for Home Visits on Mon?"). Time slots.

*   **Staff Service Management**:
    *   **Purpose**: Assign specific services to staff.
    *   **UI Elements**: Checklist of vendor services. "Select All" option. Validation warning if service not enabled by vendor.

*   **Staff Schedule View**:
    *   **Purpose**: View staff's personal calendar.
    *   **UI Elements**: Calendar view (Day/Week). Appointment blocks color-coded by type.

---

## 4. Home Services Flow

### Screens & Components
*   **Home Service Provider List**:
    *   **Purpose**: Customer view of available providers for home service.
    *   **UI Elements**: **Horizontal scroll list**. Provider cards with: Photo, Name, Rating, Distance (km), "Available" badge. Sorted by distance.

*   **Home Service Booking Flow**:
    *   **Purpose**: Book a specific provider.
    *   **UI Elements**: Date/Time picker. Address confirmation. Provider selection (if not pre-selected). Payment summary.

*   **OTP Entry Screen**:
    *   **Purpose**: Verify service start/end.
    *   **UI Elements**: 4-6 digit input. "Resend OTP" link. Timer.

*   **GPS Tracking View**:
    *   **Purpose**: Track provider arrival.
    *   **UI Elements**: Map view. Provider icon. ETA display. "Call Provider" button.

*   **Service Completion Screen**:
    *   **Purpose**: Summary after service.
    *   **UI Elements**: "Service Completed" checkmark. Rating stars. Tip option. Invoice download.

---

## 5. Tele Services Flow

### Screens & Components
*   **Tele Service Booking**:
    *   **Purpose**: Choose booking type.
    *   **UI Elements**: Toggle/Tabs for **"Instant (Available Now)"** vs **"Scheduled"**.

*   **Instant Available Staff**:
    *   **Purpose**: List staff online right now.
    *   **UI Elements**: List of staff with "Online" status indicator. "Connect Now" button. Wait time estimate.

*   **Scheduled Booking**:
    *   **Purpose**: Standard booking flow.
    *   **UI Elements**: Calendar picker. Time slots. Staff selection.

*   **Video Call Interface**:
    *   **Purpose**: The actual consultation.
    *   **UI Elements**: Video area (Self/Remote). Mute/Camera/End Call controls. Chat sidebar.

---

## 6. Problem Grid & Specialization

### Screens & Components
*   **Problem Grid Component**:
    *   **Purpose**: Discovery tool for customers.
    *   **UI Elements**: Grid of icons/images representing common issues (e.g., "Itching", "Vomiting").

*   **Specialization Filter**:
    *   **Purpose**: Filter providers by expertise.
    *   **UI Elements**: Pills/Tags (e.g., "Dermatology", "Orthopedics"). Multi-select support.

*   **Service Recommendations**:
    *   **Purpose**: Suggest services based on selected problem.
    *   **UI Elements**: "Recommended for You" section. List of relevant services (e.g., "Vet Consultation" for vomiting).

---

## 7. Special Vendor Types

### Screens & Components
*   **Breeder & Adoption Catalog**:
    *   **Purpose**: Listing pets.
    *   **UI Elements**: Gallery view of pets. Filter by Breed, Age, Price.

*   **Pet Detail Page**:
    *   **Purpose**: View single pet info.
    *   **UI Elements**: Carousel of images. Details (Age, Breed, Health info). "Contact Breeder" or "Adopt" button.

*   **Boarding & Resort Booking**:
    *   **Purpose**: Book overnight stays.
    *   **UI Elements**: Check-in/Check-out date picker. Room type selection (Standard, Deluxe). Add-ons (Grooming, Walks).

*   **Meal Plan Subscription**:
    *   **Purpose**: Subscribe to food delivery.
    *   **UI Elements**: Meal selection. Frequency (Weekly/Monthly). Pet profile selection (for portion sizing).

*   **Medicine Prescription Flow**:
    *   **Purpose**: Upload/Request meds.
    *   **UI Elements**: Prescription upload (Camera/File). "Request Refill" button from past orders.

*   **Walker Session Tracking**:
    *   **Purpose**: Live tracking of dog walk.
    *   **UI Elements**: Map with path trace. Distance/Time timer. "Pee/Poop" markers log. Photo upload.

*   **Pet Cafe Booking**:
    *   **Purpose**: Table reservation.
    *   **UI Elements**: Date/Time picker. Party size. "Bring your pet?" toggle.

*   **Pet Holiday Booking**:
    *   **Purpose**: Travel packages.
    *   **UI Elements**: Destination list. Itinerary view. Booking form.

---

## 8. Subscription Management

### Screens & Components
*   **Subscription Management**:
    *   **Purpose**: View active subs.
    *   **UI Elements**: List of subscriptions. Status (Active/Paused). Next billing date. "Manage" button.

*   **Subscription Cancellation Screen**:
    *   **Purpose**: Cancel and refund.
    *   **UI Elements**: Reason dropdown. **Refund Calculation Display** (Days used vs Remaining -> Amount). Confirm Cancellation button.

---

## 9. Settings & Configuration

### Screens & Components
*   **Service Radius Settings**:
    *   **Purpose**: Configure home service area.
    *   **UI Elements**: **Slider (1km - 5km)**. Map preview of radius circle.

*   **Distance Filter Settings**:
    *   **Purpose**: Admin/Platform settings.
    *   **UI Elements**: Input for default max radius. Toggle for "Strict Filtering".

*   **Platform Settings**:
    *   **Purpose**: Global configs.
    *   **UI Elements**: Service fee %, Commission rates, Tax settings.

---

## 10. Integrations

### Screens & Components
*   **AWS Chime Video Call**:
    *   **Purpose**: Integration component for video.
    *   **UI Elements**: (Backend integration, frontend UI matches Video Call Interface).

*   **Rewards & Loyalty Dashboard**:
    *   **Purpose**: Customer points view.
    *   **UI Elements**: Points balance. "History" list. Progress bar to next tier.

*   **Loyalty Points Redemption**:
    *   **Purpose**: Use points.
    *   **UI Elements**: "Redeem" toggle in checkout. Conversion display (100 points = $1).
