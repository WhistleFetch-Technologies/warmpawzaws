# Vendor App Flow & UI Endpoint Report

This report maps the key user flows in the Vendor App to the corresponding UI component files and their handlers. Use this as a guide for frontend development and verification.

## 1. Authentication & Onboarding

| Flow Step | UI Component File | Key Handlers / Actions | Expected Output |
| :--- | :--- | :--- | :--- |
| **Login / Register** | `/components/vendor/VendorAuth.tsx` | `handleSendCode`<br>`handleVerifyOtp` | Success: Calls `onAuthSuccess`. Checks if profile exists. |
| **Onboarding Form** | `/components/vendor/onboarding/EnhancedVendorOnboarding.tsx` | `handleSubmit` (MockAPI.vendor.submitApplication) | Success: Submits application, redirects to "Under Review" or Dashboard. |
| **Status Check** | `/components/vendor/VendorStatusChecker.tsx` | `useEffect` (MockAPI.vendor.getProfile) | Displays current application status (Pending, Approved, Rejected). |

## 2. Dashboard

| Flow Step | UI Component File | Key Handlers / Actions | Expected Output |
| :--- | :--- | :--- | :--- |
| **Main Dashboard** | `/components/vendor/VendorDashboard.tsx` | `fetchDashboardData` (MockAPI.vendor.getProfile, getBookings) | Displays stats (Earnings, Bookings) and quick actions. |
| **Solo Provider View** | `/components/vendor/dashboard/SoloProviderDashboard.tsx` | Same as above | Specialized view for independent vets/walkers. |

## 3. Booking Management

| Flow Step | UI Component File | Key Handlers / Actions | Expected Output |
| :--- | :--- | :--- | :--- |
| **Booking List** | `/components/vendor/VendorBookingManagement.tsx` | `loadBookings` (MockAPI.vendor.getBookings) | Lists all bookings with filters (Today, Upcoming). |
| **Booking Actions** | `/components/vendor/VendorBookingManagement.tsx`<br>`/components/vendor/ActiveBookingsList.tsx` | `handleAcceptBooking`<br>`handleCancelBooking` (MockAPI.booking.updateBooking) | Updates booking status. |
| **Complete Booking** | `/components/vendor/VendorBookingManagement.tsx` | `handleCompleteBooking` (MockAPI.booking.updateBooking) | Marks booking as completed, triggers payment/review flow. |
| **Details View** | `/components/vendor/AppointmentDetailModal.tsx` | `useEffect` (MockAPI.booking.getBooking) | Shows detailed booking info, pet info, and notes. |

## 4. Service & Catalog Management

| Flow Step | UI Component File | Key Handlers / Actions | Expected Output |
| :--- | :--- | :--- | :--- |
| **Service List** | `/components/vendor/VendorServiceManagementComplete.tsx` | `loadServices` (MockAPI.vendor.getServices) | Lists enabled services and prices. |
| **Add/Edit Service** | `/components/vendor/VendorServiceConfigurationScreen.tsx` | `handleSave` (MockAPI.vendor.addService / updateService) | Updates service catalog. |
| **Package Mgmt** | `/components/vendor/packages/PackageManagementContainer.tsx` | `handleSavePackage` | Creates/Updates service bundles/packages. |
| **Menu Mgmt (Cafe)** | `/components/vendor/VendorCafeMenuManagement.tsx` | `handleSaveMenu` | Updates food/drink items. |
| **Room Mgmt (Resort)** | `/components/vendor/BoardingRoomManager.tsx` | `handleSaveRoom` | Updates room types and pricing. |

## 5. Seller (E-Commerce) Flows

| Flow Step | UI Component File | Key Handlers / Actions | Expected Output |
| :--- | :--- | :--- | :--- |
| **Seller Dashboard** | `/components/vendor/seller/SellerDashboard.tsx` | `loadStats` | Shows sales, orders, and inventory stats. |
| **Product Catalog** | `/components/vendor/seller/ProductCatalogManagement.tsx` | `handleAddProduct` (MockAPI.ecommerce - via internal mock) | Adds new product to store. |
| **Order Mgmt** | `/components/vendor/seller/SellerOrderManagement.tsx` | `handleUpdateStatus` (MockAPI.ecommerce.updateOrderStatus) | Updates order status (Shipped, Delivered). |

## 6. Staff & Settings

| Flow Step | UI Component File | Key Handlers / Actions | Expected Output |
| :--- | :--- | :--- | :--- |
| **Staff Mgmt** | `/components/vendor/StaffManagement.tsx` | `handleAddStaff` (MockAPI.vendor.addStaff) | Adds new staff member. |
| **Schedule/Availability** | `/components/vendor/VendorScheduleManagement.tsx` | `handleSaveSchedule` | Updates available slots/timings. |
| **Settings** | `/components/vendor/VendorSettings.tsx` | `handleSaveProfile` (MockAPI.vendor.updateProfile) | Updates business details, logo, address. |
