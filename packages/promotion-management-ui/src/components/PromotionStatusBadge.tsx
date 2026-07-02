'use client';

import type { VisualLifecycle } from '../types';
import { LIFECYCLE_COLORS, LIFECYCLE_LABELS } from '../lifecycle';

export function PromotionStatusBadge({
  status,
  className = '',
}: {
  status: VisualLifecycle;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${LIFECYCLE_COLORS[status]} ${className}`}
    >
      {LIFECYCLE_LABELS[status]}
    </span>
  );
}
