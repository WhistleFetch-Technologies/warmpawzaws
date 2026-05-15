"use client";

import { cn } from '@/components/ui/utils';

export type SupportTicketMessageSide = 'customer' | 'support';

export interface SupportTicketMessageBubbleProps {
  label: string;
  body: string;
  createdAt?: string | null;
  side: SupportTicketMessageSide;
}

export function SupportTicketMessageBubble({
  label,
  body,
  createdAt,
  side,
}: SupportTicketMessageBubbleProps) {
  const isCustomer = side === 'customer';

  return (
    <div className={isCustomer ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className={cn(
          'max-w-[90%] rounded-2xl px-3 py-2 border',
          isCustomer
            ? 'rounded-br-md bg-gradient-to-br from-[#FF8C42]/15 to-[#FF6B9D]/10 border-[#FF8C42]/20'
            : 'rounded-bl-md bg-gray-100 border-gray-200'
        )}
      >
        <p
          className={cn(
            'text-xs font-medium mb-1',
            isCustomer ? 'text-[#FF8C42]' : 'text-gray-600'
          )}
        >
          {label}
        </p>
        <p className="text-sm text-gray-900 whitespace-pre-wrap">{body}</p>
        {createdAt ? (
          <p className="text-[10px] text-gray-400 mt-1">
            {new Date(createdAt).toLocaleString()}
          </p>
        ) : null}
      </div>
    </div>
  );
}
