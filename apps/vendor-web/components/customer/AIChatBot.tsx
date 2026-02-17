'use client';

import { useState, useCallback } from 'react';
import { MessageSquare, Send, X, Minus, AlertCircle, User, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { aiChatbotApi } from '@/lib/api-client';
import { toast } from 'sonner';

export interface AIChatBotProps {
  /** Vendor ID (required for escalation so ticket lands in admin CRM as Vendor AI Chat) */
  vendorId: string;
  /** Display name for the vendor in the chat header */
  vendorName?: string;
  /** @deprecated Use vendorId. Kept for backward compatibility where component was passed customerId as vendorId */
  customerId?: string;
  /** @deprecated Use vendorName */
  customerName?: string;
  onClose?: () => void;
  /** Start minimized (floating button only). Default true. */
  defaultMinimized?: boolean;
}

export function AIChatBot({
  vendorId,
  vendorName,
  customerId,
  customerName,
  onClose,
  defaultMinimized = true,
}: AIChatBotProps) {
  const displayName = vendorName || customerName || 'Provider';
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant' | 'system'; content: string }>>([]);
  const [input, setInput] = useState('');
  const [isMinimized, setIsMinimized] = useState(defaultMinimized);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [escalating, setEscalating] = useState(false);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setSending(true);

    try {
      const res = await aiChatbotApi.chat({
        message: text,
        vendorId: vendorId || (customerId as string),
        conversationId: conversationId || undefined,
      });

      const responseText = (res as any)?.response || "I'm here to help. How can I assist you today?";
      const newConvId = (res as any)?.conversationId;
      if (newConvId && !conversationId) setConversationId(newConvId);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: responseText,
        },
      ]);

      const requiresAgent = (res as any)?.requiresAgent;
      if (requiresAgent) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'system',
            content: 'Would you like to be connected with a support agent? Use "Talk to support" below.',
          },
        ]);
      }
    } catch (err: any) {
      console.error('Vendor AI chat error:', err);
      toast.error(err?.message || 'Failed to send message');
      setMessages((prev) => [
        ...prev,
        { role: 'system', content: 'Sorry, something went wrong. Please try again or use Support from the menu.' },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, sending, conversationId, vendorId, customerId]);

  const handleEscalateToAgent = useCallback(async () => {
    if (escalating) return;
    setEscalating(true);

    const conversationHistory = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    try {
      if (conversationId) {
        const res = await aiChatbotApi.escalateToAgent({
          conversationId,
          vendorId,
          reason: 'Vendor requested human agent',
          conversationHistory,
        });
        const msg = (res as any)?.message || 'Support has been notified. They will contact you shortly.';
        setMessages((prev) => [...prev, { role: 'system', content: msg }]);
        toast.success('Escalated to support');
      } else {
        const { vendorSupportEscalateApi } = await import('@/lib/api-client');
        const res = await vendorSupportEscalateApi.escalateFromChat({
          vendorId,
          message: messages.find((m) => m.role === 'user')?.content || 'Vendor requested support',
          conversationHistory,
          reason: 'Vendor AI chat – connect to agent',
        });
        const msg = (res as any)?.message || 'Support has been notified. They will contact you shortly.';
        setMessages((prev) => [...prev, { role: 'system', content: msg }]);
        toast.success('Escalated to support');
      }
    } catch (err: any) {
      console.error('Vendor escalate error:', err);
      toast.error(err?.message || 'Failed to connect to support');
      setMessages((prev) => [
        ...prev,
        { role: 'system', content: 'Could not connect to support. Please try Support from the menu or try again.' },
      ]);
    } finally {
      setEscalating(false);
    }
  }, [conversationId, vendorId, messages]);

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#FF8C42] hover:bg-[#E07830] rounded-full shadow-lg flex items-center justify-center text-white transition-all hover:scale-105"
        aria-label="Open AI Support"
        title="AI Support"
      >
        <MessageSquare className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[600px] bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col z-50">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-[#FF8C42] text-white rounded-t-lg">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          <h3 className="font-semibold">AI Support</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 text-white/90 hover:bg-white/20 rounded"
            aria-label="Minimize"
          >
            <Minus className="w-5 h-5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-white/90 hover:bg-white/20 rounded"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p className="font-medium">Vendor AI Support</p>
            <p className="text-sm mt-1">Ask a question or type &quot;Talk to support&quot; to connect with our team.</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg p-3 flex gap-2 ${
                  msg.role === 'user'
                    ? 'bg-[#FF8C42] text-white'
                    : msg.role === 'system'
                      ? 'bg-amber-50 text-amber-900 border border-amber-200'
                      : 'bg-gray-100 text-gray-900'
                }`}
              >
                {msg.role === 'assistant' && <Bot className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                {msg.role === 'user' && <User className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                {msg.role === 'system' && <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-gray-200 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42]"
            disabled={sending}
          />
          <Button onClick={handleSend} disabled={sending} className="bg-[#FF8C42] hover:bg-[#E07830]">
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full border-[#FF8C42] text-[#FF8C42] hover:bg-[#FFF3E8]"
          onClick={handleEscalateToAgent}
          disabled={escalating}
        >
          <AlertCircle className="w-4 h-4 mr-2" />
          {escalating ? 'Connecting...' : 'Talk to support'}
        </Button>
      </div>
    </div>
  );
}
