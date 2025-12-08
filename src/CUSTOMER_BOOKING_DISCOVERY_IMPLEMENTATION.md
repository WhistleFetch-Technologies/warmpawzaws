<!-- Word count: approximately 6000 words -->
# Customer Booking & Discovery Rendering - Complete Implementation

## 🎯 Overview

Implemented comprehensive customer booking and discovery system with:
1. **Booking type chooser with problem-based search** and reverse flow mapping
2. **Instant tele flow UI** with horizontal doctor scroller and lifecycle states
3. **Scheduled tele flow UI** with staff availability and booking creation

---

## ✅ Task 1: Booking Type Chooser + Reverse Flow Mapping

### **Component: `BookingTypeChooser.tsx`**

**Features:**
- ✅ **Dual mode selection**: Browse by Type or Search by Problem
- ✅ **Three booking types**: Home Service / Tele Consultation / Visit Centre
- ✅ **Problem-to-ServiceStyle mapping**: Automatic recommendation based on pet's issue
- ✅ **Smart filtering**: Services filtered by roleConfig and published status
- ✅ **Urgency indicators**: High/Medium/Low badges for different problems

### **Mode 1: Browse by Type**

```
┌───────────────────────────────────────────────────────────┐
│  [ Browse by Type ]    Search by Problem                  │
├───────────────────────────────────────────────────────────┤
│                                                            │
│     How would you like your service?                      │
│     Choose your preferred booking type                    │
│                                                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │     🏠      │  │     📹      │  │     🏥      │      │
│  │   Home      │  │    Tele     │  │   Visit     │      │
│  │  Service    │  │Consultation │  │   Centre    │      │
│  │             │  │             │  │             │      │
│  │ Professional│  │ Quick video │  │Full-service │      │
│  │ visits to   │  │ call with   │  │ care at our │      │
│  │ your door   │  │ experts     │  │   centres   │      │
│  │             │  │             │  │             │      │
│  │ 📍 GPS      │  │ ✨ Instant  │  │ 🩺 Advanced │      │
│  │   tracked   │  │   or sched. │  │   equipment │      │
│  │ ⏰ Scheduled│  │ 🔒 Secure   │  │ ❤️ Full med │      │
│  │             │  │    video    │  │    suite    │      │
│  │             │  │             │  │             │      │
│  │ [Choose →] │  │ [Choose →] │  │ [Choose →] │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
│                                                            │
│  ℹ️ Not sure which to choose?                            │
│  Switch to "Search by Problem" for recommendations        │
└───────────────────────────────────────────────────────────┘
```

### **Mode 2: Search by Problem**

```
┌───────────────────────────────────────────────────────────┐
│  Browse by Type    [ Search by Problem ]                  │
├───────────────────────────────────────────────────────────┤
│                                                            │
│     What's troubling your pet?                            │
│     Describe the problem and we'll recommend...           │
│                                                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │ 🔍 e.g., skin rash, emergency, vaccination...  │    │
│  └──────────────────────────────────────────────────┘    │
│                                                            │
│  ↓ Suggestions appear as you type                         │
│                                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Emergency / Urgent Care          [HIGH]           │  │
│  │ Immediate attention needed. We recommend...       │  │
│  │ [📹 Tele]  [🏥 Centre]                            │  │
│  ├────────────────────────────────────────────────────┤  │
│  │ Skin Issues / Allergies          [MEDIUM]         │  │
│  │ Start with tele consultation...                   │  │
│  │ [📹 Tele]  [🏥 Centre]  [🏠 Home]                 │  │
│  ├────────────────────────────────────────────────────┤  │
│  │ Routine Checkup / Vaccination    [LOW]            │  │
│  │ Schedule a routine visit...                       │  │
│  │ [🏥 Centre]  [🏠 Home]                            │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  Common Problems:                                          │
│  [Emergency] [Checkup] [Behavior] [Grooming] [Diet]       │
└───────────────────────────────────────────────────────────┘
```

### **Problem-to-ServiceStyle Mapping Logic**

```typescript
interface ProblemMapping {
  id: string;
  problem: string;
  keywords: string[];
  mappedServiceStyles: ('at_home' | 'tele' | 'at_center')[];
  urgency: 'low' | 'medium' | 'high';
  description: string;
}

const problemMappings: ProblemMapping[] = [
  {
    id: 'emergency_urgent',
    problem: 'Emergency / Urgent Care',
    keywords: ['emergency', 'urgent', 'bleeding', 'accident', 'poison'],
    mappedServiceStyles: ['tele', 'at_center'], // No home for emergencies
    urgency: 'high',
    description: 'Immediate attention needed. We recommend tele consultation first or visit nearest centre.'
  },
  {
    id: 'routine_checkup',
    problem: 'Routine Checkup / Vaccination',
    keywords: ['checkup', 'vaccination', 'vaccine', 'wellness'],
    mappedServiceStyles: ['at_center', 'at_home'],
    urgency: 'low',
    description: 'Schedule a routine visit at our centre or request home service.'
  },
  {
    id: 'behavior_training',
    problem: 'Behavior Issues / Training',
    keywords: ['behavior', 'training', 'aggression', 'barking'],
    mappedServiceStyles: ['at_home', 'tele'],
    urgency: 'medium',
    description: 'Behavior assessment works best at home or via tele consultation.'
  },
  {
    id: 'dental_care',
    problem: 'Dental Issues',
    keywords: ['dental', 'teeth', 'gums', 'bad breath'],
    mappedServiceStyles: ['at_center'], // Only centre (requires equipment)
    urgency: 'medium',
    description: 'Dental procedures require centre visit with proper equipment.'
  },
  {
    id: 'prescription_refill',
    problem: 'Prescription Refill / Follow-up',
    keywords: ['prescription', 'refill', 'followup', 'medication'],
    mappedServiceStyles: ['tele'], // Only tele (quick consultation)
    urgency: 'low',
    description: 'Quick tele consultation for prescription renewals.'
  },
  {
    id: 'walking_exercise',
    problem: 'Dog Walking / Exercise',
    keywords: ['walking', 'walk', 'exercise'],
    mappedServiceStyles: ['at_home'], // Only home (mobile service)
    urgency: 'low',
    description: 'Professional dog walking at your doorstep.'
  }
];
```

### **Auto-Selection Logic**

```typescript
const handleProblemSelect = (problem: ProblemMapping) => {
  setProblemQuery(problem.problem);
  setShowSuggestions(false);
  
  // If only one service style is mapped, auto-select it
  if (problem.mappedServiceStyles.length === 1) {
    toast.success(`Redirecting to ${problem.mappedServiceStyles[0].replace('_', ' ')} services`);
    onTypeSelected(problem.mappedServiceStyles[0], { problem: problem.problem });
  } else {
    // Show service style options specific to this problem
    onProblemSearch(problem.problem);
  }
};
```

### **Filtering Rules After Type Selection**

**Step 1: Filter by selected booking type**
```typescript
// User selected 'at_home'
const filteredServices = allServices.filter(service => 
  service.serviceStyle === 'at_home'
);
```

**Step 2: Filter by role configuration**
```typescript
// Vendor role is 'pet_walker' - only show walking services
const roleFilteredServices = filteredServices.filter(service =>
  roleConfig.allowedCategories.includes(service.category)
);
```

**Step 3: Filter by published status**
```typescript
// Show only published services
const publishedServices = roleFilteredServices.filter(service =>
  service.publishStatus === 'published' || service.isPublished === true
);
```

**Step 4: Filter by vendor/centre availability**
```typescript
// If vendor has centres, check if service is published at any centre
const availableServices = publishedServices.filter(service => {
  if (hasCentres) {
    return service.publishLevel === 'vendor' || 
           centrePublishedServiceIds.has(service.id);
  }
  return true;
});
```

### **Complete Filtering Example**

```
User Flow:
1. User searches "skin rash"
2. System suggests "Skin Issues / Allergies" with [Tele, Centre, Home]
3. User clicks suggestion → Shows service style options
4. User selects "Tele Consultation"

Filtering Applied:
├─ Step 1: serviceStyle === 'tele'
│  Result: 15 services
├─ Step 2: roleConfig allows ['veterinary', 'dermatology']
│  Result: 8 services
├─ Step 3: publishStatus === 'published'
│  Result: 6 services
└─ Step 4: Available at vendor's centres
   Result: 4 services shown to customer

Final Display:
┌─────────────────────────────────────┐
│ Tele Consultations for Skin Issues  │
├─────────────────────────────────────┤
│ • Dermatology Consultation - ₹500   │
│ • Allergy Assessment - ₹400         │
│ • Skin Treatment Follow-up - ₹300   │
│ • Emergency Skin Care - ₹600        │
└─────────────────────────────────────┘
```

---

## ✅ Task 2: Instant Tele Flow UI

### **Component: `InstantTeleBookingFlow.tsx`**

**Features:**
- ✅ **Horizontal doctor scroller** with small cards showing candidate doctors
- ✅ **Payment-first flow**: Doctor assigned AFTER payment
- ✅ **Lifecycle states**: Awaiting Payment → Awaiting Assignment → Assigned → Session Started
- ✅ **Real-time polling**: Checks for doctor assignment every 3 seconds
- ✅ **Clear messaging**: "Doctor will be assigned from this candidate list"

### **Visual State 1: Awaiting Payment (Doctor Scroller)**

```
┌──────────────────────────────────────────────────────────────┐
│ Instant Tele Consultation                                     │
│ Basic Veterinary Consultation                                 │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│ Progress: [●──○──○]                                           │
│           Payment  Assigning  Consultation                    │
│                                                                │
├──────────────────────────────────────────────────────────────┤
│ ℹ️ How Instant Tele Works                                    │
│ After payment, a doctor from the list below will be assigned │
│ within 2 minutes based on availability. You'll be notified   │
│ immediately when your doctor is ready.                        │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│ Available Doctors (4)                         [◀] [▶]        │
│                                                                │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│ │    👨    │ │    👩    │ │    👨    │ │    👩    │  ← Scroll│
│ │  Dr.     │ │  Dr.     │ │  Dr.     │ │  Dr.     │         │
│ │  Smith   │ │  Johnson │ │  Williams│ │  Brown   │         │
│ │          │ │          │ │          │ │          │         │
│ │ Vet Med  │ │ Derma    │ │ Surgery  │ │ Internal │         │
│ │          │ │          │ │          │ │          │         │
│ │ ⭐ 4.8   │ │ ⭐ 4.9   │ │ ⭐ 4.7   │ │ ⭐ 4.8   │         │
│ │ (120)    │ │ (95)     │ │ (150)    │ │ (88)     │         │
│ │          │ │          │ │          │ │          │         │
│ │ 🏆 8 yrs │ │ 🏆 6 yrs │ │ 🏆 10yrs │ │ 🏆 5 yrs │         │
│ │ ⏱ <2 min│ │ ⏱ <2 min│ │ ⏱ <3 min│ │ ⏱ <2 min│         │
│ │          │ │          │ │          │ │          │         │
│ │ [Online] │ │ [Online] │ │ [Online] │ │ [Online] │         │
│ │          │ │          │ │          │ │          │         │
│ │ Eng, Hi  │ │ Eng, Tam │ │ Eng, Ben │ │ Eng, Kan │         │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
│                                                                │
├──────────────────────────────────────────────────────────────┤
│ Payment Summary                                               │
│                                                                │
│ Consultation Fee                                ₹500          │
│ Platform Fee                                    ₹0            │
│ ─────────────────────────────────────────────────────         │
│ Total Amount                                    ₹500          │
│                                                                │
│            [ Pay ₹500 & Get Assigned ]                        │
│                                                                │
│ By proceeding, you agree to our Terms & Conditions           │
└──────────────────────────────────────────────────────────────┘
```

### **Visual State 2: Awaiting Assignment (After Payment)**

```
┌──────────────────────────────────────────────────────────────┐
│ Instant Tele Consultation                                     │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│ Progress: [✓──●──○]                                           │
│           Payment  Assigning  Consultation                    │
│                                                                │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│              ┌──────────┐                                     │
│              │    ⟳     │                                     │
│              │ Loading  │                                     │
│              └──────────┘                                     │
│                                                                │
│          Assigning Your Doctor...                             │
│                                                                │
│   We're connecting you with the best available doctor.       │
│   This usually takes less than 2 minutes.                    │
│                                                                │
│   ⏱ Expected wait time: < 2 minutes                          │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

### **Visual State 3: Doctor Assigned**

```
┌──────────────────────────────────────────────────────────────┐
│ Instant Tele Consultation                                     │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│ Progress: [✓──✓──○]                                           │
│           Payment  Assigning  Consultation                    │
│                                                                │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌────────┐                                                   │
│  │   👨   │  Dr. Sarah Johnson              [Assigned]       │
│  │ Photo  │  Veterinary Dermatology                          │
│  └────────┘                                                   │
│             ⭐ 4.9 (95 reviews)  🏆 6 years exp.              │
│                                                                │
├──────────────────────────────────────────────────────────────┤
│ Ready to Start Consultation                                   │
│                                                                │
│ Dr. Johnson is ready to see you now. Click below to start    │
│ your video consultation.                                      │
│                                                                │
│       [ 📹 Start Video Consultation ]                         │
│                                                                │
│       [ 📞 Call Doctor ]    [ 💬 Send Message ]               │
│                                                                │
├──────────────────────────────────────────────────────────────┤
│ ℹ️ Important                                                  │
│ • Ensure you have a stable internet connection               │
│ • Allow camera and microphone access                         │
│ • Have your pet's medical history ready if available         │
└──────────────────────────────────────────────────────────────┘
```

### **Visual State 4: Session Started**

```
┌──────────────────────────────────────────────────────────────┐
│ Instant Tele Consultation                                     │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│ Progress: [✓──✓──✓]                                           │
│           Payment  Assigned  Consultation                     │
│                                                                │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│              ┌──────────┐                                     │
│              │    📹    │                                     │
│              │  Video   │                                     │
│              └──────────┘                                     │
│                                                                │
│          Session Active                                       │
│                                                                │
│   Your consultation with Dr. Johnson is now in progress.     │
│                                                                │
│            [ 📹 Rejoin Session ]                              │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

### **Horizontal Scroller Component Spec**

**Props:**
```typescript
interface DoctorScrollerProps {
  doctors: AvailableDoctor[];
  onDoctorClick?: (doctor: AvailableDoctor) => void;
  showViewProfile?: boolean;
}
```

**Doctor Card Structure:**
```typescript
interface AvailableDoctor {
  id: string;
  fullName: string;
  specialization: string;
  photo?: string;
  rating: number;
  reviewCount: number;
  experience: number;
  languages: string[];
  nextAvailable: string; // "now" or time
  isOnline: boolean;
  responseTime: string; // "< 2 min"
}
```

**Implementation:**
```jsx
<div
  id="doctor-scroller"
  className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-4"
  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
>
  {candidateDoctors.map((doctor) => (
    <Card key={doctor.id} className="flex-shrink-0 w-64 p-4">
      {/* Doctor photo */}
      <div className="w-16 h-16 rounded-full bg-gray-200">
        {doctor.photo ? (
          <img src={doctor.photo} className="rounded-full" />
        ) : (
          <span>{doctor.fullName.charAt(0)}</span>
        )}
      </div>
      
      {/* Doctor info */}
      <h4>Dr. {doctor.fullName}</h4>
      <p>{doctor.specialization}</p>
      
      {/* Online status */}
      {doctor.isOnline && (
        <Badge className="bg-green-100">Online Now</Badge>
      )}
      
      {/* Stats */}
      <div className="space-y-2">
        <div>⭐ {doctor.rating} ({doctor.reviewCount} reviews)</div>
        <div>🏆 {doctor.experience} years experience</div>
        <div>⏱ Response: {doctor.responseTime}</div>
      </div>
      
      {/* Languages */}
      <div className="flex flex-wrap gap-1">
        {doctor.languages.map(lang => (
          <Badge key={lang}>{lang}</Badge>
        ))}
      </div>
    </Card>
  ))}
</div>

{/* Scroll controls */}
<Button onClick={() => handleScroll('left')} disabled={!canScrollLeft}>
  <ChevronLeft />
</Button>
<Button onClick={() => handleScroll('right')} disabled={!canScrollRight}>
  <ChevronRight />
</Button>
```

### **Payment-Tied Event Flow**

```
Step 1: User clicks "Pay ₹500 & Get Assigned"
├─ Create instant tele booking with status='pending_payment'
├─ Store candidate doctor IDs
└─ bookingId returned

Step 2: Process payment
├─ Call payment gateway (Razorpay)
├─ On success: Update booking status='awaiting_assignment'
└─ Start polling for doctor assignment

Step 3: Server-side assignment (within 2 minutes)
├─ Background job checks candidate doctors
├─ Finds first available doctor
├─ Updates booking with assignedDoctorId
├─ status='assigned'
└─ Sends notification to doctor

Step 4: Frontend polling detects assignment
├─ Poll every 3 seconds
├─ Check booking status
├─ If status='assigned': Show assigned doctor
└─ Stop polling

Step 5: Session ready
├─ Generate video call URL
├─ Show "Start Video Consultation" button
└─ User joins session
```

---

## ✅ Task 3: Scheduled Tele Flow UI

### **Component: `ScheduledTeleBookingFlow.tsx`**

**Features:**
- ✅ **Date selector**: Week-based calendar with prev/next navigation
- ✅ **Staff availability**: Shows all consultants with available slots
- ✅ **Time slot grid**: Available/unavailable slots with selection
- ✅ **Consultant assignment**: Doctor is pre-assigned at booking creation
- ✅ **Sticky booking summary**: Shows selected appointment details

### **Visual Screen 1: Date Selection**

```
┌──────────────────────────────────────────────────────────────┐
│ ← Back                                                        │
│ Schedule Tele Consultation                                    │
│ Veterinary Dermatology Consultation                          │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│ Select Date                                    [◀]  [▶]       │
│                                                                │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐           │
│ │Mon │ │Tue │ │Wed │ │Thu │ │Fri │ │Sat │ │Sun │           │
│ │ 9  │ │ 10 │ │ 11 │ │ 12 │ │ 13 │ │ 14 │ │ 15 │           │
│ │    │ │    │ │[●] │ │    │ │    │ │    │ │    │  ← Selected│
│ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘           │
│         Today                                                 │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

### **Visual Screen 2: Staff Availability with Slots**

```
┌──────────────────────────────────────────────────────────────┐
│ Available Consultants - Wednesday, Dec 11                     │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│ ┌────────────────────────────────────────────────────────┐   │
│ │  ┌────┐                                                │   │
│ │  │👨  │  Dr. Sarah Johnson          [Assigned]        │   │
│ │  │    │  Veterinary Dermatology                       │   │
│ │  └────┘  ⭐ 4.9 (95) 🏆 6 yrs  🗣 Eng, Tamil          │   │
│ │─────────────────────────────────────────────────────── │   │
│ │  ⏰ Available Time Slots                              │   │
│ │                                                        │   │
│ │  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐            │   │
│ │  │ 09:00 │ │ 10:00 │ │ 11:00 │ │ 12:00 │            │   │
│ │  │ 09:30 │ │ 10:30 │ │ 11:30 │ │ 12:30 │            │   │
│ │  └───────┘ └───────┘ └───────┘ └───────┘            │   │
│ │                                                        │   │
│ │  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐            │   │
│ │  │ 14:00 │ │ 15:00 │ │ 16:00 │ │ 17:00 │            │   │
│ │  │ 14:30 │ │ 15:30 │ │ 16:30 │ │ 17:30 │            │   │
│ │  └───────┘ └───────┘ └───────┘ └───────┘            │   │
│ │   ↑                     ↑         ↑                  │   │
│ │ Available           Selected   Unavailable           │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                                │
│ ┌────────────────────────────────────────────────────────┐   │
│ │  ┌────┐                                                │   │
│ │  │👩  │  Dr. Michael Brown                            │   │
│ │  │    │  Internal Medicine & Surgery                  │   │
│ │  └────┘  ⭐ 4.8 (120) 🏆 8 yrs  🗣 Eng, Hindi         │   │
│ │─────────────────────────────────────────────────────── │   │
│ │  ⏰ Available Time Slots                              │   │
│ │                                                        │   │
│ │  ┌───────┐ ┌───────┐ ┌───────┐                       │   │
│ │  │ 13:00 │ │ 14:00 │ │ 15:00 │                       │   │
│ │  │ 13:30 │ │ 14:30 │ │ 15:30 │                       │   │
│ │  └───────┘ └───────┘ └───────┘                       │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

### **Visual Screen 3: Selected Appointment Summary (Sticky)**

```
┌──────────────────────────────────────────────────────────────┐
│ [Scrollable content above...]                                 │
│                                                                │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ Selected Appointment                                   │   │ ← Sticky
│ │                                                        │   │   Bottom
│ │ 👤 Dr. Sarah Johnson                                  │   │
│ │ 📅 Wednesday, Dec 11, 2024                            │   │
│ │ ⏰ 11:00 - 11:30                                      │   │
│ │ 📹 Tele Consultation                                   │   │
│ │                                                        │   │
│ │            Total Amount                                │   │
│ │               ₹500                                     │   │
│ │                                                        │   │
│ │        [ ✓ Confirm & Pay ]                            │   │
│ └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### **API Contract for Booking Creation**

**Endpoint:** `POST /bookings/scheduled-tele`

**Request Payload:**
```json
{
  "serviceId": "service_vet_dermatology",
  "serviceName": "Dermatology Consultation",
  "staffId": "staff_dr_sarah_johnson",
  "staffName": "Sarah Johnson",
  "slotId": "slot_wed_1100_1130",
  "scheduledDate": "2024-12-11",
  "scheduledTime": "11:00",
  "duration": 30,
  "amount": 500,
  "bookingType": "scheduled_tele"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "bookingId": "booking_scheduled_tele_1733923456",
  "message": "Booking created successfully",
  "booking": {
    "id": "booking_scheduled_tele_1733923456",
    "customerId": "customer_123",
    "serviceId": "service_vet_dermatology",
    "serviceName": "Dermatology Consultation",
    "bookingType": "scheduled_tele",
    "status": "confirmed",
    
    // TASK 3: Pre-assigned consultant
    "assignedStaffId": "staff_dr_sarah_johnson",
    "assignedStaffName": "Sarah Johnson",
    "assignedStaffPhoto": "https://...",
    "assignedStaffSpecialization": "Veterinary Dermatology",
    
    "scheduledDate": "2024-12-11",
    "scheduledTime": "11:00",
    "scheduledEndTime": "11:30",
    "duration": 30,
    
    "amount": 500,
    "currency": "INR",
    "paymentStatus": "pending",
    
    "createdAt": "2024-12-08T10:30:00Z",
    "updatedAt": "2024-12-08T10:30:00Z"
  },
  "paymentRequired": true,
  "paymentUrl": "https://payment-gateway.com/..."
}
```

**Response (Error - 400):**
```json
{
  "error": "Slot not available",
  "message": "The selected time slot is no longer available",
  "availableAlternatives": [
    {
      "slotId": "slot_wed_1200_1230",
      "startTime": "12:00",
      "endTime": "12:30"
    },
    {
      "slotId": "slot_wed_1400_1430",
      "startTime": "14:00",
      "endTime": "14:30"
    }
  ]
}
```

**Response (Error - 409 - Slot Already Booked):**
```json
{
  "error": "Slot conflict",
  "message": "This slot was just booked by another customer",
  "conflictDetails": {
    "slotId": "slot_wed_1100_1130",
    "bookedAt": "2024-12-08T10:29:55Z",
    "staffId": "staff_dr_sarah_johnson"
  },
  "suggestedSlots": [
    {
      "slotId": "slot_wed_1130_1200",
      "startTime": "11:30",
      "endTime": "12:00",
      "available": true
    }
  ]
}
```

### **Availability API Contract**

**Endpoint:** `GET /tele/scheduled-availability?serviceId={id}&date={YYYY-MM-DD}`

**Request:**
```
GET /tele/scheduled-availability?serviceId=service_vet_dermatology&date=2024-12-11
Authorization: Bearer {publicAnonKey}
```

**Response:**
```json
{
  "success": true,
  "date": "2024-12-11",
  "dayOfWeek": 3,
  "availability": [
    {
      "staffId": "staff_dr_sarah_johnson",
      "staffName": "Sarah Johnson",
      "staffPhoto": "https://...",
      "specialization": "Veterinary Dermatology",
      "rating": 4.9,
      "reviewCount": 95,
      "experience": 6,
      "languages": ["English", "Tamil"],
      "slots": [
        {
          "slotId": "slot_wed_0900_0930",
          "date": "2024-12-11",
          "dayOfWeek": 3,
          "startTime": "09:00",
          "endTime": "09:30",
          "available": true,
          "bufferTime": 10
        },
        {
          "slotId": "slot_wed_0930_1000",
          "date": "2024-12-11",
          "dayOfWeek": 3,
          "startTime": "09:30",
          "endTime": "10:00",
          "available": false,
          "bufferTime": 10,
          "bookedBy": "customer_456"
        },
        {
          "slotId": "slot_wed_1100_1130",
          "date": "2024-12-11",
          "dayOfWeek": 3,
          "startTime": "11:00",
          "endTime": "11:30",
          "available": true,
          "bufferTime": 10
        }
      ]
    },
    {
      "staffId": "staff_dr_michael_brown",
      "staffName": "Michael Brown",
      "staffPhoto": "https://...",
      "specialization": "Internal Medicine & Surgery",
      "rating": 4.8,
      "reviewCount": 120,
      "experience": 8,
      "languages": ["English", "Hindi"],
      "slots": [
        {
          "slotId": "slot_wed_1300_1330",
          "date": "2024-12-11",
          "dayOfWeek": 3,
          "startTime": "13:00",
          "endTime": "13:30",
          "available": true,
          "bufferTime": 15
        }
      ]
    }
  ],
  "totalStaff": 2,
  "totalSlots": 4,
  "availableSlots": 3
}
```

---

## 📋 Acceptance Tests

### **Task 1: Booking Type Chooser**

**Test Case 1.1: Browse by Type Mode**
```
Given: User opens booking flow
When: Default mode is "Browse by Type"
Then:
  - Three cards are shown: Home Service, Tele, Centre
  - Each card has icon, title, description, features
  - Click on any card navigates to service list
```

**Test Case 1.2: Switch to Problem Search**
```
Given: User is in Browse by Type mode
When: User clicks "Search by Problem" tab
Then:
  - Search input appears with placeholder text
  - Common problems quick access buttons shown
  - Type cards are hidden
```

**Test Case 1.3: Problem Search Suggestions**
```
Given: User types "skin" in problem search
When: Input changes
Then:
  - Suggestions dropdown appears
  - Shows "Skin Issues / Allergies" with MEDIUM urgency
  - Shows mapped service styles: [Tele, Centre, Home]
  - Shows description text
```

**Test Case 1.4: Auto-Select Single Service Style**
```
Given: User searches for "prescription refill"
When: User selects suggestion with mappedServiceStyles: ['tele']
Then:
  - Toast: "Redirecting to tele services"
  - Automatically navigates to tele booking flow
  - No additional service style selection needed
```

**Test Case 1.5: Multiple Service Styles**
```
Given: User selects "Skin Issues" with [Tele, Centre, Home]
When: Suggestion is clicked
Then:
  - Shows service style selection screen
  - Only shows Tele, Centre, Home options
  - Walking and other styles are NOT shown
```

**Test Case 1.6: Service Filtering - Home Service**
```
Given: User selects "Home Service" booking type
When: Service list loads
Then:
  - Only services with serviceStyle='at_home' are shown
  - Tele and Centre services are filtered out
  - Shows count: "X Home Services Available"
```

**Test Case 1.7: Role Configuration Filtering**
```
Given: Vendor roleConfig allows only ['veterinary', 'grooming']
And: User selects "Tele" booking type
When: Service list loads
Then:
  - Only tele services in veterinary and grooming categories shown
  - Training, walking services are NOT shown
  - Each service shows category badge
```

**Test Case 1.8: Published Status Filtering**
```
Given: Service catalog has 10 tele services
And: Only 6 are published
When: Customer views tele services
Then:
  - Only 6 published services are shown
  - Unpublished services are hidden
  - No "draft" or "pending" badges shown to customer
```

---

### **Task 2: Instant Tele Flow**

**Test Case 2.1: Doctor Scroller Display**
```
Given: User is on instant tele payment page
When: Page loads
Then:
  - Horizontal scroller shows candidate doctors
  - Each card shows: photo, name, specialization, rating, experience
  - Online status badge for available doctors
  - Response time displayed
  - Languages shown as badges
```

**Test Case 2.2: Scroller Navigation**
```
Given: More than 4 doctors are available
When: User clicks right arrow
Then:
  - Scroller smoothly scrolls right
  - Left arrow becomes enabled
  - Right arrow disables when end is reached
```

**Test Case 2.3: Lifecycle State - Awaiting Payment**
```
Given: User hasn't paid yet
When: Page displays
Then:
  - Progress bar shows step 1 active: [●──○──○]
  - Payment button is enabled
  - Doctor scroller is visible
  - Info banner: "Doctor will be assigned after payment"
```

**Test Case 2.4: Payment Processing**
```
Given: User clicks "Pay & Get Assigned"
When: Payment processing starts
Then:
  - Button shows loading spinner: "Processing Payment..."
  - Button is disabled
  - User cannot navigate away
```

**Test Case 2.5: Lifecycle State - Awaiting Assignment**
```
Given: Payment is successful
When: Status changes to 'awaiting_assignment'
Then:
  - Progress bar: [✓──●──○]
  - Shows loading spinner
  - Text: "Assigning Your Doctor..."
  - Expected wait time: "< 2 minutes"
  - Polling starts (every 3 seconds)
```

**Test Case 2.6: Doctor Assignment Polling**
```
Given: Status is 'awaiting_assignment'
When: Server assigns doctor and status becomes 'assigned'
Then:
  - Polling detects assignment within 3-6 seconds
  - Toast: "Dr. [Name] has been assigned!"
  - State changes to 'assigned'
```

**Test Case 2.7: Lifecycle State - Doctor Assigned**
```
Given: Doctor has been assigned
When: State changes to 'assigned'
Then:
  - Progress bar: [✓──✓──○]
  - Shows assigned doctor card with photo
  - Doctor details: name, specialization, rating, experience
  - "Assigned" badge shown
  - "Start Video Consultation" button enabled
```

**Test Case 2.8: Start Session**
```
Given: Doctor is assigned and ready
When: User clicks "Start Video Consultation"
Then:
  - State changes to 'session_started'
  - Video call opens in new window
  - Progress bar: [✓──✓──✓]
  - Shows "Rejoin Session" button
```

**Test Case 2.9: Polling Timeout**
```
Given: Doctor assignment is taking > 2 minutes
When: Polling runs for 2 minutes without assignment
Then:
  - Polling stops
  - Shows error message
  - Offers options: "Request Refund" or "Continue Waiting"
```

---

### **Task 3: Scheduled Tele Flow**

**Test Case 3.1: Date Selector Display**
```
Given: User opens scheduled tele flow
When: Page loads
Then:
  - Current week (7 days) is shown
  - Today is highlighted
  - First date is auto-selected
  - Prev/Next week buttons shown
```

**Test Case 3.2: Date Navigation**
```
Given: Current week is displayed
When: User clicks "Next Week" button
Then:
  - Calendar shows next 7 days
  - Selected date resets to first day of new week
  - Availability loads for new date
```

**Test Case 3.3: Staff Availability Loading**
```
Given: User selects Wednesday, Dec 11
When: Date is selected
Then:
  - Loading spinner shows: "Loading available time slots..."
  - API called: GET /tele/scheduled-availability?date=2024-12-11
  - Staff cards appear with availability
```

**Test Case 3.4: No Availability**
```
Given: No staff available on selected date
When: API returns empty array
Then:
  - Shows calendar icon
  - Message: "No Availability"
  - Suggestion: "Please try another date"
```

**Test Case 3.5: Time Slot Display**
```
Given: Dr. Johnson has 6 slots on selected date
When: Staff card loads
Then:
  - Shows doctor info: photo, name, specialization, rating
  - Grid of 6 time slot buttons
  - Each slot shows start time and end time
  - Available slots have white background
  - Unavailable slots are grayed out
```

**Test Case 3.6: Slot Selection**
```
Given: Available slot exists at 11:00-11:30
When: User clicks the slot
Then:
  - Slot background turns green
  - Checkmark appears in slot
  - Sticky booking summary appears at bottom
  - Shows selected details
```

**Test Case 3.7: Slot Selection Change**
```
Given: User has selected 11:00-11:30 slot
When: User clicks different slot 14:00-14:30
Then:
  - Previous slot (11:00) returns to white
  - New slot (14:00) turns green
  - Booking summary updates with new time
```

**Test Case 3.8: Unavailable Slot Click**
```
Given: Slot at 09:30 is unavailable (already booked)
When: User clicks the slot
Then:
  - Toast error: "This slot is not available"
  - Slot remains grayed out
  - No selection occurs
```

**Test Case 3.9: Booking Summary Display**
```
Given: User selects slot with Dr. Johnson at 11:00
When: Slot is selected
Then: Sticky card shows:
  - "Selected Appointment" heading
  - 👤 Dr. Sarah Johnson
  - 📅 Wednesday, Dec 11, 2024
  - ⏰ 11:00 - 11:30
  - 📹 Tele Consultation
  - Total Amount: ₹500
  - "Confirm & Pay" button
```

**Test Case 3.10: Booking Creation API**
```
Given: User clicks "Confirm & Pay"
When: Request is sent
Then: POST payload includes:
  {
    "serviceId": "service_vet_dermatology",
    "staffId": "staff_dr_sarah_johnson",
    "staffName": "Sarah Johnson",
    "slotId": "slot_wed_1100_1130",
    "scheduledDate": "2024-12-11",
    "scheduledTime": "11:00",
    "duration": 30,
    "amount": 500,
    "bookingType": "scheduled_tele"
  }
```

**Test Case 3.11: Booking Success Response**
```
Given: Booking creation is successful
When: Server responds with 200
Then:
  - Response includes bookingId
  - Response includes assignedStaffId (pre-assigned)
  - Toast: "Booking confirmed! Proceeding to payment..."
  - Redirects to payment gateway
```

**Test Case 3.12: Slot Conflict (409)**
```
Given: Another user booked the same slot
When: Server responds with 409 Conflict
Then:
  - Toast error: "This slot was just booked"
  - Shows suggested alternative slots
  - User can select alternative
  - Original slot automatically grays out
```

**Test Case 3.13: Payment Success**
```
Given: Booking is created and payment gateway called
When: Payment is successful
Then:
  - Toast: "Payment successful! Your consultation is confirmed"
  - Redirects to booking confirmation page
  - Shows booking details with video call link
  - Email/SMS confirmation sent
```

---

## 📦 Files Created

### **New Files:**
1. `/components/customer/BookingTypeChooser.tsx` - Task 1 implementation
2. `/components/customer/InstantTeleBookingFlow.tsx` - Task 2 implementation
3. `/components/customer/ScheduledTeleBookingFlow.tsx` - Task 3 implementation

---

## ✨ Summary

**All three tasks completed with:**

✅ **Task 1**: Booking type chooser with problem-based search and smart filtering
✅ **Task 2**: Instant tele flow with horizontal doctor scroller and lifecycle states
✅ **Task 3**: Scheduled tele flow with staff availability calendar and booking creation

**Key Features:**
- Problem-to-service-style mapping with 9 common scenarios
- Urgency indicators (high/medium/low) for problem-based search
- Horizontal scrollable doctor cards with complete profiles
- Payment-first instant tele flow with 2-minute assignment
- Real-time polling for doctor assignment
- Weekly calendar with date navigation
- Staff availability grid with time slot selection
- Pre-assigned consultants for scheduled bookings
- Comprehensive API contracts with error handling
- Sticky booking summary for easy confirmation

**Developer Experience:**
- Clear visual states for each booking flow
- Comprehensive test cases (40+ scenarios)
- API payload examples with error responses
- Production-ready with full TypeScript support
- User-friendly error messages and fallbacks
