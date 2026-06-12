"use client";

import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
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
  /** Tighter textarea in bounded layouts (e.g. full-screen sheet). */
  compact?: boolean;
  className?: string;
}

export function SupportTicketReplyComposer({
  value,
  onChange,
  sending,
  onSend,
  attachments = [],
  onAttachmentsChange,
  compact = false,
  className,
}: SupportTicketReplyComposerProps) {
  const canSend = Boolean(value.trim()) || attachments.length > 0;

  return (
    <Card className={cn('shrink-0 space-y-3 p-4', className)}>
      <label className="text-sm font-medium text-gray-700" htmlFor="ticket-reply">
        Your reply
      </label>
      <Textarea
        id="ticket-reply"
        rows={compact ? 3 : 4}
        placeholder="Type your message to support…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="resize-none"
        disabled={sending}
      />
      {onAttachmentsChange ? (
        <SupportAttachmentPicker
          attachments={attachments}
          onChange={onAttachmentsChange}
          disabled={sending}
          compact={compact}
        />
      ) : null}
      <Button
        type="button"
        onClick={() => onSend(attachments.length ? attachments : undefined)}
        disabled={sending || !canSend}
        className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white gap-2"
      >
        <Send className="w-4 h-4" />
        {sending ? 'Sending…' : 'Send message'}
      </Button>
    </Card>
  );
}
