'use client';
/**
 * AI Chatbot Widget - Web
 * AWS Bedrock-powered chatbot with symptoms checker, booking assist, and support
 * Phase 3: AI Chatbot Integration
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, Send, Bot, User, AlertCircle, Headphones } from 'lucide-react';
import { aiChatbotApi, supportCrmApi } from '@/lib/api-client';
import { toast } from 'sonner';

interface AIChatbotWidgetProps {
  customerId?: string;
  customerPhone?: string;
  petId?: string;
  onClose?: () => void;
  onNavigate?: (dest: string, data?: any) => void;
  /**
   * `dock` — floating panel above home tab bar (default).
   * `modal` — same card UI as dock, for auth / guest pages (no bottom nav — sits above safe area).
   */
  presentation?: 'dock' | 'modal';
}

interface Message {
  id: string;
  type: 'user' | 'bot' | 'system';
  content: string;
  timestamp: string;
  intent?: string;
  suggestedActions?: string[];
  requiresAgent?: boolean;
  /** When set, "Continue to booking" uses this path */
  bookingUrl?: string;
}

/** Match backend inferBookingCategoryFromText — fixes API URLs that wrongly use category=vet for "grooming" etc. */
function inferCategoryFromBookingMessage(msg: string): string | null {
  const m = msg.toLowerCase().trim();
  if (!m) return null;
  if (/\b(grooming|groom|groomer|bath|trim|haircut)\b/.test(m)) return 'grooming';
  if (/\b(walk|walker|walking)\b/.test(m)) return 'walker';
  if (/\b(train|trainer|training|behavior|behaviourist)\b/.test(m)) return 'training';
  if (/\b(board|boarding|kennel|daycare)\b/.test(m)) return 'boarding';
  if (/\b(vet|veterinar|veterinary|doctor|clinic)\b/.test(m)) return 'vet';
  if (/\b(pharmacy|medicine|medication)\b/.test(m)) return 'pharmacy';
  if (/\b(cafe|café)\b/.test(m)) return 'cafe';
  if (/\b(resort|holiday)\b/.test(m)) return 'resort';
  return null;
}

function alignBookingSearchPath(path: string, userMessage: string): string {
  if (!path.startsWith('/search')) return path;
  const cat = inferCategoryFromBookingMessage(userMessage);
  if (!cat) return path;
  try {
    const qIdx = path.indexOf('?');
    const base = qIdx >= 0 ? path.slice(0, qIdx) : path;
    const sp = new URLSearchParams(qIdx >= 0 ? path.slice(qIdx + 1) : '');
    const cur = sp.get('category') || '';
    if (cur === cat) return path;
    if (cur === 'vet' && cat !== 'vet') {
      sp.set('category', cat);
      if (!sp.get('q')?.trim()) sp.set('q', userMessage.trim());
      return `${base}?${sp.toString()}`;
    }
    if (!cur) {
      sp.set('category', cat);
      if (!sp.get('q')?.trim()) sp.set('q', userMessage.trim());
      return `${base}?${sp.toString()}`;
    }
  } catch {
    /* ignore */
  }
  return path;
}

export function AIChatbotWidget({
  customerId,
  customerPhone,
  petId,
  onClose,
  onNavigate,
  presentation = 'dock',
}: AIChatbotWidgetProps) {
  const router = useRouter();
  const lastBookingUrlRef = useRef<string | null>(null);
  const showMobileBackdrop = presentation === 'dock' || presentation === 'modal';

  const goTo = useCallback(
    (dest: string) => {
      const d = (dest || '').trim();
      if (!d) return;
      if (d.startsWith('/')) {
        if (onNavigate) onNavigate(d);
        else router.push(d);
      } else if (onNavigate) {
        onNavigate(d);
      }
    },
    [onNavigate, router]
  );

  // Widget is always open when rendered - parent controls visibility via conditional rendering
  const [isOpen, setIsOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'bot',
      content: "Hi! I'm your Warmpawz AI Assistant. I can help you with:\n\n• Pet health symptoms checker\n• Smart booking assistance\n• General support questions\n\nHow can I help you today?",
      timestamp: new Date().toISOString(),
      suggestedActions: ['Contact Support'],
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [mode, setMode] = useState<'chat' | 'symptoms' | 'booking'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!inputText.trim() || sending) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: inputText.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    const messageText = inputText.trim();
    setInputText('');
    setSending(true);

    if (mode !== 'booking') {
      lastBookingUrlRef.current = null;
    }

    try {
      let response: any;
      
      if (mode === 'symptoms') {
        response = await aiChatbotApi.symptomsChecker({
          symptoms: messageText,
          petId,
          customerId,
          customerPhone,
        });
        
        const botMessage: Message = {
          id: `bot-${Date.now()}`,
          type: 'bot',
          content: response.response || 'I understand your concern. Please consult with a veterinarian for proper diagnosis.',
          timestamp: new Date().toISOString(),
          intent: 'symptoms',
          suggestedActions: response.vetBookingSuggested
            ? ['Find Vet Clinic', 'Book Consultation', 'Search Providers']
            : ['Find Vet Clinic', 'Search Providers', 'Book Consultation'],
        };
        
        setMessages(prev => [...prev, botMessage]);
      } else if (mode === 'booking') {
        response = await aiChatbotApi.bookingAssist({
          query: messageText,
          customerId,
          customerPhone,
          petId,
        });
        
        let bookingPath =
          typeof response.bookingUrl === 'string' && response.bookingUrl.startsWith('/')
            ? response.bookingUrl
            : '/search';
        bookingPath = alignBookingSearchPath(bookingPath, messageText);
        lastBookingUrlRef.current = bookingPath;

        const stepLabels = Array.isArray(response.nextSteps)
          ? response.nextSteps.filter(
              (s: unknown) =>
                typeof s === 'string' && s.trim() && !/^browse services$/i.test(String(s).trim())
            )
          : [];
        const suggestedActions = Array.from(
          new Set([...stepLabels, 'Continue to booking', 'Browse Bookings'])
        );

        const botMessage: Message = {
          id: `bot-${Date.now()}`,
          type: 'bot',
          content: response.response || "I'd be happy to help you book a service!",
          timestamp: new Date().toISOString(),
          intent: 'booking',
          suggestedActions,
          bookingUrl: bookingPath,
        };
        
        setMessages(prev => [...prev, botMessage]);
      } else {
        response = await aiChatbotApi.chat({
          message: messageText,
          customerId,
          customerPhone,
          conversationId: conversationId || undefined,
          petId,
          context: { widgetMode: 'chat' },
        });
        
        if (!conversationId && response.conversationId) {
          setConversationId(response.conversationId);
        }
        
        const botMessage: Message = {
          id: `bot-${Date.now()}`,
          type: 'bot',
          content: response.response || "I'm here to help!",
          timestamp: new Date().toISOString(),
          intent: response.intent,
          suggestedActions: ['Create Ticket', 'Contact Support'],
          requiresAgent: response.requiresAgent,
        };
        
        setMessages(prev => [...prev, botMessage]);
        
        if (response.requiresAgent) {
          const shouldEscalate = confirm('Would you like to be connected with a human support agent?');
          if (shouldEscalate) {
            await handleEscalateToAgent(response.conversationId || conversationId || '');
          }
        }
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        type: 'system',
        content: 'Sorry, I encountered an error. Please try again or contact support.',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
  };

  const handleEscalateToAgent = async (convId: string) => {
    try {
      const conversationHistory = messages
        .map(m => `${m.type}: ${m.content}`)
        .join('\n');
      
      const response: any = await aiChatbotApi.escalateToAgent({
        conversationId: convId,
        customerId,
        customerPhone,
        reason: 'User requested human agent',
        conversationHistory,
      });
      
      const systemMessage: Message = {
        id: `system-${Date.now()}`,
        type: 'system',
        content: response.message || 'Your conversation has been escalated to a support agent. They will contact you shortly.',
        timestamp: new Date().toISOString(),
      };
      
      setMessages(prev => [...prev, systemMessage]);
    } catch (error: any) {
      console.error('Error escalating to agent:', error);
      alert('Failed to connect with agent. Please try again.');
    }
  };

  const handleContactSupport = useCallback(() => {
    const transcript =
      [...messages].reverse().find((m) => m.type === 'user')?.content?.slice(0, 800) || '';

    if (onNavigate && customerId) {
      onNavigate('support_help', { initialTab: 'contact' });
      setIsOpen(false);
      onClose?.();
      return;
    }

    const digits = (customerPhone || '').replace(/\D/g, '');
    const defaultBody =
      transcript ||
      'I need help with Warmpawz (reached via Contact Support in the AI Assistant).';

    if (digits.length >= 10) {
      void (async () => {
        try {
          await supportCrmApi.createTicket({
            customerId,
            customerPhone,
            subject: 'Support request (AI Assistant)',
            message: defaultBody.slice(0, 4000),
            source: 'ai_chatbot',
            priority: 'medium',
            category: 'general',
          });
          toast.success('Support request received. Our team will follow up.');
        } catch (e: any) {
          console.error('createTicket', e);
          toast.error(e?.message || 'Could not submit online.');
          const sub = encodeURIComponent('Support request (AI Assistant)');
          const body = encodeURIComponent(
            `${defaultBody}\n\n(Sent by email because online ticket could not be created.)`
          );
          if (typeof window !== 'undefined') {
            window.location.href = `mailto:support@warmpawz.com?subject=${sub}&body=${body}`;
          }
          toast.info('Opening email to support@warmpawz.com');
        }
      })();
      return;
    }

    const sub = encodeURIComponent('WARMPAWZ Customer Support');
    const body = encodeURIComponent(
      `${transcript ? `From in-app chat:\n${transcript}\n\n` : ''}Describe your issue below:\n`
    );
    if (typeof window !== 'undefined') {
      window.location.href = `mailto:support@warmpawz.com?subject=${sub}&body=${body}`;
    }
    toast.info('Opening your email app. Sign in later for in-app tickets.');
  }, [customerId, customerPhone, messages, onClose, onNavigate]);

  const handleSuggestedAction = (action: string) => {
    const a = action.toLowerCase();

    if (
      (a.includes('create') && a.includes('ticket')) ||
      a.replace(/\s+/g, '') === 'createticket'
    ) {
      const recentUser = [...messages].reverse().find(m => m.type === 'user');
      const transcript = recentUser?.content?.slice(0, 800) || '';
      const extra =
        typeof window !== 'undefined'
          ? window.prompt('Add details for support (optional):', transcript) ?? transcript
          : transcript;
      const body = [transcript && `Latest message: ${transcript}`, extra && extra !== transcript ? extra : '']
        .filter(Boolean)
        .join('\n\n')
        .slice(0, 4000);
      void (async () => {
        try {
          await supportCrmApi.createTicket({
            customerId,
            customerPhone,
            subject: 'Support request (AI Chat)',
            message: body || 'Customer requested support from AI Assistant.',
            source: 'ai_chatbot',
            priority: 'medium',
            category: 'general',
          });
          toast.success('Support ticket created. Our team will follow up.');
        } catch (e: any) {
          console.error('createTicket', e);
          toast.error(e?.message || 'Could not create ticket.');
          const sub = encodeURIComponent('Support request (AI Chat)');
          const fallbackBody =
            body || 'Customer requested support from AI Assistant.';
          const mailBody = encodeURIComponent(
            `${fallbackBody}\n\n(Sent by email because online ticket could not be created.)`
          );
          if (typeof window !== 'undefined') {
            window.location.href = `mailto:support@warmpawz.com?subject=${sub}&body=${mailBody}`;
          }
          toast.info('Opening email to support@warmpawz.com');
        }
      })();
      return;
    }

    if (
      (a.includes('browse') && a.includes('booking')) ||
      (a.includes('my') && a.includes('booking'))
    ) {
      goTo('/bookings');
      setIsOpen(false);
      onClose?.();
      return;
    }

    if (a === 'continue to booking' && lastBookingUrlRef.current) {
      goTo(lastBookingUrlRef.current);
      setIsOpen(false);
      onClose?.();
      return;
    }

    if (a.includes('vet') || a.includes('clinic') || (a.includes('consultation') && !a.includes('tele'))) {
      goTo('/search?category=vet');
      setIsOpen(false);
      onClose?.();
      return;
    }

    if (a.includes('search') && a.includes('provider')) {
      goTo('/search');
      setIsOpen(false);
      onClose?.();
      return;
    }

    if (a.includes('browse') && a.includes('service')) {
      goTo('/search');
      setIsOpen(false);
      onClose?.();
      return;
    }

    if (a.includes('book') || a.includes('slot') || a.includes('select service')) {
      if (lastBookingUrlRef.current) {
        goTo(lastBookingUrlRef.current);
      } else {
        goTo('/search');
      }
      setIsOpen(false);
      onClose?.();
      return;
    }

    if (a.includes('shop') || (a.includes('browse') && a.includes('shop'))) {
      goTo('/shop');
      setIsOpen(false);
      onClose?.();
      return;
    }

    if (a.includes('cart')) {
      goTo('/cart');
      setIsOpen(false);
      onClose?.();
      return;
    }

    if (a.includes('contact') && a.includes('support')) {
      handleContactSupport();
      return;
    }

    if (a.includes('get help') || a === 'help') {
      if (onNavigate && customerId) {
        onNavigate('support_help', {});
        setIsOpen(false);
        onClose?.();
      } else {
        handleContactSupport();
      }
      return;
    }

    if (a.includes('open') && a.includes('setting')) {
      goTo('/settings');
      setIsOpen(false);
      onClose?.();
      return;
    }
  };

  // If closed internally, call parent's onClose to unmount
  if (!isOpen) {
    onClose?.();
    return null;
  }

  const panelShell =
    presentation === 'modal'
      ? [
          'fixed z-[50] flex min-h-0 flex-col bg-white rounded-lg shadow-2xl border border-gray-200',
          'left-3 right-3 bottom-[max(1rem,env(safe-area-inset-bottom,0px))]',
          'max-h-[min(600px,calc(100dvh-2rem-env(safe-area-inset-bottom,0px)-env(safe-area-inset-top,0px)))]',
          'sm:left-auto sm:right-6 sm:w-96',
        ].join(' ')
      : [
          'fixed z-[50] flex min-h-0 flex-col bg-white rounded-lg shadow-2xl border border-gray-200',
          'left-3 right-3 bottom-[max(6.5rem,calc(5.5rem+env(safe-area-inset-bottom,0px)))]',
          'max-h-[min(600px,calc(100dvh-7.5rem-env(safe-area-inset-bottom,0px)-env(safe-area-inset-top,0px)))]',
          'sm:left-auto sm:right-6 sm:w-96',
        ].join(' ');

  return (
    <>
      {showMobileBackdrop && (
        <button
          type="button"
          className="fixed inset-0 z-[49] bg-black/40 sm:hidden"
          aria-label="Close chat"
          onClick={() => {
            setIsOpen(false);
            onClose?.();
          }}
        />
      )}
      <div className={panelShell}>
      {/* Header — match home FAB / Help gradient */}
      <div className="flex flex-col gap-2 p-4 border-b border-gray-200 shrink-0 rounded-t-lg bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] text-white">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Bot className="w-5 h-5 shrink-0" />
            <h3 className="font-semibold truncate">AI Assistant</h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => handleContactSupport()}
              className="flex items-center gap-1 rounded-full bg-white/20 hover:bg-white/30 px-2.5 py-1.5 text-xs font-semibold"
              aria-label="Contact support"
            >
              <Headphones className="w-3.5 h-3.5 shrink-0" />
              Support
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onClose?.();
              }}
              className="shrink-0 hover:bg-white/20 rounded-lg p-1"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setMode('chat')}
            className={`px-2 py-1 text-xs rounded font-medium ${
              mode === 'chat' ? 'bg-white text-[#E85D04]' : 'bg-white/20 text-white hover:bg-white/25'
            }`}
          >
            Chat
          </button>
          <button
            type="button"
            onClick={() => setMode('symptoms')}
            className={`px-2 py-1 text-xs rounded font-medium ${
              mode === 'symptoms' ? 'bg-white text-[#E85D04]' : 'bg-white/20 text-white hover:bg-white/25'
            }`}
          >
            Symptoms
          </button>
          <button
            type="button"
            onClick={() => setMode('booking')}
            className={`px-2 py-1 text-xs rounded font-medium ${
              mode === 'booking' ? 'bg-white text-[#E85D04]' : 'bg-white/20 text-white hover:bg-white/25'
            }`}
          >
            Booking
          </button>
        </div>
        <p className="text-[11px] text-white/85 leading-snug">
          {mode === 'symptoms' &&
            'Describe symptoms — we match care areas from our catalog and suggest providers you can book.'}
          {mode === 'booking' &&
            'Say the service you want — we match catalog services and providers, then use the buttons to continue.'}
          {mode === 'chat' && 'Ask anything about the app, orders, or pet care. Use buttons below the reply when shown.'}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.type === 'user'
                  ? 'bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white'
                  : message.type === 'system'
                  ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <div className="flex items-start gap-2">
                {message.type === 'bot' && <Bot className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                {message.type === 'user' && <User className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                {message.type === 'system' && <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
              
              {message.suggestedActions && message.suggestedActions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {message.suggestedActions.map((action, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestedAction(action)}
                      className="px-3 py-1 text-xs bg-white text-[#E85D04] border border-[#FF8C42] rounded-md hover:bg-orange-50"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              )}
              
              {message.requiresAgent && (
                <button
                  onClick={() => handleEscalateToAgent(conversationId || '')}
                  className="mt-2 w-full px-3 py-1 text-xs bg-red-50 text-red-600 border border-red-200 rounded-md hover:bg-red-100"
                >
                  Connect with Agent
                </button>
              )}
            </div>
          </div>
        ))}
        
        {sending && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4" />
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={
              mode === 'symptoms'
                ? "Describe your pet's symptoms..."
                : mode === 'booking'
                ? 'What service do you need?'
                : 'Type your message...'
            }
            className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#FF8C42]/40"
            disabled={sending}
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={!inputText.trim() || sending}
            title="Send"
            aria-label="Send message"
            className="shrink-0 h-11 w-11 rounded-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white shadow-md hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
    </>
  );
}

