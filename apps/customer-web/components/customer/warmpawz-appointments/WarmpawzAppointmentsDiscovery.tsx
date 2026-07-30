'use client';

import { WarmpawzAppointmentsVendorList } from '@/components/customer/warmpawz-appointments/WarmpawzAppointmentsVendorList';

type WarmpawzAppointmentsDiscoveryProps = {
  category: string;
  phone: string;
  onBack: () => void;
  onGoHome: () => void;
  onNavigate: (screen: string, data?: Record<string, unknown>) => void;
};

export function WarmpawzAppointmentsDiscovery({
  category,
  phone: _phone,
  onBack,
  onGoHome,
  onNavigate,
}: WarmpawzAppointmentsDiscoveryProps) {
  return (
    <WarmpawzAppointmentsVendorList
      category={category}
      onBack={onBack}
      onGoHome={onGoHome}
      onNavigate={onNavigate}
    />
  );
}
