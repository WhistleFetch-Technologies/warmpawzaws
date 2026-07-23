'use client';

import type { PricingStatus } from '@/lib/warmpawz-pay-pricing-admin';

export interface PricingStatusBadgeProps {
  readonly status: PricingStatus;
}

export function PricingStatusBadge({ status }: PricingStatusBadgeProps) {
  const isActive = status === 'active';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
      }`}
    >
      {isActive ? 'Active' : 'Disabled'}
    </span>
  );
}
