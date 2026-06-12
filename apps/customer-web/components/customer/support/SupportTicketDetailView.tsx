"use client";

import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/utils';
import { SupportTicketMessages } from './SupportTicketMessages';
import { SupportTicketReplyComposer } from './SupportTicketReplyComposer';
import { SupportTicketSummaryHeader } from './SupportTicketSummaryHeader';
import type { SupportTicketDetailBundle } from './types';
import type { SupportAttachment } from '@/lib/support-attachment-upload';

export interface SupportTicketDetailViewProps {
  loadingInitial: boolean;
  detail: SupportTicketDetailBundle | null;
  replyText: string;
  onReplyTextChange: (value: string) => void;
  sendingReply: boolean;
  onSendReply: (attachments?: SupportAttachment[]) => void;
  replyAttachments?: SupportAttachment[];
  onReplyAttachmentsChange?: (attachments: SupportAttachment[]) => void;
  onBack: () => void;
  onMessagesRefresh?: () => void | Promise<void>;
  embeddedInModal?: boolean;
}

export function SupportTicketDetailView({
  loadingInitial,
  detail,
  replyText,
  onReplyTextChange,
  sendingReply,
  onSendReply,
  replyAttachments = [],
  onReplyAttachmentsChange,
  onBack,
  onMessagesRefresh,
  embeddedInModal = false,
}: SupportTicketDetailViewProps) {
  const ticket = detail?.ticket;

  return (
    <div
      className={cn(
        'flex flex-col flex-1 min-h-0 overflow-hidden',
        !embeddedInModal && 'min-h-[min(72dvh,640px)]'
      )}
    >
      <div className="shrink-0 space-y-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-[#FF8C42] -ml-0.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to My Tickets
          </button>
          {onMessagesRefresh ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-xl border-gray-200 text-xs"
              onClick={() => void onMessagesRefresh()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          ) : null}
        </div>

        {loadingInitial && !detail ? (
          <div className="py-12 text-center">
            <div className="w-8 h-8 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading conversation…</p>
          </div>
        ) : null}

        {ticket ? (
          <SupportTicketSummaryHeader
            status={String(ticket.status || 'open')}
            ticketNumber={
              ticket.ticket_number != null ? String(ticket.ticket_number) : null
            }
            ticketId={ticket.id != null ? String(ticket.id) : undefined}
            subject={String(ticket.subject || 'Support')}
            createdAt={
              ticket.created_at != null ? String(ticket.created_at) : null
            }
            category={ticket.category != null ? String(ticket.category) : null}
            bookingId={
              ticket.booking_id != null ? String(ticket.booking_id) : undefined
            }
            metadata={
              ticket.metadata != null && typeof ticket.metadata === 'object'
                ? (ticket.metadata as Record<string, unknown>)
                : undefined
            }
          />
        ) : null}
      </div>

      {detail ? (
        <>
          <SupportTicketMessages
            ticketStatus={String(detail.ticket.status || 'open')}
            initialMessage={
              detail.ticket.message != null ? String(detail.ticket.message) : null
            }
            initialCreatedAt={
              detail.ticket.created_at != null
                ? String(detail.ticket.created_at)
                : null
            }
            responses={detail.responses}
            fillAvailable
            className={embeddedInModal ? undefined : 'flex-1 min-h-[200px]'}
          />
          <SupportTicketReplyComposer
            value={replyText}
            onChange={onReplyTextChange}
            sending={sendingReply}
            onSend={onSendReply}
            attachments={replyAttachments}
            onAttachmentsChange={onReplyAttachmentsChange}
          />
        </>
      ) : null}
    </div>
  );
}
