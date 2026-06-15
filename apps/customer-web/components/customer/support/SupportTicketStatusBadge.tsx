"use client";

import { AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/components/ui/utils';
import {
  formatTicketStatusLabel,
  statusBadgeClasses,
} from './support-ticket-ui-utils';

function StatusGlyph({ status }: { status: string }) {
  switch (status) {
    case 'open':
    case 'in_progress':
    case 'assigned':
    case 'waiting_for_customer':
      return <AlertCircle className="w-3 h-3" />;
    case 'awaiting_assignment':
    case 'ai_acknowledged':
      return <Clock className="w-3 h-3" />;
    case 'resolved':
    case 'closed':
      return <CheckCircle className="w-3 h-3" />;
    default:
      return <Clock className="w-3 h-3" />;
  }
}

export interface SupportTicketStatusBadgeProps {
  status: string;
  className?: string;
}

export function SupportTicketStatusBadge({ status, className }: SupportTicketStatusBadgeProps) {
  const normalized = status || 'open';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide',
        statusBadgeClasses(normalized),
        className
      )}
    >
      <StatusGlyph status={normalized} />
      {formatTicketStatusLabel(normalized)}
    </span>
  );
}
