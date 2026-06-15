"use client";

import { Calendar, Tag } from 'lucide-react';
import { SupportTicketStatusBadge } from './SupportTicketStatusBadge';
import { SupportTicketCategoryBadge } from './SupportTicketCategoryBadge';
import {
  formatMessageTimestamp,
  formatTicketDisplayId,
  resolveTicketCategory,
} from './support-ticket-ui-utils';

export interface SupportTicketSummaryHeaderProps {
  status: string;
  ticketNumber?: string | null;
  ticketId?: string;
  subject: string;
  createdAt?: string | null;
  category?: string | null;
  bookingId?: string;
  metadata?: Record<string, unknown>;
}

export function SupportTicketSummaryHeader({
  status,
  ticketNumber,
  ticketId,
  subject,
  createdAt,
  category,
  bookingId,
  metadata,
}: SupportTicketSummaryHeaderProps) {
  const categoryKind = resolveTicketCategory({
    booking_id: bookingId,
    category: category || undefined,
    metadata,
  });

  return (
    <div className="space-y-2 pb-1">
      <h3 className="font-semibold text-gray-900 text-base leading-snug">{subject || 'Support'}</h3>
      <div className="flex flex-wrap items-center gap-1.5">
        <SupportTicketStatusBadge status={status || 'open'} />
        <SupportTicketCategoryBadge kind={categoryKind} />
        <span className="text-[10px] text-gray-400 font-mono">
          {formatTicketDisplayId({
            ticket_number: ticketNumber || undefined,
            id: ticketId || ticketNumber || '—',
          })}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-400">
        {createdAt ? (
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatMessageTimestamp(createdAt)}
          </span>
        ) : null}
        {category ? (
          <span className="inline-flex items-center gap-1 capitalize">
            <Tag className="w-3 h-3" />
            {category}
          </span>
        ) : null}
      </div>
    </div>
  );
}
