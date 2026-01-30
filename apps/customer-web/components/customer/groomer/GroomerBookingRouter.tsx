"use client";

import React from 'react';
import { UniversalBookingRouter } from '../shared/UniversalBookingRouter';

// ============================================================================
// GROOMER BOOKING ROUTER (Wrapper)
// ============================================================================

interface GroomerBookingRouterProps {
  phone: string;
  doctorId?: string;
  vendorId?: string; // ✅ FIX: Add vendorId to support center/vendor context
  clinicId?: string; // ✅ FIX: Add clinicId for center bookings
  doctor?: any;
  selectedService?: any; // Service object with id, name, price, etc.
  serviceType?: string;
  serviceId?: string; // ✅ FIX: Add serviceId to handle specific service selection
  serviceName?: string; // ✅ FIX: Add serviceName
  serviceStyle?: string; // ✅ FIX: Add serviceStyle to preserve context
  price?: number; // ✅ FIX: Add price
  duration?: number; // ✅ FIX: Add duration
  selectedServices?: any[]; // ✅ NEW: Multiple selected services from center profile
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  onViewBooking?: (bookingId: string) => void;
}

export function GroomerBookingRouter({ 
  phone, 
  doctorId, 
  vendorId,
  clinicId,
  doctor, 
  selectedService, 
  serviceType,
  serviceId,
  serviceName,
  serviceStyle,
  price,
  duration,
  selectedServices, // ✅ NEW: Multiple selected services
  onBack, 
  onNavigate, 
  onViewBooking 
}: GroomerBookingRouterProps) {
  return (
    <UniversalBookingRouter
      roleId="groomer"
      phone={phone}
      doctorId={doctorId}
      vendorId={vendorId}
      clinicId={clinicId}
      doctor={doctor}
      selectedService={selectedService}
      serviceType={serviceType}
      serviceId={serviceId}
      serviceName={serviceName}
      serviceStyle={serviceStyle}
      price={price}
      duration={duration}
      selectedServices={selectedServices}
      onBack={onBack}
      onNavigate={onNavigate}
      onViewBooking={onViewBooking}
    />
  );
}
