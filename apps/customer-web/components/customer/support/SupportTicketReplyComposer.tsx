"use client";

import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

export interface SupportTicketReplyComposerProps {
  value: string;
  onChange: (value: string) => void;
  sending: boolean;
  onSend: () => void;
}

export function SupportTicketReplyComposer({
  value,
  onChange,
  sending,
  onSend,
}: SupportTicketReplyComposerProps) {
  return (
    <Card className="p-4 space-y-3">
      <label className="text-sm font-medium text-gray-700" htmlFor="ticket-reply">
        Your reply
      </label>
      <Textarea
        id="ticket-reply"
        rows={4}
        placeholder="Type your message to support…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="resize-none"
        disabled={sending}
      />
      <Button
        type="button"
        onClick={() => onSend()}
        disabled={sending || !value.trim()}
        className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white gap-2"
      >
        <Send className="w-4 h-4" />
        {sending ? 'Sending…' : 'Send message'}
      </Button>
    </Card>
  );
}
