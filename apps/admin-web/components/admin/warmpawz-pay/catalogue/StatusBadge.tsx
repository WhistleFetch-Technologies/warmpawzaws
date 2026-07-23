'use client';

import { Badge } from '@warmpawz/ui';
import type { PublishStatus } from '@/lib/warmpawz-pay-catalogue-admin';

const STATUS_LABELS: Record<PublishStatus, string> = {
  draft: 'Draft',
  published: 'Published',
};

const STATUS_VARIANT: Record<PublishStatus, 'secondary' | 'default'> = {
  draft: 'secondary',
  published: 'default',
};

export interface StatusBadgeProps {
  readonly status: PublishStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className="capitalize">
      {STATUS_LABELS[status]}
    </Badge>
  );
}
