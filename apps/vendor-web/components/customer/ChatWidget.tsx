'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Minus, Bot, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

interface ChatWidgetProps {
  userId?: string;
  userName?: string;
  userType?: 'customer' | 'vendor';
  defaultOpen?: boolean;
  onClose?: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function ChatWidget({ userId, userName, userType = 'vendor', defaultOpen = false, onClose }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  // Clear unread count when opening
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setUnreadCount(0);
    }
  }, [isOpen, isMinimized]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await apiClient.post('/ai-chatbot/chat', {
        message: userMessage.content,
        customerId: userId || null,
        context: {
          userName,
          userType,
          previousMessages: messages.slice(-5).map(m => ({
            role: m.role,
            content: m.content,
          })),
        },
      }) as any;

      const assistantMessage: Message = {
        role: 'assistant',
        content: response?.response || response?.message || "I'm here to help! How can I assist you today?",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // If minimized, increment unread count
      if (isMinimized) {
        setUnreadCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('AI chatbot error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: "I'm sorry, I'm having trouble connecting right now. Please try again in a moment, or contact support if the issue persists.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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

  // Quick suggestions for first-time users
  const quickSuggestions = [
    "How do I manage my services?",
    "Help with bookings",
    "Payment & settlements",
    "Contact support",
  ];

  return (
    <>
      {/* Launcher Button - Always visible when chat is closed or minimized */}
      {(!isOpen || isMinimized) && (
        <button
          onClick={isMinimized ? handleMaximize : toggleOpen}
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] right-4 z-40 group"
          aria-label="Open chat"
        >
          {/* Pulse ring animation */}
          <span className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-400 to-amber-500 animate-ping opacity-25" />
          
          {/* Button */}
          <div className="relative w-14 h-14 bg-gradient-to-br from-[#FF8C42] to-[#FF6B1A] rounded-full shadow-lg flex items-center justify-center hover:shadow-xl hover:scale-105 transition-all duration-200">
            <MessageSquare className="w-6 h-6 text-white" />
            
            {/* Unread badge */}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-bounce">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          
          {/* Tooltip */}
          <span className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            {isMinimized ? 'Open Chat' : 'Need Help?'}
            <span className="absolute top-full right-4 border-4 border-transparent border-t-gray-900" />
          </span>
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && !isMinimized && (
        <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] right-2 left-2 sm:left-auto sm:right-4 z-40 sm:w-[360px] h-[min(520px,calc(100vh-8rem))] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B1A] p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Warmpawz Assistant</h3>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-xs text-white/80">Online • AI-powered</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleMinimize}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Minimize chat"
              >
                <Minus className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={toggleOpen}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Close chat"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-[#FF8C42]" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Hi{userName ? `, ${userName.split(' ')[0]}` : ''}! 👋</h4>
                <p className="text-sm text-gray-500 mb-6">
                  I'm your AI assistant. Ask me anything about managing your business, bookings, or getting support.
                </p>
                
                {/* Quick Suggestions */}
                <div className="w-full space-y-2">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Quick questions</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {quickSuggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setInput(suggestion);
                          inputRef.current?.focus();
                        }}
                        className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:border-[#FF8C42] hover:text-[#FF8C42] transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-r from-[#FF8C42] to-[#FF6B1A] text-white rounded-br-sm'
                          : 'bg-white text-gray-900 shadow-sm border border-gray-100 rounded-bl-sm'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-white/70' : 'text-gray-400'}`}>
                        {formatTime(msg.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
                
                {/* Typing indicator */}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-gray-100">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-gray-100">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                disabled={isTyping}
                className="flex-1 px-4 py-2.5 bg-gray-100 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:bg-white transition-all disabled:opacity-50"
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="px-4 bg-gradient-to-r from-[#FF8C42] to-[#FF6B1A] hover:from-[#FF7A2E] hover:to-[#FF5500] rounded-xl disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-[10px] text-gray-400 mt-2 text-center">
              Powered by AI • Responses may take a moment
            </p>
          </div>
        </div>
      )}
    </>
  );
}
