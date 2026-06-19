'use client';

/**
 * ============================================================================
 * CHAT INTERFACE FROM NOTIFICATION
 * ============================================================================
 * 
 * Modal overlay chat window opened from notification
 * - Real-time message updates
 * - Video call button integration
 * - Coordinate before consultation
 * 
 * Phase: Phase 2 - Customer Engagement & Notifications
 * Date: 2026-01-28
 * ============================================================================
 */

import { useState, useEffect, useRef } from 'react';
import { useVisualViewport } from '@/hooks/useVisualViewport';
import { X, Send, Video, Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface ChatInterfaceFromNotificationProps {
  isOpen: boolean;
  bookingId: string;
  vendorName: string;
  vendorPhoto?: string;
  onClose: () => void;
  onStartVideoCall?: (bookingId: string) => void;
}

interface Message {
  id: string;
  sender: 'customer' | 'vendor';
  message: string;
  timestamp: string;
}

export function ChatInterfaceFromNotification({
  isOpen,
  bookingId,
  vendorName,
  vendorPhoto,
  onClose,
  onStartVideoCall,
}: ChatInterfaceFromNotificationProps) {
  useVisualViewport();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Shrink the overlay to the visual viewport so the input stays above the keyboard.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;

    function updateOverlay() {
      const el = overlayRef.current;
      if (!el) return;
      el.style.height = `${vv.height}px`;
    }

    updateOverlay();
    vv.addEventListener('resize', updateOverlay);
    vv.addEventListener('scroll', updateOverlay);
    return () => {
      vv.removeEventListener('resize', updateOverlay);
      vv.removeEventListener('scroll', updateOverlay);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadMessages();
      // Poll for new messages every 3 seconds
      const interval = setInterval(loadMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen, bookingId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/chat/booking/${bookingId}/conversation`) as any;

      if (response.success && response.messages) {
        setMessages(response.messages.map((m: any) => ({
          id: m.id,
          sender: m.sender_type === 'vendor' || m.sender_type === 'staff' ? 'vendor' : 'customer',
          message: m.message || m.content,
          timestamp: m.created_at || m.timestamp,
        })));
        const hasUnread = response.messages.some(
          (m: any) => (m.sender_type === 'vendor' || m.sender_type === 'staff') && !m.is_read
        );
        if (hasUnread) {
          apiClient.post(`/chat/conversations/${bookingId}/read`, {}).catch(() => {});
        }
      }
    } catch (error: any) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCustomerPhone = (): string => {
    if (typeof window === 'undefined') return '';
    return (
      localStorage.getItem('customerPhone') ||
      localStorage.getItem('phone') ||
      localStorage.getItem('userPhone') ||
      ''
    ).trim();
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const response = await apiClient.post(`/chat/booking/${bookingId}/message`, {
        senderPhone: getCustomerPhone() || 'customer',
        senderName: 'Customer',
        senderType: 'customer',
        message: messageText,
        messageType: 'text',
      }) as any;

      if (response.success) {
        await loadMessages();
      } else {
        toast.error('Failed to send message');
        setNewMessage(messageText);
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      setNewMessage(messageText);
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-customer flex flex-col shadow-2xl" style={{ height: 'min(600px, calc(var(--vvh, 100dvh) - 2rem))' }}>
        {/* Header */}
        <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white p-4 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            {vendorPhoto ? (
              <img
                src={vendorPhoto}
                alt={vendorName}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <MessageSquare className="w-5 h-5" />
              </div>
            )}
            <div>
              <div className="font-semibold">{vendorName}</div>
              <div className="text-xs text-white/90">Chat</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onStartVideoCall && (
              <Button
                onClick={() => onStartVideoCall(bookingId)}
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-0 h-8 px-3"
              >
                <Video className="w-4 h-4 mr-1" />
                Video
              </Button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 text-[#FF8C42] animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-8">
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'customer' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                    message.sender === 'customer'
                      ? 'bg-[#FF8C42] text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <div className="text-sm">{message.message}</div>
                  <div
                    className={`text-xs mt-1 ${
                      message.sender === 'customer' ? 'text-white/70' : 'text-gray-500'
                    }`}
                  >
                    {new Date(message.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
              style={{ fontSize: '16px' }}
              disabled={sending}
            />
            <Button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              className="bg-[#FF8C42] hover:bg-[#FF7A29] text-white"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
