"use client";

import { GroomerBookingRouter } from './GroomerBookingRouter';

interface GroomerBookingFlowProps {
  phone: string;
  serviceType?: string;
  vendorId?: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

export function GroomerBookingFlow({ phone, serviceType, vendorId, onBack, onNavigate }: GroomerBookingFlowProps) {
  // Delegate to GroomerBookingRouter which has the full implementation
  return (
    <GroomerBookingRouter
      phone={phone}
      doctorId={vendorId}
      serviceType={serviceType}
      onBack={onBack}
      onNavigate={onNavigate}
    />
  );
}
