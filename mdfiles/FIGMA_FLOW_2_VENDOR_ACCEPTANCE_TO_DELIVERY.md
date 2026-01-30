# 🎨 Figma Prompt: Flow 2 - Vendor Acceptance → Service Delivery
## Complete Design System with Exact Code Reference

**Date:** January 2026  
**Flow:** Phase 2 - Vendor Acceptance → Service Delivery  
**Design Reference:** CustomerHomeComplete.tsx (Same header/footer structure)

---

## 📋 CRITICAL DESIGN REQUIREMENTS

### ⚠️ MANDATORY: Match Customer Home Design EXACTLY

**Same Header/Footer Structure as Flow 1:**
- Header: `bg-gradient-to-br from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]`
- Content: White background, `rounded-t-[24px] -mt-3`
- Footer: Standardized footer (Home, Cart, Bookings, Profile)

**Icon Library:** Lucide React 2D icons ONLY (same as Flow 1)

---

## 📱 SCREEN 2.1: GPS Tracking (Customer View)

### Design Specifications

**Header:**
- Title: "Track Service"
- Subtitle: "Live location tracking"
- Back button (left)

**Content Area:**
- **Map View (Full Screen):**
  - Google Maps or Mapbox integration area
  - Vendor location marker (orange pin)
  - Customer location marker (blue pin)
  - Route line (orange, dashed)
  - ETA display (floating card, top-right)

- **Status Updates (Bottom Sheet):**
  - Current status badge: "On the way" | "Arriving" | "Arrived" | "In Progress"
  - Vendor info card:
    - Photo (circular, 50px)
    - Name
    - Service name
    - Distance remaining
    - ETA (minutes)
  - "Contact Vendor" button (outline, orange border)
  - "View Booking Details" link

**Status Colors:**
- On the way: Orange (`#FF8C42`)
- Arriving: Yellow (`#F59E0B`)
- Arrived: Green (`#10B981`)
- In Progress: Blue (`#3B82F6`)

**API Contracts:**
```json
// Get Tracking Data
{
  "endpoint": "GET /gps-tracking/booking/{bookingId}",
  "response": {
    "sessionId": "uuid",
    "vendorLocation": {
      "lat": number,
      "lng": number,
      "timestamp": "ISO string"
    },
    "customerLocation": {
      "lat": number,
      "lng": number
    },
    "eta": number (minutes),
    "distance": number (km),
    "status": "on_way | arriving | arrived | in_progress",
    "route": [
      { "lat": number, "lng": number }
    ]
  }
}
```

**Navigation:**
```typescript
// Contact Vendor:
onNavigate('chat', { bookingId: bookingId, vendorId: vendorId });

// View Details:
onNavigate('booking-details', { bookingId: bookingId });
```

**Auto-Update:**
- Poll every 5 seconds
- Show loading indicator during update
- Smooth marker animation on location change

**File Location:**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Flow 2 - Vendor Acceptance to Delivery/Screen 2.1 - GPS Tracking.fig`

---

## 📱 SCREEN 2.2: Booking Details (Customer View - Active)

### Design Specifications

**Header:**
- Title: "Booking Details"
- Status badge (right): "Confirmed" | "In Progress" | "Completed"
- Back button

**Content:**
1. **Status Card:**
   - Large status badge (color-coded)
   - Next action: "Waiting for vendor" | "Service in progress" | "Service completed"
   - Progress timeline (visual)

2. **Service Info:**
   - Service name (large, bold)
   - Vendor name + photo
   - Date & time
   - Service style badge (at_center/at_home/tele)

3. **Pet Info:**
   - Pet photo + name
   - Type/Breed

4. **Location (if at_home):**
   - Address
   - Map preview (small)
   - "View Full Map" link

5. **OTP Display (if confirmed):**
   - Large OTP code (6 digits, prominent)
   - "Copy OTP" button
   - Instructions: "Share this OTP with the vendor to complete service"

6. **Action Buttons:**
   - "Track Service" (if in_progress, orange gradient)
   - "Contact Vendor" (outline)
   - "Cancel Booking" (text, red, if pending)

**API Contracts:**
```json
// Get Booking
{
  "endpoint": "GET /bookings/{bookingId}",
  "response": {
    "id": "uuid",
    "status": "pending | confirmed | in_progress | completed",
    "serviceName": "string",
    "vendorName": "string",
    "bookingDate": "YYYY-MM-DD",
    "bookingTime": "HH:MM",
    "petName": "string",
    "address": "string",
    "otpCode": "string (if confirmed)",
    "paymentStatus": "paid"
  }
}
```

**Navigation:**
```typescript
// Track Service:
onNavigate('tracking', { bookingId: bookingId });

// Contact Vendor:
onNavigate('chat', { bookingId: bookingId });

// Cancel:
onNavigate('cancel-booking', { bookingId: bookingId });
```

**File Location:**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Flow 2 - Vendor Acceptance to Delivery/Screen 2.2 - Booking Details Active.fig`

---

## 📱 SCREEN 2.3: Vendor On The Way Notification

### Design Specifications

**Type:** Modal/Popup (overlay)

**Design:**
- Semi-transparent backdrop (black, 50% opacity)
- White card (centered, rounded-2xl)
- Padding: `p-6`

**Content:**
1. **Vendor Photo:**
   - Circular, 80px
   - Border: Orange, 3px

2. **Title:**
   - "Vendor On The Way!" (bold, large)

3. **Info:**
   - Vendor name
   - Service name
   - ETA: "Arriving in {X} minutes"
   - Distance: "{X} km away"

4. **Action Buttons:**
   - "Track Live" (primary, orange gradient, full width)
   - "View Details" (secondary, outline, full width)
   - "Dismiss" (text, small, bottom)

**Auto-Dismiss:**
- Show for 10 seconds
- Auto-close or manual dismiss

**API Contracts:**
```json
// Triggered by WebSocket/Polling
{
  "event": "vendor.on_the_way",
  "data": {
    "bookingId": "uuid",
    "vendorName": "string",
    "vendorPhoto": "string",
    "eta": number (minutes),
    "distance": number (km)
  }
}
```

**Navigation:**
```typescript
// Track Live:
onNavigate('tracking', { bookingId: bookingId });

// View Details:
onNavigate('booking-details', { bookingId: bookingId });
```

**File Location:**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Flow 2 - Vendor Acceptance to Delivery/Screen 2.3 - Vendor On The Way.fig`

---

## ✅ DESIGN CHECKLIST

- [ ] Header matches Flow 1 exactly
- [ ] Footer matches Flow 1 exactly
- [ ] Icons: Lucide React 2D only
- [ ] Colors: Exact hex values
- [ ] Map integration area clearly marked
- [ ] Status badges color-coded correctly
- [ ] OTP display prominent and clear
- [ ] Loading states for map/data fetching
- [ ] Error states (network failure, etc.)
- [ ] API contracts annotated
- [ ] Navigation handlers defined

---

## 📦 EXPORT INSTRUCTIONS

1. **Save Location:** `/Users/ketan/Documents/Figma UI Customer APP/Flow 2 - Vendor Acceptance to Delivery/`
2. **File Naming:** `Screen X.X - Screen Name.fig`
3. **Include:** API annotations, navigation notes, component structure

---

**End of Flow 2 Prompt**
