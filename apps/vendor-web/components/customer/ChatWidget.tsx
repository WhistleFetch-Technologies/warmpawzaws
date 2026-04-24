'use client';

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import {
  MessageSquare,
  Send,
  X,
  Minus,
  Bot,
  Sparkles,
  GripHorizontal,
  User,
  Phone,
  Headphones,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

const DRAG_OFFSET_STORAGE_KEY = 'warmpawz_vendor_chat_drag_offset';

/** Vendor AI chat — human support line (tap-to-call on mobile). */
const VENDOR_SUPPORT_PHONE_E164 = '+917349533635';

interface ChatWidgetProps {
  userId?: string;
  userName?: string;
  userType?: 'customer' | 'vendor';
  defaultOpen?: boolean;
  onClose?: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

function newMessageId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Renders `**bold**` segments from API copy as styled strong text. */
function formatInlineSegments(text: string, strongClass: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={i} className={strongClass}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function ChatMessageBody({
  content,
  variant,
}: {
  content: string;
  variant: 'user' | 'assistant';
}) {
  const blocks = content.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
  const strongClass =
    variant === 'user' ? 'font-semibold text-white' : 'font-semibold text-gray-900';
  const paraClass =
    variant === 'user'
      ? 'text-[15px] leading-relaxed text-white/95 first:mt-0'
      : 'text-[15px] leading-relaxed text-gray-800 first:mt-0';

  if (blocks.length === 0) {
    return <p className={paraClass}>{formatInlineSegments(content, strongClass)}</p>;
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => (
        <p key={i} className={`${paraClass} whitespace-pre-wrap`}>
          {formatInlineSegments(block, strongClass)}
        </p>
      ))}
    </div>
  );
}

function clampDragOffset(nx: number, ny: number): { x: number; y: number } {
  const w = typeof window !== 'undefined' ? window.innerWidth : 400;
  const h = typeof window !== 'undefined' ? window.innerHeight : 800;
  const margin = 12;
  const bottomNavReserve = 88;
  const panelW = Math.min(360, w - margin * 2);
  const panelH = Math.min(520, h - bottomNavReserve);
  const minX = -(w - margin - panelW);
  const maxX = w - margin - 48;
  const minY = -(h - margin - panelH);
  const maxY = margin + 24;
  return {
    x: Math.max(minX, Math.min(maxX, nx)),
    y: Math.max(minY, Math.min(maxY, ny)),
  };
}

export function ChatWidget({ userId, userName, userType = 'vendor', defaultOpen = false, onClose }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [supportTicketId, setSupportTicketId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const offsetRef = useRef(dragOffset);
  const dragMovedRef = useRef(false);

  useEffect(() => {
    offsetRef.current = dragOffset;
  }, [dragOffset]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAG_OFFSET_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { x?: number; y?: number };
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          setDragOffset(clampDragOffset(parsed.x, parsed.y));
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      setUnreadCount(0);
    }
  }, [isOpen, isMinimized]);

  const persistOffset = useCallback((o: { x: number; y: number }) => {
    try {
      localStorage.setItem(DRAG_OFFSET_STORAGE_KEY, JSON.stringify(o));
    } catch {
      /* ignore */
    }
  }, []);

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest('[data-chat-stop-drag]')) {
        return;
      }
      if (e.button !== undefined && e.button !== 0) {
        return;
      }
      dragMovedRef.current = false;
      const pointerId = e.pointerId;
      const startX = e.clientX;
      const startY = e.clientY;
      const orig = offsetRef.current;

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
          dragMovedRef.current = true;
          ev.preventDefault();
        }
        if (!dragMovedRef.current) return;
        const next = clampDragOffset(orig.x + dx, orig.y + dy);
        setDragOffset(next);
      };

      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        setDragOffset((current) => {
          persistOffset(current);
          return current;
        });
      };

      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [persistOffset]
  );

  const sendChatMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isTyping) return;

      const userMessage: Message = {
        id: newMessageId(),
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      };

      const historyForApi = messages.slice(-5).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setIsTyping(true);

      const payload: Record<string, unknown> = {
        message: userMessage.content,
        conversationId: conversationId || undefined,
        context: {
          userName,
          userType,
          previousMessages: historyForApi,
        },
      };

      if (userType === 'vendor') {
        payload.vendorId = userId || null;
        payload.customerId = null;
      } else {
        payload.customerId = userId || null;
        payload.vendorId = null;
      }

      /** Dev / QA: set NEXT_PUBLIC_AI_CHAT_INCLUDE_VENDOR_READINESS_METRICS=true in .env.local to echo DB counts in the API JSON (see Network → response). */
      if (process.env.NEXT_PUBLIC_AI_CHAT_INCLUDE_VENDOR_READINESS_METRICS === 'true') {
        payload.includeVendorReadinessMetrics = true;
      }

      try {
        const response = (await apiClient.post('/ai-chatbot/chat', payload)) as {
          success?: boolean;
          conversationId?: string;
          response?: string;
          message?: string;
          ticketId?: string;
          requiresAgent?: boolean;
          vendorReadinessMetrics?: {
            availabilityTotalRows?: number;
            availabilityOpenRows?: number;
            publishedForDiscovery?: number;
            canonicalVendorId?: string;
          };
        };

        if (response?.conversationId) {
          setConversationId(response.conversationId);
        }
        if (response?.ticketId) {
          setSupportTicketId(String(response.ticketId));
        }

        if (response?.vendorReadinessMetrics != null) {
          console.info('[Warmpawz Assistant] vendorReadinessMetrics', response.vendorReadinessMetrics);
        }

        const assistantMessage: Message = {
          id: newMessageId(),
          role: 'assistant',
          content:
            response?.response ||
            response?.message ||
            "I'm here to help! How can I assist you today?",
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        if (isMinimized) {
          setUnreadCount((prev) => prev + 1);
        }
      } catch (error) {
        console.error('AI chatbot error:', error);
        const errorMessage: Message = {
          id: newMessageId(),
          role: 'assistant',
          content:
            "I'm sorry, I'm having trouble connecting right now. Please try again in a moment, or contact support if the issue persists.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsTyping(false);
      }
    },
    [conversationId, isMinimized, isTyping, messages, userId, userName, userType]
  );

  const handleSend = () => sendChatMessage(input);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendChatMessage(input);
    }
  };

  const toggleOpen = () => {
    if (!isOpen) {
      setIsOpen(true);
      setIsMinimized(false);
    } else {
      setIsOpen(false);
      onClose?.();
    }
  };

  const handleMinimize = () => {
    setIsMinimized(true);
  };

  const handleMaximize = () => {
    setIsMinimized(false);
    setUnreadCount(0);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const quickSuggestions = [
    'How do I manage my services?',
    'Help with bookings',
    'Payment & settlements',
    'Contact support',
  ];

  const shellStyle: React.CSSProperties = {
    transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
  };

  return (
    <>
      <div
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] right-4 z-40 flex flex-col items-end gap-0"
        style={shellStyle}
      >
        {(!isOpen || isMinimized) && (
          <button
            type="button"
            onPointerDown={startDrag}
            onClick={() => {
              if (dragMovedRef.current) {
                dragMovedRef.current = false;
                return;
              }
              if (isMinimized) {
                handleMaximize();
              } else {
                toggleOpen();
              }
            }}
            className="group relative touch-manipulation"
            aria-label="Open chat"
          >
            <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r from-orange-400 to-amber-500 opacity-25 animate-ping" />

            <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#FF8C42] to-[#FF6B1A] shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl">
              <MessageSquare className="h-6 w-6 text-white" />

              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 animate-bounce items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>

            <span className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-sm text-white opacity-0 transition-opacity group-hover:opacity-100">
              {isMinimized ? 'Open Chat' : 'Need Help?'}
              <span className="absolute right-4 top-full border-4 border-transparent border-t-gray-900" />
            </span>
          </button>
        )}

        {isOpen && !isMinimized && (
          <div className="flex max-h-[min(520px,calc(100vh-8rem))] w-[min(360px,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl animate-in slide-in-from-bottom-5 duration-300">
            <div
              role="toolbar"
              aria-label="Move chat window"
              onPointerDown={startDrag}
              className="flex cursor-grab touch-none select-none items-center justify-between bg-gradient-to-r from-[#FF8C42] to-[#FF6B1A] p-3 active:cursor-grabbing sm:p-4"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                <GripHorizontal className="h-4 w-4 shrink-0 text-white/80" aria-hidden />
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur sm:h-10 sm:w-10">
                    <Bot className="h-4 w-4 text-white sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-white sm:text-base">Warmpawz Assistant</h3>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
                      <span className="text-xs text-white/80">Online • AI-powered • Drag header to move</span>
                    </div>
                  </div>
                </div>
              </div>
              <div
                className="flex shrink-0 touch-manipulation items-center gap-0.5"
                data-chat-stop-drag
              >
                <button
                  type="button"
                  onClick={handleMinimize}
                  className="rounded-lg p-2 transition-colors hover:bg-white/20"
                  aria-label="Minimize chat"
                >
                  <Minus className="h-4 w-4 text-white" />
                </button>
                <button
                  type="button"
                  onClick={toggleOpen}
                  className="rounded-lg p-2 transition-colors hover:bg-white/20"
                  aria-label="Close chat"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>

            {userType === 'vendor' && (
              <div
                className="border-b border-orange-100/80 bg-gradient-to-r from-orange-50/95 to-amber-50/90 px-3 py-2.5 sm:px-4"
                data-chat-stop-drag
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80 text-[#FF7A35] shadow-sm ring-1 ring-orange-100">
                    <Headphones className="h-4 w-4" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-orange-900/80">
                      Contact support
                    </p>
                    <p className="mt-0.5 text-[13px] leading-snug text-gray-700">
                      Contact us for any help and support via this number{' '}
                      <a
                        href={`tel:${VENDOR_SUPPORT_PHONE_E164.replace(/\s/g, '')}`}
                        className="inline-flex items-center gap-1 font-semibold text-[#FF6B1A] underline decoration-orange-200 underline-offset-2 hover:text-[#e55f14]"
                      >
                        <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {VENDOR_SUPPORT_PHONE_E164}
                      </a>
                      .
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div
              className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-gradient-to-b from-stone-50 to-gray-50/90 p-4"
              role="log"
              aria-live="polite"
              aria-relevant="additions"
            >
              {supportTicketId ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  A support ticket is open for this chat (ref.{' '}
                  <span className="font-mono">{supportTicketId.slice(0, 8)}</span>…). Our team can follow up in the
                  support queue.
                </div>
              ) : null}
              {messages.length === 0 ? (
                <div className="flex flex-col items-center px-2 py-4 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100">
                    <Sparkles className="h-8 w-8 text-[#FF8C42]" />
                  </div>
                  <h4 className="mb-2 font-semibold text-gray-900">
                    Hi{userName ? `, ${userName.split(' ')[0]}` : ''}! 👋
                  </h4>
                  <p className="mb-4 text-sm text-gray-500">
                    I&apos;m your AI assistant. Ask me anything about managing your business, bookings, or getting
                    support.
                  </p>

                  <div className="w-full max-w-full space-y-2 pb-2">
                    <p className="text-xs uppercase tracking-wide text-gray-400">Quick questions</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {quickSuggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          type="button"
                          disabled={isTyping}
                          onClick={() => void sendChatMessage(suggestion)}
                          className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 transition-colors hover:border-[#FF8C42] hover:text-[#FF8C42] disabled:opacity-50"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.role === 'assistant' && (
                        <div
                          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FF8C42] to-[#FF6B1A] shadow-md ring-2 ring-white"
                          aria-hidden
                        >
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                      )}
                      <div
                        className={`group min-w-0 max-w-[min(85%,20rem)] ${
                          msg.role === 'user' ? 'flex flex-col items-end' : ''
                        }`}
                      >
                        <div
                          className={`rounded-2xl px-4 py-3 shadow-md transition-shadow ${
                            msg.role === 'user'
                              ? 'rounded-br-md bg-gradient-to-br from-[#FF8C42] via-[#FF7A35] to-[#FF5C1A] text-white shadow-orange-500/20'
                              : 'rounded-bl-md border border-gray-100/80 bg-white text-gray-900 shadow-gray-200/60 ring-1 ring-gray-900/5'
                          }`}
                        >
                          {msg.role === 'assistant' && (
                            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[#FF7A35]">
                              Assistant
                            </p>
                          )}
                          <ChatMessageBody content={msg.content} variant={msg.role} />
                        </div>
                        <div
                          className={`mt-1 flex items-center gap-1 px-0.5 ${
                            msg.role === 'user' ? 'justify-end' : 'justify-start pl-10'
                          }`}
                        >
                          <time
                            dateTime={msg.timestamp.toISOString()}
                            className={`text-[11px] tabular-nums ${
                              msg.role === 'user' ? 'text-gray-500' : 'text-gray-400'
                            }`}
                          >
                            {formatTime(msg.timestamp)}
                          </time>
                        </div>
                      </div>
                      {msg.role === 'user' && (
                        <div
                          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 ring-2 ring-white"
                          aria-hidden
                        >
                          <User className="h-4 w-4 text-gray-600" />
                        </div>
                      )}
                    </div>
                  ))}

                  {isTyping && (
                    <div className="flex justify-start gap-2">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FF8C42] to-[#FF6B1A] shadow-md ring-2 ring-white">
                        <Bot className="h-4 w-4 text-white" aria-hidden />
                      </div>
                      <div className="rounded-2xl rounded-bl-md border border-gray-100/80 bg-white px-4 py-3 shadow-md ring-1 ring-gray-900/5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 animate-bounce rounded-full bg-[#FF8C42]/70"
                            style={{ animationDelay: '0ms' }}
                          />
                          <span
                            className="h-2 w-2 animate-bounce rounded-full bg-[#FF8C42]/70"
                            style={{ animationDelay: '150ms' }}
                          />
                          <span
                            className="h-2 w-2 animate-bounce rounded-full bg-[#FF8C42]/70"
                            style={{ animationDelay: '300ms' }}
                          />
                        </div>
                        <p className="mt-2 text-[11px] text-gray-400">Thinking…</p>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            <div className="border-t border-gray-100 bg-white p-4">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Type your message..."
                  disabled={isTyping}
                  className="flex-1 rounded-xl border-0 bg-gray-100 px-4 py-2.5 text-sm transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FF8C42] disabled:opacity-50"
                />
                <Button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={!input.trim() || isTyping}
                  className="rounded-xl bg-gradient-to-r from-[#FF8C42] to-[#FF6B1A] px-4 hover:from-[#FF7A2E] hover:to-[#FF5500] disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-center text-[10px] text-gray-400">
                Powered by AI • Responses may take a moment
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
