'use client';

import { Badge } from '@warmpawz/ui';
import type { MerchantReadiness } from '@/lib/warmpawz-appointments-merchant-types';
import { formatReadinessScore } from '@/lib/warmpawz-appointments-merchant-types';

export interface ReadinessIndicatorProps {
  readonly readiness: MerchantReadiness;
}

export function ReadinessIndicator({ readiness }: ReadinessIndicatorProps) {
  const score = formatReadinessScore(readiness);
  const ready = readiness.readyForAppointments;

  return (
    <Badge
      className={
        ready
          ? 'bg-green-100 text-green-800 hover:bg-green-100'
          : 'bg-amber-100 text-amber-900 hover:bg-amber-100'
      }
      aria-label={`Readiness ${score}${ready ? ', ready for appointments' : ', blocked'}`}
    >
      {score}
    </Badge>
  );
}
