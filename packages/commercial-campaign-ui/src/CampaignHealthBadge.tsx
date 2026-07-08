'use client';

import {
  CAMPAIGN_HEALTH_COLORS,
  type CampaignHealthStatus,
} from './types';

export function CampaignHealthBadge({
  status,
  className = '',
}: {
  status: CampaignHealthStatus;
  className?: string;
}) {
  const label =
    status === 'healthy' ? 'Healthy' : status === 'warning' ? 'Warning' : 'Critical';
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CAMPAIGN_HEALTH_COLORS[status]} ${className}`}
      title={label}
    >
      {label}
    </span>
  );
}
