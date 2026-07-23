'use client';

import { Badge } from '@warmpawz/ui';
import type { PlatformStatus } from '@/lib/warmpawz-pay-merchants-admin';

const VARIANTS: Record<
  PlatformStatus,
  string
> = {
  Approved: 'bg-green-100 text-green-800 hover:bg-green-100',
  Pending: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  Suspended: 'bg-red-100 text-red-800 hover:bg-red-100',
  Inactive: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
  Deleted: 'bg-gray-200 text-gray-600 hover:bg-gray-200',
};

export interface PlatformStatusBadgeProps {
  readonly status: PlatformStatus;
}

export function PlatformStatusBadge({ status }: PlatformStatusBadgeProps) {
  return (
    <Badge className={VARIANTS[status]} aria-label={`Platform status ${status}`}>
      {status}
    </Badge>
  );
}
