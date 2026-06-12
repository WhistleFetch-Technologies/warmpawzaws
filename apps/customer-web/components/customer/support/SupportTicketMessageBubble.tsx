"use client";

import { Bot, CheckCheck, Headphones } from 'lucide-react';
import { cn } from '@/components/ui/utils';
import { formatMessageTimestamp, formatTicketStatusLabel } from './support-ticket-ui-utils';

export type SupportTicketMessageVariant = 'customer' | 'ai' | 'agent';

export interface SupportTicketMessageBubbleProps {
  variant: SupportTicketMessageVariant;
  label: string;
  body: string;
  createdAt?: string | null;
  /** Shown below AI auto-reply body */
  statusLabel?: string;
  showReadReceipt?: boolean;
}

export function SupportTicketMessageBubble({
  variant,
  label,
  body,
  createdAt,
  statusLabel,
  showReadReceipt = false,
}: SupportTicketMessageBubbleProps) {
  const isCustomer = variant === 'customer';
  const isAi = variant === 'ai';

  if (isCustomer) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%]">
          <p className="text-xs font-medium text-[#FF8C42] mb-1 text-right">{label}</p>
          <div className="rounded-2xl rounded-br-md bg-[#FFF3E8] px-3 py-2.5">
            <p className="text-sm text-gray-900 whitespace-pre-wrap">{body}</p>
            <div className="mt-1.5 flex items-center justify-end gap-1.5">
              {createdAt ? (
                <span className="text-[10px] text-gray-400">{formatMessageTimestamp(createdAt)}</span>
              ) : null}
              {showReadReceipt ? (
                <CheckCheck className="w-3.5 h-3.5 text-[#FF8C42]" aria-label="Sent" />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start gap-2">
      <div
        className={cn(
          'shrink-0 flex h-8 w-8 items-center justify-center rounded-full',
          isAi ? 'bg-blue-100 text-blue-600' : 'bg-[#FFF3E8] text-[#FF8C42]'
        )}
      >
        {isAi ? <Bot className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
      </div>
      <div className="max-w-[88%] min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          <p className={cn('text-xs font-semibold', isAi ? 'text-blue-600' : 'text-[#FF8C42]')}>
            {label}
          </p>
          {isAi ? (
            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
              Auto-reply
            </span>
          ) : null}
        </div>
        <div
          className={cn(
            'rounded-2xl rounded-bl-md px-3 py-2.5 border',
            isAi
              ? 'bg-blue-50 border-blue-100'
              : 'bg-white border-gray-200'
          )}
        >
          <p className="text-sm text-gray-900 whitespace-pre-wrap">{body}</p>
          {isAi && statusLabel ? (
            <div className="mt-2 border-t border-blue-100 pt-2">
              <p className="text-xs text-blue-600">
                Status: {statusLabel}
              </p>
            </div>
          ) : null}
          {createdAt ? (
            <p className="text-[10px] text-gray-400 mt-1.5">{formatMessageTimestamp(createdAt)}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export { formatTicketStatusLabel };
