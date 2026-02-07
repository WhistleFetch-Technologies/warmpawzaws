"use client";

import { TrainerBookingRouter } from './TrainerBookingRouter';

interface TrainerBookingFlowProps {
  phone: string;
  serviceType?: string;
  vendorId?: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

export function TrainerBookingFlow({ phone, serviceType, vendorId, onBack, onNavigate }: TrainerBookingFlowProps) {
  // Delegate to TrainerBookingRouter which has the full implementation
  return (
    <TrainerBookingRouter
      phone={phone}
      doctorId={vendorId}
      serviceType={serviceType}
      onBack={onBack}
      onNavigate={onNavigate}
    />
  );
}
