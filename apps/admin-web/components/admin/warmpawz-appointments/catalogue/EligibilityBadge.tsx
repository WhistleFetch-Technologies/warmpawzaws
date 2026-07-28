'use client';

import { Badge } from '@warmpawz/ui';

export interface EligibilityBadgeProps {
  readonly customerVisible: boolean;
}

export function EligibilityBadge({ customerVisible }: EligibilityBadgeProps) {
  if (customerVisible) {
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
        Visible
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="bg-amber-100 text-amber-900 hover:bg-amber-100">
      Hidden
    </Badge>
  );
}
