'use client';

import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { UniversalServicesByStyle } from '@/components/customer/shared/UniversalServicesByStyle';
import type { RoleId } from '@/components/customer/shared/roleConfig';
import type { WapptStyleFilter } from '@/hooks/useWarmpawzAppointmentsByCategoryFeed';
import { getWarmpawzAppointmentBookingTitle } from '@/lib/warmpawz-appointments-customer';

const STYLE_FILTERS: { id: WapptStyleFilter; label: string }[] = [
  { id: 'all', label: 'View all' },
  { id: 'at_center', label: 'At centre' },
  { id: 'at_home', label: 'At home' },
];

const CATEGORY_ROLE: Record<string, RoleId> = {
  vet: 'veterinarian',
  grooming: 'groomer',
  training: 'trainer',
};

const CATEGORY_BOOKING_SCREEN: Record<string, string> = {
  vet: 'vet-booking',
  grooming: 'grooming-booking',
  training: 'training-booking',
};

type WarmpawzAppointmentsDiscoveryProps = {
  category: string;
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: Record<string, unknown>) => void;
};

export function WarmpawzAppointmentsDiscovery({
  category,
  phone,
  onBack,
  onNavigate,
}: WarmpawzAppointmentsDiscoveryProps) {
  const [styleFilter, setStyleFilter] = useState<WapptStyleFilter>('all');
  const roleId = CATEGORY_ROLE[category] ?? 'veterinarian';
  const { title, subtitle } = getWarmpawzAppointmentBookingTitle(category);
  const listServiceStyle = styleFilter === 'at_home' ? 'at_home' : 'at_center';

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <div className="sticky top-0 z-10 border-b bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="rounded-full p-2 hover:bg-gray-100">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900">{title}</h1>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {STYLE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStyleFilter(f.id)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                styleFilter === f.id
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <UniversalServicesByStyle
        phone={phone}
        roleId={roleId}
        serviceStyle={listServiceStyle}
        category={category}
        appointmentsMode
        wapptStyleFilter={styleFilter}
        profileBackScreen="wappt-discovery"
        onBack={onBack}
        onNavigate={onNavigate}
        bookingScreen={CATEGORY_BOOKING_SCREEN[category] ?? 'grooming-booking'}
      />
    </div>
  );
}
