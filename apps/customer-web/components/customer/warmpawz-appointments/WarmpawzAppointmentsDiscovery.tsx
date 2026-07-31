'use client';

import { WarmpawzAppointmentsVendorList } from '@/components/customer/warmpawz-appointments/WarmpawzAppointmentsVendorList';
import type { WapptDiscoveryListStyle } from '@/lib/warmpawz-appointments/wappt-list-style-config';

type WarmpawzAppointmentsDiscoveryProps = {
  category: string;
  initialServiceStyle?: WapptDiscoveryListStyle;
  lockStyleFilter?: boolean;
  phone: string;
  onBack: () => void;
  onGoHome: () => void;
  onNavigate: (screen: string, data?: Record<string, unknown>) => void;
};

export function WarmpawzAppointmentsDiscovery({
  category,
  initialServiceStyle,
  lockStyleFilter,
  phone: _phone,
  onBack,
  onGoHome,
  onNavigate,
}: WarmpawzAppointmentsDiscoveryProps) {
  return (
    <WarmpawzAppointmentsVendorList
      category={category}
      initialServiceStyle={initialServiceStyle}
      lockStyleFilter={lockStyleFilter}
      onBack={onBack}
      onGoHome={onGoHome}
      onNavigate={onNavigate}
    />
  );
}
