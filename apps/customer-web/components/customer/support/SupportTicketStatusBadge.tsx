"use client";

import { AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/components/ui/utils';

function statusPillClass(status: string): string {
  switch (status) {
    case 'open':
      return 'bg-yellow-100 text-yellow-700';
    case 'in_progress':
      return 'bg-blue-100 text-blue-700';
    case 'resolved':
      return 'bg-green-100 text-green-700';
    case 'closed':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function StatusGlyph({ status }: { status: string }) {
  switch (status) {
    case 'open':
      return <AlertCircle className="w-4 h-4" />;
    case 'in_progress':
      return <Clock className="w-4 h-4" />;
    case 'resolved':
    case 'closed':
      return <CheckCircle className="w-4 h-4" />;
    default:
      return <Clock className="w-4 h-4" />;
  }
}

export interface SupportTicketStatusBadgeProps {
  status: string;
  className?: string;
}

export function SupportTicketStatusBadge({ status, className }: SupportTicketStatusBadgeProps) {
  const normalized = (status || 'open').replace('_', ' ');
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        statusPillClass(status || 'open'),
        className
      )}
    >
      <StatusGlyph status={status || 'open'} />
      {normalized}
    </span>
  );
}
