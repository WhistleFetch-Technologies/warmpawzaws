"use client";

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/utils';
import { SupportTicketMessages } from './SupportTicketMessages';
import { SupportTicketReplyComposer } from './SupportTicketReplyComposer';
import { SupportTicketSummaryHeader } from './SupportTicketSummaryHeader';
import type { SupportTicketDetailBundle } from './types';

export interface SupportTicketDetailViewProps {
  loadingInitial: boolean;
  detail: SupportTicketDetailBundle | null;
  replyText: string;
  onReplyTextChange: (value: string) => void;
  sendingReply: boolean;
  onSendReply: () => void;
  onBack: () => void;
  /** Passed to message list: user taps Refresh to reload `GET /support/tickets/:id`. */
  onMessagesRefresh?: () => void | Promise<void>;
  /**
   * Set when the view sits in a fixed-height shell (e.g. messages inbox sheet with `overflow-hidden`).
   * Uses flex + internal scrolling so the reply composer stays visible like vendor chat.
   */
  embeddedInModal?: boolean;
}

export function SupportTicketDetailView({
  loadingInitial,
  detail,
  replyText,
  onReplyTextChange,
  sendingReply,
  onSendReply,
  onBack,
  onMessagesRefresh,
  embeddedInModal = false,
}: SupportTicketDetailViewProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4',
        embeddedInModal && 'h-full min-h-0 overflow-hidden'
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0 gap-2 -ml-2 text-gray-700"
        onClick={onBack}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to My Tickets
      </Button>

      {loadingInitial && !detail ? (
        <Card className="p-8 text-center">
          <div className="w-8 h-8 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Loading conversation…</p>
        </Card>
      ) : null}

      {detail ? (
        <>
          <div className="shrink-0">
            <SupportTicketSummaryHeader
              status={String(detail.ticket.status || 'open')}
              ticketNumber={
                detail.ticket.ticket_number != null
                  ? String(detail.ticket.ticket_number)
                  : null
              }
              subject={String(detail.ticket.subject || 'Support')}
            />
          </div>
          <SupportTicketMessages
            initialMessage={
              detail.ticket.message != null ? String(detail.ticket.message) : null
            }
            initialCreatedAt={
              detail.ticket.created_at != null ? String(detail.ticket.created_at) : null
            }
            responses={detail.responses}
            onRefresh={onMessagesRefresh}
            fillAvailable={embeddedInModal}
          />
          <SupportTicketReplyComposer
            value={replyText}
            onChange={onReplyTextChange}
            sending={sendingReply}
            onSend={onSendReply}
            compact={embeddedInModal}
          />
        </>
      ) : null}
    </div>
  );
}
