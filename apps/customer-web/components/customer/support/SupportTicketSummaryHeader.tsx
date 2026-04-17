"use client";

import { Card } from '@/components/ui/card';
import { SupportTicketStatusBadge } from './SupportTicketStatusBadge';

export interface SupportTicketSummaryHeaderProps {
  status: string;
  ticketNumber?: string | null;
  subject: string;
  pollHint?: string;
}

export function SupportTicketSummaryHeader({
  status,
  ticketNumber,
  subject,
  pollHint = 'New messages appear automatically every few seconds.',
}: SupportTicketSummaryHeaderProps) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <SupportTicketStatusBadge status={status || 'open'} />
        {ticketNumber != null && String(ticketNumber).trim() !== '' ? (
          <span className="text-xs text-gray-400">{String(ticketNumber)}</span>
        ) : null}
      </div>
      <h3 className="font-semibold text-gray-900 text-lg">{subject || 'Support'}</h3>
      <p className="text-xs text-gray-400 mt-1">{pollHint}</p>
    </Card>
  );
}
