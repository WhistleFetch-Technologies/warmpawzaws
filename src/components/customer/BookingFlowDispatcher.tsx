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

export function BookingFlowDispatcher({
  serviceType,
  serviceStyle,
  vendorId,
  vendorName,
  vendorType = 'center',
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

  // ✅ ENHANCEMENT: Render appropriate booking flow component based on service style and type
  switch (serviceStyle) {
    case 'at_center':
      // Center booking flow (Clinic / Grooming / Diagnostics)
      if (serviceType === 'vet') {
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
      if (serviceType === 'vet') {
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
      if (serviceType === 'vet') {
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
      // ✅ NEW: DeliveryBookingFlow component
      const deliveryServiceType = serviceType === 'pharmacy' ? 'pharmacy' : 
                                   serviceType === 'nutritionist' ? 'meals' : 
                                   'products';
      
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

