# Customer App Flow & UI Endpoint Report

This report maps the key user flows in the Customer App to the corresponding UI component files and their handlers. Use this as a guide for frontend development and verification.

## 1. Authentication & Onboarding

| Flow Step | UI Component File | Key Handlers / Actions | Expected Output |
| :--- | :--- | :--- | :--- |
| **Login / Sign Up** | `/components/customer/CustomerAuth.tsx` | `handleSendCode` (MockAPI.auth.generateOTP)<br>`handleVerifyOtp` (MockAPI.auth.verifyOTP) | Success: Calls `onAuthSuccess` and redirects to Onboarding or Home. |
| **Onboarding (New User)** | `/components/customer/CustomerOnboarding.tsx` | `handleNext`<br>`handleComplete` | Success: Calls `onComplete`, transitions to Journey Selection. |
| **Journey Selection** | `/components/customer/CustomerPlanningJourney.tsx`<br>`/components/customer/CustomerHavePetJourney.tsx` | `handleOptionSelect`<br>`handleComplete` | Success: Saves preferences and redirects to Home. |

## 2. Home & Discovery

| Flow Step | UI Component File | Key Handlers / Actions | Expected Output |
| :--- | :--- | :--- | :--- |
| **Home Screen** | `/components/customer/CustomerHomeComplete.tsx` | `handleServiceClick`<br>`EnhancedSearchBar` | Navigates to specific Service Landing pages. Displays previous providers and radar map. |
| **Global Search** | `/components/customer/EnhancedSearchBar.tsx` | `handleSearch` (MockAPI.search.universalSearch) | Displays dropdown suggestions or redirects to `/components/customer/SearchResultsPage.tsx`. |
| **Problem Grid** | `/components/customer/ProblemGridNavigation.tsx` | `onProblemSelect` | Navigates to `ServicesByProblem` with filtered results. |
| **Service Discovery** | `/components/customer/ServiceDiscovery.tsx` | `useEffect` (MockAPI.search.searchVendors) | Lists available vendors/services based on category filters. |

## 3. Service Booking Flows

### Veterinary (Tele & Home & Clinic)
| Flow Step | UI Component File | Key Handlers / Actions | Expected Output |
| :--- | :--- | :--- | :--- |
| **Landing** | `/components/customer/VetServicesLanding.tsx` | `onBookNow` | Redirects to Vet Booking Router. |
| **Booking Flow** | `/components/customer/vet/VetBookingFlow.tsx` | `handleSlotSelect`<br>`handleConfirm` (MockAPI.booking.createBooking) | Success: Redirects to `VetBookingSuccess.tsx` with Booking ID. |

### Grooming
| Flow Step | UI Component File | Key Handlers / Actions | Expected Output |
| :--- | :--- | :--- | :--- |
| **Landing** | `/components/customer/GroomingServicesLanding.tsx` | `onBook` | Redirects to Grooming Center List. |
| **Center List** | `/components/customer/grooming/GroomingCenterListView.tsx` | `handleSelectCenter` | Opens Center Profile. |
| **Booking** | `/components/customer/grooming/BookingConfirmation.tsx` | `handleConfirmBooking` (MockAPI.booking.createBooking) | Success: Shows confirmation modal/toast. |

### Pet Cafe (Zomato-style)
| Flow Step | UI Component File | Key Handlers / Actions | Expected Output |
| :--- | :--- | :--- | :--- |
| **Landing** | `/components/customer/PetCafeServicesLanding.tsx` | `loadCafes` (MockAPI.search.searchVendors) | Lists pet-friendly cafes. |
| **Profile** | `/components/customer/PetCafeListingZomatoStyle.tsx` | `loadCafeDetails` (MockAPI.integratedServices.getCafeDetails) | Shows menu, amenities, photos. |
| **Reservation** | `/components/customer/CafeReservationFlow.tsx` | `handleBooking` (MockAPI.booking.createBooking) | Success: Reserves a table. |

### Pet Resort & Holidays
| Flow Step | UI Component File | Key Handlers / Actions | Expected Output |
| :--- | :--- | :--- | :--- |
| **Resort Landing** | `/components/customer/ResortServicesLanding.tsx` | `loadResorts` (MockAPI.search.searchVendors) | Lists luxury resorts. |
| **Holiday Landing** | `/components/customer/PetHolidayServicesLanding.tsx` | `loadVendors` (MockAPI.search.searchVendors) | Lists holiday packages. |

### Nutritionist
| Flow Step | UI Component File | Key Handlers / Actions | Expected Output |
| :--- | :--- | :--- | :--- |
| **Landing** | `/components/customer/NutritionistServicesLanding.tsx` | `loadNutritionists` (MockAPI.search.searchVendors) | Lists nutrition experts. |
| **Tracking** | `/components/customer/NutritionistFoodDeliveryTracking.tsx` | `useEffect` | Tracks food delivery orders. |

### Ambulance & Emergency
| Flow Step | UI Component File | Key Handlers / Actions | Expected Output |
| :--- | :--- | :--- | :--- |
| **Emergency SOS** | `/components/customer/AmbulanceSOS.tsx` | `handleSOS` | Triggers immediate alert/call. |
| **Booking Flow** | `/components/customer/AmbulanceBookingFlow.tsx` | `handleBooking` (MockAPI.integratedServices.bookAmbulance) | Success: Displays Live Tracking Map with Driver info. |

### Insurance
| Flow Step | UI Component File | Key Handlers / Actions | Expected Output |
| :--- | :--- | :--- | :--- |
| **Dashboard** | `/components/customer/InsurancePolicyDashboard.tsx` | `useEffect` (MockAPI.integratedServices.getCustomerPolicies) | Lists active policies and claims. |
| **Purchase Flow** | `/components/customer/InsurancePolicyPurchase.tsx` | `handlePurchase` (MockAPI.integratedServices.purchaseInsurance) | Success: Adds new policy to dashboard. |
| **File Claim** | `/components/customer/InsuranceClaimForm.tsx` | `handleSubmit` (MockAPI.integratedServices.fileInsuranceClaim) | Success: Submits claim and returns Ticket ID. |

## 4. E-Commerce (Shop)

| Flow Step | UI Component File | Key Handlers / Actions | Expected Output |
| :--- | :--- | :--- | :--- |
| **Shop Home** | `/components/customer/ShopDashboard.tsx` | `useEffect` (MockAPI.ecommerce.getProducts) | Lists featured products and categories. |
| **Product Detail** | `/components/shop/ProductDetail.tsx` | `handleAddToCart` (MockAPI.ecommerce.updateCartItem) | Updates Cart Context/State. |
| **Cart & Checkout** | `/components/shop/CartSheet.tsx`<br>`/components/shop/CheckoutPage.tsx` | `handleCheckout`<br>`handlePlaceOrder` (MockAPI.ecommerce.createOrder) | Success: Redirects to Order Success / Tracking page. |

## 5. Account & Management

| Flow Step | UI Component File | Key Handlers / Actions | Expected Output |
| :--- | :--- | :--- | :--- |
| **Profile** | `/components/customer/CustomerProfile.tsx` | `handleUpdateProfile` (MockAPI.customer.updateProfile) | Updates user details. |
| **My Bookings** | `/components/customer/MyBookings.tsx` | `useEffect` (MockAPI.booking.getCustomerBookings) | Lists active and past bookings with statuses. |
| **Pet Profile** | `/components/customer/PetProfileDashboard.tsx` | `handleAddPet` (MockAPI.customer.addPet) | Adds/Edits pet details. |
| **Medical Records** | `/components/customer/MedicalRecordsPage.tsx` | `handleUpload` (MockAPI.customer.uploadPetMedicalDocument) | Uploads and lists medical docs. |
| **Wallet** | `/components/customer/WalletPage.tsx` | `handleTopUp` (MockAPI.post /wallet/topup) | Updates wallet balance. |

## 6. AI & Support

| Flow Step | UI Component File | Key Handlers / Actions | Expected Output |
| :--- | :--- | :--- | :--- |
| **AI Chatbot** | `/components/customer/AIChatBot.tsx` | `handleSend` (MockAPI.ai.chat) | Displays AI response and suggestions. |
| **Support Ticket** | `/components/customer/AIChatBot.tsx` | `createSupportTicket` (MockAPI.support.createTicket) | Creates a support ticket from chat context. |
