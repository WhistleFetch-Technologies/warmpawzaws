"use client";

import { RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SupportTicketMessageBubble } from './SupportTicketMessageBubble';
import type { SupportTicketResponseRow } from './types';

export interface SupportTicketMessagesProps {
  initialMessage?: string | null;
  initialCreatedAt?: string | null;
  responses: SupportTicketResponseRow[];
  /** Re-fetch ticket thread from parent (e.g. `getTicket`) when the user taps Refresh. */
  onRefresh?: () => void | Promise<void>;
}

export function SupportTicketMessages({
  initialMessage,
  initialCreatedAt,
  responses,
  onRefresh,
}: SupportTicketMessagesProps) {
  const hasInitial =
    initialMessage != null && String(initialMessage).trim().length > 0;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-gray-700">Messages</h4>
        {onRefresh ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => void onRefresh()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        ) : null}
      </div>
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
