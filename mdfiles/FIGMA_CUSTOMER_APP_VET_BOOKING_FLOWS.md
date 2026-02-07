# 🎨 Figma Prompt: Vet Booking Flows (Customer App)
## Clinic, Tele, Home Visit - Complete Flows with Exact Code

**Date:** January 2026  
**Focus:** Customer App Only - Vet Booking Flows  
**Reference:** VetBookingRouter.tsx, TeleConsultationRouter.tsx, HomeServiceRouter.tsx

---

## 📋 EXACT CODE REFERENCE

### Header (Same as Dashboard)
Use exact header from CustomerHomeComplete.tsx (lines 913-1031)

### Footer (Same as Dashboard)
Use StandardizedFooter.tsx

---

## 🔄 FLOW 1: Clinic Visit Booking

### Screen Flow Map

```
1. Clinic List View
   ↓ (click clinic)
2. Clinic Profile View
   ↓ (click doctor)
3. Doctor Details View
   ↓ (select service)
4. Booking Flow (Multi-step)
   ↓ (complete booking)
5. Payment
   ↓ (payment success)
6. Booking Confirmation
```

### Screen 1.1: Clinic List View

**Design:**
- Header: "Find a Clinic" (with back button)
- Search bar: White background, rounded
- Filter button: Right side of search
- Clinic cards (list):
  - Clinic photo (circular, 60px)
  - Clinic name (bold)
  - Rating (stars + number)
  - Location (`MapPin` icon + address)
  - Distance (if available)
  - "View Clinic" button (outline, orange border)

**API Contracts:**
```json
// Get Clinics
{
  "endpoint": "GET /customer/discover-services?category=vet&roleId=veterinarian&serviceStyle=at_center",
  "response": {
    "vendors": [
      {
        "id": "uuid",
        "vendorName": "string",
        "rating": number,
        "location": "string",
        "distance": number (km),
        "photo": "string"
      }
    ]
  }
}
```

**Navigation:**
```typescript
onNavigate('vet-clinic-profile', { clinicId: clinic.id, vendorId: clinic.id });
```

**File Location:**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Vet Service/Clinic Visit/1.1 - Clinic List.fig`

---

### Screen 1.2: Clinic Profile View

**Design:**
- Header: Clinic name (with back button)
- Clinic photo (large, top)
- Clinic info card:
  - Name (large, bold)
  - Rating + reviews
  - Location + map preview (small)
  - Operating hours
  - Amenities (icons: `Shield`, `Clock`, etc.)
- Doctors section:
  - "Our Doctors" heading
  - Doctor cards (horizontal scroll or grid):
    - Photo (circular, 50px)
    - Name
    - Specialty
    - Rating
    - "View Profile" button
- Services section:
  - Service cards with prices
  - "Book Appointment" buttons

**API Contracts:**
```json
// Get Clinic Profile
{
  "endpoint": "GET /vendor/{clinicId}/profile",
  "response": {
    "id": "uuid",
    "businessName": "string",
    "rating": number,
    "location": "string",
    "operatingHours": {},
    "doctors": [
      {
        "id": "uuid",
        "name": "string",
        "photo": "string",
        "specialty": "string",
        "rating": number
      }
    ],
    "services": []
  }
}
```

**Navigation:**
```typescript
// View Doctor:
onNavigate('vet-doctor-details', { doctorId: doctor.id, clinicId: clinicId });

// Book Service:
onNavigate('vet-booking', { 
  clinicId: clinicId,
  vendorId: clinicId,
  serviceId: serviceId,
  serviceType: 'clinic',
  serviceStyle: 'at_center'
});
```

**File Location:**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Vet Service/Clinic Visit/1.2 - Clinic Profile.fig`

---

### Screen 1.3: Doctor Details View

**Design:**
- Header: Doctor name (with back button)
- Doctor photo (large, circular, 100px)
- Doctor info:
  - Name (large, bold)
  - Specialty
  - Qualifications
  - Experience (years)
  - Rating + reviews
  - Bio/description
- Services offered:
  - Service cards with:
    - Service name
    - Service style badges (at_center/at_home/tele)
    - Price
    - Duration
    - "Book Now" button (orange gradient)

**API Contracts:**
```json
// Get Doctor Details
{
  "endpoint": "GET /customer/staff/{doctorId}",
  "response": {
    "id": "uuid",
    "name": "string",
    "photo": "string",
    "specialty": "string",
    "qualifications": "string",
    "rating": number,
    "services": [
      {
        "id": "uuid",
        "serviceId": "uuid",
        "name": "string",
        "price": number,
        "duration": number,
        "serviceStyle": "at_center | at_home | tele"
      }
    ]
  }
}
```

**Navigation:**
```typescript
onNavigate('vet-booking', {
  doctorId: doctor.id,
  vendorId: vendorId,
  clinicId: clinicId,
  serviceId: service.serviceId,
  serviceName: service.name,
  serviceStyle: 'at_center',
  price: service.price
});
```

**File Location:**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Vet Service/Clinic Visit/1.3 - Doctor Details.fig`

---

### Screen 1.4: Clinic Booking Flow (Multi-Step)

**From VetBookingRouter.tsx - Steps:**

#### Step 1: Service Selection (if multiple services)
- Service cards grid
- Each card: Name, price, duration, description
- Selected: Orange border + background tint

#### Step 2: Date & Time Selection
- Calendar picker (7 days forward)
- Available dates highlighted (orange)
- Selected date: Orange background
- Time slots grid:
  - Available: White, orange border
  - Selected: Orange background, white text
  - Unavailable: Gray, disabled

#### Step 3: Pet Selection
- Pet cards (horizontal scroll or grid):
  - Photo (circular, 80px)
  - Name
  - Type/Breed
  - Selected: Orange border
- "Add Pet" button (if no pets)

#### Step 4: Booking Summary
- Service details
- Date & time
- Pet selected
- Price breakdown
- "Confirm Booking" button (orange gradient)

**API Contracts:**
```json
// Get Time Slots
{
  "endpoint": "GET /customer/vendor/{vendorId}/available-slots?date={YYYY-MM-DD}&serviceStyle=at_center",
  "response": {
    "slots": [
      { "time": "09:00", "available": true },
      { "time": "09:30", "available": true }
    ]
  }
}

// Create Booking
{
  "endpoint": "POST /bookings/create",
  "body": {
    "customerId": "uuid",
    "vendorId": "uuid",
    "serviceId": "uuid",
    "staffId": "uuid (doctorId)",
    "bookingDate": "YYYY-MM-DD",
    "bookingTime": "HH:MM",
    "serviceType": "at_center",
    "petId": "uuid",
    "amount": number
  },
  "response": {
    "success": true,
    "bookingId": "uuid",
    "status": "pending"
  }
}
```

**Navigation:**
```typescript
// After booking creation:
onNavigate('payment', { bookingId: response.bookingId });
```

**File Location:**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Vet Service/Clinic Visit/1.4 - Booking Flow.fig`

---

## 🔄 FLOW 2: Tele Consultation Booking

### Screen Flow Map

```
1. Mode Selection (Instant vs Scheduled)
   ↓ (choose mode)
2a. Instant: Service Selection → Pet Selection → Queue → Payment
2b. Scheduled: Provider List → Provider Profile → Date/Time → Pet → Payment
```

### Screen 2.1: Mode Selection

**From TeleConsultationRouter.tsx (lines 97-199):**

**Design:**
- Header: "Tele Consultation" (with back button)
- Stats cards (3 cards): "24/7 Available", "<5min Avg Wait", "4.8 Rating"
- Two large option cards:

**Instant Consultation Card:**
- Background: `bg-green-50`
- Border: `border-2 border-transparent hover:border-green-400`
- Icon: `Zap` (green, 48px)
- Title: "Instant Consultation"
- Badge: "Live Now" (green)
- Description: "Connect immediately with the next available vet"
- Features: "<5 min wait", "Video call"
- Click → Navigate to instant flow

**Scheduled Consultation Card:**
- Background: `bg-blue-50`
- Border: `border-2 border-transparent hover:border-blue-400`
- Icon: `Calendar` (blue, 48px)
- Title: "Scheduled Consultation"
- Description: "Choose your preferred vet and book a time slot"
- Features: "Choose your vet", "Book ahead"
- Click → Navigate to scheduled flow

**Info Card:**
- Background: `bg-amber-50`
- Border: `border-amber-100`
- Icon: `AlertCircle` (amber)
- Text: "Note: Both options include video consultation, prescription, and follow-up support."

**API Contracts:**
```json
// No API call needed - just navigation
```

**Navigation:**
```typescript
// Instant:
onNavigate('vet-tele-instant', {});

// Scheduled:
onNavigate('vet-tele-scheduled', {});
```

**File Location:**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Vet Service/Tele Consultation/2.1 - Mode Selection.fig`

---

### Screen 2.2: Instant Tele - Service Selection

**From TeleConsultationRouter.tsx (lines 215-273):**

**Design:**
- Header: "Instant Consultation" (with back button)
- Title: "Choose a Service"
- Service cards (list):
  - Service name (bold)
  - Description (small text)
  - Features: Duration (`Clock` icon), "Video call" (`Video` icon)
  - Price (large, orange, right-aligned)
  - Clickable card

**API Contracts:**
```json
// Get Platform Services
{
  "endpoint": "GET /customer/services/platform?roleId=veterinarian&serviceStyle=tele",
  "response": {
    "services": [
      {
        "id": "uuid",
        "serviceId": "uuid",
        "name": "string",
        "description": "string",
        "price": number,
        "duration": number
      }
    ]
  }
}
```

**Navigation:**
```typescript
onNavigate('vet-tele-instant-pet', { serviceId: service.serviceId });
```

**File Location:**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Vet Service/Tele Consultation/2.2 - Instant Service Selection.fig`

---

### Screen 2.3: Instant Tele - Pet Selection

**From TeleConsultationRouter.tsx (lines 289-352):**

**Design:**
- Header: "Which pet needs attention?" (with back button)
- Pet cards (2-column grid):
  - Photo (circular, 64px) or emoji placeholder
  - Name (bold)
  - Breed/Type (small text)
  - Selected: Orange border
- "Add Pet" card (dashed border)

**API Contracts:**
```json
// Get Pets
{
  "endpoint": "GET /customer/pets/{phone}",
  "response": {
    "pets": [
      {
        "id": "uuid",
        "name": "string",
        "type": "string",
        "breed": "string",
        "photo": "string"
      }
    ]
  }
}
```

**Navigation:**
```typescript
onNavigate('vet-tele-instant-queue', { 
  serviceId: serviceId,
  petId: pet.id 
});
```

**File Location:**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Vet Service/Tele Consultation/2.3 - Instant Pet Selection.fig`

---

### Screen 2.4: Instant Tele - Queue Waiting

**Design:**
- Header: "Connecting to Vet..." (with back button)
- Large loading animation (spinner or pulsing icon)
- Queue position: "You are #X in queue"
- Estimated wait: "<5 minutes"
- "Cancel" button (text, red)

**API Contracts:**
```json
// Join Queue
{
  "endpoint": "POST /tele-consultation/queue/join",
  "body": {
    "customerId": "uuid",
    "serviceId": "uuid",
    "petId": "uuid"
  },
  "response": {
    "queueId": "uuid",
    "position": number,
    "estimatedWait": number (minutes)
  }
}

// Check Queue Status (poll every 5 seconds)
{
  "endpoint": "GET /tele-consultation/queue/{queueId}/status",
  "response": {
    "position": number,
    "estimatedWait": number,
    "status": "waiting | connecting | connected"
  }
}
```

**Navigation:**
```typescript
// When connected:
onNavigate('vet-tele-call', { 
  queueId: queueId,
  meetingId: response.meetingId 
});

// On cancel:
onNavigate('vet-tele-consultation', {});
```

**File Location:**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Vet Service/Tele Consultation/2.4 - Instant Queue.fig`

---

### Screen 2.5: Scheduled Tele - Provider List

**Design:**
- Header: "Choose Your Vet" (with back button)
- Search bar
- Filter button
- Provider cards (list):
  - Photo (circular, 60px)
  - Name (bold)
  - Specialty
  - Rating (stars + number)
  - "Online" badge (green, if available)
  - Next available slot (if scheduled)
  - Consultation fee
  - "View Profile" button

**API Contracts:**
```json
// Get Tele Providers
{
  "endpoint": "GET /customer/discover-services?category=vet&roleId=veterinarian&serviceStyle=tele",
  "response": {
    "providers": [
      {
        "id": "uuid",
        "name": "string",
        "photo": "string",
        "specialty": "string",
        "rating": number,
        "isOnline": boolean,
        "consultationFee": number,
        "nextAvailableSlot": "string"
      }
    ]
  }
}
```

**Navigation:**
```typescript
onNavigate('vet-tele-provider-profile', { providerId: provider.id });
```

**File Location:**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Vet Service/Tele Consultation/2.5 - Scheduled Provider List.fig`

---

### Screen 2.6: Scheduled Tele - Booking Flow

**Similar to Clinic Booking Flow but:**
- Service style: `tele`
- Date/Time selection required
- No address needed
- Payment → Confirmation

**File Location:**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Vet Service/Tele Consultation/2.6 - Scheduled Booking Flow.fig`

---

## 🔄 FLOW 3: Home Visit Booking

### Screen Flow Map

```
1. Home Visit Provider Discovery
   ↓ (click provider)
2. Provider Profile
   ↓ (select service)
3. Booking Flow (Date/Time → Pet → Address)
   ↓ (complete booking)
4. Payment
   ↓ (payment success)
5. Booking Confirmation
```

### Screen 3.1: Home Visit Provider Discovery

**From HomeServiceRouter.tsx:**

**Design:**
- Header: "Find a Vet" (with back button)
- Search bar
- Filter button
- Problem-based quick filters (horizontal scroll):
  - Vomiting, Diarrhea, Not Eating, Skin Issues, etc.
- Provider cards (list):
  - Photo (circular, 60px)
  - Name (bold)
  - Rating (stars + number)
  - Distance (km)
  - Next availability
  - Price range
  - "View Profile" button

**API Contracts:**
```json
// Get Home Visit Providers
{
  "endpoint": "GET /customer/discover-services?category=vet&roleId=veterinarian&serviceStyle=at_home",
  "query": {
    "lat": number,
    "lng": number,
    "radius": number (km),
    "problemId": "string (optional)"
  },
  "response": {
    "providers": [
      {
        "id": "uuid",
        "name": "string",
        "rating": number,
        "distance": number (km),
        "nextAvailability": "string",
        "priceRange": { "min": number, "max": number }
      }
    ]
  }
}
```

**Navigation:**
```typescript
onNavigate('vet-home-provider-profile', { 
  providerId: provider.id,
  vendorId: provider.vendorId 
});
```

**File Location:**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Vet Service/Home Visit/3.1 - Provider Discovery.fig`

---

### Screen 3.2: Home Visit Provider Profile

**Design:**
- Header: Provider name (with back button)
- Provider photo (large, circular, 100px)
- Provider info:
  - Name (large, bold)
  - Specialty
  - Rating + reviews
  - Experience
  - Response time
- Services offered:
  - Service cards with prices
  - "Book Home Visit" buttons
- Reviews section (optional)

**API Contracts:**
```json
// Get Provider Profile
{
  "endpoint": "GET /customer/staff/{providerId}",
  "response": {
    "id": "uuid",
    "name": "string",
    "services": [
      {
        "serviceId": "uuid",
        "name": "string",
        "price": number,
        "duration": number
      }
    ]
  }
}
```

**Navigation:**
```typescript
onNavigate('vet-booking', {
  doctorId: provider.id,
  vendorId: provider.vendorId,
  serviceId: service.serviceId,
  serviceStyle: 'at_home',
  price: service.price
});
```

**File Location:**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Vet Service/Home Visit/3.2 - Provider Profile.fig`

---

### Screen 3.3: Home Visit Booking Flow

**Similar to Clinic Booking but:**
- Service style: `at_home`
- **Additional Step: Address Selection**
  - Address input field
  - "Use Current Location" button
  - Map preview (optional)
  - Address validation

**API Contracts:**
```json
// Create Home Visit Booking
{
  "endpoint": "POST /bookings/create",
  "body": {
    "customerId": "uuid",
    "vendorId": "uuid",
    "serviceId": "uuid",
    "staffId": "uuid",
    "bookingDate": "YYYY-MM-DD",
    "bookingTime": "HH:MM",
    "serviceType": "at_home",
    "address": "string",
    "latitude": number,
    "longitude": number,
    "petId": "uuid",
    "amount": number
  }
}
```

**File Location:**
Save to: `/Users/ketan/Documents/Figma UI Customer APP/Vet Service/Home Visit/3.3 - Booking Flow.fig`

---

## ✅ DESIGN CHECKLIST (All Screens)

- [ ] Header matches CustomerHomeComplete.tsx exactly
- [ ] Content area: `bg-white rounded-t-[24px] -mt-3 pt-4 pb-24`
- [ ] Footer: StandardizedFooter
- [ ] Icons: Lucide React 2D only
- [ ] Colors: Exact hex values
- [ ] API contracts: Annotated
- [ ] Navigation: Handlers defined
- [ ] Loading states: Designed
- [ ] Error states: Designed
- [ ] Empty states: Designed

---

**End of Vet Booking Flows Prompt**
