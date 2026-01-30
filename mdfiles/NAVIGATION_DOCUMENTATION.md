# 🧭 Navigation Documentation: Complete Flow Navigation Map
## All Screens, Routes, and Navigation Handlers

**Date:** January 2026  
**Purpose:** Complete navigation structure for all customer app flows

---

## 📱 NAVIGATION STRUCTURE

### Base Navigation Pattern

```typescript
// Navigation handler signature
type NavigationHandler = (screen: string, data?: any) => void;

// Example usage
onNavigate('service-details', { serviceId: 'xxx', vendorId: 'yyy' });
```

---

## 🔄 FLOW 1: Customer Onboarding → Booking Creation

### Screen Flow Map

```
1. Customer Authentication
   ↓ (on success, if new user)
2. Pet Registration
   ↓ (on success)
3. Customer Home (Service Discovery)
   ↓ (click service card)
4. Service Details
   ↓ (click "Book Now")
5. Booking Flow (Multi-step)
   ↓ (on booking creation)
6. Payment Screen
   ↓ (on payment success)
7. Booking Confirmation
```

### Navigation Handlers

#### Screen 1.1 → 1.2 (Auth → Pet Registration)
```typescript
// In CustomerAuthScreen
if (response.user.isNew) {
  onNavigate('pet-registration', { 
    customerId: response.user.id,
    phone: phone 
  });
} else {
  onNavigate('home', { phone: phone });
}
```

#### Screen 1.2 → 1.3 (Pet Registration → Home)
```typescript
// In PetRegistrationScreen
onNavigate('home', { phone: phone });
```

#### Screen 1.3 → 1.4 (Home → Service Details)
```typescript
// In CustomerHomeComplete
onNavigate('service-details', { 
  serviceId: service.id,
  vendorId: service.vendorId 
});
```

#### Screen 1.4 → 1.5 (Service Details → Booking Flow)
```typescript
// In ServiceDetailsScreen
onNavigate('booking-flow', { 
  serviceId: serviceId,
  vendorId: vendorId,
  basePrice: service.basePrice
});
```

#### Screen 1.5 → 1.6 (Booking Flow → Payment)
```typescript
// In BookingFlowScreen
onNavigate('payment', { 
  bookingId: response.bookingId,
  amount: totalAmount
});
```

#### Screen 1.6 → 2.2 (Payment → Booking Details)
```typescript
// In PaymentScreen
onNavigate('booking-details', { 
  bookingId: bookingId,
  paymentId: response.payment.id
});
```

---

## 🔄 FLOW 2: Vendor Acceptance → Service Delivery

### Screen Flow Map

```
1. Booking Details (Customer View)
   ↓ (if status = "confirmed" or "in_progress")
2. GPS Tracking (if at_home service)
   ↓ (or)
3. Booking Details (Active) - with OTP display
   ↓ (vendor starts service)
4. Vendor On The Way Notification
   ↓ (click "Track Live")
5. GPS Tracking (Live)
   ↓ (service completes)
6. Booking Completion
```

### Navigation Handlers

#### Screen 2.1 (GPS Tracking)
```typescript
// From Booking Details or Notification
onNavigate('tracking', { bookingId: bookingId });

// From Home (active bookings section)
onNavigate('tracking', { bookingId: activeBooking.id });
```

#### Screen 2.2 (Booking Details Active)
```typescript
// From Home or Bookings list
onNavigate('booking-details', { bookingId: bookingId });

// Actions from Booking Details:
onNavigate('tracking', { bookingId: bookingId }); // Track service
onNavigate('chat', { bookingId: bookingId, vendorId: vendorId }); // Contact vendor
onNavigate('cancel-booking', { bookingId: bookingId }); // Cancel
```

#### Screen 2.3 (Vendor On The Way)
```typescript
// Auto-triggered by WebSocket/Polling
// Actions:
onNavigate('tracking', { bookingId: bookingId }); // Track Live
onNavigate('booking-details', { bookingId: bookingId }); // View Details
```

---

## 🔄 FLOW 3: Service Completion → Revenue

### Screen Flow Map

```
1. Booking Completion
   ↓ (click "Rate Service")
2. Review & Rating
   ↓ (on submit)
3. Home (with success message)
   ↓ (or click "View Bookings")
4. Booking History
   ↓ (click booking)
5. Booking Details (Completed)
```

### Navigation Handlers

#### Screen 3.1 → 3.2 (Completion → Review)
```typescript
// In BookingCompletionScreen
onNavigate('review', { 
  bookingId: bookingId,
  vendorId: vendorId,
  serviceName: serviceName
});
```

#### Screen 3.2 → 3.3 (Review → Home)
```typescript
// In ReviewRatingScreen
onNavigate('home', { showSuccess: true });
```

#### Screen 3.3 (Booking History)
```typescript
// From Footer or Home
onNavigate('bookings', { tab: 'upcoming' | 'completed' | 'cancelled' });

// From Booking History:
onNavigate('booking-details', { bookingId: booking.id }); // View Details
onNavigate('tracking', { bookingId: booking.id }); // Track (if in_progress)
onNavigate('review', { bookingId: booking.id }); // Rate (if completed)
```

---

## 🗺️ NEXT.JS ROUTE MAPPING

### App Router Structure

```
apps/customer-web/app/
├── page.tsx                    # Home (CustomerHomeComplete)
├── auth/
│   └── page.tsx                # Authentication
├── pets/
│   └── register/
│       └── page.tsx            # Pet Registration
├── services/
│   ├── [serviceId]/
│   │   └── page.tsx            # Service Details
│   └── book/
│       └── page.tsx            # Booking Flow
├── bookings/
│   ├── page.tsx                # Booking History
│   ├── [bookingId]/
│   │   └── page.tsx            # Booking Details
│   └── [bookingId]/
│       └── review/
│           └── page.tsx        # Review & Rating
├── tracking/
│   └── [bookingId]/
│       └── page.tsx            # GPS Tracking
├── payments/
│   └── page.tsx                # Payment Screen
└── chat/
    └── [bookingId]/
        └── page.tsx            # Chat with Vendor
```

### Route Handler Mapping

```typescript
// Route: /services/[serviceId]
export default function ServiceDetailsPage({ params }: { params: { serviceId: string } }) {
  return <ServiceDetailsScreen serviceId={params.serviceId} />;
}

// Route: /bookings/[bookingId]
export default function BookingDetailsPage({ params }: { params: { bookingId: string } }) {
  return <BookingDetailsScreen bookingId={params.bookingId} />;
}

// Route: /tracking/[bookingId]
export default function TrackingPage({ params }: { params: { bookingId: string } }) {
  return <GPSTrackingScreen bookingId={params.bookingId} />;
}
```

---

## 🔗 NAVIGATION HANDLER IMPLEMENTATION

### In CustomerHomeWrapper

```typescript
// apps/customer-web/components/customer/wrappers/CustomerHomeWrapper.tsx

const handleNavigate = (screen: string, data?: any) => {
  switch (screen) {
    // Flow 1
    case 'pet-registration':
      setCurrentScreen('pet-registration');
      setScreenData(data);
      break;
    
    case 'service-details':
      setCurrentScreen('service-details');
      setScreenData(data);
      break;
    
    case 'booking-flow':
      setCurrentScreen('booking-flow');
      setScreenData(data);
      break;
    
    case 'payment':
      router.push(`/payments?bookingId=${data.bookingId}`);
      break;
    
    // Flow 2
    case 'tracking':
      router.push(`/tracking/${data.bookingId}`);
      break;
    
    case 'booking-details':
      router.push(`/bookings/${data.bookingId}`);
      break;
    
    case 'chat':
      router.push(`/chat/${data.bookingId}`);
      break;
    
    // Flow 3
    case 'review':
      router.push(`/bookings/${data.bookingId}/review`);
      break;
    
    case 'bookings':
      router.push('/bookings');
      break;
    
    // Default
    case 'home':
      setCurrentScreen('home');
      break;
    
    default:
      console.warn('Unknown navigation target:', screen);
  }
};
```

---

## 📋 NAVIGATION PARAMETERS

### Common Parameters

```typescript
// Service Details
{ serviceId: string, vendorId: string }

// Booking Flow
{ serviceId: string, vendorId: string, basePrice: number }

// Payment
{ bookingId: string, amount: number }

// Tracking
{ bookingId: string }

// Booking Details
{ bookingId: string }

// Review
{ bookingId: string, vendorId: string, serviceName: string }

// Chat
{ bookingId: string, vendorId: string }
```

---

## ✅ NAVIGATION TESTING CHECKLIST

For each navigation:
- [ ] Source screen has correct handler
- [ ] Target screen receives correct parameters
- [ ] Route exists in Next.js app router
- [ ] Parameters are passed correctly
- [ ] Back navigation works
- [ ] Deep linking works (if applicable)
- [ ] Navigation state persists (if needed)

---

**End of Navigation Documentation**
