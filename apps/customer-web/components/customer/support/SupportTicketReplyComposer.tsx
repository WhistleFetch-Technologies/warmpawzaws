"use client";

import { useCallback, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/utils';
import type { SupportAttachment } from '@/lib/support-attachment-upload';
import { SupportAttachmentPicker } from './SupportAttachmentPicker';

export interface SupportTicketReplyComposerProps {
  value: string;
  onChange: (value: string) => void;
  sending: boolean;
  onSend: (attachments?: SupportAttachment[]) => void;
  attachments?: SupportAttachment[];
  onAttachmentsChange?: (attachments: SupportAttachment[]) => void;
  className?: string;
}

export function SupportTicketReplyComposer({
  value,
  onChange,
  sending,
  onSend,
  attachments = [],
  onAttachmentsChange,
  className,
}: SupportTicketReplyComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = Boolean(value.trim()) || attachments.length > 0;

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [value, resizeTextarea]);

  const handleSend = () => {
    if (!canSend || sending) return;
    onSend(attachments.length ? attachments : undefined);
  };

  return (
    <div
      className={cn(
        'shrink-0 border-t border-gray-100 bg-white pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]',
        className
      )}
    >
      {onAttachmentsChange && attachments.length > 0 ? (
        <div className="mb-2 px-1">
          <SupportAttachmentPicker
            mode="composer"
            attachments={attachments}
            onChange={onAttachmentsChange}
            disabled={sending}
          />
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        {onAttachmentsChange ? (
          <SupportAttachmentPicker
            mode="icon"
            attachments={attachments}
            onChange={onAttachmentsChange}
            disabled={sending}
          />
        ) : (
          <div className="w-10 shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder="Type your message to support..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={sending}
            className="w-full min-h-[44px] max-h-[120px] resize-none rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF8C42]/30 focus:border-[#FF8C42]/40 disabled:opacity-60"
            style={{ fontSize: '16px' }}
          />
          <p className="mt-1 px-1 text-[10px] text-gray-400">
            Images or PDF, max 3 files (10MB each)
          </p>
        </div>

        <Button
          type="button"
          onClick={handleSend}
          disabled={sending || !canSend}
          className="h-11 shrink-0 rounded-xl bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white gap-1.5 px-4 text-sm font-semibold shadow-sm"
        >
          <Send className="w-4 h-4" />
          Send
        </Button>
      </div>
    </div>
  );
}
