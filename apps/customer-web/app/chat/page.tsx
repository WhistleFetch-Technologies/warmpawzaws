'use client';

import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api-client';

// ============================================================================
// TYPES
// ============================================================================

interface Conversation {
  id: string;
  participant_type: 'vendor' | 'support';
  participant_id: string;
  participant_name: string;
  participant_avatar?: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  booking_id?: string;
  booking_service?: string;
  is_online: boolean;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_type: 'customer' | 'vendor' | 'support' | 'system';
  sender_id: string;
  content: string;
  content_type: 'text' | 'image' | 'file' | 'booking_card' | 'system';
  attachment_url?: string;
  attachment_name?: string;
  created_at: string;
  read_at?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Message input
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (activeConversation) {
      loadMessages(activeConversation.id);
      markAsRead(activeConversation.id);
    }
  }, [activeConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Polling for new messages
  useEffect(() => {
    if (!activeConversation) return;
    
    const interval = setInterval(() => {
      loadMessages(activeConversation.id, true);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [activeConversation]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.get<any>('/chat/conversations');
      setConversations(response.conversations || response || []);
    } catch (err: any) {
      console.error('Error loading conversations:', err);
      setError(err.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId: string, silent = false) => {
    try {
      if (!silent) setLoading(true);
      
      const response = await apiClient.get<any>(`/chat/conversations/${conversationId}/messages`);
      setMessages(response.messages || response || []);
    } catch (err) {
      if (!silent) console.error('Error loading messages:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const markAsRead = async (conversationId: string) => {
    try {
      await apiClient.post(`/chat/conversations/${conversationId}/read`, {});
      setConversations(prev => prev.map(c => 
        c.id === conversationId ? { ...c, unread_count: 0 } : c
      ));
    } catch (err) {
      // Silent fail
    }
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeConversation) return;
    
    try {
      setSending(true);
      
      // Optimistic update
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        conversation_id: activeConversation.id,
        sender_type: 'customer',
        sender_id: 'me',
        content: newMessage,
        content_type: 'text',
        created_at: new Date().toISOString(),
      };
      
      setMessages(prev => [...prev, optimisticMessage]);
      setNewMessage('');
      
      await apiClient.post(`/chat/conversations/${activeConversation.id}/messages`, {
        content: newMessage,
        content_type: 'text',
      });
      
      loadMessages(activeConversation.id, true);
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation) return;
    
    // In production, upload to S3 and send message with attachment URL
    alert(`File upload: ${file.name} - This would upload to S3 in production`);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading && conversations.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading chats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Conversations List */}
      <div className={`${activeConversation ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-col bg-white border-r`}>
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold text-gray-900">Messages</h1>
        </div>
        
        {conversations.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-8">
              <div className="text-5xl mb-4">💬</div>
              <p className="text-gray-500">No conversations yet</p>
              <p className="text-sm text-gray-400 mt-2">Book a service to start chatting with vendors</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => setActiveConversation(conv)}
                className={`w-full p-4 flex items-start gap-3 hover:bg-gray-50 transition border-b ${
                  activeConversation?.id === conv.id ? 'bg-orange-50' : ''
                }`}
              >
                <div className="relative">
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-xl">
                    {conv.participant_type === 'support' ? '🎧' : '🏪'}
                  </div>
                  {conv.is_online && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 truncate">{conv.participant_name}</h3>
                    <span className="text-xs text-gray-400">{formatTime(conv.last_message_time)}</span>
                  </div>
                  {conv.booking_service && (
                    <p className="text-xs text-orange-600 truncate">{conv.booking_service}</p>
                  )}
                  <p className="text-sm text-gray-500 truncate mt-1">{conv.last_message}</p>
                </div>
                {conv.unread_count > 0 && (
                  <span className="w-5 h-5 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center">
                    {conv.unread_count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chat Area */}
      {activeConversation ? (
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 bg-white border-b flex items-center gap-4">
            <button
              onClick={() => setActiveConversation(null)}
              className="md:hidden text-gray-500"
            >
              ← Back
            </button>
            <div className="relative">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-lg">
                {activeConversation.participant_type === 'support' ? '🎧' : '🏪'}
              </div>
              {activeConversation.is_online && (
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900">{activeConversation.participant_name}</h2>
              {activeConversation.booking_service && (
                <p className="text-sm text-gray-500">{activeConversation.booking_service}</p>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(message => (
              <div key={message.id} className={`flex ${message.sender_type === 'customer' ? 'justify-end' : 'justify-start'}`}>
                {message.content_type === 'system' ? (
                  <div className="text-center text-xs text-gray-400 py-2 w-full">
                    {message.content}
                  </div>
                ) : (
                  <div className={`max-w-[75%] ${message.sender_type === 'customer' ? 'order-1' : ''}`}>
                    <div className={`px-4 py-3 rounded-2xl ${
                      message.sender_type === 'customer'
                        ? 'bg-orange-500 text-white rounded-br-none'
                        : 'bg-white text-gray-900 rounded-bl-none shadow-sm'
                    }`}>
                      <p>{message.content}</p>
                      {message.attachment_url && (
                        <a href={message.attachment_url} className="text-sm underline mt-2 block">
                          📎 {message.attachment_name || 'Attachment'}
                        </a>
                      )}
                    </div>
                    <p className={`text-xs text-gray-400 mt-1 ${message.sender_type === 'customer' ? 'text-right' : ''}`}>
                      {formatTime(message.created_at)}
                    </p>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="p-4 bg-white border-t">
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept="image/*,.pdf,.doc,.docx"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-gray-500 hover:text-gray-700 transition"
              >
                📎
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-1 px-4 py-3 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || sending}
                className="p-3 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition disabled:opacity-50"
              >
                {sending ? '...' : '➤'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="text-6xl mb-4">💬</div>
            <h2 className="text-xl font-semibold text-gray-900">Select a conversation</h2>
            <p className="text-gray-500 mt-2">Choose a chat from the list to start messaging</p>
          </div>
        </div>
      )}
    </div>
  );
}

