"use client";

import { RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/utils';
import { SupportTicketMessageBubble } from './SupportTicketMessageBubble';
import type { SupportTicketResponseRow } from './types';

export interface SupportTicketMessagesProps {
  initialMessage?: string | null;
  initialCreatedAt?: string | null;
  responses: SupportTicketResponseRow[];
  /** Re-fetch ticket thread from parent (e.g. `getTicket`) when the user taps Refresh. */
  onRefresh?: () => void | Promise<void>;
  /**
   * When true, the thread list grows to fill remaining space in a flex parent (e.g. messages modal)
   * and scrolls internally. When false, uses a capped height so long threads scroll inside the card on normal pages.
   */
  fillAvailable?: boolean;
}

export function SupportTicketMessages({
  initialMessage,
  initialCreatedAt,
  responses,
  onRefresh,
  fillAvailable = false,
}: SupportTicketMessagesProps) {
  const hasInitial =
    initialMessage != null && String(initialMessage).trim().length > 0;

  return (
    <Card
      className={cn(
        'p-4',
        fillAvailable && 'flex min-h-0 flex-1 flex-col'
      )}
    >
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
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
      <div
        className={cn(
          'space-y-3 overflow-y-auto pr-1',
          fillAvailable
            ? 'min-h-0 flex-1 overscroll-contain'
            : 'max-h-[min(50vh,420px)]'
        )}
      >
        {hasInitial ? (
          <SupportTicketMessageBubble
            side="customer"
            label="You"
            body={String(initialMessage)}
            createdAt={initialCreatedAt != null ? String(initialCreatedAt) : null}
          />
        ) : null}
        {responses.map((r, idx) => {
          const responder = String(r.responder_type || '').toLowerCase();
          const isCustomer = responder === 'customer';
          const isSystemAi = responder === 'system_ai';
          return (
            <SupportTicketMessageBubble
              key={String(r.id || r.created_at || idx)}
              side={isCustomer ? 'customer' : 'support'}
              label={isCustomer ? 'You' : isSystemAi ? 'Warmpawz Support' : 'Support'}
              body={String(r.message || '')}
              createdAt={r.created_at != null ? String(r.created_at) : null}
            />
          );
        })}
      </div>
    </Card>
  );
}
