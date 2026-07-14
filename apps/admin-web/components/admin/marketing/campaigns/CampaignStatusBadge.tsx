'use client';

import {
  CAMPAIGN_LIFECYCLE_LABELS,
  CAMPAIGN_STATUS_COLORS,
  type CampaignLifecycleStatus,
} from '@/lib/commercial-campaign/types';

export function CampaignStatusBadge({
  status,
  className = '',
}: {
  status: CampaignLifecycleStatus;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CAMPAIGN_STATUS_COLORS[status]} ${className}`}
    >
      {CAMPAIGN_LIFECYCLE_LABELS[status]}
    </span>
  );
}
