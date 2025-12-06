# 🏗️ Universal Home & Tele Services Implementation Plan

## 🎯 Overview
Build a complete, universal framework for home services and tele-consultation across all vendor types with proper staff service management, booking lifecycle, tracking, and OTP completion.

---

## 🐛 IMMEDIATE FIXES REQUIRED

### **Issue 1: Staff Services Not Loading**
**Problem**: Dr. Vikram Bhat (new staff) doesn't see services in staff login even though services appear in customer app.

**Root Cause**: 
- Vendor assigns services via `staff.assignedServices` array (list of service IDs)
- Staff Service Management looks for `staff:${staffId}:service:*` KV records
- These two systems are disconnected

**Solution**:
1. When vendor assigns services, auto-create `staff:${staffId}:service:*` records
2. Sync staff services on staff login if missing
3. Allow staff to enable/disable services independently

---

### **Issue 2: Appointments Not Visible in Staff Login**
**Problem**: Booked appointments don't appear in staff dashboard.

**Root Cause**: Need to query appointments by staffId

**Solution**:
1. Create endpoint: `GET /staff/:staffId/appointments`
2. Query all bookings where `assignedStaffId === staffId`
3. Show in staff dashboard with proper status badges

---

## 🏛️ ARCHITECTURE

### **Service Style Framework**
```typescript
type ServiceStyle = 'at_center' | 'at_home' | 'tele';

interface StaffServiceSubscription {
  style: ServiceStyle;
  enabled: boolean;
  
  // For home services
  maxDistance?: number; // km radius staff willing to travel
  
  // For tele services
  teleEnabled?: boolean;
  videoCallEnabled?: boolean;
  chatEnabled?: boolean;
}
```

### **Data Structure**
```typescript
// Staff Service Record
interface StaffService {
  id: string; // staffsvc_xxxxx
  staffId: string;
  serviceId: string; // Reference to vendor service
  serviceName: string;
  category: string;
  price: number;
  duration: number;
  
  // Service style
  serviceStyle: 'at_center' | 'at_home' | 'tele';
  
  // Staff control
  isActive: boolean; // Staff can toggle
  
  // Home service specific
  maxTravelDistance?: number; // For at_home
  
  // Tele specific
  teleVideoEnabled?: boolean; // For tele
  teleChatEnabled?: boolean;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

// Booking with Style
interface Booking {
  id: string;
  customerId: string;
  vendorId: string;
  assignedStaffId?: string;
  
  serviceStyle: 'at_center' | 'at_home' | 'tele';
  
  services: Array<{
    serviceId: string;
    serviceName: string;
    price: number;
    duration: number;
  }>;
  
  // Home service specific
  customerAddress?: Address;
  travelStartedAt?: string;
  arrivedAt?: string;
  
  // Tele specific
  teleCallStartedAt?: string;
  teleCallEndedAt?: string;
  teleCallDuration?: number;
  
  // Tracking (home & walker)
  trackingSessionId?: string;
  startOtp?: string; // For walker session start
  endOtp: string; // For completion
  
  // Status
  status: 'pending' | 'accepted' | 'traveling' | 'in_progress' | 'completed' | 'cancelled';
  
  // Earnings
  totalAmount: number;
  earningsReleased: boolean;
  staffEarnings?: number;
  
  createdAt: string;
  updatedAt: string;
}
```

---

## 📋 IMPLEMENTATION PHASES

### **Phase 1: Fix Immediate Issues** ⚡ (Priority)

#### 1.1: Staff Service Sync
- [ ] Create endpoint: `POST /staff/:staffId/sync-services-from-assignment`
- [ ] Auto-create `staff:${staffId}:service:*` from `staff.assignedServices`
- [ ] Call this on staff login if services array is empty
- [ ] Update staff service management to show all services

#### 1.2: Staff Appointments View
- [ ] Create endpoint: `GET /staff/:staffId/appointments`
- [ ] Filter by staff ID and date range
- [ ] Show status, customer, service, timing
- [ ] Implement in StaffDashboard

---

### **Phase 2: Service Style Management** 🎛️

#### 2.1: Staff Service Style Subscription
- [ ] Add UI in StaffServiceManagement for style preferences
- [ ] Toggle: at_center, at_home, tele
- [ ] For home: Distance radius slider (0-50km)
- [ ] For tele: Enable video/chat toggles
- [ ] Update backend to store preferences

#### 2.2: Discovery Filtering
- [ ] Update universal search to filter by serviceStyle
- [ ] Only show staff if:
  - Service style is enabled for staff
  - For home: Customer within staff's maxDistance
  - For tele: Staff has tele enabled
  - Staff is online and available

---

### **Phase 3: Home Services Framework** 🏠

#### 3.1: Home Services Booking Flow
- [ ] Add service style selector at booking start
- [ ] Show only home-enabled services
- [ ] Calculate distance from customer to staff
- [ ] Filter out staff beyond their maxDistance
- [ ] Check availability with scheduling policies

#### 3.2: Home Services Tracking
- [ ] Create tracking session on booking accept
- [ ] "Start Travel" button for staff
- [ ] Update status to 'traveling'
- [ ] Send notification to customer
- [ ] Real-time location updates using Google Maps API
- [ ] Show ETA to customer
- [ ] "Arrived" button when staff reaches

#### 3.3: Service Completion
- [ ] "Complete Service" button
- [ ] Customer provides END OTP
- [ ] Verify OTP
- [ ] Update status to 'completed'
- [ ] Release earnings to staff
- [ ] Create earning record

---

### **Phase 4: Walker-Specific Flow** 🐕

#### 4.1: Walking Session
- [ ] Customer books walking session
- [ ] Staff reaches customer home (tracked)
- [ ] Staff requests START OTP from customer
- [ ] Start tracking session (route, distance, time)
- [ ] Live tracking map for customer
- [ ] Collect session data (distance walked, route, duration)
- [ ] END OTP to complete
- [ ] Generate session report
- [ ] Release earnings

---

### **Phase 5: Tele-Consultation Framework** 📱

#### 5.1: Tele Booking
- [ ] Filter staff with tele enabled
- [ ] Show available time slots
- [ ] Book tele appointment
- [ ] Send notification to staff

#### 5.2: Video/Chat Integration
- [ ] "Start Video Call" button (customer & staff)
- [ ] Integrate existing video call component
- [ ] "Accept/Reject" call for staff
- [ ] In-call chat functionality
- [ ] Record call duration
- [ ] End call and provide END OTP
- [ ] Release earnings based on duration

---

### **Phase 6: Emergency Reassignment** 🚨

#### 6.1: Vendor Cancellation
- [ ] Staff can mark as "Can't accept" with reason
- [ ] System broadcasts to nearby staff (within 5km)
- [ ] Push notifications to eligible staff
- [ ] First to accept gets assignment
- [ ] Update customer with new staff info
- [ ] Auto-reassign within 10 minutes or refund

---

### **Phase 7: Universal Discovery** 🔍

#### 7.1: Style-Aware Search
- [ ] Add `serviceStyle` parameter to search
- [ ] Filter services by style at discovery stage
- [ ] De-duplicate services across vendors
- [ ] Show singular service list
- [ ] Display available vendors/staff per service

---

## 🛠️ TECHNICAL COMPONENTS

### **New Backend Endpoints**

```typescript
// Staff service management
POST   /staff/:staffId/sync-services-from-assignment
GET    /staff/:staffId/appointments
POST   /staff/:staffId/services/:serviceId/toggle-style
PUT    /staff/:staffId/services/:serviceId/update-distance
PUT    /staff/:staffId/services/:serviceId/update-tele-settings

// Home services
POST   /booking/:bookingId/start-travel
POST   /booking/:bookingId/mark-arrived
POST   /booking/:bookingId/complete-with-otp
GET    /booking/:bookingId/tracking-session

// Walker specific
POST   /booking/:bookingId/start-session-with-otp
GET    /booking/:bookingId/session-data
POST   /booking/:bookingId/end-session-with-otp

// Tele consultation
POST   /booking/:bookingId/start-video-call
POST   /booking/:bookingId/end-video-call
GET    /booking/:bookingId/call-status

// Emergency reassignment
POST   /booking/:bookingId/reject-and-reassign
GET    /staff/nearby-eligible/:lat/:lon/:serviceId
POST   /booking/:bookingId/broadcast-to-nearby
POST   /booking/:bookingId/accept-reassignment

// Earnings
POST   /booking/:bookingId/release-earnings
GET    /staff/:staffId/earnings
```

### **New Frontend Components**

```typescript
// Staff
<StaffServiceStyleManager />
<StaffAppointmentsList />
<HomeServiceTracker /> // For traveling
<WalkerSessionTracker />
<TeleConsultationPanel />
<EarningsDashboard />

// Customer
<ServiceStyleSelector />
<HomeServiceBooking />
<LiveStaffTracker /> // Track staff coming home
<WalkerSessionViewer /> // Watch dog walk live
<TeleConsultationInterface />
<VideoCallInterface />
```

---

## 📱 UI FLOWS

### **Customer: Home Services**

```
1. Service Dashboard
   ↓
2. Choose "Home Services" 🏠
   ↓
3. Browse services (filtered: home-enabled only)
   ↓
4. Select service(s)
   ↓
5. Enter/confirm address
   ↓
6. View available time slots
   ↓
7. Make payment
   ↓
8. Booking confirmed
   ↓
9. Staff assigned
   ↓
10. Staff starts travel → Notification + Live tracking
    ↓
11. Staff arrives → Notification
    ↓
12. Service in progress
    ↓
13. Provide END OTP
    ↓
14. Booking completed
    ↓
15. Rate & review
```

### **Staff: Home Services**

```
1. New booking notification
   ↓
2. View details (location, services, price, direction)
   ↓
3. Accept/Reject
   ↓
4. If accepted → "Start Travel" button appears
   ↓
5. Click "Start Travel"
   ↓
6. Customer gets notification + tracking starts
   ↓
7. Navigate using "Get Directions"
   ↓
8. Click "I've Arrived"
   ↓
9. Provide service
   ↓
10. Click "Complete Service"
    ↓
11. Request END OTP from customer
    ↓
12. Enter OTP
    ↓
13. Service marked complete
    ↓
14. Earnings credited
```

### **Walker: Walking Session**

```
1. Accept walking booking
   ↓
2. Travel to customer home (tracked)
   ↓
3. Arrive at home
   ↓
4. Request START OTP from customer
   ↓
5. Enter START OTP → Session begins
   ↓
6. Start walking (route tracking begins)
   ↓
7. Customer watches live on map
   ↓
8. Complete walk, return to home
   ↓
9. Request END OTP from customer
   ↓
10. Enter END OTP → Session ends
    ↓
11. Generate session report (distance, route, duration)
    ↓
12. Show customer
    ↓
13. Earnings released
```

### **Tele Consultation**

```
CUSTOMER:
1. Choose "Tele Consultation" 📱
   ↓
2. Browse tele-enabled doctors
   ↓
3. Select slot
   ↓
4. Make payment
   ↓
5. At appointment time → "Start Video Call" button
   ↓
6. Click → Call rings on staff app
   ↓
7. Staff accepts → Video call starts
   ↓
8. Consultation (5-10 min)
   ↓
9. End call
   ↓
10. Provide END OTP
    ↓
11. Complete

STAFF:
1. View tele appointments
   ↓
2. At appointment time → Ready
   ↓
3. Customer initiates call → Incoming call notification
   ↓
4. Accept/Reject
   ↓
5. If accept → Video call interface
   ↓
6. Conduct consultation + Chat
   ↓
7. End call
   ↓
8. Request END OTP
   ↓
9. Enter OTP
   ↓
10. Earnings credited
```

---

## 🗃️ DATABASE SCHEMA

### **KV Store Keys**

```
staff:{staffId}:service:{staffServiceId}    // Staff service subscription
staff:{staffId}:style_preferences           // Style preferences
booking:{bookingId}                         // Booking record
booking:{bookingId}:tracking                // Tracking session
booking:{bookingId}:walker_session          // Walker session data
booking:{bookingId}:tele_session            // Tele call data
staff_appointment_index:{staffId}:{date}    // Index for fast lookup
earnings:{staffId}:{bookingId}              // Earnings record
```

---

## ✅ VALIDATION & BUSINESS RULES

### **Home Services**
- Staff must be within defined maxDistance
- Check scheduling policies for lead time
- Verify no double booking
- Check buffer time between bookings
- Staff must be online and active
- Customer address must be complete

### **Tele Services**
- Staff must have tele enabled
- Video/chat capabilities verified
- Appointment time must be in future
- Duration limits (5-30 min)

### **Walker Services**
- START OTP required before tracking
- END OTP required for completion
- Minimum session duration (15 min)
- Route tracking mandatory

### **General**
- OTP verification mandatory for completion
- Payment before booking confirmation
- Earnings released only after OTP completion
- Cancellation policies enforced
- Rating/review after completion

---

## 🚀 DEPLOYMENT PLAN

### **Phase 1 (Week 1): Critical Fixes**
- Fix staff service sync
- Fix appointment visibility
- Basic home services booking

### **Phase 2 (Week 2): Tracking**
- Home service tracking
- Google Maps integration
- Real-time updates

### **Phase 3 (Week 3): Walker & Tele**
- Walker session tracking
- Tele consultation integration
- Video call functionality

### **Phase 4 (Week 4): Polish & Scale**
- Emergency reassignment
- Performance optimization
- Comprehensive testing

---

## 🎯 SUCCESS METRICS

- Staff services sync: 100% success rate
- Appointment visibility: Real-time updates
- Home service completion: <5% cancellation
- Walker session tracking: 100% accuracy
- Tele call quality: >90% satisfaction
- Earnings accuracy: 100%
- System performance: <200ms response time

---

**Status**: 📋 Plan Complete - Ready for Implementation
**Estimated Timeline**: 4 weeks
**Priority**: 🚨 Critical (Fixes first, then features)
