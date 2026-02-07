# 🎨 Figma Prompt: Flow 3 - Service Completion → Revenue Realization
## Complete Design System with Exact Code Reference

**Date:** January 2026  
**Flow:** Phase 3 - Service Completion → Revenue Realization  
**Design Reference:** CustomerHomeComplete.tsx (Same header/footer structure)

---

## 📋 CRITICAL DESIGN REQUIREMENTS

### ⚠️ MANDATORY: Match Customer Home Design EXACTLY

**Same Header/Footer Structure as Flow 1 & 2**

**Icon Library:** Lucide React 2D icons ONLY

---

## 📱 SCREEN 3.1: Booking Completion (Customer)

### Design Specifications

**Header:**
- Title: "Service Completed"
- Subtitle: "Thank you for using WarmPawz"
- Back button

**Content:**
1. **Success Animation/Icon:**
   - Large checkmark icon (green, 80px)
   - Or success illustration (2D only)

2. **Completion Message:**
   - "Service completed successfully!"
   - Date & time of completion

3. **OTP Display (Prominent):**
   - Label: "Completion OTP"
   - Large OTP code (6 digits, 48px font, bold)
   - Background: Light orange (`#FFF4E6`)
   - Border: Orange (`#FF8C42`)
   - "Copy OTP" button (icon: `Copy`, orange)

4. **Service Summary:**
   - Service name
   - Vendor name
   - Pet name
   - Date & time
   - Amount paid

5. **Action Buttons:**
   - "Rate Service" (primary, orange gradient, full width)
   - "View Booking Details" (secondary, outline, full width)
   - "Book Again" (text, small)

**API Contracts:**
```json
// Get Completed Booking
{
  "endpoint": "GET /bookings/{bookingId}",
  "response": {
    "id": "uuid",
    "status": "completed",
    "otpCode": "string (6 digits)",
    "completedAt": "ISO string",
    "serviceName": "string",
    "vendorName": "string"
  }
}
```

**Navigation:**
```typescript
// Rate Service:
onNavigate('review', { 
  bookingId: bookingId,
  vendorId: vendorId,
  serviceName: serviceName
});

// View Details:
onNavigate('booking-details', { bookingId: bookingId });

// Book Again:
onNavigate('service-details', { serviceId: serviceId });
```

**File Location:**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Flow 3 - Completion to Revenue/Screen 3.1 - Booking Completion.fig`

---

## 📱 SCREEN 3.2: Review & Rating

### Design Specifications

**Header:**
- Title: "Rate Your Experience"
- Subtitle: "Help us improve"
- Close button (X, right)

**Content:**
1. **Service Info Card:**
   - Service name
   - Vendor name + photo
   - Date of service

2. **Rating Section:**
   - "How was your experience?" (heading)
   - Star rating (5 stars, clickable)
   - Selected stars: Orange (`#FF8C42`)
   - Unselected stars: Gray (`#D1D5DB`)

3. **Review Text:**
   - Textarea (multi-line)
   - Placeholder: "Share your experience..."
   - Character count: "0/500"

4. **Photo Upload (Optional):**
   - "Add Photos" button
   - Grid of uploaded photos (if any)
   - Max 5 photos

5. **Tags (Optional):**
   - Quick tags: "Excellent", "Good", "Average", "Poor"
   - Selected: Orange background

6. **Submit Button:**
   - Orange gradient, full width
   - Text: "Submit Review"
   - Disabled state (if rating < 1)

**API Contracts:**
```json
// Submit Review
{
  "endpoint": "POST /reviews",
  "method": "POST",
  "body": {
    "bookingId": "uuid",
    "vendorId": "uuid",
    "rating": number (1-5),
    "comment": "string (optional)",
    "photos": ["string (URLs, optional)"],
    "tags": ["string (optional)"]
  },
  "response": {
    "success": true,
    "reviewId": "uuid"
  }
}
```

**Navigation:**
```typescript
// On submit success:
onNavigate('home', { showSuccess: true });
```

**File Location:**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Flow 3 - Completion to Revenue/Screen 3.2 - Review Rating.fig`

---

## 📱 SCREEN 3.3: Booking History (Customer)

### Design Specifications

**Header:**
- Title: "My Bookings"
- Filter button (right): `Filter` icon
- Search button (right): `Search` icon

**Content:**
- **Tabs:**
  - "Upcoming" (active: orange underline)
  - "Completed"
  - "Cancelled"

- **Booking Cards (List):**
  For each booking:
  - Service name (bold)
  - Vendor name + photo (small, circular)
  - Date & time
  - Status badge (color-coded)
  - Pet name
  - Amount
  - Action button: "View Details" | "Track" | "Rate"

- **Empty State:**
  - Icon: `Calendar` (gray, large)
  - Text: "No bookings yet"
  - "Book Service" button (orange gradient)

**API Contracts:**
```json
// Get Bookings
{
  "endpoint": "GET /customer/bookings?status={status}",
  "response": {
    "bookings": [
      {
        "id": "uuid",
        "serviceName": "string",
        "vendorName": "string",
        "bookingDate": "YYYY-MM-DD",
        "bookingTime": "HH:MM",
        "status": "pending | confirmed | in_progress | completed | cancelled",
        "amount": number
      }
    ],
    "total": number
  }
}
```

**Navigation:**
```typescript
// View Details:
onNavigate('booking-details', { bookingId: booking.id });

// Track:
onNavigate('tracking', { bookingId: booking.id });

// Rate:
onNavigate('review', { bookingId: booking.id });
```

**File Location:**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Flow 3 - Completion to Revenue/Screen 3.3 - Booking History.fig`

---

## ✅ DESIGN CHECKLIST

- [ ] Header matches Flow 1 exactly
- [ ] Footer matches Flow 1 exactly
- [ ] Icons: Lucide React 2D only
- [ ] Colors: Exact hex values
- [ ] OTP display very prominent
- [ ] Star rating interactive
- [ ] Review form accessible
- [ ] Booking cards clear and scannable
- [ ] Empty states designed
- [ ] API contracts annotated
- [ ] Navigation handlers defined

---

## 📦 EXPORT INSTRUCTIONS

1. **Save Location:** `/Users/ketan/Documents/Figma UI Customer APP/Flow 3 - Completion to Revenue/`
2. **File Naming:** `Screen X.X - Screen Name.fig`
3. **Include:** API annotations, navigation notes, component structure

---

**End of Flow 3 Prompt**
