'use client';

import { WarmpawzAppointmentsVendorList } from '@/components/customer/warmpawz-appointments/WarmpawzAppointmentsVendorList';
import type { WapptDiscoveryListStyle } from '@/lib/warmpawz-appointments/wappt-list-style-config';

type WarmpawzAppointmentsDiscoveryProps = {
  category: string;
  initialServiceStyle?: WapptDiscoveryListStyle;
  lockStyleFilter?: boolean;
  profileBackScreen?: string;
  specialization?: string;
  listSubtitleOverride?: string;
  phone: string;
  onBack: () => void;
  onGoHome: () => void;
  onNavigate: (screen: string, data?: Record<string, unknown>) => void;
};

export function WarmpawzAppointmentsDiscovery({
  category,
  initialServiceStyle,
  lockStyleFilter,
  profileBackScreen = 'wappt-discovery',
  specialization,
  listSubtitleOverride,
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
      profileBackScreen={profileBackScreen}
      specialization={specialization}
      listSubtitleOverride={listSubtitleOverride}
      onBack={onBack}
      onGoHome={onGoHome}
      onNavigate={onNavigate}
    />
  );
}
