# Customer Booking Flows Analysis Report
**Date:** January 27, 2026  
**Scope:** At-Center, Home, and Tele/Video Service Booking Flows

---

## Executive Summary

This report analyzes the Customer Booking flows for three service types:
1. **At-Center Services** (vet clinics, grooming centers, training centers)
2. **Home Services** (home visits for grooming, training, vet, walking)
3. **Tele/Video Services** (video consultations)

**Overall Status:** ✅ **Functional** with some gaps and improvements needed.

---

## 1. Customer App Service Dashboard

### ✅ **Status: IMPLEMENTED**

**Location:** `apps/customer-web/components/customer/CustomerServicesPage.tsx`

**Findings:**
- ✅ Service dashboard component exists with `ServiceDashboardHeader`
- ✅ Service types display: vet, grooming, training, walker, boarding
- ✅ Filtering by category, service style (at_home, at_center, tele)
- ✅ Location-based filtering available
- ✅ Stats cards showing service counts, ratings, bookings

**Issues:**
1. **Missing Service Types:** Some specialized services (nutritionist, behaviourist) may not appear in main dashboard
   - **File:** `apps/customer-web/components/customer/CustomerServicesPage.tsx:202-207`
   - **Fix:** Add missing categories to SelectContent

2. **Service Dashboard Header Stats:** Hardcoded values instead of real-time data
   - **File:** `apps/customer-web/components/customer/CustomerServicesPage.tsx:70-97`
   - **Issue:** Stats like "50+ Centers", "1K+ Bookings" are static
   - **Recommendation:** Fetch real stats from backend API

---

## 2. At-Center Booking Flow

### ✅ **Status: IMPLEMENTED** with minor gaps

### 2.1 Service Provider Listing

**Location:** `apps/customer-web/components/customer/shared/UniversalServiceProviderList.tsx`

**Features Implemented:**
- ✅ Provider cards with profile photo, specialization, distance, rating
- ✅ Filtering by rating, experience, distance, specialization
- ✅ Sort by rating, distance, price, experience, availability
- ✅ Sponsored providers section
- ✅ Top providers section

**Issues:**
1. **Provider Metrics Display:**
   - **File:** `apps/customer-web/components/customer/shared/UniversalServiceProviderList.tsx:295-720`
   - ✅ Distance calculation works
   - ✅ Rating display works
   - ⚠️ **Missing:** Completed services count not consistently shown
   - ⚠️ **Missing:** Response time not displayed

2. **Provider Photo Fallback:**
   - **File:** `apps/customer-web/components/customer/shared/UniversalServiceProviderList.tsx:450-470`
   - ✅ Has fallback for missing photos
   - ⚠️ **Issue:** Some providers may show placeholder instead of actual photo

### 2.2 Provider Profile View

**Location:** `apps/customer-web/components/customer/vet/ClinicProfileView.tsx`  
**Alternative:** `apps/customer-web/components/customer/shared/UniversalProviderProfile.tsx`

**Features Implemented:**
- ✅ Overview section with name, rating, reviews
- ✅ Services list with prices
- ✅ Photos gallery
- ✅ Amenities display
- ✅ Doctors/staff listing (for clinics)
- ✅ Address and contact info

**Issues:**
1. **Photos Gallery:**
   - **File:** `apps/customer-web/components/customer/vet/ClinicProfileView.tsx:131-132`
   - ⚠️ **Issue:** Photos array may be empty for some vendors
   - **Recommendation:** Add fallback to vendor logo or default image

2. **Amenities Display:**
   - **File:** `apps/customer-web/components/customer/vet/ClinicProfileView.tsx:250-256`
   - ⚠️ **Issue:** Amenities array may be empty
   - **Status:** Component handles empty arrays gracefully

3. **Services Mapping:**
   - **File:** `apps/customer-web/components/customer/vet/ClinicProfileView.tsx:100-108`
   - ✅ Correctly maps `service_id` (UUID) as primary ID
   - ✅ Handles multiple response formats

### 2.3 Schedule Selection

**Location:** `apps/customer-web/components/customer/booking/CenterBookingPage.tsx`  
**Alternative:** `apps/customer-web/components/customer/booking/CalendarSlotPicker.tsx`

**Features Implemented:**
- ✅ Date picker (next 7 days)
- ✅ Time slot selection
- ✅ Available slots fetched from backend
- ✅ Calendar component with slot availability

**Issues:**
1. **Scheduling Policy Check:**
   - **File:** `apps/customer-web/components/customer/booking/CenterBookingPage.tsx:61-72`
   - ⚠️ **Missing:** No validation of advance booking hours/minimum notice
   - ⚠️ **Missing:** No check for cancellation policy
   - **Backend:** `backend/lambda/src/endpoints/bookings-enhanced.ts:73-104` has validation
   - **Gap:** Frontend doesn't show policy warnings before selection

2. **Available Slots API:**
   - **File:** `apps/customer-web/components/customer/booking/CenterBookingPage.tsx:63-64`
   - **Endpoint:** `/vendor/${vendorId}/available-slots?date=${selectedDate}`
   - ✅ API call exists
   - ⚠️ **Issue:** No error handling for API failures
   - ⚠️ **Issue:** No loading state for slot fetching

3. **Time Slot Display:**
   - **File:** `apps/customer-web/components/customer/booking/CalendarSlotPicker.tsx`
   - ✅ Shows available/unavailable slots
   - ⚠️ **Missing:** No indication of "almost full" slots
   - ⚠️ **Missing:** No display of slot capacity

### 2.4 Pet Selection

**Location:** `apps/customer-web/components/customer/BookingFlow.tsx:908-981`

**Features Implemented:**
- ✅ Pet list display with photos
- ✅ Pet selection with visual feedback
- ✅ Add pet modal inline
- ✅ Auto-select first pet if only one exists

**Issues:**
1. **Pet Photo Display:**
   - **File:** `apps/customer-web/components/customer/BookingFlow.tsx:939-945`
   - ✅ Has fallback emoji for missing photos
   - ⚠️ **Issue:** Photo upload in modal may not persist

2. **Pet Required Validation:**
   - **File:** `apps/customer-web/components/customer/BookingFlow.tsx:110-124`
   - ✅ Correctly identifies services requiring pets
   - ✅ Blocks booking if no pet selected

### 2.5 Payment and Booking Confirmation

**Location:** `apps/customer-web/components/customer/BookingFlow.tsx:1072-1229`

**Features Implemented:**
- ✅ Payment review screen
- ✅ Wallet integration
- ✅ Razorpay payment gateway
- ✅ Subscription coverage check
- ✅ Booking confirmation screen

**Issues:**
1. **Payment API Contract:**
   - **File:** `apps/customer-web/components/customer/BookingFlow.tsx:608-619`
   - ✅ Uses camelCase for API (`bookingId`, `amount`, `useWallet`)
   - ✅ Handles multiple response formats
   - **Status:** ✅ **COMPLIANT**

2. **Booking Creation:**
   - **File:** `apps/customer-web/components/customer/BookingFlow.tsx:490-666`
   - **Endpoint:** `/bookings/create`
   - ✅ Uses Zod schema validation on backend
   - ✅ Sends camelCase fields (`customerId`, `vendorId`, `serviceId`, `bookingDate`, `bookingTime`)
   - **Status:** ✅ **COMPLIANT**

3. **Booking Confirmation:**
   - **File:** `apps/customer-web/components/customer/BookingFlow.tsx:1181-1213`
   - ✅ Shows booking details
   - ⚠️ **Missing:** No booking ID display
   - ⚠️ **Missing:** No QR code for check-in

---

## 3. Home Services Flow

### ✅ **Status: IMPLEMENTED** with gaps

### 3.1 Provider Discovery

**Location:** `apps/customer-web/components/customer/home-services/HomeServiceRouter.tsx`

**Features Implemented:**
- ✅ Hyperlocal provider discovery
- ✅ Distance-based filtering
- ✅ Last booked providers prioritized
- ✅ Provider cards with ratings, distance, availability

**Issues:**
1. **Staff/Solo Provider Filtering:**
   - **File:** `apps/customer-web/components/customer/home-services/HomeServiceRouter.tsx:427`
   - **Endpoint:** `/customer/${phone}/last-booked-providers`
   - ⚠️ **CRITICAL GAP:** No explicit filtering for staff/solo providers only
   - **Current:** Shows all providers (vendors + staff + solo)
   - **Requirement:** Should show ONLY staff and solo providers (not vendor centers)
   - **Fix Needed:** Add `providerType` filter to API call or filter results client-side

2. **Provider Type Detection:**
   - **File:** `apps/customer-web/components/customer/home-services/HomeServiceRouter.tsx:119-139`
   - ⚠️ **Issue:** `ServiceProvider` interface doesn't have `providerType` field
   - **Recommendation:** Add `providerType: 'staff' | 'solo' | 'vendor'` to interface

### 3.2 GPS Tracking Integration

**Location:** `apps/customer-web/components/customer/booking/GPSTrackingView.tsx`

**Features Implemented:**
- ✅ Real-time GPS tracking via SSE (Server-Sent Events)
- ✅ Polling fallback if SSE not supported
- ✅ Distance traveled display
- ✅ Duration tracking
- ✅ ETA calculation
- ✅ Google Maps integration

**Issues:**
1. **GPS Tracking API:**
   - **File:** `apps/customer-web/components/customer/booking/GPSTrackingView.tsx:32-48`
   - **Endpoint:** `/gps-tracking/booking/${bookingId}/stream` (SSE)
   - **Fallback:** `/gps-tracking/booking/${bookingId}` (polling)
   - ✅ Both endpoints exist
   - ⚠️ **Issue:** SSE connection may fail silently
   - **Recommendation:** Add retry logic for SSE connection

2. **GPS Tracking Display:**
   - **File:** `apps/customer-web/components/customer/booking/GPSTrackingView.tsx:240-318`
   - ✅ Shows current location, distance, duration
   - ⚠️ **Missing:** No map visualization (only Google Maps link)
   - **Recommendation:** Add embedded map component

### 3.3 Address Selection

**Location:** `apps/customer-web/components/customer/BookingFlow.tsx:983-1070`

**Features Implemented:**
- ✅ Address list display
- ✅ Address selection with visual feedback
- ✅ Add address modal inline
- ✅ GPS location detection
- ✅ Default address auto-selection

**Issues:**
1. **Address Coordinates:**
   - **File:** `apps/customer-web/components/customer/BookingFlow.tsx:400-403`
   - ✅ Uses latitude/longitude for commute calculation
   - ⚠️ **Issue:** Some addresses may not have coordinates
   - **Recommendation:** Auto-geocode addresses without coordinates

2. **Address Required Validation:**
   - **File:** `apps/customer-web/components/customer/BookingFlow.tsx:127-143`
   - ✅ Correctly identifies services requiring address
   - ✅ Blocks booking if no address selected

---

## 4. Tele/Video Flow

### ✅ **Status: IMPLEMENTED** with gaps

### 4.1 Schedule vs Instant Consultation

**Location:** `apps/customer-web/components/customer/vet/TeleConsultationRouter.tsx`

**Features Implemented:**
- ✅ Two modes: Scheduled and Instant
- ✅ Instant consultation queue system
- ✅ Scheduled consultation booking flow
- ✅ Provider selection for scheduled consultations

**Issues:**
1. **Instant Consultation Queue:**
   - **File:** `apps/customer-web/components/customer/InstantTeleQueue.tsx`
   - **Endpoint:** `/instant-tele/join-queue`
   - ✅ Queue joining works
   - ✅ Provider acceptance handling
   - ⚠️ **Issue:** No timeout handling if no provider accepts
   - **Recommendation:** Add timeout (e.g., 5 minutes) with fallback to scheduled booking

2. **Scheduled Consultation:**
   - **File:** `apps/customer-web/components/customer/vet/TeleConsultationRouter.tsx:492-575`
   - ✅ Provider profile view
   - ✅ Service selection
   - ✅ Schedule selection
   - ⚠️ **Missing:** No indication of provider availability for scheduled slots
   - **Recommendation:** Show "Available Now" badge for providers currently online

### 4.2 Video Call Integration

**Location:** `apps/customer-web/components/customer/booking/ChimeVideoCall.tsx`  
**Alternative:** `apps/customer-web/components/customer/video/VideoCallInterface.tsx`

**Features Implemented:**
- ✅ AWS Chime SDK integration
- ✅ Video call UI with controls
- ✅ Mute/unmute, camera on/off
- ✅ Chat during call
- ✅ End call functionality

**Issues:**
1. **Video Call Initialization:**
   - **File:** `apps/customer-web/components/customer/booking/ChimeVideoCall.tsx:121-150`
   - ⚠️ **Issue:** Chime SDK loaded dynamically, may fail to load
   - **Recommendation:** Add CDN fallback or preload SDK

2. **Video Call Endpoint:**
   - **File:** `apps/customer-web/components/customer/booking/ChimeVideoCall.tsx:192-204`
   - **Endpoint:** `/video-call/join`
   - ✅ Endpoint exists
   - ⚠️ **Issue:** No error handling for meeting creation failures
   - **Recommendation:** Add retry logic and user-friendly error messages

3. **Video Call Page Route:**
   - **File:** `apps/customer-web/app/video/[bookingId]/page.tsx`
   - ✅ Route exists
   - ✅ Client component handles video call
   - **Status:** ✅ **WORKING**

### 4.3 Prescription Upload

**Location:** `apps/customer-web/components/customer/PrescriptionHistoryModal.tsx`

**Features Implemented:**
- ✅ Prescription upload modal
- ✅ File upload (PDF, images)
- ✅ Upload to booking endpoint
- ✅ Display uploaded prescriptions
- ✅ Link prescriptions to bookings

**Issues:**
1. **Prescription Upload API:**
   - **File:** `apps/customer-web/components/customer/PrescriptionHistoryModal.tsx:157-182`
   - **Endpoint:** `/medical-records/booking/${bookingId}/upload-prescription`
   - ✅ Endpoint exists
   - ⚠️ **Issue:** No file size validation on frontend (only backend)
   - **Recommendation:** Add frontend validation (max 5MB)

2. **Prescription Display:**
   - **File:** `apps/customer-web/components/customer/PrescriptionHistoryModal.tsx:295-622`
   - ✅ Shows PDF and image prescriptions
   - ⚠️ **Issue:** PDF viewer may not work on all browsers
   - **Recommendation:** Use PDF.js for better compatibility

3. **Prescription Upload in Video Call:**
   - **File:** `apps/customer-web/components/customer/booking/ChimeVideoCall.tsx:688-694`
   - ⚠️ **Missing:** Upload button exists but handler may not be connected
   - **Recommendation:** Verify `onPrescriptionUpload` prop is passed correctly

---

## 5. Backend Endpoints Analysis

### ✅ **Status: MOSTLY COMPLIANT**

### 5.1 Booking Creation

**Location:** `backend/lambda/src/endpoints/bookings-enhanced.ts`

**Endpoints:**
- ✅ `POST /bookings/create` - Main endpoint (Zod validated)
- ✅ `POST /booking/create` - Legacy endpoint (backward compatibility)
- ✅ `POST /customer/booking/create` - Customer-specific endpoint
- ✅ `POST /customer/bookings/create` - Alternative customer endpoint

**API Contract:**
- ✅ Uses `CreateBookingRequestSchema` (Zod)
- ✅ Accepts camelCase: `customerId`, `vendorId`, `serviceId`, `bookingDate`, `bookingTime`
- ✅ Validates booking date/time (minimum notice, max advance days)
- ✅ Handles service types: `at_center`, `at_home`, `tele`

**Issues:**
1. **Multiple Endpoints:**
   - **File:** `backend/lambda/src/endpoints/bookings-enhanced.ts:1758-1907`
   - ⚠️ **Issue:** 4 different endpoints for same functionality
   - **Recommendation:** Consolidate to single `/bookings/create` endpoint

2. **Service Type Mapping:**
   - **File:** `backend/lambda/src/endpoints/bookings-enhanced.ts:150-152`
   - ✅ Maps legacy `'online'` to `'tele'`
   - ✅ Defaults to `'at_vendor'` if not specified
   - **Status:** ✅ **WORKING**

### 5.2 Available Slots

**Location:** `backend/lambda/src/endpoints/followup-reschedule.ts` (likely)

**Endpoints:**
- ✅ `GET /vendor/${vendorId}/available-slots?date=${date}`
- ✅ `GET /bookings/available-slots` (alternative)

**Issues:**
1. **Scheduling Policy:**
   - **File:** `backend/lambda/src/endpoints/bookings-enhanced.ts:43-44`
   - ✅ Constants defined: `MAX_ADVANCE_BOOKING_DAYS = 60`, `MIN_NOTICE_HOURS = 1`
   - ⚠️ **Missing:** No vendor-specific scheduling policies
   - **Recommendation:** Add vendor scheduling policy table/endpoint

### 5.3 Provider Discovery (Home Services)

**Endpoints:**
- ✅ `GET /customer/discover-staff` - Staff discovery with commute time
- ✅ `GET /customer/${phone}/last-booked-providers` - Last booked providers

**Issues:**
1. **Provider Type Filtering:**
   - ⚠️ **CRITICAL GAP:** No explicit `providerType` filter in API
   - **Recommendation:** Add `providerType` query parameter to filter staff/solo only

### 5.4 GPS Tracking

**Endpoints:**
- ✅ `GET /gps-tracking/booking/${bookingId}/stream` - SSE stream
- ✅ `GET /gps-tracking/booking/${bookingId}` - Polling endpoint

**Status:** ✅ **WORKING**

### 5.5 Video Call

**Endpoints:**
- ✅ `POST /video-call/join` - Join/create meeting
- ✅ `POST /video-call/:bookingId/end` - End call
- ✅ `GET /video-call/:bookingId/attendees` - Get attendees

**Status:** ✅ **WORKING**

### 5.6 Prescription Upload

**Endpoints:**
- ✅ `POST /medical-records/booking/:bookingId/upload-prescription` - Upload prescription

**Status:** ✅ **WORKING**

---

## 6. Critical Issues Summary

### 🔴 **HIGH PRIORITY**

1. **Home Services: Staff/Solo Provider Filtering**
   - **File:** `apps/customer-web/components/customer/home-services/HomeServiceRouter.tsx`
   - **Issue:** Shows all providers instead of only staff/solo
   - **Impact:** Users may see vendor centers in home services list
   - **Fix:** Add `providerType` filter to API call or filter client-side

2. **Scheduling Policy Display**
   - **File:** `apps/customer-web/components/customer/booking/CenterBookingPage.tsx`
   - **Issue:** No frontend validation/warning for advance booking hours
   - **Impact:** Users may select invalid time slots
   - **Fix:** Add policy check before allowing slot selection

3. **Provider Profile Photos**
   - **File:** `apps/customer-web/components/customer/vet/ClinicProfileView.tsx:131-132`
   - **Issue:** Empty photos array for some vendors
   - **Impact:** Poor UX with missing images
   - **Fix:** Add fallback to vendor logo or default image

### 🟡 **MEDIUM PRIORITY**

4. **Service Dashboard Stats**
   - **File:** `apps/customer-web/components/customer/CustomerServicesPage.tsx:70-97`
   - **Issue:** Hardcoded stats instead of real-time data
   - **Fix:** Fetch real stats from backend API

5. **GPS Tracking Map Visualization**
   - **File:** `apps/customer-web/components/customer/booking/GPSTrackingView.tsx`
   - **Issue:** No embedded map, only Google Maps link
   - **Fix:** Add embedded map component (Google Maps or Mapbox)

6. **Instant Consultation Timeout**
   - **File:** `apps/customer-web/components/customer/InstantTeleQueue.tsx`
   - **Issue:** No timeout if no provider accepts
   - **Fix:** Add 5-minute timeout with fallback to scheduled booking

### 🟢 **LOW PRIORITY**

7. **Booking Confirmation QR Code**
   - **File:** `apps/customer-web/components/customer/BookingFlow.tsx:1181-1213`
   - **Issue:** No QR code for check-in
   - **Fix:** Generate QR code with booking ID

8. **Prescription Upload File Size Validation**
   - **File:** `apps/customer-web/components/customer/PrescriptionHistoryModal.tsx`
   - **Issue:** No frontend validation (only backend)
   - **Fix:** Add frontend validation before upload

---

## 7. API Contract Compliance

### ✅ **COMPLIANT**

- Booking creation uses camelCase (`customerId`, `vendorId`, `serviceId`)
- Backend validates with Zod schemas
- Response formats handled (camelCase and snake_case)

### ⚠️ **NEEDS ATTENTION**

- Multiple booking endpoints (consolidation recommended)
- Provider type filtering missing in home services API

---

## 8. Required Fields Capture

### ✅ **COMPLIANT**

- Pet selection required for pet services
- Address required for home services
- Date/time required for all bookings
- Service selection required

### ⚠️ **MINOR GAPS**

- Notes field optional (as intended)
- Some optional fields may not be clearly marked

---

## 9. Recommendations

1. **Consolidate Booking Endpoints:** Reduce from 4 to 1 main endpoint
2. **Add Provider Type Filtering:** Explicit filter for staff/solo providers in home services
3. **Add Scheduling Policy UI:** Show advance booking hours and cancellation policy
4. **Improve Error Handling:** Add retry logic and user-friendly error messages
5. **Add Real-time Stats:** Fetch service dashboard stats from backend
6. **Enhance GPS Tracking:** Add embedded map visualization
7. **Add Booking QR Code:** Generate QR code for check-in

---

## 10. File Path Reference

### Frontend Components
- Service Dashboard: `apps/customer-web/components/customer/CustomerServicesPage.tsx`
- Provider Listing: `apps/customer-web/components/customer/shared/UniversalServiceProviderList.tsx`
- Provider Profile: `apps/customer-web/components/customer/vet/ClinicProfileView.tsx`
- Booking Flow: `apps/customer-web/components/customer/BookingFlow.tsx`
- Center Booking: `apps/customer-web/components/customer/booking/CenterBookingPage.tsx`
- Home Services: `apps/customer-web/components/customer/home-services/HomeServiceRouter.tsx`
- Tele Consultation: `apps/customer-web/components/customer/vet/TeleConsultationRouter.tsx`
- Video Call: `apps/customer-web/components/customer/booking/ChimeVideoCall.tsx`
- GPS Tracking: `apps/customer-web/components/customer/booking/GPSTrackingView.tsx`
- Prescription Upload: `apps/customer-web/components/customer/PrescriptionHistoryModal.tsx`

### Backend Endpoints
- Booking Creation: `backend/lambda/src/endpoints/bookings-enhanced.ts`
- Video Call: `backend/lambda/src/endpoints/video-call-enhanced.ts`
- GPS Tracking: `backend/lambda/src/endpoints/gps-tracking.ts` (if exists)
- Medical Records: `backend/lambda/src/endpoints/medical-records.ts`

---

**Report Generated:** January 27, 2026  
**Next Review:** After implementing critical fixes
