'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Paperclip, Image, FileText, AlertCircle, Clock, CheckCheck, User, Phone, Calendar, MessageSquare, Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

interface ChatMessage {
  id: string;
  booking_id: string;
  sender_phone: string;
  sender_name: string;
  sender_type: 'customer' | 'vendor' | 'system';
  message: string;
  message_type: 'text' | 'image' | 'file' | 'system';
  file_id?: string;
  file_name?: string;
  file_url?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

interface BookingInfo {
  id: string;
  status: string;
  customerName: string;
  customerPhone: string;
  vendorName: string;
  vendorPhone: string;
  serviceName?: string;
  bookingDate?: string;
  bookingTime?: string;
  petName?: string;
}

interface VendorChatModalProps {
  bookingId: string;
  vendorId?: string;
  vendorPhone?: string;
  vendorName?: string;
  customerPhone?: string;
  customerName?: string;
  bookingStatus?: string;
  serviceName?: string;
  onClose: () => void;
  onSupportHandoff?: (bookingId: string, reason: string) => void;
}

// ============================================================================
// CHAT STATUS HELPERS
// ============================================================================

const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed', 'in_progress', 'active'];

function isChatActive(status: string): boolean {
  return ACTIVE_BOOKING_STATUSES.includes(status?.toLowerCase());
}

function getChatStatusMessage(status: string): string {
  if (isChatActive(status)) {
    return 'Chat is active for this booking';
  }
  switch (status?.toLowerCase()) {
    case 'completed':
      return 'Booking completed - Chat has ended. Use Support for further assistance.';
    case 'cancelled':
      return 'Booking cancelled - Chat is not available.';
    default:
      return 'Chat is not available for this booking status.';
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function VendorChatModal({ 
  bookingId, 
  vendorId,
  vendorPhone, 
  vendorName, 
  customerPhone, 
  customerName,
  bookingStatus = 'active',
  serviceName,
  onClose,
  onSupportHandoff
}: VendorChatModalProps) {
  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState(bookingStatus);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Check if chat is active based on booking status
  const chatActive = isChatActive(status);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  const loadConversation = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);

      const response = await apiClient.get(`/chat/booking/${bookingId}/conversation`) as any;
      
      if (response.success || response.messages) {
        setMessages(response.messages || []);
        
        // Update booking info from response
        if (response.booking) {
          setBooking(response.booking);
          if (response.booking.status) {
            setStatus(response.booking.status);
          }
        }
      }
    } catch (err: any) {
      if (!silent) {
        console.error('Error loading conversation:', err);
        setError(err.message || 'Failed to load conversation');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [bookingId]);

  // Initial load
  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  // Polling for new messages (every 3 seconds while chat is active)
  useEffect(() => {
    if (!chatActive) return;

    pollingRef.current = setInterval(() => {
      loadConversation(true);
    }, 3000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [chatActive, loadConversation]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark messages as read when they appear
  useEffect(() => {
    const unreadFromCustomer = messages.filter(
      m => m.sender_type === 'customer' && !m.is_read
    );
    
    unreadFromCustomer.forEach(async (msg) => {
      try {
        await apiClient.put(`/chat/messages/${msg.id}/read`, {});
      } catch (e) {
        // Silent fail for read receipts
      }
    });
  }, [messages]);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !chatActive) return;

    try {
      setSending(true);
      setError(null);

      // Optimistic update
      const optimisticMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        booking_id: bookingId,
        sender_phone: vendorPhone || '',
        sender_name: vendorName || 'Vendor',
        sender_type: 'vendor',
        message: newMessage.trim(),
        message_type: 'text',
        is_read: false,
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, optimisticMessage]);
      const messageText = newMessage.trim();
      setNewMessage('');

      // Send to API
      await apiClient.post(`/chat/booking/${bookingId}/message`, {
        senderPhone: vendorPhone,
        senderName: vendorName || 'Vendor',
        senderType: 'vendor',
        message: messageText,
        messageType: 'text',
      });

      // Reload to get server-confirmed message
      await loadConversation(true);
    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(err.message || 'Failed to send message');
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chatActive) return;

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    try {
      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('bookingId', bookingId);
      formData.append('senderPhone', vendorPhone || '');
      formData.append('senderName', vendorName || 'Vendor');
      formData.append('senderType', 'vendor');

      // Use fetch directly for FormData
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/chat/upload-file`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to upload file');
      }

      const result = await response.json();
      
      if (result.success) {
        toast.success('File sent successfully');
        await loadConversation(true);
      }
    } catch (err: any) {
      console.error('Error uploading file:', err);
      setError(err.message || 'Failed to upload file');
      toast.error('Failed to send file');
    } finally {
      setUploading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSupportHandoff = async () => {
    try {
      // Create support ticket via chat handoff endpoint
      const response = await apiClient.post('/support/chat-handoff', {
        bookingId,
        vendorId,
        userType: 'vendor',
        reason: 'Vendor needs support assistance after booking completion',
      }) as any;

      if (response.success) {
        toast.success('Support ticket created! Our team will assist you shortly.');
        if (onSupportHandoff) {
          onSupportHandoff(bookingId, 'Support ticket created');
        }
        onClose();
      } else {
        toast.error('Failed to create support ticket');
      }
    } catch (err: any) {
      console.error('Error creating support handoff:', err);
      toast.error('Failed to contact support. Please try again.');
    }
  };

  // ============================================================================
  // HELPERS
  // ============================================================================

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="w-4 h-4" />;
      case 'file': return <FileText className="w-4 h-4" />;
      default: return null;
    }
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = new Date(message.created_at).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {} as Record<string, ChatMessage[]>);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B1A] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{customerName || 'Customer'}</h2>
              <div className="flex items-center gap-2 text-white/80 text-sm">
                {serviceName && <span>{serviceName}</span>}
                {customerPhone && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {customerPhone}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Chat Status Banner */}
        {!chatActive && (
          <div className={`px-4 py-3 flex items-center justify-between ${
            status === 'completed' ? 'bg-gray-100' : 'bg-red-50'
          }`}>
            <div className="flex items-center gap-2">
              <AlertCircle className={`w-5 h-5 ${status === 'completed' ? 'text-gray-500' : 'text-red-500'}`} />
              <span className={`text-sm ${status === 'completed' ? 'text-gray-600' : 'text-red-600'}`}>
                {getChatStatusMessage(status)}
              </span>
            </div>
            {status === 'completed' && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSupportHandoff}
                className="flex items-center gap-2"
              >
                <Headphones className="w-4 h-4" />
                Contact Support
              </Button>
            )}
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-gray-500">Loading messages...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-2" />
                <p className="text-red-600">{error}</p>
                <Button 
                  onClick={() => loadConversation()} 
                  className="mt-4"
                  variant="outline"
                >
                  Retry
                </Button>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">No messages yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  {chatActive 
                    ? 'Start the conversation by sending a message' 
                    : 'Chat history is empty'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedMessages).map(([date, msgs]) => (
                <div key={date}>
                  {/* Date Separator */}
                  <div className="flex items-center justify-center my-4">
                    <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                      {formatDate(msgs[0].created_at)}
                    </div>
                  </div>
                  
                  {/* Messages for this date */}
                  {msgs.map((message) => (
                    <div 
                      key={message.id} 
                      className={`flex ${message.sender_type === 'vendor' ? 'justify-end' : 'justify-start'} mb-3`}
                    >
                      {message.sender_type === 'system' ? (
                        <div className="bg-gray-100 text-gray-600 text-xs px-4 py-2 rounded-full max-w-[80%] text-center">
                          {message.message}
                        </div>
                      ) : (
                        <div className={`max-w-[75%] ${message.sender_type === 'vendor' ? 'order-1' : ''}`}>
                          {/* Sender name for customer messages */}
                          {message.sender_type === 'customer' && (
                            <p className="text-xs text-gray-500 mb-1 ml-1">{message.sender_name || 'Customer'}</p>
                          )}
                          
                          <div className={`px-4 py-3 rounded-2xl ${
                            message.sender_type === 'vendor'
                              ? 'bg-[#FF8C42] text-white rounded-br-sm'
                              : 'bg-white text-gray-900 rounded-bl-sm shadow-sm border border-gray-100'
                          }`}>
                            {/* File/Image attachment */}
                            {message.message_type !== 'text' && message.file_name && (
                              <a 
                                href={message.file_url || `/chat/file/${message.file_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-2 mb-2 ${
                                  message.sender_type === 'vendor' ? 'text-white/90' : 'text-blue-600'
                                } hover:underline`}
                              >
                                {getMessageIcon(message.message_type)}
                                <span className="text-sm truncate">{message.file_name}</span>
                              </a>
                            )}
                            
                            {/* Message text */}
                            <p className="whitespace-pre-wrap break-words">{message.message}</p>
                          </div>
                          
                          {/* Time and read status */}
                          <div className={`flex items-center gap-1 mt-1 ${
                            message.sender_type === 'vendor' ? 'justify-end' : 'justify-start'
                          }`}>
                            <span className="text-xs text-gray-400">{formatTime(message.created_at)}</span>
                            {message.sender_type === 'vendor' && (
                              <CheckCheck className={`w-3.5 h-3.5 ${
                                message.is_read ? 'text-blue-500' : 'text-gray-400'
                              }`} />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-gray-200">
          {chatActive ? (
            <div className="flex items-end gap-3">
              {/* File Upload Button */}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept="image/*,.pdf,.doc,.docx"
                disabled={uploading}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition disabled:opacity-50"
              >
                {uploading ? (
                  <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Paperclip className="w-5 h-5" />
                )}
              </button>

              {/* Message Input */}
              <div className="flex-1 relative">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Type a message..."
                  rows={1}
                  className="w-full px-4 py-3 bg-gray-100 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-[#FF8C42] max-h-32"
                  style={{ minHeight: '48px' }}
                />
              </div>

              {/* Send Button */}
              <Button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || sending}
                className="p-3 bg-[#FF8C42] hover:bg-[#FF6B1A] text-white rounded-full disabled:opacity-50"
              >
                {sending ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              <p className="text-sm">Chat is no longer active for this booking.</p>
              {status === 'completed' && (
                <Button
                  onClick={handleSupportHandoff}
                  className="mt-3 bg-[#FF8C42] hover:bg-[#FF6B1A]"
                >
                  <Headphones className="w-4 h-4 mr-2" />
                  Contact Support
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
