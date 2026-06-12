"use client";

import { useMemo, useState } from 'react';
import { ChevronDown, MessageCircle, Plus, RefreshCw, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SupportTicketListCard, type SupportTicketListItem } from './SupportTicketListCard';
import {
  matchesTicketFilter,
  type TicketFilterValue,
} from './support-ticket-ui-utils';

const FILTER_OPTIONS: { value: TicketFilterValue; label: string }[] = [
  { value: 'all', label: 'All Tickets' },
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
  { value: 'booking', label: 'Booking' },
  { value: 'general', label: 'General' },
];

interface SupportTicketsListTabProps {
  tickets: SupportTicketListItem[];
  loading: boolean;
  onRefresh: () => void;
  onCreateTicket: () => void;
  onOpenTicket: (ticketId: string) => void;
}

export function SupportTicketsListTab({
  tickets,
  loading,
  onRefresh,
  onCreateTicket,
  onOpenTicket,
}: SupportTicketsListTabProps) {
  const [filter, setFilter] = useState<TicketFilterValue>('all');

  const filtered = useMemo(
    () => tickets.filter((t) => matchesTicketFilter(t, filter)),
    [tickets, filter]
  );

  const filterLabel =
    FILTER_OPTIONS.find((o) => o.value === filter)?.label ?? 'All Tickets';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={onRefresh}
          className="h-9 px-3 rounded-xl border-gray-200 text-gray-700 shrink-0 gap-1.5 text-xs font-medium"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={onCreateTicket}
          className="flex-1 h-9 rounded-xl bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white gap-1.5 text-xs font-semibold shadow-sm min-w-0"
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/25 shrink-0">
            <Plus className="w-3 h-3" />
          </span>
          <span className="truncate">Create New Ticket</span>
        </Button>

        <div className="relative shrink-0">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as TicketFilterValue)}
            aria-label="Filter tickets"
            className="h-9 appearance-none rounded-xl border border-gray-200 bg-white pl-3 pr-8 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#FF8C42]/30"
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        </div>
      </div>

      {loading && tickets.length === 0 ? (
        <div className="rounded-2xl border border-[#F1F5F9] bg-white p-10 text-center">
          <div className="w-8 h-8 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading your tickets…</p>
        </div>
      ) : null}

      {!loading && tickets.length === 0 ? (
        <div className="rounded-2xl border border-[#F1F5F9] bg-white p-10 text-center shadow-[0_1px_4px_rgba(15,23,42,0.04)]">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF3E8]">
            <Ticket className="w-7 h-7 text-[#FF8C42]" />
          </div>
          <h3 className="text-base font-semibold text-gray-900">No Tickets Yet</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
            You haven&apos;t created any support tickets.
          </p>
          <Button
            type="button"
            onClick={onCreateTicket}
            className="mt-5 h-10 px-5 rounded-xl bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white text-sm font-medium"
          >
            Create New Ticket
          </Button>
        </div>
      ) : null}

      {!loading && tickets.length > 0 && filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#F1F5F9] bg-white p-8 text-center">
          <MessageCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No tickets match &ldquo;{filterLabel}&rdquo;</p>
        </div>
      ) : null}

      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((ticket) => (
            <SupportTicketListCard
              key={ticket.id}
              ticket={ticket}
              onOpen={() => onOpenTicket(ticket.id)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
