/**
 * Booking Flow Dispatcher
 * 
 * Universal dispatcher that routes to appropriate booking flow based on:
 * - Service type
 * - Service style (Center | Home | Tele | Delivery | Package)
 * - Vendor type (Solo | Center)
 * - Role configuration
 * 
 * This component implements the unified booking flow architecture.
 * ✅ ENHANCED: Now actually renders booking flow components instead of just routing
 */

import React from 'react';
import { VetBookingFlow } from './vet/VetBookingFlow';
import { VetBookingRouter } from './vet/VetBookingRouter';
import { CenterBookingFlowEnhanced } from './CenterBookingFlowEnhanced';
import { PackageBookingPage } from './PackageBookingPage';
import { DeliveryBookingFlow } from './DeliveryBookingFlow';

interface BookingFlowDispatcherProps {
  serviceType: string; // 'vet', 'grooming', 'training', etc.
  serviceStyle: 'at_center' | 'at_home' | 'tele' | 'delivery' | 'package';
  vendorId: string;
  vendorName?: string;
  vendorType?: 'solo' | 'center';
  vendorRoleId?: string; // ✅ NEW: Explicit role ID for role-based routing
  staffId?: string;
  selectedService?: any;
  customerId: string;
  customerPhone: string;
  petId?: string; // Optional: pre-selected pet
  petName?: string; // Optional: pre-selected pet name
  customerName?: string; // Optional: customer name
  onBack?: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onBookingComplete?: (bookingId: string) => void;
}

/**
 * Role-to-Service-Type Mapping
 * Maps all 20+ vendor roles to appropriate service types and flows
 */
const ROLE_SERVICE_MAPPING: Record<string, { serviceType: string; defaultStyle: string }> = {
  'veterinarian': { serviceType: 'vet', defaultStyle: 'at_center' },
  'veterinary_clinic': { serviceType: 'vet', defaultStyle: 'at_center' },
  'pet_clinic': { serviceType: 'vet', defaultStyle: 'at_center' },
  'pet_groomer': { serviceType: 'grooming', defaultStyle: 'at_center' },
  'pet_trainer': { serviceType: 'training', defaultStyle: 'at_home' },
  'pet_behaviorist': { serviceType: 'training', defaultStyle: 'at_home' },
  'pet_walker': { serviceType: 'walker', defaultStyle: 'at_home' },
  'pet_boarding': { serviceType: 'boarding', defaultStyle: 'at_center' },
  'pet_resort': { serviceType: 'resort', defaultStyle: 'at_center' },
  'pet_cafe': { serviceType: 'cafe', defaultStyle: 'at_center' },
  'pet_pharmacy': { serviceType: 'pharmacy', defaultStyle: 'delivery' },
  'nutritionist': { serviceType: 'nutrition', defaultStyle: 'delivery' },
  'pet_products_store': { serviceType: 'products', defaultStyle: 'delivery' },
  'pet_insurance': { serviceType: 'insurance', defaultStyle: 'tele' },
  'insurance': { serviceType: 'insurance', defaultStyle: 'tele' },
  'pet_ambulance': { serviceType: 'ambulance', defaultStyle: 'at_home' },
  'pet_sitter': { serviceType: 'sitting', defaultStyle: 'at_home' },
  'pet_taxi': { serviceType: 'transport', defaultStyle: 'at_home' },
  'pet_photographer': { serviceType: 'photography', defaultStyle: 'at_home' },
  'pet_shelter': { serviceType: 'adoption', defaultStyle: 'at_center' },
  'pet_breeder': { serviceType: 'breeding', defaultStyle: 'at_center' },
  'pet_sunset_services': { serviceType: 'memorial', defaultStyle: 'at_center' },
  'pet_holiday_planner': { serviceType: 'holiday', defaultStyle: 'package' }
};

export function BookingFlowDispatcher({
  serviceType,
  serviceStyle,
  vendorId,
  vendorName,
  vendorType = 'center',
  vendorRoleId,
  staffId,
  selectedService,
  customerId,
  customerPhone,
  petId,
  petName,
  customerName,
  onBack,
  onNavigate,
  onBookingComplete,
}: BookingFlowDispatcherProps) {
  
  // ✅ ENHANCEMENT: Role-based service type and style determination
  let effectiveServiceType = serviceType;
  let effectiveServiceStyle = serviceStyle;

  // If role ID is provided, use it to determine service type and style
  if (vendorRoleId && ROLE_SERVICE_MAPPING[vendorRoleId]) {
    const roleMapping = ROLE_SERVICE_MAPPING[vendorRoleId];
    if (!serviceType || serviceType === 'unknown') {
      effectiveServiceType = roleMapping.serviceType;
    }
    if (!serviceStyle) {
      effectiveServiceStyle = roleMapping.defaultStyle as any;
    }
  }

  // Default onBack handler
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (onNavigate) {
      onNavigate('home');
    }
  };

  // Default onNavigate handler
  const handleNavigate = (screen: string, data?: any) => {
    if (onNavigate) {
      onNavigate(screen, data);
    }
  };

  // Handle booking completion
  const handleBookingComplete = (bookingId: string) => {
    if (onBookingComplete) {
      onBookingComplete(bookingId);
    } else if (onNavigate) {
      onNavigate('booking-success', { bookingId });
    }
  };

  // ✅ ENHANCEMENT: Role-specific flow routing
  // Handle role-specific flows that need special handling
  if (vendorRoleId) {
    switch (vendorRoleId) {
      case 'pet_cafe':
        // Cafe bookings need table/pax selection
        if (effectiveServiceStyle === 'at_center') {
          // Use center booking flow but with cafe-specific features
          return (
            <CenterBookingFlowEnhanced
              vendorId={vendorId}
              vendorName={vendorName || 'Pet Cafe'}
              customerId={customerId}
              customerPhone={customerPhone}
              customerName={customerName}
              petId={petId}
              petName={petName}
              onBack={handleBack}
              onSuccess={handleBookingComplete}
              vendorRoleId={vendorRoleId}
            />
          );
        }
        break;

      case 'pet_boarding':
      case 'pet_resort':
        // Boarding/Resort need check-in/check-out dates
        if (effectiveServiceStyle === 'at_center') {
          return (
            <CenterBookingFlowEnhanced
              vendorId={vendorId}
              vendorName={vendorName || 'Pet Boarding'}
              customerId={customerId}
              customerPhone={customerPhone}
              customerName={customerName}
              petId={petId}
              petName={petName}
              onBack={handleBack}
              onSuccess={handleBookingComplete}
              vendorRoleId={vendorRoleId}
            />
          );
        }
        break;

      case 'pet_pharmacy':
        // Pharmacy needs prescription upload
        if (effectiveServiceStyle === 'delivery') {
          return (
            <DeliveryBookingFlow
              serviceType="pharmacy"
              vendorId={vendorId}
              vendorName={vendorName}
              customerId={customerId}
              customerPhone={customerPhone}
              petId={petId}
              petName={petName}
              onBack={handleBack}
              onNavigate={handleNavigate}
              onBookingComplete={handleBookingComplete}
              vendorRoleId={vendorRoleId}
            />
          );
        }
        break;

      case 'nutritionist':
        // Nutritionist needs meal plan selection
        if (effectiveServiceStyle === 'delivery') {
          return (
            <DeliveryBookingFlow
              serviceType="meals"
              vendorId={vendorId}
              vendorName={vendorName}
              customerId={customerId}
              customerPhone={customerPhone}
              petId={petId}
              petName={petName}
              onBack={handleBack}
              onNavigate={handleNavigate}
              onBookingComplete={handleBookingComplete}
              vendorRoleId={vendorRoleId}
            />
          );
        }
        break;

      case 'pet_insurance':
      case 'insurance':
        // Insurance needs policy selection
        if (effectiveServiceStyle === 'tele' || effectiveServiceStyle === 'at_center') {
          return (
            <VetBookingRouter
              phone={customerPhone}
              doctorId={staffId}
              selectedService={selectedService}
              serviceType="tele"
              onBack={handleBack}
              onNavigate={handleNavigate}
              vendorRoleId={vendorRoleId}
            />
          );
        }
        break;
    }
  }

  // ✅ ENHANCEMENT: Render appropriate booking flow component based on service style and type
  switch (effectiveServiceStyle) {
    case 'at_center':
      // Center booking flow (Clinic / Grooming / Diagnostics)
      if (effectiveServiceType === 'vet' || vendorRoleId === 'veterinarian' || vendorRoleId === 'veterinary_clinic' || vendorRoleId === 'pet_clinic') {
        // Use VetBookingRouter for enhanced vet center bookings (with doctor selection)
        return (
          <VetBookingRouter
            phone={customerPhone}
            doctorId={staffId}
            selectedService={selectedService}
            serviceType="clinic"
            onBack={handleBack}
            onNavigate={handleNavigate}
            onViewBooking={(bookingId, petId) => {
              handleNavigate('booking-details', { bookingId, petId });
            }}
          />
        );
      } else if (petId && petName && customerName) {
        // Use CenterBookingFlowEnhanced for other center services (requires pet/customer data)
        return (
          <CenterBookingFlowEnhanced
            vendorId={vendorId}
            vendorName={vendorName || 'Service Provider'}
            customerId={customerId}
            customerPhone={customerPhone}
            customerName={customerName}
            petId={petId}
            petName={petName}
            onBack={handleBack}
            onSuccess={handleBookingComplete}
          />
        );
      } else {
        // Fallback: Use VetBookingFlow for basic center bookings
        return (
          <VetBookingFlow
            phone={customerPhone}
            serviceType="clinic"
            vendorId={vendorId}
            onBack={handleBack}
            onNavigate={handleNavigate}
          />
        );
      }

    case 'at_home':
      // Home services flow (Grooming / Walker / Training / Vet Home)
      if (effectiveServiceType === 'vet' || vendorRoleId === 'veterinarian') {
        return (
          <VetBookingFlow
            phone={customerPhone}
            serviceType="home"
            vendorId={vendorId}
            onBack={handleBack}
            onNavigate={handleNavigate}
          />
        );
      } else {
        // For other home services, use VetBookingFlow as base (can be extended)
        return (
          <VetBookingFlow
            phone={customerPhone}
            serviceType="home"
            vendorId={vendorId}
            onBack={handleBack}
            onNavigate={handleNavigate}
          />
        );
      }

    case 'tele':
      // Tele consultation flow
      if (effectiveServiceType === 'vet' || vendorRoleId === 'veterinarian' || vendorRoleId === 'pet_behaviorist' || vendorRoleId === 'nutritionist') {
        return (
          <VetBookingRouter
            phone={customerPhone}
            doctorId={staffId}
            selectedService={selectedService}
            serviceType="tele"
            onBack={handleBack}
            onNavigate={handleNavigate}
            onViewBooking={(bookingId, petId) => {
              handleNavigate('booking-details', { bookingId, petId });
            }}
          />
        );
      } else {
        // Fallback: Use VetBookingRouter for tele consultations
        return (
          <VetBookingRouter
            phone={customerPhone}
            doctorId={staffId}
            selectedService={selectedService}
            serviceType="tele"
            onBack={handleBack}
            onNavigate={handleNavigate}
          />
        );
      }

    case 'delivery':
      // Delivery flow (Medicine / Nutrition / Products)
      // ✅ ENHANCED: Role-based delivery service type
      let deliveryServiceType = 'products';
      if (effectiveServiceType === 'pharmacy' || vendorRoleId === 'pet_pharmacy') {
        deliveryServiceType = 'pharmacy';
      } else if (effectiveServiceType === 'nutrition' || vendorRoleId === 'nutritionist') {
        deliveryServiceType = 'meals';
      } else if (effectiveServiceType === 'products' || vendorRoleId === 'pet_products_store') {
        deliveryServiceType = 'products';
      }
      
      return (
        <DeliveryBookingFlow
          serviceType={deliveryServiceType}
          vendorId={vendorId}
          vendorName={vendorName}
          customerId={customerId}
          customerPhone={customerPhone}
          petId={petId}
          petName={petName}
          onBack={handleBack}
          onNavigate={handleNavigate}
          onBookingComplete={handleBookingComplete}
        />
      );

    case 'package':
      // Package & subscription flow
      return (
        <PackageBookingPage
          customerPhone={customerPhone}
          customerId={customerId}
          petId={petId}
          onBack={handleBack}
          onNavigate={handleNavigate}
          onBookingComplete={handleBookingComplete}
        />
      );

    default:
      // Fallback to center booking
      return (
        <VetBookingFlow
          phone={customerPhone}
          serviceType="clinic"
          vendorId={vendorId}
          onBack={handleBack}
          onNavigate={handleNavigate}
        />
      );
  }
}

/**
 * Helper function to determine service style from service data
 */
export function determineServiceStyle(service: any): 'at_center' | 'at_home' | 'tele' | 'delivery' | 'package' {
  if (service.serviceStyle) {
    return service.serviceStyle;
  }
  
  // Fallback logic based on service type
  if (service.isPackage || service.type === 'package') {
    return 'package';
  }
  
  if (service.isDelivery || service.type === 'delivery') {
    return 'delivery';
  }
  
  if (service.isTele || service.type === 'tele') {
    return 'tele';
  }
  
  if (service.isHome || service.type === 'home') {
    return 'at_home';
  }
  
  // Default to center
  return 'at_center';
}

/**
 * Helper function to get booking flow component name
 */
export function getBookingFlowComponent(serviceStyle: string, serviceType: string): string {
  const flowMap: Record<string, Record<string, string>> = {
    at_center: {
      vet: 'VetBookingRouter',
      grooming: 'GroomingBookingFlow',
      training: 'TrainingBookingFlow',
      boarding: 'BoardingBookingFlow',
      default: 'CenterBookingFlow',
    },
    at_home: {
      grooming: 'HomeGroomingBookingFlow',
      training: 'HomeTrainingBookingFlow',
      walker: 'WalkerBookingFlow',
      default: 'HomeServiceBookingFlow',
    },
    tele: {
      vet: 'TeleVetBookingFlow',
      default: 'TeleConsultationBookingFlow',
    },
    delivery: {
      medicine: 'MedicineDeliveryFlow',
      nutrition: 'NutritionDeliveryFlow',
      diagnostics: 'DiagnosticsDeliveryFlow',
      default: 'DeliveryBookingFlow',
    },
    package: {
      default: 'PackageBookingFlow',
    },
  };

  return flowMap[serviceStyle]?.[serviceType] || flowMap[serviceStyle]?.default || 'CenterBookingFlow';
}

