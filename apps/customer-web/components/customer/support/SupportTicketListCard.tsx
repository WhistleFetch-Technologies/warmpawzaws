"use client";

import { Calendar, ChevronRight, Tag } from 'lucide-react';
import { SupportTicketStatusBadge } from './SupportTicketStatusBadge';
import { SupportTicketCategoryBadge } from './SupportTicketCategoryBadge';
import { supportTicketCategoryLabel } from '@/lib/support-ticket-categories';
import {
  formatTicketDate,
  formatTicketDisplayId,
  resolveTicketCategory,
} from './support-ticket-ui-utils';

export interface SupportTicketListItem {
  id: string;
  ticket_number?: string;
  subject: string;
  message?: string;
  status: string;
  category?: string;
  created_at: string;
  booking_id?: string;
  metadata?: Record<string, unknown>;
}

interface SupportTicketListCardProps {
  ticket: SupportTicketListItem;
  onOpen: () => void;
}

export function SupportTicketListCard({ ticket, onOpen }: SupportTicketListCardProps) {
  const categoryKind = resolveTicketCategory(ticket);
  const preview = (ticket.message || '').trim();

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left rounded-2xl border border-[#F1F5F9] bg-white p-3 shadow-[0_1px_4px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-md active:scale-[0.995]"
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <SupportTicketStatusBadge status={ticket.status} />
            <SupportTicketCategoryBadge kind={categoryKind} />
            <span className="text-[10px] text-gray-400 font-mono truncate">
              {formatTicketDisplayId(ticket)}
            </span>
          </div>

          <h4 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 pr-6">
            {ticket.subject}
          </h4>

          {preview ? (
            <p className="text-xs text-gray-500 line-clamp-2">{preview}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-400">
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatTicketDate(ticket.created_at)}
            </span>
            {ticket.category ? (
              <span className="inline-flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {supportTicketCategoryLabel(ticket.category)}
              </span>
            ) : null}
          </div>

          <p className="text-xs font-medium text-[#FF8C42]">Tap to open and reply</p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-300 shrink-0 mt-1" aria-hidden />
      </div>
    </button>
  );
}
