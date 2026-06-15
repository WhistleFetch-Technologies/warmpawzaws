"use client";

import { cn } from '@/components/ui/utils';
import {
  categoryBadgeClasses,
  categoryLabel,
  type TicketCategoryKind,
} from './support-ticket-ui-utils';

export function SupportTicketCategoryBadge({
  kind,
  className,
}: {
  kind: TicketCategoryKind;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide',
        categoryBadgeClasses(kind),
        className
      )}
    >
      {categoryLabel(kind)}
    </span>
  );
}
