# 🧭 Navigation Documentation: Customer App Only
## Complete Flow Navigation Map for Customer App

**Date:** January 2026  
**Focus:** Customer App Only - All Navigation Handlers and Routes

---

## 📱 NAVIGATION STRUCTURE

### Base Navigation Pattern

```typescript
// Navigation handler signature
type NavigationHandler = (screen: string, data?: any) => void;

// Example usage
onNavigate('vet-clinic-list', {});
onNavigate('vet-booking', { serviceId: 'xxx', serviceStyle: 'at_center' });
```

---

## 🔄 VET SERVICE FLOWS

### Flow 1: Vet Service Dashboard → Clinic Visit

```
1. Vet Service Dashboard
   ↓ (click "Clinic Visit")
2. Clinic List View
   ↓ (click clinic)
3. Clinic Profile View
   ↓ (click doctor)
4. Doctor Details View
   ↓ (select service, click "Book Now")
5. Clinic Booking Flow
   ↓ (complete booking)
6. Payment Screen
   ↓ (payment success)
7. Booking Confirmation
```

**Navigation Handlers:**
```typescript
// Dashboard → Clinic List
onNavigate('vet-clinic-list', {});

// Clinic List → Clinic Profile
onNavigate('vet-clinic-profile', { 
  clinicId: clinic.id, 
  vendorId: clinic.id 
});

// Clinic Profile → Doctor Details
onNavigate('vet-doctor-details', { 
  doctorId: doctor.id, 
  clinicId: clinicId 
});

// Doctor Details → Booking Flow
onNavigate('vet-booking', {
  doctorId: doctor.id,
  vendorId: vendorId,
  clinicId: clinicId,
  serviceId: service.serviceId,
  serviceName: service.name,
  serviceStyle: 'at_center',
  price: service.price
});

// Booking Flow → Payment
onNavigate('payment', { bookingId: bookingId });

// Payment → Confirmation
onNavigate('booking-confirmation', { 
  bookingId: bookingId,
  paymentId: paymentId 
});
```

---

### Flow 2: Vet Service Dashboard → Tele Consultation

```
1. Vet Service Dashboard
   ↓ (click "Tele Consultation")
2. Tele Mode Selection (Instant vs Scheduled)
   ↓ (choose mode)
3a. Instant: Service Selection → Pet Selection → Queue → Payment
3b. Scheduled: Provider List → Provider Profile → Date/Time → Pet → Payment
```

**Navigation Handlers:**
```typescript
// Dashboard → Tele Consultation
onNavigate('vet-tele-consultation', {});

// Mode Selection → Instant
onNavigate('vet-tele-instant', {});

// Mode Selection → Scheduled
onNavigate('vet-tele-scheduled', {});

// Instant Service Selection → Pet Selection
onNavigate('vet-tele-instant-pet', { serviceId: service.serviceId });

// Instant Pet Selection → Queue
onNavigate('vet-tele-instant-queue', { 
  serviceId: serviceId,
  petId: pet.id 
});

// Scheduled Provider List → Provider Profile
onNavigate('vet-tele-provider-profile', { providerId: provider.id });

// Provider Profile → Booking Flow
onNavigate('vet-booking', {
  doctorId: provider.id,
  vendorId: provider.vendorId,
  serviceId: service.serviceId,
  serviceStyle: 'tele',
  price: service.price
});
```

---

### Flow 3: Vet Service Dashboard → Home Visit

```
1. Vet Service Dashboard
   ↓ (click "Home Visit")
2. Home Visit Provider Discovery
   ↓ (click provider)
3. Provider Profile
   ↓ (select service, click "Book Now")
4. Home Visit Booking Flow (Date/Time → Pet → Address)
   ↓ (complete booking)
5. Payment Screen
   ↓ (payment success)
6. Booking Confirmation
```

**Navigation Handlers:**
```typescript
// Dashboard → Home Visit
onNavigate('vet-home-visit', {});

// Provider Discovery → Provider Profile
onNavigate('vet-home-provider-profile', { 
  providerId: provider.id,
  vendorId: provider.vendorId 
});

// Provider Profile → Booking Flow
onNavigate('vet-booking', {
  doctorId: provider.id,
  vendorId: provider.vendorId,
  serviceId: service.serviceId,
  serviceStyle: 'at_home',
  price: service.price
});
```

---

## 🔄 UNIVERSAL SERVICE BOOKING FLOWS

### Flow: Service Style Selection → Booking

```
1. Service Details (any service)
   ↓ (click "Book Now")
2. Service Style Selection (if multiple styles)
   ↓ (select style)
3. Booking Flow (varies by style)
   ↓ (complete booking)
4. Payment
   ↓ (payment success)
5. Booking Confirmation
```

**Navigation Handlers:**
```typescript
// Service Details → Style Selection
onNavigate('service-style-selection', { 
  serviceId: serviceId,
  vendorId: vendorId 
});

// Style Selection → Booking Flow
onNavigate('booking-flow', {
  serviceId: serviceId,
  vendorId: vendorId,
  serviceStyle: selectedStyle // 'at_center' | 'at_home' | 'tele'
});

// Booking Flow → Payment
onNavigate('payment', { bookingId: bookingId });

// Payment → Confirmation
onNavigate('booking-confirmation', { bookingId: bookingId });
```

---

## 🗺️ NEXT.JS ROUTE MAPPING (Customer App)

### App Router Structure

```
apps/customer-web/app/
├── page.tsx                    # Home (CustomerHomeComplete)
├── vet/
│   ├── page.tsx                # Vet Service Dashboard
│   ├── clinics/
│   │   ├── page.tsx            # Clinic List
│   │   └── [clinicId]/
│   │       └── page.tsx        # Clinic Profile
│   ├── tele/
│   │   └── page.tsx            # Tele Consultation Router
│   └── home/
│       └── page.tsx            # Home Visit Discovery
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
└── [service]/
    ├── page.tsx                # Service Details
    └── book/
        └── page.tsx            # Booking Flow
```

---

## 🔗 NAVIGATION HANDLER IMPLEMENTATION

### In CustomerHomeWrapper

```typescript
// apps/customer-web/components/customer/wrappers/CustomerHomeWrapper.tsx

const handleNavigate = (screen: string, data?: any) => {
  switch (screen) {
    // Vet Flows
    case 'vet':
      setCurrentScreen('vet');
      break;
    
    case 'vet-clinic-list':
      setCurrentScreen('vet-clinic-list');
      break;
    
    case 'vet-clinic-profile':
      setCurrentScreen('vet-clinic-profile');
      setScreenData(data);
      break;
    
    case 'vet-doctor-details':
      setCurrentScreen('vet-doctor-details');
      setScreenData(data);
      break;
    
    case 'vet-booking':
      setCurrentScreen('vet-booking');
      setScreenData(data);
      break;
    
    case 'vet-tele-consultation':
      setCurrentScreen('vet-tele-consultation');
      break;
    
    case 'vet-home-visit':
      setCurrentScreen('vet-home-visit');
      break;
    
    // Universal Booking
    case 'booking-flow':
      router.push(`/bookings/create?serviceId=${data.serviceId}&serviceStyle=${data.serviceStyle}`);
      break;
    
    case 'payment':
      router.push(`/payments?bookingId=${data.bookingId}`);
      break;
    
    case 'booking-confirmation':
      router.push(`/bookings/${data.bookingId}/confirmation`);
      break;
    
    // Tracking
    case 'tracking':
      router.push(`/tracking/${data.bookingId}`);
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
// Vet Clinic Flow
{ clinicId: string, vendorId: string }

// Vet Doctor Flow
{ doctorId: string, clinicId: string, vendorId: string }

// Vet Booking Flow
{ 
  doctorId?: string,
  vendorId: string,
  clinicId?: string,
  serviceId: string,
  serviceName: string,
  serviceStyle: 'at_center' | 'at_home' | 'tele',
  price: number
}

// Booking Flow
{ 
  serviceId: string,
  vendorId: string,
  serviceStyle: 'at_center' | 'at_home' | 'tele'
}

// Payment
{ bookingId: string, amount?: number }

// Tracking
{ bookingId: string }

// Booking Details
{ bookingId: string }
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

---

**End of Navigation Documentation (Customer App Only)**
