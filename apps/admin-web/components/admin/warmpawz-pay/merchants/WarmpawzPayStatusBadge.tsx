'use client';

import { Badge } from '@warmpawz/ui';
import type { WarmpawzPayStatus } from '@/lib/warmpawz-pay-merchants-admin';

const VARIANTS: Record<WarmpawzPayStatus, string> = {
  Draft: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  Published: 'bg-green-100 text-green-800 hover:bg-green-100',
  Hidden: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
};

export interface WarmpawzPayStatusBadgeProps {
  readonly status: WarmpawzPayStatus;
}

export function WarmpawzPayStatusBadge({ status }: WarmpawzPayStatusBadgeProps) {
  return (
    <Badge className={VARIANTS[status]} aria-label={`Warmpawz Pay status ${status}`}>
      {status}
    </Badge>
  );
}
