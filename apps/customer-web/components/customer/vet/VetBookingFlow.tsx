"use client";

import { VetBookingRouter } from './VetBookingRouter';

interface VetBookingFlowProps {
  phone: string;
  serviceType?: string;
  vendorId?: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

export function VetBookingFlow({ phone, serviceType, vendorId, onBack, onNavigate }: VetBookingFlowProps) {
  // Delegate to VetBookingRouter which has the full implementation
  return (
    <VetBookingRouter
      phone={phone}
      doctorId={vendorId}
      serviceType={serviceType}
      onBack={onBack}
      onNavigate={onNavigate}
    />
  );
}
