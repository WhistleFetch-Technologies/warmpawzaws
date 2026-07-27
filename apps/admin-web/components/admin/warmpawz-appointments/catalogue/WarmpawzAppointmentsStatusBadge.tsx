'use client';

import { Badge } from '@warmpawz/ui';
import type { WarmpawzAppointmentsStatus } from '@/lib/warmpawz-appointments-merchant-types';

const VARIANTS: Record<WarmpawzAppointmentsStatus, string> = {
  Draft: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  Published: 'bg-green-100 text-green-800 hover:bg-green-100',
  Hidden: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
};

export interface WarmpawzAppointmentsStatusBadgeProps {
  readonly status: WarmpawzAppointmentsStatus;
}

export function WarmpawzAppointmentsStatusBadge({ status }: WarmpawzAppointmentsStatusBadgeProps) {
  return (
    <Badge className={VARIANTS[status]} aria-label={`Warmpawz Appointments status ${status}`}>
      {status}
    </Badge>
  );
}
