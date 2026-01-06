'use client';

import React, { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { X, Send, Loader2 } from 'lucide-react';

interface SupportTicket {
  id: string;
  subject: string;
  status: string;
  priority: string;
}

interface TicketDetailModalProps {
  ticket: SupportTicket;
  onClose: () => void;
  onUpdate: () => void;
}

export function TicketDetailModal({ ticket, onClose, onUpdate }: TicketDetailModalProps) {
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const handleReply = async () => {
    if (!replyText.trim()) return;
    try {
      setSending(true);
      await apiClient.post(`/admin/support/tickets/${ticket.id}/reply`, { message: replyText });
      setReplyText('');
      onUpdate();
    } catch (error) {
      console.error('Error sending reply:', error);
      alert('Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{ticket.subject}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reply</label>
            <textarea
              value={replyText}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReplyText(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
              placeholder="Type your reply..."
            />
          </div>
          <button
            onClick={handleReply}
            disabled={sending || !replyText.trim()}
            className="w-full py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send Reply
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

