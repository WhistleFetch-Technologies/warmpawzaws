'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { 
  ArrowLeft, 
  MessageSquare, 
  Send, 
  Phone, 
  User,
  Loader2,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Message {
  id: string;
  sender_id: string;
  sender_type: 'staff' | 'customer';
  message: string;
  created_at: string;
  read_at?: string;
}

interface Conversation {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_photo?: string;
  booking_id?: string;
  booking_date?: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
  messages: Message[];
}

export default function StaffMessagesPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<any>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const staffSession = localStorage.getItem('staff_session');
      if (staffSession) {
        try {
          const staffData = JSON.parse(staffSession);
          setStaff(staffData);
          loadConversations(staffData.id);
        } catch (error) {
          console.error('Error parsing staff session:', error);
          router.push('/staff/login');
        }
      } else {
        router.push('/staff/login');
      }
    }
  }, [router]);

  useEffect(() => {
    if (selectedConversation) {
      scrollToBottom();
      markAsRead();
    }
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [selectedConversation?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async (staffId: string) => {
    try {
      setLoading(true);
      // Fetch conversations for this staff member
      // This endpoint should return all conversations where staff is involved
      const response = await apiClient.get<any>(`/staff/${staffId}/conversations`);
      
      if (response.success && response.conversations) {
        setConversations(response.conversations);
      } else {
        // Fallback: create mock conversations from bookings
        const bookingsResponse = await apiClient.get<any>(`/staff/${staffId}/appointments`);
        if (bookingsResponse.appointments) {
          const mockConversations: Conversation[] = bookingsResponse.appointments.map((booking: any) => ({
            id: `conv_${booking.id}`,
            customer_id: booking.customer_id || 'unknown',
            customer_name: booking.customer_name || 'Customer',
            customer_phone: booking.customer_phone || '',
            booking_id: booking.id,
            booking_date: booking.booking_date,
            last_message: 'Tap to start conversation',
            last_message_at: booking.booking_date,
            unread_count: 0,
            messages: [],
          }));
          setConversations(mockConversations);
        }
      }
    } catch (error: any) {
      console.error('Error loading conversations:', error);
      // Create mock conversations from bookings as fallback
      try {
        const bookingsResponse = await apiClient.get<any>(`/staff/${staffId}/appointments`);
        if (bookingsResponse.appointments) {
          const mockConversations: Conversation[] = bookingsResponse.appointments.map((booking: any) => ({
            id: `conv_${booking.id}`,
            customer_id: booking.customer_id || 'unknown',
            customer_name: booking.customer_name || 'Customer',
            customer_phone: booking.customer_phone || '',
            booking_id: booking.id,
            booking_date: booking.booking_date,
            last_message: 'Tap to start conversation',
            last_message_at: booking.booking_date,
            unread_count: 0,
            messages: [],
          }));
          setConversations(mockConversations);
        }
      } catch (e) {
        toast.error('Failed to load conversations');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const response = await apiClient.get<any>(`/staff/conversations/${conversationId}/messages`);
      if (response.success && response.messages) {
        setSelectedConversation(prev => prev ? {
          ...prev,
          messages: response.messages,
        } : null);
      }
    } catch (error: any) {
      console.error('Error loading messages:', error);
      // If endpoint doesn't exist, use empty messages array
      if (selectedConversation) {
        setSelectedConversation({
          ...selectedConversation,
          messages: [],
        });
      }
    }
  };

  const markAsRead = async () => {
    if (!selectedConversation || !staff) return;
    
    try {
      await apiClient.post<any>(`/staff/conversations/${selectedConversation.id}/read`);
      // Update local state
      setConversations(prev => prev.map(conv => 
        conv.id === selectedConversation.id 
          ? { ...conv, unread_count: 0 }
          : conv
      ));
    } catch (error) {
      // Silently fail if endpoint doesn't exist
      console.error('Error marking as read:', error);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedConversation || !staff) return;

    try {
      setSending(true);
      const response = await apiClient.post<any>(`/staff/conversations/${selectedConversation.id}/messages`, {
        message: messageText.trim(),
      });

      if (response.success) {
        const newMessage: Message = {
          id: response.message?.id || `msg_${Date.now()}`,
          sender_id: staff.id,
          sender_type: 'staff',
          message: messageText.trim(),
          created_at: new Date().toISOString(),
        };

        setSelectedConversation(prev => prev ? {
          ...prev,
          messages: [...(prev.messages || []), newMessage],
          last_message: messageText.trim(),
          last_message_at: new Date().toISOString(),
        } : null);

        setMessageText('');
        scrollToBottom();
      } else {
        throw new Error(response.error || 'Failed to send message');
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error(error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    loadMessages(conversation.id);
  };

  const filteredConversations = conversations.filter(conv => 
    conv.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.customer_phone.includes(searchQuery)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF8C42] mx-auto mb-4" />
          <p className="text-gray-600">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Conversations List */}
      <div className="w-full md:w-1/3 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-[#FF8C42] text-white">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => router.push('/staff/dashboard')}
              className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold">Messages</h1>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/70 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/20 border-white/30 text-white placeholder:text-white/70"
            />
          </div>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No conversations yet</p>
              <p className="text-sm mt-1">Start chatting with customers from your appointments</p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleSelectConversation(conv)}
                className={`w-full p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left ${
                  selectedConversation?.id === conv.id ? 'bg-orange-50 border-l-4 border-l-[#FF8C42]' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#FF8C42] flex items-center justify-center flex-shrink-0">
                    {conv.customer_photo ? (
                      <img
                        src={conv.customer_photo}
                        alt={conv.customer_name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <User className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-gray-900 truncate">{conv.customer_name}</p>
                      {conv.unread_count > 0 && (
                        <Badge className="bg-[#FF8C42] text-white text-xs">
                          {conv.unread_count}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 truncate">{conv.last_message || 'No messages yet'}</p>
                    {conv.last_message_at && (
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(conv.last_message_at).toLocaleDateString()}
                      </p>
                    )}
                    {conv.booking_date && (
                      <Badge variant="outline" className="text-xs mt-1">
                        Booking: {new Date(conv.booking_date).toLocaleDateString()}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Messages View */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#FF8C42] flex items-center justify-center">
                    {selectedConversation.customer_photo ? (
                      <img
                        src={selectedConversation.customer_photo}
                        alt={selectedConversation.customer_name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <User className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{selectedConversation.customer_name}</p>
                    <p className="text-sm text-gray-500">{selectedConversation.customer_phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`tel:${selectedConversation.customer_phone}`)}
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Call
                  </Button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {selectedConversation.messages && selectedConversation.messages.length > 0 ? (
                selectedConversation.messages.map((message) => {
                  const isStaff = message.sender_type === 'staff';
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isStaff ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          isStaff
                            ? 'bg-[#FF8C42] text-white'
                            : 'bg-white text-gray-900 border border-gray-200'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                        <p className={`text-xs mt-1 ${
                          isStaff ? 'text-white/70' : 'text-gray-400'
                        }`}>
                          {new Date(message.created_at).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No messages yet</p>
                  <p className="text-sm mt-1">Start the conversation!</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="Type a message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  onClick={sendMessage}
                  disabled={!messageText.trim() || sending}
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
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center text-gray-500">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="text-sm mt-1">Choose a conversation from the list to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
