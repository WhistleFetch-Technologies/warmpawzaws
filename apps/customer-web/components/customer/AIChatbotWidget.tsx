'use client';
/**
 * AI Chatbot Widget - Web
 * AWS Bedrock-powered chatbot with symptoms checker, booking assist, and support
 * Phase 3: AI Chatbot Integration
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, User, AlertCircle } from 'lucide-react';
import { apiClient, aiChatbotApi, supportCrmApi } from '@/lib/api-client';

interface AIChatbotWidgetProps {
  customerId?: string;
  customerPhone?: string;
  petId?: string;
  onClose?: () => void;
  onNavigate?: (path: string) => void;
}

interface Message {
  id: string;
  type: 'user' | 'bot' | 'system';
  content: string;
  timestamp: string;
  intent?: string;
  suggestedActions?: string[];
  requiresAgent?: boolean;
}

export function AIChatbotWidget({
  customerId,
  customerPhone,
  petId,
  onClose,
  onNavigate,
}: AIChatbotWidgetProps) {
  // Widget is always open when rendered - parent controls visibility via conditional rendering
  const [isOpen, setIsOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'bot',
      content: "Hi! I'm your Warmpawz AI Assistant. I can help you with:\n\n• Pet health symptoms checker\n• Smart booking assistance\n• General support questions\n\nHow can I help you today?",
      timestamp: new Date().toISOString(),
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
          suggestedActions: response.vetBookingSuggested ? ['Find Vet Clinic', 'Book Consultation'] : [],
        };
        
        setMessages(prev => [...prev, botMessage]);
        
        if (response.shouldSeeVet && response.vetBookingSuggested && onNavigate) {
          setTimeout(() => {
            onNavigate('/search?category=vet');
          }, 1000);
        }
      } else if (mode === 'booking') {
        response = await aiChatbotApi.bookingAssist({
          query: messageText,
          customerId,
          customerPhone,
          petId,
        });
        
        const botMessage: Message = {
          id: `bot-${Date.now()}`,
          type: 'bot',
          content: response.response || "I'd be happy to help you book a service!",
          timestamp: new Date().toISOString(),
          intent: 'booking',
          suggestedActions: response.nextSteps || [],
        };
        
        setMessages(prev => [...prev, botMessage]);
        
        if (response.bookingUrl && onNavigate) {
          setTimeout(() => {
            onNavigate(response.bookingUrl || '/book');
          }, 1000);
        }
      } else {
        response = await aiChatbotApi.chat({
          message: messageText,
          customerId,
          customerPhone,
          conversationId: conversationId || undefined,
          petId,
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
          suggestedActions: response.suggestedActions || [],
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

  const handleSuggestedAction = (action: string) => {
    if (!onNavigate) return;
    
    if (action.includes('Vet') || action.includes('Clinic')) {
      onNavigate('/search?category=vet');
    } else if (action.includes('Book')) {
      onNavigate('/book');
    } else if (action.includes('Shop')) {
      onNavigate('/shop');
    }
  };

  // If closed internally, call parent's onClose to unmount
  if (!isOpen) {
    onClose?.();
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 h-[600px] bg-white rounded-lg shadow-2xl flex flex-col border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-primary-600 text-white rounded-t-lg">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <h3 className="font-semibold">AI Assistant</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <button
              onClick={() => setMode('chat')}
              className={`px-2 py-1 text-xs rounded ${mode === 'chat' ? 'bg-white text-primary-600' : 'bg-primary-500'}`}
            >
              Chat
            </button>
            <button
              onClick={() => setMode('symptoms')}
              className={`px-2 py-1 text-xs rounded ${mode === 'symptoms' ? 'bg-white text-primary-600' : 'bg-primary-500'}`}
            >
              Symptoms
            </button>
            <button
              onClick={() => setMode('booking')}
              className={`px-2 py-1 text-xs rounded ${mode === 'booking' ? 'bg-white text-primary-600' : 'bg-primary-500'}`}
            >
              Booking
            </button>
          </div>
          <button
            onClick={() => {
              setIsOpen(false);
              onClose?.();
            }}
            className="ml-2 hover:bg-primary-700 rounded p-1"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.type === 'user'
                  ? 'bg-primary-600 text-white'
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
                      className="px-3 py-1 text-xs bg-white text-primary-600 border border-primary-600 rounded-md hover:bg-primary-50"
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
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            disabled={sending}
          />
          <button
            onClick={sendMessage}
            disabled={!inputText.trim() || sending}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

