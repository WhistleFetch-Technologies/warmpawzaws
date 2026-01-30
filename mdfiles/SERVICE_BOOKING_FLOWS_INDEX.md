# Service Booking Flows - Master Index
## Customer App - Complete Flow Documentation

**Date:** 2026-01-28  
**Version:** 1.0  
**Status:** Complete Documentation Set  
**Purpose:** Master index and quick reference for all service booking flows

---

## 📚 Documentation Structure

This documentation set provides **enterprise-grade, step-by-step flow specifications** for the customer-side service booking experience. Each document covers:

- ✅ **Clear step-by-step flows** with screen-by-screen breakdown
- ✅ **API endpoints** for each step with request/response structures
- ✅ **UI/UX requirements** with design specifications
- ✅ **Data models** and data flow
- ✅ **Error handling** and edge cases
- ✅ **Reusable components** and filter systems
- ✅ **Reference designs** and best practices

---

## 📖 Document List

### 1. [Service Booking Flow Overview](./SERVICE_BOOKING_FLOW_OVERVIEW.md)
**Purpose:** High-level architecture and flow structure

**Contents:**
- Flow architecture diagram
- Entry points (Service Cards, Problem Grid, Search)
- Service styles (Center, Home, Tele)
- Common reusable components
- Tech stack details
- Design system

**Key Sections:**
- Entry Points
- Service Styles
- Common Components
- Reusable Flows
- Tech Stack

**Use When:** Understanding overall flow structure and architecture

---

### 2. [Center Services Booking Flow](./CENTER_SERVICES_BOOKING_FLOW.md)
**Purpose:** Complete flow for At Center/Clinic bookings

**Flow Steps:** 7 steps
1. Service Selection
2. Service Style Selection (At Center)
3. Provider Discovery
4. Provider Profile & Service Selection
5. Scheduling (Date, Time, Pet)
6. Payment & Checkout
7. Booking Confirmation

**Key Features:**
- Center/clinic provider listing
- Distance-based filtering
- Amenities filtering
- Center timing and availability
- OTP for booking completion

**Endpoints:**
- `GET /customer/services/search?style=at_center`
- `GET /vendor/{vendorId}/profile`
- `GET /vendor/{vendorId}/availability`
- `POST /bookings/create`

**Use When:** Implementing or reviewing center-based service bookings

---

### 3. [Home Services Booking Flow](./HOME_SERVICES_BOOKING_FLOW.md)
**Purpose:** Complete flow for At Home service bookings

**Flow Steps:** 7 steps
1. Service Selection
2. Service Style Selection (At Home)
3. Provider Discovery (Staff/Solo only)
4. Provider Profile & Service Selection
5. Scheduling & Address Selection
6. Payment & Checkout
7. Booking Confirmation with GPS Tracking

**Key Features:**
- Staff/solo provider listing
- Problem-based filtering
- Address selection with map
- GPS tracking integration
- ETA calculation
- Real-time location updates

**Endpoints:**
- `GET /customer/services/search?style=at_home`
- `GET /staff/{staffId}/profile`
- `POST /gps-tracking/start`
- `GET /gps-tracking/booking/{bookingId}`

**Use When:** Implementing or reviewing home service bookings with GPS tracking

---

### 4. [Tele Consultation Booking Flow](./TELE_CONSULTATION_BOOKING_FLOW.md)
**Purpose:** Complete flow for Video Call consultations

**Flow Variations:**
- **Scheduled:** 6 steps
- **Instant:** 5 steps

**Key Features:**
- Schedule vs Instant selection
- Video call integration (WebRTC/Amazon Chime)
- Chat interface (pre/post consultation)
- 5-minute reminder notification
- Instant queue system
- Prescription upload

**Endpoints:**
- `GET /customer/services/search?style=tele`
- `POST /video-call/create-meeting`
- `GET /chat/{bookingId}/messages`
- `GET /customer/{phone}/bookings/upcoming-calls?minutes=5`

**Use When:** Implementing or reviewing tele/video consultation bookings

---

### 5. [Problem Grid Integration Flow](./PROBLEM_GRID_INTEGRATION_FLOW.md)
**Purpose:** Problem-focused booking flow integration

**Flow Steps:** 6 steps
1. Problem Selection (from grid)
2. Service Style Selection (filtered by problem)
3. Provider Discovery (pre-filtered by problem)
4. Provider Profile (problem context)
5. Booking Flow (standard with problem tag)
6. Confirmation (problem tagged)

**Key Features:**
- Problem-first approach
- Pre-filtered provider discovery
- Problem-specific specializations
- Reusable components with problem context
- Filter reusability system

**Endpoints:**
- `GET /config/problem-grid`
- `GET /customer/services/search?problemGridId={id}`
- `GET /vendor/{vendorId}/services?problemGridId={id}`

**Use When:** Understanding how problem grid integrates with main flows

---

### 6. [Payment & Checkout Flow](./PAYMENT_CHECKOUT_FLOW.md)
**Purpose:** Universal payment processing

**Flow Steps:** 3 steps
1. Booking Summary Review
2. Payment Method Selection
3. Payment Processing

**Key Features:**
- Universal payment page (all booking types)
- Price breakdown (service, fees, GST)
- Multiple payment methods (Wallet, Razorpay)
- Discount application (Vendor, Platform, Coupon)
- GST calculation (CGST/SGST/IGST)

**Endpoints:**
- `POST /tax/calculate`
- `GET /admin/finance/fees`
- `POST /promotions/validate-code`
- `POST /razorpay/orders/create`
- `POST /razorpay/payments/verify`

**Use When:** Implementing or reviewing payment processing

---

### 7. [Booking Confirmation & Post-Booking Flow](./BOOKING_CONFIRMATION_FLOW.md)
**Purpose:** Post-booking experience and tracking

**Flow Steps:** Multiple post-booking actions
1. Booking Confirmation Screen
2. Post-Booking Actions (Calendar, Share, View)
3. Tracking & Notifications
4. Booking Details Screen
5. My Bookings Section

**Key Features:**
- OTP display and sharing
- GPS tracking (home services)
- Real-time notifications
- Chat interface
- Prescription access
- Reschedule/Cancel options

**Endpoints:**
- `GET /bookings/{bookingId}`
- `GET /customer/{customerId}/bookings`
- `GET /gps-tracking/booking/{bookingId}`
- `GET /customer/{phone}/notifications`

**Use When:** Implementing post-booking features and tracking

---

## 🎯 Quick Reference Guide

### Entry Points

| Entry Point | Component | Flow Document |
|------------|-----------|---------------|
| Service Card Click | `CustomerHomeComplete.tsx` | Overview, Center/Home/Tele |
| Problem Grid | `ProblemGridNavigation.tsx` | Problem Grid Integration |
| Search Bar | `EnhancedSearchBar.tsx` | Overview |
| Quick Actions | `CustomerHomeComplete.tsx` | Overview |

### Service Styles

| Style | Flow Document | Key Components |
|-------|---------------|----------------|
| At Center | Center Services Flow | `VetServicesByStyle.tsx`, `CenterBookingFlowEnhanced.tsx` |
| At Home | Home Services Flow | `HomeServiceRouter.tsx`, `UniversalHomeServiceRouter.tsx` |
| Tele/Video | Tele Consultation Flow | `TeleConsultationRouter.tsx`, `InstantTeleQueue.tsx` |

### Reusable Components

| Component | Used In | Document |
|-----------|---------|----------|
| `ServiceDiscovery.tsx` | All flows | Overview, Problem Grid |
| `SchedulingSelector.tsx` | All flows | Center, Home, Tele |
| `PetSelector.tsx` | All flows | All flows |
| `AddressSelector.tsx` | Home, Delivery | Home Services Flow |
| `UniversalPaymentPage.tsx` | All flows | Payment Flow |
| `BookingConfirmationScreen.tsx` | All flows | Confirmation Flow |

### Common Endpoints

| Endpoint | Purpose | Used In |
|----------|---------|---------|
| `GET /customer/services/search` | Provider discovery | All flows |
| `GET /vendor/{vendorId}/profile` | Provider details | Center, Home |
| `GET /staff/{staffId}/profile` | Staff details | Home, Tele |
| `POST /bookings/create` | Create booking | All flows |
| `POST /razorpay/orders/create` | Payment order | Payment Flow |
| `GET /bookings/{bookingId}` | Booking details | Confirmation Flow |

---

## 🏗️ Architecture Overview

### Flow Hierarchy

```
Customer Home Screen
    │
    ├── Service Card Click
    │   └── Service Style Selection
    │       ├── At Center → Center Flow
    │       ├── At Home → Home Flow
    │       └── Tele → Tele Flow
    │
    ├── Problem Grid Click
    │   └── Problem Grid Router
    │       └── Service Style (Filtered)
    │           └── Provider Discovery (Pre-filtered)
    │               └── Standard Booking Flow
    │
    └── Search Bar
        └── Service Discovery
            └── Provider Selection
                └── Standard Booking Flow
```

### Component Reusability

```
Universal Components (Reused Across All Flows)
    │
    ├── ServiceDiscovery.tsx
    │   └── Adapts based on serviceStyle and problemGridId
    │
    ├── SchedulingSelector.tsx
    │   └── Same component, different data source
    │
    ├── UniversalPaymentPage.tsx
    │   └── Handles all booking types
    │
    └── BookingConfirmationScreen.tsx
        └── Adapts based on serviceStyle
```

---

## 📊 Flow Comparison Matrix

| Feature | Center | Home | Tele |
|---------|--------|------|------|
| Provider Type | Centers/Clinics | Staff/Solo | Staff/Solo |
| Address Required | ❌ | ✅ | ❌ |
| GPS Tracking | ❌ | ✅ | ❌ |
| Video Call | ❌ | ❌ | ✅ |
| Chat Interface | ✅ | ✅ | ✅ |
| OTP Required | ✅ | ✅ | ✅ |
| Problem Filtering | ✅ | ✅ | ✅ |
| Instant Booking | ❌ | ✅ | ✅ |

---

## 🎨 Design System Quick Reference

### Colors
- **Primary:** `#FF8C42` (Orange)
- **Primary Hover:** `#FF7A29`
- **Success:** `#10B981` (Green)
- **Error:** `#DC2626` (Red)

### Container Width
- **Mobile:** `max-w-[430px] mx-auto`
- **Modal:** `max-w-lg`
- **Desktop:** `max-w-2xl` or `max-w-4xl`

### Typography
- **Headings:** `text-2xl font-bold` (h1), `text-xl font-bold` (h2)
- **Body:** `text-base` or `text-sm` with `text-gray-700`

### Components
- **Buttons:** `bg-[#FF8C42] hover:bg-[#FF7A29] text-white rounded-xl`
- **Cards:** `bg-white rounded-2xl shadow-md border border-gray-200`

---

## 🔗 Integration Points

### Problem Grid → Main Flows
- Problem selection → Filtered service style selection
- Pre-filtered provider discovery
- Problem context maintained throughout
- Problem tag in booking

### Payment → All Flows
- Universal payment page
- Same payment flow for all booking types
- Service-style-specific price components (e.g., travel fee for home)

### Tracking → Home Services
- GPS tracking initialized on booking confirmation
- Real-time location updates
- ETA calculation
- Home screen notifications

---

## 📱 Screen Flow Summary

### Minimum Flow (5 Steps)
1. Service Selection
2. Service Style Selection
3. Provider Selection
4. Booking Details (Pet, Date, Time, Address)
5. Payment & Confirmation

### Enhanced Flow (7 Steps)
1. Service Selection
2. Service Style Selection
3. Provider Discovery (with filters)
4. Provider Profile
5. Service Selection (if multiple)
6. Booking Details
7. Payment & Confirmation

### Problem Grid Flow (6 Steps)
1. Problem Selection
2. Service Style Selection (filtered)
3. Provider Discovery (pre-filtered)
4. Provider Profile (problem context)
5. Booking Details
6. Payment & Confirmation

---

## 🛠️ Tech Stack Summary

### Frontend
- **Framework:** Next.js 14 (App Router)
- **UI Library:** React 18
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Components:** Radix UI
- **State:** React Query, Context API
- **Forms:** React Hook Form + Zod

### Backend Integration
- **API:** RESTful endpoints
- **Payment:** Razorpay
- **Video:** Amazon Chime SDK / WebRTC
- **Maps:** Google Maps API
- **Notifications:** SNS/Push Notifications

---

## ✅ Implementation Checklist

### Phase 1: Core Flows
- [ ] Center Services Booking Flow
- [ ] Home Services Booking Flow
- [ ] Tele Consultation Booking Flow
- [ ] Universal Payment Page

### Phase 2: Integration
- [ ] Problem Grid Integration
- [ ] Filter System
- [ ] Reusable Components

### Phase 3: Post-Booking
- [ ] Booking Confirmation Screen
- [ ] GPS Tracking (Home Services)
- [ ] Notifications System
- [ ] Booking Details Screen
- [ ] My Bookings Section

### Phase 4: Enhancements
- [ ] Chat Interface
- [ ] Video Call Integration
- [ ] Prescription Management
- [ ] Reviews & Ratings

---

## 📞 Support & Questions

For questions about these flows:
1. Refer to the specific flow document
2. Check the "Edge Cases" section
3. Review API endpoint specifications
4. Consult the "UI/UX Requirements" section

---

## 📝 Document Status

| Document | Status | Last Updated |
|----------|--------|--------------|
| Service Booking Flow Overview | ✅ Complete | 2026-01-28 |
| Center Services Booking Flow | ✅ Complete | 2026-01-28 |
| Home Services Booking Flow | ✅ Complete | 2026-01-28 |
| Tele Consultation Booking Flow | ✅ Complete | 2026-01-28 |
| Problem Grid Integration Flow | ✅ Complete | 2026-01-28 |
| Payment & Checkout Flow | ✅ Complete | 2026-01-28 |
| Booking Confirmation Flow | ✅ Complete | 2026-01-28 |

**All Documents:** ✅ **Complete and Ready for Design Implementation**

---

## 🎯 Next Steps

1. **Design Phase:**
   - Use these documents as design specifications
   - Create wireframes based on screen specifications
   - Design UI components based on requirements

2. **Development Phase:**
   - Implement flows step-by-step
   - Use API endpoints as specified
   - Follow UI/UX requirements

3. **Testing Phase:**
   - Test each flow end-to-end
   - Verify API integrations
   - Test error handling and edge cases

4. **Review Phase:**
   - Compare implementation with specifications
   - Verify all endpoints are implemented
   - Ensure UI matches design requirements

---

**Document Status:** ✅ Complete  
**Last Updated:** 2026-01-28  
**Ready for:** Design and Development Implementation
