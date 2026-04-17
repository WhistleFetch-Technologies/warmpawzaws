"use client";

import { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { SupportTicketMessageBubble } from './SupportTicketMessageBubble';
import type { SupportTicketResponseRow } from './types';

const POLL_MS = 5000;

export interface SupportTicketMessagesProps {
  initialMessage?: string | null;
  initialCreatedAt?: string | null;
  responses: SupportTicketResponseRow[];
  /** Re-fetch ticket thread from parent (e.g. `getTicket`) so new agent/customer messages appear. */
  onRefresh?: () => void | Promise<void>;
}

export function SupportTicketMessages({
  initialMessage,
  initialCreatedAt,
  responses,
  onRefresh,
}: SupportTicketMessagesProps) {
  useEffect(() => {
    if (!onRefresh) return;
    const id = window.setInterval(() => {
      void onRefresh();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [onRefresh]);

  const hasInitial =
    initialMessage != null && String(initialMessage).trim().length > 0;

  return (
    <Card className="p-4">
      <h4 className="text-sm font-medium text-gray-700 mb-3">Messages</h4>
      <div className="space-y-3 max-h-[min(50vh,420px)] overflow-y-auto pr-1">
        {hasInitial ? (
          <SupportTicketMessageBubble
            side="customer"
            label="You"
            body={String(initialMessage)}
            createdAt={initialCreatedAt != null ? String(initialCreatedAt) : null}
          />
        ) : null}
        {responses.map((r, idx) => {
          const isCustomer = String(r.responder_type || '').toLowerCase() === 'customer';
          return (
            <SupportTicketMessageBubble
              key={String(r.id || r.created_at || idx)}
              side={isCustomer ? 'customer' : 'support'}
              label={isCustomer ? 'You' : 'Support'}
              body={String(r.message || '')}
              createdAt={r.created_at != null ? String(r.created_at) : null}
            />
          );
        })}
      </div>
    </Card>
  );
}
