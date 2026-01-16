'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Badge,
} from '@warmpawz/ui';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import {
  Loader2,
  Send,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  X,
} from 'lucide-react';

interface TicketDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  vendorId: string;
  onTicketUpdated?: () => void;
}

interface Message {
  id: string;
  message: string;
  responder_type: 'customer' | 'agent' | 'system'; // 'customer' = vendor in this context
  created_at: string;
  responder_id?: string;
}

interface Ticket {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  assigned_to?: string;
  messages?: Message[];
}

export function TicketDetailModal({
  open,
  onOpenChange,
  ticketId,
  vendorId,
  onTicketUpdated,
}: TicketDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open && ticketId) {
      loadTicket();
    }
  }, [open, ticketId]);

  const loadTicket = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<any>(
        `/vendor/support/tickets/${ticketId}?vendorId=${vendorId}`
      );

      if (res.success) {
        setTicket(res.ticket);
      } else {
        toast.error(res.error || 'Failed to load ticket');
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error('Error loading ticket:', error);
      toast.error(error.message || 'Failed to load ticket');
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setSending(true);

    try {
      const res = await apiClient.post<any>(
        `/vendor/support/tickets/${ticketId}/messages`,
        {
          vendorId,
          message: newMessage.trim(),
        }
      );

      if (res.success) {
        toast.success('Message sent');
        setNewMessage('');
        await loadTicket();
      } else {
        toast.error(res.error || 'Failed to send message');
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error(error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleCloseTicket = async () => {
    setClosing(true);

    try {
      const res = await apiClient.put<any>(
        `/vendor/support/tickets/${ticketId}/status`,
        {
          vendorId,
          status: 'closed',
          resolution: 'Closed by vendor',
        }
      );

      if (res.success) {
        toast.success('Ticket closed');
        onTicketUpdated?.();
        onOpenChange(false);
      } else {
        toast.error(res.error || 'Failed to close ticket');
      }
    } catch (error: any) {
      console.error('Error closing ticket:', error);
      toast.error(error.message || 'Failed to close ticket');
    } finally {
      setClosing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'resolved':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'closed':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low':
        return 'bg-gray-100 text-gray-700';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700';
      case 'high':
        return 'bg-orange-100 text-orange-700';
      case 'urgent':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading || !ticket) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl">
                Ticket #{ticket.ticket_number}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {ticket.subject}
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <Badge className={getStatusColor(ticket.status)}>
                {ticket.status.replace('_', ' ')}
              </Badge>
              <Badge className={getPriorityColor(ticket.priority)}>
                {ticket.priority}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Ticket Info */}
        <div className="border-b border-gray-200 pb-4">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Created: {new Date(ticket.created_at).toLocaleString()}
            </div>
            <span>|</span>
            <div className="flex items-center gap-1">
              <User className="w-4 h-4" />
              Category: {ticket.category}
            </div>
            {ticket.assigned_to && (
              <>
                <span>|</span>
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Assigned
                </div>
              </>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 py-4 overflow-y-auto max-h-[400px]">
          <div className="space-y-4">
            {/* Original Message */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-semibold text-orange-900">
                  Original Request
                </span>
              </div>
              <p className="text-gray-800 whitespace-pre-wrap">{ticket.description}</p>
            </div>

            {/* Thread Messages */}
            {ticket.messages && ticket.messages.length > 0 ? (
              ticket.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.responder_type === 'customer' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-4 ${
                      msg.responder_type === 'customer'
                        ? 'bg-blue-600 text-white'
                        : msg.responder_type === 'agent'
                        ? 'bg-white border border-gray-200'
                        : 'bg-gray-100 border border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1 text-xs opacity-75">
                      <span className="font-semibold">
                        {msg.responder_type === 'customer'
                          ? 'You'
                          : msg.responder_type === 'agent'
                          ? 'Support Agent'
                          : 'System'}
                      </span>
                      <span>{new Date(msg.created_at).toLocaleTimeString()}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{msg.message}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Waiting for support team response...</p>
              </div>
            )}
          </div>
        </div>

        {/* Reply Area */}
        {ticket.status !== 'closed' && ticket.status !== 'resolved' && (
          <div className="border-t border-gray-200 pt-4 space-y-3">
            <div className="flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={sending}
              />
              <Button onClick={handleSendMessage} disabled={sending || !newMessage.trim()}>
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>

            <div className="flex justify-between items-center">
              <p className="text-xs text-gray-500">
                Press Enter to send, Shift+Enter for new line
              </p>
              {ticket.status !== 'closed' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCloseTicket}
                  disabled={closing}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  {closing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Closing...
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4 mr-2" />
                      Close Ticket
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}

        {ticket.status === 'resolved' || ticket.status === 'closed' ? (
          <div className="border-t border-gray-200 pt-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-600" />
              <p className="text-sm font-semibold text-green-900">
                This ticket has been {ticket.status}
              </p>
              {ticket.resolved_at && (
                <p className="text-xs text-green-700 mt-1">
                  {new Date(ticket.resolved_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
