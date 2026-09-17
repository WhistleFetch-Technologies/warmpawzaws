'use client';

import type { PromoEngineStatus } from '@/lib/promo-engine/types';
import { ENGINE_STATUS_COLORS, ENGINE_STATUS_LABELS } from '@/lib/promo-engine/status';

export function PromotionEngineStatusBadge({
  status,
  className = '',
}: {
  status: PromoEngineStatus;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ENGINE_STATUS_COLORS[status]} ${className}`}
    >
      {ENGINE_STATUS_LABELS[status]}
    </span>
  );
}
