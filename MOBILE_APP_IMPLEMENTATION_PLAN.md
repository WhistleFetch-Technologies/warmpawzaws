# 📱 Mobile App Implementation Plan
## Complete Alignment with Web App + Branding Guidelines

**Generated:** December 2024  
**Status:** Comprehensive Implementation Roadmap  
**Target:** Customer & Vendor Mobile Apps (React Native)

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Web-to-Mobile Screen Mapping](#web-to-mobile-screen-mapping)
3. [API Endpoint Mapping](#api-endpoint-mapping)
4. [Branding Guidelines Implementation](#branding-guidelines-implementation)
5. [Notification System Integration](#notification-system-integration)
6. [Search & Filter Implementation](#search--filter-implementation)
7. [Business Rules Implementation](#business-rules-implementation)
8. [Implementation Phases](#implementation-phases)
9. [Technical Architecture](#technical-architecture)
10. [Testing Strategy](#testing-strategy)

---

## 🎯 Executive Summary

### Goal
Create mobile apps (Customer & Vendor) that are **identical** to the web app in:
- ✅ Functionality and flows
- ✅ Design and UI/UX
- ✅ API integration
- ✅ Business rules
- ✅ Branding guidelines compliance

### Current State
- **Customer Mobile:** 6 screens, 0% API integration
- **Vendor Mobile:** Basic structure only
- **Web App:** 150+ screens, fully functional

### Target State
- **Customer Mobile:** 80+ screens matching web app
- **Vendor Mobile:** 60+ screens matching web app
- **100% API alignment** with web app
- **100% branding compliance**

---

## 🗺️ Web-to-Mobile Screen Mapping

### Customer App Screen Mapping

#### 1. Authentication & Onboarding Flow

| Web Component | Mobile Screen | Status | Priority |
|--------------|---------------|--------|----------|
| `CustomerAuth` | `LoginScreen.tsx` | ✅ Exists | 🔴 Critical |
| `CustomerOnboarding` | `OnboardingScreen.tsx` | ❌ Missing | 🔴 Critical |
| `CustomerPlanningJourney` | `PlanningJourneyScreen.tsx` | ❌ Missing | 🔴 Critical |
| `CustomerHavePetJourney` | `HavePetJourneyScreen.tsx` | ❌ Missing | 🔴 Critical |
| `CustomerUserProfile` | `UserProfileScreen.tsx` | ❌ Missing | 🔴 Critical |
| `CustomerPetProfile` | `PetProfileScreen.tsx` | ❌ Missing | 🔴 Critical |

**Implementation Notes:**
- Use same API endpoints as web
- Match exact flow logic
- Implement same validation rules

#### 2. Home & Dashboard

| Web Component | Mobile Screen | Status | Priority |
|--------------|---------------|--------|----------|
| `CustomerHomeComplete` | `HomeScreen.tsx` | ⚠️ Partial | 🔴 Critical |
| `CustomerDashboard` | `DashboardScreen.tsx` | ❌ Missing | 🟠 High |
| `IntegratedServicesHub` | `IntegratedServicesScreen.tsx` | ❌ Missing | 🟠 High |
| `ServiceDiscovery` | `ServiceDiscoveryScreen.tsx` | ❌ Missing | 🟠 High |

**Features to Implement:**
- Service category cards with brand colors
- Trending problems section
- Previous providers carousel
- Quick actions matching web

#### 3. Search & Discovery

| Web Component | Mobile Screen | Status | Priority |
|--------------|---------------|--------|----------|
| `EnhancedSearchBar` | `SearchScreen.tsx` | ⚠️ UI only | 🔴 Critical |
| `SearchResultsPage` | `SearchResultsScreen.tsx` | ❌ Missing | 🔴 Critical |
| `SearchFilters` | `SearchFiltersScreen.tsx` | ❌ Missing | 🟠 High |
| `SearchAutocomplete` | `SearchAutocomplete.tsx` | ❌ Missing | 🟠 High |
| `ProblemGridSelector` | `ProblemGridScreen.tsx` | ❌ Missing | 🟠 High |
| `VendorDiscoveryByProblem` | `VendorDiscoveryScreen.tsx` | ❌ Missing | 🟠 High |
| `VendorSearchEnhanced` | `VendorSearchScreen.tsx` | ❌ Missing | 🟠 High |
| `ProductSearchEnhanced` | `ProductSearchScreen.tsx` | ❌ Missing | 🟡 Medium |

**Search Features:**
- Text search with autocomplete
- Problem-based search
- Category filters
- Location-based search
- Price range filters
- Rating filters
- Availability filters

#### 4. Service-Specific Screens

##### Veterinary Services

| Web Component | Mobile Screen | Status | Priority |
|--------------|---------------|--------|----------|
| `VetServicesLanding` | `VetServicesLandingScreen.tsx` | ❌ Missing | 🔴 Critical |
| `VetServiceRouter` | `VetServiceRouterScreen.tsx` | ❌ Missing | 🔴 Critical |
| `VetAtHome` | `VetAtHomeScreen.tsx` | ❌ Missing | 🔴 Critical |
| `VetClinicListViewEnhanced` | `VetClinicListScreen.tsx` | ❌ Missing | 🔴 Critical |
| `VetCenterProfileView` | `VetClinicProfileScreen.tsx` | ❌ Missing | 🔴 Critical |
| `VetDoctorDetails` | `VetDoctorDetailsScreen.tsx` | ❌ Missing | 🔴 Critical |
| `VetBookingRouter` | `VetBookingFlowScreen.tsx` | ❌ Missing | 🔴 Critical |
| `TeleConsultation` | `TeleConsultationScreen.tsx` | ❌ Missing | 🟠 High |
| `DiagnosticsBookingFlow` | `DiagnosticsBookingScreen.tsx` | ❌ Missing | 🟠 High |

##### Grooming Services

| Web Component | Mobile Screen | Status | Priority |
|--------------|---------------|--------|----------|
| `GroomingServicesLanding` | `GroomingLandingScreen.tsx` | ❌ Missing | 🔴 Critical |
| `GroomingServiceRouter` | `GroomingRouterScreen.tsx` | ❌ Missing | 🔴 Critical |
| `GroomingAtHome` | `GroomingAtHomeScreen.tsx` | ❌ Missing | 🔴 Critical |
| `GroomingCenterVisit` | `GroomingCenterScreen.tsx` | ❌ Missing | 🔴 Critical |

##### Training Services

| Web Component | Mobile Screen | Status | Priority |
|--------------|---------------|--------|----------|
| `TrainingServicesLanding` | `TrainingLandingScreen.tsx` | ❌ Missing | 🔴 Critical |
| `TrainingServiceRouter` | `TrainingRouterScreen.tsx` | ❌ Missing | 🔴 Critical |
| `TrainingAtHome` | `TrainingAtHomeScreen.tsx` | ❌ Missing | 🔴 Critical |
| `TrainingProgressDashboard` | `TrainingProgressScreen.tsx` | ❌ Missing | 🟠 High |

##### Boarding Services

| Web Component | Mobile Screen | Status | Priority |
|--------------|---------------|--------|----------|
| `BoardingServicesLanding` | `BoardingLandingScreen.tsx` | ❌ Missing | 🔴 Critical |
| `BoardingServiceRouter` | `BoardingRouterScreen.tsx` | ❌ Missing | 🔴 Critical |
| `BoardingDailyUpdates` | `BoardingUpdatesScreen.tsx` | ❌ Missing | 🟠 High |

##### Walking Services

| Web Component | Mobile Screen | Status | Priority |
|--------------|---------------|--------|----------|
| `WalkingServicesLanding` | `WalkingLandingScreen.tsx` | ❌ Missing | 🔴 Critical |
| `WalkerService` | `WalkerServiceScreen.tsx` | ❌ Missing | 🔴 Critical |
| `WalkerSessionTracking` | `WalkerTrackingScreen.tsx` | ❌ Missing | 🟠 High |
| `WalkPhotosGallery` | `WalkPhotosScreen.tsx` | ❌ Missing | 🟡 Medium |

##### Other Services

| Service | Web Component | Mobile Screen | Priority |
|---------|--------------|---------------|----------|
| Adoption | `AdoptionServiceRouter` | `AdoptionRouterScreen.tsx` | 🟠 High |
| Sunset | `SunsetServiceRouter` | `SunsetRouterScreen.tsx` | 🟠 High |
| Insurance | `InsuranceServicesLanding` | `InsuranceLandingScreen.tsx` | 🟡 Medium |
| Cafes | `PetCafeServicesLanding` | `CafeLandingScreen.tsx` | 🟡 Medium |
| Pharmacy | `PharmacyServicesLanding` | `PharmacyLandingScreen.tsx` | 🟡 Medium |
| Photography | `PhotographyServicesLanding` | `PhotographyLandingScreen.tsx` | 🟡 Medium |
| Breeder | `BreederServicesLanding` | `BreederLandingScreen.tsx` | 🟡 Medium |
| Ambulance | `AmbulanceServicesLanding` | `AmbulanceLandingScreen.tsx` | 🟠 High |
| Nutritionist | `NutritionistServicesLanding` | `NutritionistLandingScreen.tsx` | 🟡 Medium |
| Relocation | `RelocationServicesLanding` | `RelocationLandingScreen.tsx` | 🟡 Medium |
| Resort | `ResortServicesLanding` | `ResortLandingScreen.tsx` | 🟡 Medium |
| Holiday | `PetHolidayServicesLanding` | `HolidayLandingScreen.tsx` | 🟡 Medium |

#### 5. Booking Management

| Web Component | Mobile Screen | Status | Priority |
|--------------|---------------|--------|----------|
| `MyBookings` | `BookingsScreen.tsx` | ⚠️ Partial | 🔴 Critical |
| `AppointmentsList` | `AppointmentsScreen.tsx` | ❌ Missing | 🔴 Critical |
| `BookingDetailsComplete` | `BookingDetailScreen.tsx` | ❌ Missing | 🔴 Critical |
| `AppointmentDetailsView` | `AppointmentDetailScreen.tsx` | ❌ Missing | 🔴 Critical |
| `RescheduleAppointmentView` | `RescheduleScreen.tsx` | ❌ Missing | 🟠 High |
| `CancelBookingModal` | `CancelBookingScreen.tsx` | ❌ Missing | 🟠 High |
| `BookingChatWidget` | `BookingChatScreen.tsx` | ❌ Missing | 🟠 High |
| `LiveGPSTracking` | `GPSTrackingScreen.tsx` | ❌ Missing | 🟠 High |
| `RateServiceModal` | `RateServiceScreen.tsx` | ❌ Missing | 🟠 High |

#### 6. Pet Management

| Web Component | Mobile Screen | Status | Priority |
|--------------|---------------|--------|----------|
| `CustomerPetsPage` | `PetsScreen.tsx` | ❌ Missing | 🔴 Critical |
| `CustomerPetProfile` | `PetProfileScreen.tsx` | ❌ Missing | 🔴 Critical |
| `PetProfileDashboard` | `PetDashboardScreen.tsx` | ❌ Missing | 🟠 High |
| `CustomerPetDetails` | `PetDetailsScreen.tsx` | ❌ Missing | 🟠 High |
| `AddPetModal` | `AddPetScreen.tsx` | ❌ Missing | 🔴 Critical |
| `MedicalRecordsPage` | `MedicalRecordsScreen.tsx` | ❌ Missing | 🟠 High |

#### 7. E-commerce

| Web Component | Mobile Screen | Status | Priority |
|--------------|---------------|--------|----------|
| `ShopDashboard` | `ShopScreen.tsx` | ❌ Missing | 🟠 High |
| `ProductDetailPage` | `ProductDetailScreen.tsx` | ❌ Missing | 🟠 High |
| `ShoppingCartView` | `CartScreen.tsx` | ❌ Missing | 🟠 High |
| `CheckoutView` | `CheckoutScreen.tsx` | ❌ Missing | 🟠 High |
| `OrderSuccessView` | `OrderSuccessScreen.tsx` | ❌ Missing | 🟠 High |
| `OrderHistoryView` | `OrderHistoryScreen.tsx` | ❌ Missing | 🟠 High |
| `OrderDetailView` | `OrderDetailScreen.tsx` | ❌ Missing | 🟠 High |
| `OrderTrackingView` | `OrderTrackingScreen.tsx` | ❌ Missing | 🟠 High |
| `UniversalOrderTracking` | `UniversalTrackingScreen.tsx` | ❌ Missing | 🟡 Medium |

#### 8. Advanced Features

| Web Component | Mobile Screen | Status | Priority |
|--------------|---------------|--------|----------|
| `MultiPetBookingPage` | `MultiPetBookingScreen.tsx` | ❌ Missing | 🟡 Medium |
| `PackageBookingPage` | `PackageBookingScreen.tsx` | ❌ Missing | 🟡 Medium |
| `EmergencyBookingPage` | `EmergencyBookingScreen.tsx` | ❌ Missing | 🟠 High |
| `CheckInCheckOutPage` | `CheckInOutScreen.tsx` | ❌ Missing | 🟡 Medium |
| `RewardsLoyaltyPage` | `RewardsScreen.tsx` | ❌ Missing | 🟡 Medium |
| `ReferralSystemPage` | `ReferralScreen.tsx` | ❌ Missing | 🟡 Medium |
| `WalletPage` | `WalletScreen.tsx` | ❌ Missing | 🟠 High |
| `MatingDatingHub` | `MatingDatingScreen.tsx` | ❌ Missing | 🟡 Low |

#### 9. Profile & Settings

| Web Component | Mobile Screen | Status | Priority |
|--------------|---------------|--------|----------|
| `CustomerProfile` | `ProfileScreen.tsx` | ⚠️ Partial | 🔴 Critical |
| `UserAccountSidebar` | `AccountScreen.tsx` | ❌ Missing | 🟠 High |
| `CustomerServicesPage` | `ServicesScreen.tsx` | ❌ Missing | 🟠 High |
| `CustomerBookingsPage` | `BookingsPageScreen.tsx` | ❌ Missing | 🟠 High |

### Vendor App Screen Mapping

#### 1. Authentication & Onboarding

| Web Component | Mobile Screen | Status | Priority |
|--------------|---------------|--------|----------|
| `VendorAuth` | `VendorLoginScreen.tsx` | ❌ Missing | 🔴 Critical |
| `VendorRoleSelection` | `VendorRoleScreen.tsx` | ❌ Missing | 🔴 Critical |
| `EnhancedVendorOnboarding` | `VendorOnboardingScreen.tsx` | ❌ Missing | 🔴 Critical |
| `VendorApplicationSubmitted` | `ApplicationSubmittedScreen.tsx` | ❌ Missing | 🔴 Critical |
| `VendorApplicationUnderReview` | `ApplicationReviewScreen.tsx` | ❌ Missing | 🔴 Critical |
| `VendorClarificationRequested` | `ClarificationScreen.tsx` | ❌ Missing | 🔴 Critical |
| `VendorApprovedSetup` | `ApprovedSetupScreen.tsx` | ❌ Missing | 🔴 Critical |
| `VendorAvailabilitySetup` | `AvailabilitySetupScreen.tsx` | ❌ Missing | 🔴 Critical |
| `VendorSetupCompleted` | `SetupCompletedScreen.tsx` | ❌ Missing | 🔴 Critical |
| `VendorApplicationRejected` | `ApplicationRejectedScreen.tsx` | ❌ Missing | 🔴 Critical |

#### 2. Dashboard & Management

| Web Component | Mobile Screen | Status | Priority |
|--------------|---------------|--------|----------|
| `VendorDashboard` | `VendorDashboardScreen.tsx` | ❌ Missing | 🔴 Critical |
| `VendorBookingManagement` | `BookingManagementScreen.tsx` | ❌ Missing | 🔴 Critical |
| `VendorServiceManagementComplete` | `ServiceManagementScreen.tsx` | ❌ Missing | 🔴 Critical |
| `StaffManagement` | `StaffManagementScreen.tsx` | ❌ Missing | 🟠 High |
| `FacilityManagement` | `FacilityManagementScreen.tsx` | ❌ Missing | 🟠 High |
| `VendorScheduleManagement` | `ScheduleManagementScreen.tsx` | ❌ Missing | 🟠 High |

#### 3. Service-Specific Vendor Screens

| Service | Web Component | Mobile Screen | Priority |
|---------|--------------|---------------|----------|
| Clinic | `ClinicDashboard` | `ClinicDashboardScreen.tsx` | 🔴 Critical |
| Cafe | `CafeVendorDashboard` | `CafeDashboardScreen.tsx` | 🟠 High |
| Sunset | `SunsetServicesVendorDashboard` | `SunsetDashboardScreen.tsx` | 🟠 High |
| Insurance | `InsuranceVendorContainer` | `InsuranceDashboardScreen.tsx` | 🟡 Medium |
| Resort | `ResortManagementDashboard` | `ResortDashboardScreen.tsx` | 🟡 Medium |
| Nutritionist | `NutritionistDashboard` | `NutritionistDashboardScreen.tsx` | 🟡 Medium |

#### 4. Booking & Consultation

| Web Component | Mobile Screen | Status | Priority |
|--------------|---------------|--------|----------|
| `VendorBookingDetailModal` | `BookingDetailScreen.tsx` | ❌ Missing | 🔴 Critical |
| `AcceptBookingModal` | `AcceptBookingScreen.tsx` | ❌ Missing | 🔴 Critical |
| `DeclineBookingModal` | `DeclineBookingScreen.tsx` | ❌ Missing | 🔴 Critical |
| `VendorTeleConsultationFlow` | `TeleConsultationScreen.tsx` | ❌ Missing | 🟠 High |
| `VendorConsultationScreen` | `ConsultationScreen.tsx` | ❌ Missing | 🟠 High |
| `VendorPrescriptionModal` | `PrescriptionScreen.tsx` | ❌ Missing | 🟠 High |

#### 5. Analytics & Reports

| Web Component | Mobile Screen | Status | Priority |
|--------------|---------------|--------|----------|
| `VendorAnalytics` | `AnalyticsScreen.tsx` | ❌ Missing | 🟡 Medium |
| `SettlementDashboard` | `SettlementScreen.tsx` | ❌ Missing | 🟠 High |
| `ProgressTrackingDashboard` | `ProgressScreen.tsx` | ❌ Missing | 🟡 Medium |

---

## 🔌 API Endpoint Mapping

### Customer APIs

#### Authentication APIs
```typescript
// All use same endpoints as web app
POST /auth/send-otp
POST /auth/verify-otp
POST /auth/login
POST /auth/refresh
GET  /auth/logout
```

#### Customer Profile APIs
```typescript
GET    /customer/profile/:identifier
PATCH  /customer/profile/:identifier
GET    /customer/profile/unified/:identifier
POST   /customer/onboarding/complete
```

#### Pet Management APIs
```typescript
GET    /customer/:customerId/pets
POST   /customer/:customerId/pets
PATCH  /customer/:customerId/pets/:petId
DELETE /customer/:customerId/pets/:petId
GET    /customer/:customerId/pets/:petId/medical-records
```

#### Service Discovery APIs
```typescript
GET /customer/featured-services
GET /customer/search-services?query=...&filters=...
GET /customer/problem-first-search?query=...&location=...
GET /customer/vendors?serviceType=...&location=...
GET /customer/services/:serviceId
GET /customer/vendors/:vendorId
```

#### Booking APIs
```typescript
GET    /customer/:customerId/bookings
GET    /booking/:bookingId
POST   /booking/create
PATCH  /booking/:bookingId
DELETE /booking/:bookingId/cancel
POST   /booking/:bookingId/reschedule
GET    /booking/:bookingId/tracking
POST   /booking/:bookingId/rate
```

#### E-commerce APIs
```typescript
GET    /customer/products?category=...&search=...
GET    /customer/products/:productId
GET    /customer/cart
POST   /customer/cart/add
DELETE /customer/cart/:itemId
POST   /customer/checkout
GET    /customer/orders
GET    /customer/orders/:orderId
GET    /customer/orders/:orderId/tracking
```

#### Payment & Wallet APIs
```typescript
GET    /customer/wallet
POST   /customer/wallet/add-funds
POST   /customer/payment-methods
GET    /customer/payment-methods
DELETE /customer/payment-methods/:id
```

#### Notification APIs
```typescript
GET    /customer/notifications
PATCH  /customer/notifications/:id/read
DELETE /customer/notifications/:id
```

### Vendor APIs

#### Authentication APIs
```typescript
POST /auth/send-otp
POST /auth/verify-otp
POST /auth/login
```

#### Vendor Profile APIs
```typescript
GET    /vendor/:vendorId
PATCH  /vendor/:vendorId
GET    /vendor/:vendorId/dashboard
```

#### Service Management APIs
```typescript
GET    /vendor/:vendorId/services
POST   /vendor/services
PATCH  /vendor/services/:serviceId
DELETE /vendor/services/:serviceId
POST   /vendor/services/:serviceId/publish
```

#### Booking Management APIs
```typescript
GET    /vendor/:vendorId/bookings
GET    /vendor/bookings/:bookingId
POST   /vendor/bookings/:bookingId/accept
POST   /vendor/bookings/:bookingId/decline
PATCH  /vendor/bookings/:bookingId
```

#### Staff Management APIs
```typescript
GET    /vendor/:vendorId/staff
POST   /vendor/staff
PATCH  /vendor/staff/:staffId
DELETE /vendor/staff/:staffId
```

---

## 🎨 Branding Guidelines Implementation

### Color System Implementation

#### Create Brand Colors File

**File:** `apps/customer-mobile/src/theme/colors.ts`
```typescript
export const BrandColors = {
  // Primary Colors
  primary: {
    orange: '#FF8C42',
    pink: '#FF6B9D',
    yellow: '#FFC857',
    purple: '#9B59B6',
  },
  
  // Service Colors
  services: {
    veterinary: '#26C6DA',
    grooming: '#FF6B9D',
    training: '#9B59B6',
    boarding: '#FF8C42',
    walking: '#4CAF50',
    nutrition: '#FFC857',
    pharmacy: '#2196F3',
    adoption: '#E91E63',
    insurance: '#673AB7',
  },
  
  // Semantic Colors
  semantic: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
  
  // Neutral Colors
  neutral: {
    gray50: '#F9FAFB',
    gray100: '#F3F4F6',
    gray200: '#E5E7EB',
    gray300: '#D1D5DB',
    gray400: '#9CA3AF',
    gray500: '#6B7280',
    gray600: '#4B5563',
    gray700: '#374151',
    gray800: '#1F2937',
    gray900: '#111827',
  },
};
```

#### Create Gradient Utilities

**File:** `apps/customer-mobile/src/theme/gradients.ts`
```typescript
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';

export const Gradients = {
  primary: ['#FF8C42', '#FF6B9D'],
  loyalty: ['#FFC857', '#FF8C42'],
  premium: ['#9B59B6', '#673AB7'],
  success: ['#10B981', '#059669'],
};

export const GradientButton = ({ children, gradient, ...props }) => {
  return (
    <LinearGradient
      colors={gradient || Gradients.primary}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      {...props}
    >
      {children}
    </LinearGradient>
  );
};
```

### Typography Implementation

#### Create Typography System

**File:** `apps/customer-mobile/src/theme/typography.ts`
```typescript
import { Platform } from 'react-native';

// Load Inter font
export const FontFamily = {
  regular: Platform.select({
    ios: 'Inter-Regular',
    android: 'Inter-Regular',
    default: 'Inter',
  }),
  medium: Platform.select({
    ios: 'Inter-Medium',
    android: 'Inter-Medium',
    default: 'Inter',
  }),
  semibold: Platform.select({
    ios: 'Inter-SemiBold',
    android: 'Inter-SemiBold',
    default: 'Inter',
  }),
  bold: Platform.select({
    ios: 'Inter-Bold',
    android: 'Inter-Bold',
    default: 'Inter',
  }),
};

export const Typography = {
  // Headings
  h1: {
    fontSize: 32,
    fontFamily: FontFamily.bold,
    lineHeight: 40,
  },
  h2: {
    fontSize: 24,
    fontFamily: FontFamily.semibold,
    lineHeight: 32,
  },
  h3: {
    fontSize: 20,
    fontFamily: FontFamily.semibold,
    lineHeight: 28,
  },
  
  // Body
  body: {
    fontSize: 16,
    fontFamily: FontFamily.regular,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    lineHeight: 20,
  },
  bodyTiny: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    lineHeight: 16,
  },
};
```

#### Font Installation

**Add to `package.json`:**
```json
{
  "dependencies": {
    "@expo-google-fonts/inter": "^0.2.3",
    "expo-font": "~11.0.0"
  }
}
```

**Load fonts in `App.tsx`:**
```typescript
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';

export default function App() {
  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  if (!fontsLoaded) {
    return <SplashScreen />;
  }

  // ... rest of app
}
```

### Component Library

#### Create Branded Button Component

**File:** `apps/customer-mobile/src/components/BrandedButton.tsx`
```typescript
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BrandColors, Gradients, Typography } from '../theme';

interface BrandedButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive';
  loading?: boolean;
  disabled?: boolean;
  gradient?: boolean;
}

export const BrandedButton: React.FC<BrandedButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  gradient = true,
}) => {
  if (variant === 'primary' && gradient) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={Gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.button, disabled && styles.buttonDisabled]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{title}</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  // Other variants...
};
```

#### Create Service Card Component

**File:** `apps/customer-mobile/src/components/ServiceCard.tsx`
```typescript
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { BrandColors, Typography } from '../theme';

interface ServiceCardProps {
  service: {
    id: string;
    name: string;
    image: string;
    price: number;
    serviceType: string;
    rating?: number;
  };
  onPress: () => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ service, onPress }) => {
  const serviceColor = BrandColors.services[service.serviceType] || BrandColors.primary.orange;

  return (
    <TouchableOpacity
      style={[styles.card, { borderTopColor: serviceColor, borderTopWidth: 4 }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Image source={{ uri: service.image }} style={styles.image} />
      <View style={styles.content}>
        <View style={[styles.badge, { backgroundColor: `${serviceColor}20` }]}>
          <Text style={[styles.badgeText, { color: serviceColor }]}>
            {service.serviceType}
          </Text>
        </View>
        <Text style={Typography.h3}>{service.name}</Text>
        <Text style={[Typography.body, { color: BrandColors.primary.orange }]}>
          ₹{service.price}
        </Text>
      </View>
    </TouchableOpacity>
  );
};
```

### Spacing System

**File:** `apps/customer-mobile/src/theme/spacing.ts`
```typescript
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};
```

### Border Radius System

**File:** `apps/customer-mobile/src/theme/borders.ts`
```typescript
export const BorderRadius = {
  sm: 8,   // rounded-lg
  md: 12,
  lg: 16,  // rounded-xl
  full: 9999, // rounded-full
};
```

---

## 🔔 Notification System Integration

### Notification Service Setup

**File:** `apps/customer-mobile/src/services/notificationService.ts`
```typescript
import PushNotification from 'react-native-push-notification';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../config/api';

class NotificationService {
  private channelId = 'warmpawz-notifications';

  initialize() {
    // Create notification channel (Android)
    if (Platform.OS === 'android') {
      PushNotification.createChannel(
        {
          channelId: this.channelId,
          channelName: 'Warmpawz Notifications',
          channelDescription: 'Notifications for bookings, messages, and updates',
          playSound: true,
          soundName: 'default',
          importance: 4,
          vibrate: true,
        },
        (created) => console.log(`Channel created: ${created}`)
      );
    }

    // Configure notification handlers
    PushNotification.configure({
      onNotification: (notification) => {
        console.log('Notification received:', notification);
        // Handle notification tap
        this.handleNotificationTap(notification);
      },
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },
      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });
  }

  async registerDeviceToken(token: string, userId: string) {
    try {
      await fetch(`${API_BASE_URL}/customer/notifications/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, userId, platform: Platform.OS }),
      });
    } catch (error) {
      console.error('Failed to register device token:', error);
    }
  }

  showLocalNotification(title: string, message: string, data?: any) {
    PushNotification.localNotification({
      channelId: this.channelId,
      title,
      message,
      data,
      playSound: true,
      soundName: 'default',
    });
  }

  private handleNotificationTap(notification: any) {
    // Navigate based on notification type
    const { type, bookingId, chatId } = notification.data || {};
    
    // Use navigation service to navigate
    // navigationService.navigate(type, { bookingId, chatId });
  }
}

export default new NotificationService();
```

### Real-time Notification Listener

**File:** `apps/customer-mobile/src/hooks/useNotifications.ts`
```typescript
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import notificationService from '../services/notificationService';
import { API_BASE_URL } from '../config/api';

export const useNotifications = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Initialize notification service
    notificationService.initialize();

    // Set up real-time listener (using Supabase Realtime or WebSocket)
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const notification = payload.new;
        notificationService.showLocalNotification(
          notification.title,
          notification.message,
          notification.data
        );
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user]);
};
```

---

## 🔍 Search & Filter Implementation

### Search Service

**File:** `apps/customer-mobile/src/services/searchService.ts`
```typescript
import { API_BASE_URL } from '../config/api';
import apiClient from './api';

export interface SearchFilters {
  serviceType?: string;
  location?: { lat: number; lng: number; radius?: number };
  priceRange?: { min: number; max: number };
  rating?: number;
  availability?: string;
  sortBy?: 'price' | 'rating' | 'distance' | 'popularity';
}

export const searchService = {
  // Text search
  async searchServices(query: string, filters?: SearchFilters) {
    return apiClient.get('/customer/search-services', {
      params: { query, ...filters },
    });
  },

  // Problem-based search
  async searchByProblem(problem: string, location?: { lat: number; lng: number }) {
    return apiClient.get('/customer/problem-first-search', {
      params: { query: problem, ...location },
    });
  },

  // Category search
  async searchByCategory(category: string, filters?: SearchFilters) {
    return apiClient.get('/customer/search-services', {
      params: { category, ...filters },
    });
  },

  // Autocomplete
  async autocomplete(query: string) {
    return apiClient.get('/customer/search/autocomplete', {
      params: { query },
    });
  },
};
```

### Filter Component

**File:** `apps/customer-mobile/src/components/SearchFilters.tsx`
```typescript
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { BrandColors, Typography, Spacing, BorderRadius } from '../theme';
import { SearchFilters as FilterType } from '../services/searchService';

interface SearchFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
}

export const SearchFilters: React.FC<SearchFiltersProps> = ({
  filters,
  onFiltersChange,
}) => {
  const serviceTypes = [
    'Veterinary', 'Grooming', 'Training', 'Boarding', 'Walking',
    'Nutrition', 'Pharmacy', 'Adoption', 'Insurance'
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.container}>
      {serviceTypes.map((type) => (
        <TouchableOpacity
          key={type}
          style={[
            styles.filterChip,
            filters.serviceType === type && styles.filterChipActive,
          ]}
          onPress={() => onFiltersChange({ ...filters, serviceType: type })}
        >
          <Text
            style={[
              styles.filterText,
              filters.serviceType === type && styles.filterTextActive,
            ]}
          >
            {type}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};
```

---

## 📐 Business Rules Implementation

### Booking Rules

**File:** `apps/customer-mobile/src/rules/bookingRules.ts`
```typescript
export const BookingRules = {
  // Minimum booking advance time
  minAdvanceBookingHours: 2,
  
  // Maximum booking advance time
  maxAdvanceBookingDays: 30,
  
  // Cancellation rules
  cancellation: {
    freeCancellationHours: 24,
    partialRefundHours: 12,
    noRefundHours: 2,
  },
  
  // Rescheduling rules
  rescheduling: {
    maxReschedules: 3,
    minAdvanceHours: 4,
  },
  
  // Multi-pet booking
  multiPet: {
    maxPetsPerBooking: 5,
    discountPerAdditionalPet: 0.1, // 10%
  },
  
  // Package booking
  package: {
    minServicesForPackage: 3,
    packageDiscount: 0.15, // 15%
  },
  
  // Emergency booking
  emergency: {
    surcharge: 0.5, // 50% surcharge
    availableServices: ['Veterinary', 'Ambulance'],
  },
};
```

### Validation Rules

**File:** `apps/customer-mobile/src/rules/validationRules.ts`
```typescript
export const ValidationRules = {
  phone: {
    pattern: /^[6-9]\d{9}$/,
    message: 'Please enter a valid 10-digit phone number',
  },
  
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Please enter a valid email address',
  },
  
  pet: {
    name: {
      minLength: 2,
      maxLength: 50,
    },
    age: {
      min: 0,
      max: 30,
    },
  },
  
  address: {
    minLength: 10,
    maxLength: 200,
  },
};
```

---

## 🚀 Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

#### Week 1: Setup & Branding
- [ ] Set up branding theme system (colors, typography, spacing)
- [ ] Install and configure Inter font
- [ ] Create branded component library (Button, Card, Badge, etc.)
- [ ] Set up navigation structure matching web app
- [ ] Configure API client with proper error handling

#### Week 2: Authentication & Onboarding
- [ ] Implement LoginScreen with OTP (uncomment APIs)
- [ ] Create OnboardingScreen matching web flow
- [ ] Create PlanningJourneyScreen
- [ ] Create HavePetJourneyScreen
- [ ] Create UserProfileScreen
- [ ] Create PetProfileScreen
- [ ] Test complete onboarding flow

**Deliverables:**
- ✅ Branding system implemented
- ✅ Authentication working
- ✅ Onboarding flow complete

### Phase 2: Core Features (Weeks 3-4)

#### Week 3: Home & Search
- [ ] Enhance HomeScreen with all web features
- [ ] Implement SearchScreen with autocomplete
- [ ] Create SearchResultsScreen
- [ ] Create SearchFilters component
- [ ] Implement ProblemGridScreen
- [ ] Create VendorDiscoveryScreen

#### Week 4: Service Discovery
- [ ] Create VetServicesLandingScreen
- [ ] Create GroomingServicesLandingScreen
- [ ] Create TrainingServicesLandingScreen
- [ ] Create BoardingServicesLandingScreen
- [ ] Create WalkingServicesLandingScreen
- [ ] Implement service routing logic

**Deliverables:**
- ✅ Home screen complete
- ✅ Search functionality working
- ✅ Service discovery implemented

### Phase 3: Booking Flows (Weeks 5-7)

#### Week 5: Booking Creation
- [ ] Create booking flow screens (Pet selection, Time slots, Address)
- [ ] Implement booking creation API
- [ ] Create BookingConfirmationScreen
- [ ] Add payment integration
- [ ] Test booking flow end-to-end

#### Week 6: Booking Management
- [ ] Enhance BookingsScreen with full functionality
- [ ] Create BookingDetailScreen
- [ ] Create RescheduleScreen
- [ ] Create CancelBookingScreen
- [ ] Implement booking status updates

#### Week 7: Advanced Booking Features
- [ ] Create MultiPetBookingScreen
- [ ] Create PackageBookingScreen
- [ ] Create EmergencyBookingScreen
- [ ] Implement booking rules validation

**Deliverables:**
- ✅ Complete booking flow
- ✅ Booking management working
- ✅ Advanced booking features

### Phase 4: Pet Management (Week 8)

- [ ] Create PetsScreen (list view)
- [ ] Create AddPetScreen
- [ ] Create PetDetailScreen
- [ ] Create PetDashboardScreen
- [ ] Create MedicalRecordsScreen
- [ ] Implement pet CRUD operations

**Deliverables:**
- ✅ Pet management complete

### Phase 5: E-commerce (Weeks 9-10)

#### Week 9: Shop & Cart
- [ ] Create ShopScreen
- [ ] Create ProductDetailScreen
- [ ] Create CartScreen
- [ ] Implement cart management

#### Week 10: Checkout & Orders
- [ ] Create CheckoutScreen
- [ ] Create OrderSuccessScreen
- [ ] Create OrderHistoryScreen
- [ ] Create OrderDetailScreen
- [ ] Create OrderTrackingScreen

**Deliverables:**
- ✅ E-commerce flow complete

### Phase 6: Advanced Features (Weeks 11-12)

#### Week 11: Notifications & Real-time
- [ ] Set up push notifications
- [ ] Implement notification service
- [ ] Create notification screen
- [ ] Add real-time updates

#### Week 12: Additional Features
- [ ] Create WalletScreen
- [ ] Create RewardsScreen
- [ ] Create ReferralScreen
- [ ] Create ChatScreen
- [ ] Create GPSTrackingScreen

**Deliverables:**
- ✅ Notifications working
- ✅ Advanced features complete

### Phase 7: Vendor App (Weeks 13-16)

#### Week 13: Vendor Auth & Onboarding
- [ ] Create VendorLoginScreen
- [ ] Create VendorOnboardingScreen
- [ ] Implement vendor application flow
- [ ] Create all onboarding states

#### Week 14: Vendor Dashboard
- [ ] Create VendorDashboardScreen
- [ ] Create BookingManagementScreen
- [ ] Create ServiceManagementScreen
- [ ] Create StaffManagementScreen

#### Week 15: Vendor Operations
- [ ] Create AcceptBookingScreen
- [ ] Create ConsultationScreen
- [ ] Create PrescriptionScreen
- [ ] Create ScheduleManagementScreen

#### Week 16: Vendor Analytics
- [ ] Create AnalyticsScreen
- [ ] Create SettlementScreen
- [ ] Create ReportsScreen

**Deliverables:**
- ✅ Vendor app complete

### Phase 8: Testing & Polish (Weeks 17-18)

- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Bug fixes
- [ ] UI/UX polish
- [ ] Branding compliance check
- [ ] Documentation

**Deliverables:**
- ✅ Apps ready for production

---

## 🏗️ Technical Architecture

### Project Structure

```
apps/
├── customer-mobile/
│   ├── src/
│   │   ├── screens/
│   │   │   ├── auth/
│   │   │   ├── onboarding/
│   │   │   ├── home/
│   │   │   ├── search/
│   │   │   ├── services/
│   │   │   ├── bookings/
│   │   │   ├── pets/
│   │   │   ├── shop/
│   │   │   └── profile/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   ├── branded/
│   │   │   └── service-specific/
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   ├── authService.ts
│   │   │   ├── searchService.ts
│   │   │   └── notificationService.ts
│   │   ├── context/
│   │   │   ├── AuthContext.tsx
│   │   │   ├── CartContext.tsx
│   │   │   └── NotificationContext.tsx
│   │   ├── theme/
│   │   │   ├── colors.ts
│   │   │   ├── typography.ts
│   │   │   ├── spacing.ts
│   │   │   └── gradients.ts
│   │   ├── rules/
│   │   │   ├── bookingRules.ts
│   │   │   └── validationRules.ts
│   │   └── navigation/
│   │       ├── CustomerNavigator.tsx
│   │       └── types.ts
│   └── App.tsx
│
└── vendor-mobile/
    └── (similar structure)
```

### Key Dependencies

```json
{
  "dependencies": {
    "react-native": "0.73.0",
    "@react-navigation/native": "^6.1.9",
    "@react-navigation/stack": "^6.3.20",
    "@react-navigation/bottom-tabs": "^6.5.11",
    "@expo-google-fonts/inter": "^0.2.3",
    "expo-linear-gradient": "~12.0.0",
    "expo-font": "~11.0.0",
    "@supabase/supabase-js": "^2.39.0",
    "react-native-push-notification": "^8.1.1",
    "@react-native-async-storage/async-storage": "^1.21.0",
    "axios": "^1.6.2",
    "@warmpawz/shared-api": "file:../../packages/shared-api"
  }
}
```

---

## ✅ Testing Strategy

### Unit Tests
- Component rendering
- Business rules validation
- API service functions

### Integration Tests
- Navigation flows
- API integration
- State management

### E2E Tests
- Complete user journeys
- Booking flows
- Payment flows

### Manual Testing Checklist
- [ ] All screens match web app design
- [ ] All APIs integrated and working
- [ ] Branding guidelines followed
- [ ] Notifications working
- [ ] Search and filters working
- [ ] Business rules enforced
- [ ] Error handling proper
- [ ] Loading states implemented
- [ ] Empty states implemented

---

## 📊 Success Metrics

### Completion Metrics
- **Screens:** 80+ customer, 60+ vendor
- **API Integration:** 100%
- **Branding Compliance:** 100%
- **Feature Parity:** 100% with web app

### Quality Metrics
- **Test Coverage:** >80%
- **Performance:** <2s load time
- **Crash Rate:** <0.1%
- **User Satisfaction:** >4.5/5

---

## 🎯 Next Steps

1. **Review this plan** with team
2. **Set up project structure** (Week 1)
3. **Begin Phase 1** implementation
4. **Daily standups** to track progress
5. **Weekly reviews** of completed phases

---

**Document Status:** Ready for Implementation  
**Last Updated:** December 2024  
**Owner:** Development Team

