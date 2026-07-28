'use client';

import { Badge } from '@warmpawz/ui';
import type { PublishStatus } from '@/lib/warmpawz-appointments-catalogue-admin';

const STATUS_LABELS: Record<PublishStatus, string> = {
  draft: 'Draft',
  published: 'Published',
};

const STATUS_VARIANT: Record<PublishStatus, 'secondary' | 'default'> = {
  draft: 'secondary',
  published: 'default',
};

export interface StatusBadgeProps {
  readonly status: PublishStatus | null;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  if (!status) {
    return (
      <Badge variant="outline" className="text-gray-600">
        Not in catalogue
      </Badge>
    );
  }

  return (
    <Badge variant={STATUS_VARIANT[status]} className="capitalize">
      {STATUS_LABELS[status]}
    </Badge>
  );
}
