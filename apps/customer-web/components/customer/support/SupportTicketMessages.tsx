"use client";

import { useMemo } from 'react';
import { cn } from '@/components/ui/utils';
import {
  SupportTicketMessageBubble,
  formatTicketStatusLabel,
} from './SupportTicketMessageBubble';
import type { SupportTicketResponseRow } from './types';

export interface SupportTicketMessagesProps {
  ticketStatus?: string;
  initialMessage?: string | null;
  initialCreatedAt?: string | null;
  responses: SupportTicketResponseRow[];
  fillAvailable?: boolean;
  className?: string;
}

function normalizeMessage(text: unknown): string {
  return String(text || '').trim();
}

function resolveMessageVariant(
  responder: string
): 'customer' | 'ai' | 'agent' {
  const r = responder.toLowerCase();
  if (r === 'customer') return 'customer';
  if (r === 'system_ai') return 'ai';
  return 'agent';
}

function resolveAgentLabel(row: SupportTicketResponseRow): string {
  const name = row.responder_name?.trim();
  if (name) return name;
  return 'Warmpawz Support';
}

export function SupportTicketMessages({
  ticketStatus = 'open',
  initialMessage,
  initialCreatedAt,
  responses,
  fillAvailable = false,
  className,
}: SupportTicketMessagesProps) {
  const statusLabel = formatTicketStatusLabel(ticketStatus);

  const timeline = useMemo(() => {
    const items: Array<{
      key: string;
      variant: 'customer' | 'ai' | 'agent';
      label: string;
      body: string;
      createdAt?: string | null;
      showReadReceipt?: boolean;
    }> = [];

    const initialBody = normalizeMessage(initialMessage);
    if (initialBody) {
      items.push({
        key: 'initial',
        variant: 'customer',
        label: 'You',
        body: initialBody,
        createdAt: initialCreatedAt,
        showReadReceipt: true,
      });
    }

    for (let idx = 0; idx < responses.length; idx++) {
      const row = responses[idx];
      const body = normalizeMessage(row.message);
      if (!body) continue;

      const responder = String(row.responder_type || '').toLowerCase();
      const variant = resolveMessageVariant(responder);

      if (
        variant === 'customer' &&
        initialBody &&
        body.toLowerCase() === initialBody.toLowerCase()
      ) {
        continue;
      }

      items.push({
        key: String(row.id || row.created_at || `r-${idx}`),
        variant,
        label:
          variant === 'customer'
            ? 'You'
            : variant === 'ai'
              ? 'AI Assistant'
              : resolveAgentLabel(row),
        body,
        createdAt: row.created_at,
        showReadReceipt: variant === 'customer',
      });
    }

    return items;
  }, [initialMessage, initialCreatedAt, responses]);

  return (
    <div
      className={cn(
        'space-y-4 overflow-y-auto pr-0.5',
        fillAvailable ? 'min-h-0 flex-1 overscroll-contain' : 'max-h-[min(58vh,520px)]',
        className
      )}
    >
      {timeline.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No messages yet.</p>
      ) : (
        timeline.map((item) => (
          <SupportTicketMessageBubble
            key={item.key}
            variant={item.variant}
            label={item.label}
            body={item.body}
            createdAt={item.createdAt}
            statusLabel={item.variant === 'ai' ? statusLabel : undefined}
            showReadReceipt={item.showReadReceipt}
          />
        ))
      )}
    </div>
  );
}
