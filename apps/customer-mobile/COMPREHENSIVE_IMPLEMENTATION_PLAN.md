# Comprehensive Mobile App Implementation Plan

## Overview
Complete implementation of customer and vendor mobile apps with all 18 business rules, full booking lifecycle, GPS tracking, payments, notifications, and specialized services.

## Current Status Analysis

### ✅ Completed
- Authentication (OTP-based)
- Onboarding flows (Customer & Vendor)
- Basic navigation structure
- Theme system (branding guidelines)
- Video call integration (AWS Chime)
- Profile management
- Basic dashboard screens

### ❌ Missing Critical Components

#### Customer App
1. **Service Discovery & Booking Flow**
   - Problem grid selector
   - Vendor/staff discovery by problem
   - Service selection
   - Staff assignment
   - Scheduling (single session & subscription)
   - Payment integration (Razorpay + Wallet)
   - GPS tracking for home services
   - Booking lifecycle management

2. **Specialized Service Screens**
   - Pet Cafe (Zomato-style listing)
   - Pet Resort & Boarding
   - Pet Insurance
   - Pet Holidays
   - Pet Walker
   - Nutritionist
   - Behaviorist/Trainer
   - Breeder/Adoption

3. **Integrated Services**
   - Ambulance SOS
   - Medicine Delivery
   - Diagnostics

4. **Notifications**
   - Push notifications
   - SMS notifications
   - In-app notifications

#### Vendor App
1. **Scheduling Management**
   - Staff schedules
   - Center schedules
   - Buffer time configuration
   - Availability windows
   - Holiday management

2. **Service Management**
   - Complete CRUD
   - Package management
   - Pricing tiers
   - Service area configuration

3. **Booking Management**
   - Real-time updates
   - GPS tracking (for staff)
   - Status management
   - Refund/rescheduling

4. **Specialized Vendor Features**
   - Prescription builder (Vets)
   - Menu management (Cafe)
   - Room management (Resort)
   - Package tracking (Trainer/Behaviorist)

## Implementation Phases

### Phase 1: Core Booking Flow (Priority: CRITICAL)
**Timeline: Week 1-2**

#### 1.1 Problem Grid & Service Discovery
- [ ] ProblemGridSelectorScreen (customer-mobile)
- [ ] VendorDiscoveryScreen (customer-mobile)
- [ ] ServiceProviderListScreen (customer-mobile)
- [ ] ServiceProviderDetailScreen (customer-mobile)
- [ ] Elastic search integration
- [ ] Location-based filtering (radius search)

#### 1.2 Service Selection & Staff Assignment
- [ ] ServiceSelectionScreen (customer-mobile)
- [ ] StaffSelectionScreen (customer-mobile)
- [ ] PetSelectionScreen (customer-mobile)
- [ ] Problem-based staff matching

#### 1.3 Scheduling System
- [ ] TimeSlotSelectorScreen (customer-mobile)
  - Single session: Available time slots
  - Subscription: General slots (morning 8-12, evening 4-8, night)
- [ ] ScheduleManagementScreen (vendor-mobile)
  - Staff schedule configuration
  - Center schedule configuration
  - Buffer time settings
  - Availability windows

#### 1.4 Payment Integration
- [ ] PaymentScreen (customer-mobile)
  - Razorpay integration
  - Wallet support
  - Multiple payment methods
- [ ] RefundPolicyScreen (customer-mobile)
- [ ] ReschedulingScreen (customer-mobile)

#### 1.5 Booking Lifecycle
- [ ] BookingConfirmationScreen (customer-mobile)
- [ ] BookingDetailScreen (customer-mobile)
- [ ] BookingStatusScreen (customer-mobile)
- [ ] BookingHistoryScreen (customer-mobile)

### Phase 2: GPS Tracking & Home Services (Priority: HIGH)
**Timeline: Week 2-3**

#### 2.1 GPS Tracking Implementation
- [ ] LocationService (shared)
  - Real-time location updates
  - Route tracking
  - ETA calculation
- [ ] StaffLocationTracker (vendor-mobile)
  - Start/stop tracking
  - Location sharing
- [ ] CustomerTrackingScreen (customer-mobile)
  - Live staff location
  - Route visualization
  - ETA display

#### 2.2 Home Services Flow
- [ ] HomeServiceBookingScreen (customer-mobile)
  - Service provider listing (radius-based)
  - Distance calculation
  - Commute time estimation
  - Scheduling with buffer time
- [ ] HomeServiceTrackingScreen (customer-mobile)
  - Staff en-route notification
  - Live tracking
  - Arrival notification

### Phase 3: Tele Services & Video Consultation (Priority: HIGH)
**Timeline: Week 3**

#### 3.1 Tele Services Booking
- [ ] TeleServiceBookingScreen (customer-mobile)
  - Instant consultation (available staff)
  - Scheduled consultation
  - Staff assignment after payment
- [ ] VideoConsultationScreen (customer-mobile)
  - Video call integration
  - Chat integration
  - Prescription builder (for vets)

### Phase 4: Payment & Wallet System (Priority: HIGH)
**Timeline: Week 3-4**

#### 4.1 Razorpay Integration
- [ ] RazorpayService (shared)
  - Order creation
  - Payment capture
  - Refund processing
  - Marketplace mode
- [ ] PaymentGatewayScreen (customer-mobile)
- [ ] RefundProcessingScreen (customer-mobile)

#### 4.2 Wallet System
- [ ] WalletScreen (customer-mobile)
  - Balance display
  - Transaction history
  - Add money
  - Wallet usage in payments

### Phase 5: Notifications System (Priority: HIGH)
**Timeline: Week 4**

#### 5.1 Push Notifications
- [ ] NotificationService (shared)
  - Push notification setup
  - Token management
  - Notification handling
- [ ] NotificationScreen (customer-mobile & vendor-mobile)
  - Notification list
  - Mark as read
  - Notification settings

#### 5.2 SMS Notifications
- [ ] SMSNotificationService (backend integration)
  - Booking confirmations
  - Status updates
  - GPS tracking updates

### Phase 6: Specialized Services (Priority: MEDIUM)
**Timeline: Week 5-6**

#### 6.1 Pet Cafe
- [ ] CafeListingScreen (customer-mobile) - Zomato-style
- [ ] CafeDetailScreen (customer-mobile)
- [ ] TableBookingScreen (customer-mobile)
- [ ] CafeManagementScreen (vendor-mobile)
  - Table configuration
  - Availability management
  - Menu management

#### 6.2 Pet Resort & Boarding
- [ ] ResortListingScreen (customer-mobile)
- [ ] ResortDetailScreen (customer-mobile)
- [ ] CheckInCheckOutScreen (customer-mobile)
- [ ] ResortManagementScreen (vendor-mobile)
  - Room configuration
  - Pricing management
  - Availability calendar

#### 6.3 Pet Insurance
- [ ] InsurancePlansScreen (customer-mobile)
- [ ] PolicyPurchaseScreen (customer-mobile)
- [ ] PolicyManagementScreen (customer-mobile)
- [ ] ClaimFilingScreen (customer-mobile)
- [ ] InsuranceDashboardScreen (vendor-mobile)

#### 6.4 Pet Holidays
- [ ] HolidayPackagesScreen (customer-mobile)
- [ ] HolidayDetailScreen (customer-mobile)
- [ ] HolidayBookingScreen (customer-mobile)
- [ ] HolidayManagementScreen (vendor-mobile)

#### 6.5 Pet Walker
- [ ] WalkerBookingScreen (customer-mobile)
- [ ] RouteTrackingScreen (customer-mobile)
- [ ] SessionTrackingScreen (customer-mobile)
- [ ] WalkerDashboardScreen (vendor-mobile)

#### 6.6 Nutritionist
- [ ] NutritionistBookingScreen (customer-mobile)
- [ ] ConsultationScreen (customer-mobile)
- [ ] MealPlanScreen (customer-mobile)
- [ ] FoodDeliveryTrackingScreen (customer-mobile)

#### 6.7 Behaviorist & Trainer
- [ ] TrainingBookingScreen (customer-mobile)
- [ ] ProgressTrackingScreen (customer-mobile)
- [ ] PackageManagementScreen (customer-mobile)
- [ ] TrainingDashboardScreen (vendor-mobile)

### Phase 7: Integrated Services (Priority: MEDIUM)
**Timeline: Week 6-7**

#### 7.1 Ambulance
- [ ] AmbulanceSOSScreen (customer-mobile)
- [ ] AmbulanceTrackingScreen (customer-mobile)

#### 7.2 Medicine Delivery
- [ ] MedicineOrderScreen (customer-mobile)
- [ ] DeliveryTrackingScreen (customer-mobile)

#### 7.3 Diagnostics
- [ ] DiagnosticsBookingScreen (customer-mobile)
- [ ] ReportManagementScreen (customer-mobile)

### Phase 8: Advanced Features (Priority: LOW)
**Timeline: Week 7-8**

#### 8.1 Prescription & Medical Records
- [ ] PrescriptionBuilderScreen (vendor-mobile - Vets)
- [ ] MedicalRecordsScreen (customer-mobile)
- [ ] PrescriptionHistoryScreen (customer-mobile)

#### 8.2 Subscription Packages
- [ ] PackageSelectionScreen (customer-mobile)
- [ ] PackageManagementScreen (customer-mobile)
- [ ] PackageProgressScreen (customer-mobile)

#### 8.3 Refund & Rescheduling
- [ ] RefundPolicyScreen (customer-mobile)
- [ ] ReschedulingScreen (customer-mobile)
- [ ] RefundProcessingScreen (vendor-mobile)

## Technical Implementation Details

### Shared Services
1. **LocationService**
   - Real-time GPS tracking
   - Route calculation
   - Distance/ETA calculation

2. **NotificationService**
   - Push notifications
   - SMS notifications
   - In-app notifications

3. **PaymentService**
   - Razorpay integration
   - Wallet management
   - Refund processing

4. **BookingService**
   - Booking creation
   - Status management
   - Lifecycle tracking

5. **SearchService**
   - Elastic search integration
   - Problem-based search
   - Location-based filtering

### Data Structures

#### Booking Object
```typescript
interface Booking {
  id: string;
  customerId: string;
  vendorId: string;
  staffId?: string;
  serviceId: string;
  serviceType: 'center' | 'home' | 'tele';
  serviceStyle: 'at_home' | 'at_center' | 'both';
  petId: string;
  scheduledDate: string;
  scheduledTime: string;
  address?: Address;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  payment: PaymentInfo;
  location?: {
    lat: number;
    lng: number;
  };
  gpsTracking?: GPSTracking;
  chatId?: string;
  videoCallId?: string;
  prescriptionId?: string;
  medicalRecordId?: string;
}
```

#### Schedule Object
```typescript
interface Schedule {
  staffId?: string;
  centerId?: string;
  date: string;
  timeSlots: TimeSlot[];
  bufferTime: number; // minutes
  availabilityWindows: AvailabilityWindow[];
  blockedTimes: BlockedTime[];
}
```

## API Endpoints Required

### Customer Endpoints
- `GET /customer/problem-grid/:roleId` - Get problem grid
- `GET /customer/discover-by-problem/:roleId/:problemId` - Discover vendors/staff
- `GET /customer/services/:vendorId` - Get vendor services
- `GET /customer/staff/:staffId` - Get staff details
- `POST /customer/booking` - Create booking
- `GET /customer/bookings` - Get bookings
- `GET /customer/booking/:bookingId` - Get booking details
- `POST /customer/booking/:bookingId/cancel` - Cancel booking
- `POST /customer/booking/:bookingId/reschedule` - Reschedule booking
- `POST /customer/payment/initiate` - Initiate payment
- `POST /customer/payment/verify` - Verify payment
- `GET /customer/wallet` - Get wallet balance
- `POST /customer/wallet/add` - Add money to wallet
- `GET /customer/location/track/:bookingId` - Track staff location

### Vendor Endpoints
- `GET /vendor/schedule/:staffId` - Get staff schedule
- `POST /vendor/schedule/update` - Update schedule
- `GET /vendor/bookings` - Get bookings
- `POST /vendor/booking/:bookingId/accept` - Accept booking
- `POST /vendor/booking/:bookingId/reject` - Reject booking
- `POST /vendor/booking/:bookingId/complete` - Complete booking
- `POST /vendor/location/start` - Start GPS tracking
- `POST /vendor/location/update` - Update location
- `POST /vendor/location/stop` - Stop GPS tracking

## Next Steps

1. **Start with Phase 1.1**: Implement Problem Grid & Service Discovery
2. **Continue with Phase 1.2**: Service Selection & Staff Assignment
3. **Implement Phase 1.3**: Scheduling System
4. **Add Phase 1.4**: Payment Integration
5. **Complete Phase 1.5**: Booking Lifecycle

Then proceed with remaining phases systematically.

