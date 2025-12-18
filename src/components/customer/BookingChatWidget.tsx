import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { MessageCircle, Send, X, Paperclip, FileText, Video, Phone, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

/**
 * 💬 BOOKING CHAT WIDGET
 * 
 * Role-based chat widget that adapts based on:
 * - Vendor role (veterinarian, groomer, trainer, etc.)
 * - Booking stage (pre-consultation, during, post)
 * - Available features (prescription sharing, medical records, video call)
 * 
 * Features:
 * - Real-time messaging
 * - File attachments
 * - Prescription sharing
 * - Medical records access
 * - Video call integration
 * - Role-specific context
 */

interface ChatMessage {
  id: string;
  bookingId: string;
  senderPhone: string;
  senderName: string;
  senderType: 'customer' | 'vendor';
  message: string;
  messageType: 'text' | 'image' | 'file' | 'prescription';
  timestamp: string;
  read: boolean;
  fileId?: string;
  fileName?: string;
}

interface ChatConfig {
  chatEnabled: boolean;
  features: {
    prescriptionSharing: boolean;
    medicalRecordsAccess: boolean;
    fileSharing: boolean;
    videoCall: boolean;
    followUpScheduling: boolean;
  };
  chatTypes: string[];
  defaultChatType: string;
}

interface BookingChatWidgetProps {
  bookingId: string;
  vendorId: string;
  vendorName: string;
  customerPhone: string;
  customerName: string;
  petName: string;
  serviceName?: string;
  totalAmount?: number;
  bookingStage?: 'pre-consultation' | 'during' | 'post';
  onVideoCallRequest?: () => void;
  onPrescriptionRequest?: () => void;
}

export function BookingChatWidget({
  bookingId,
  vendorId,
  vendorName,
  customerPhone,
  customerName,
  petName,
  serviceName,
  totalAmount,
  bookingStage = 'pre-consultation',
  onVideoCallRequest,
  onPrescriptionRequest
}: BookingChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatConfig, setChatConfig] = useState<ChatConfig | null>(null);
  const [roleContext, setRoleContext] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (bookingId && vendorId) {
      loadChatConfig();
      loadRoleContext();
      loadMessages();
    }
  }, [bookingId, vendorId]);

  useEffect(() => {
    if (isOpen && messages.length > 0) {
      markMessagesAsRead();
    }
  }, [isOpen, messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-refresh messages when chat is open
  useEffect(() => {
    if (isOpen) {
      const interval = setInterval(() => {
        loadMessages();
      }, 3000); // Poll every 3 seconds

      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatConfig = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/chat-config`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setChatConfig(data.chatConfig);
      }
    } catch (error) {
      console.error('Failed to load chat config:', error);
    }
  };

  const loadRoleContext = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/booking/${bookingId}/chat/role-context`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setRoleContext(data.roleContext);
      }
    } catch (error) {
      console.error('Failed to load role context:', error);
    }
  };

  const loadMessages = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/chat/booking/${bookingId}/conversation`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        
        // Count unread messages
        const unread = data.messages?.filter((msg: ChatMessage) => 
          msg.senderType !== 'customer' && !msg.read
        ).length || 0;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const markMessagesAsRead = async () => {
    try {
      await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/chat/booking/${bookingId}/read`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ readerPhone: customerPhone })
        }
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/chat/booking/${bookingId}/message`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            senderPhone: customerPhone,
            senderName: customerName,
            senderType: 'customer',
            message: newMessage,
            messageType: 'text'
          })
        }
      );

      if (response.ok) {
        setNewMessage('');
        loadMessages();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bookingId', bookingId);
      formData.append('senderPhone', customerPhone);
      formData.append('senderName', customerName);
      formData.append('senderType', 'customer');
      formData.append('caption', `Shared ${file.name}`);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/chat/upload-file`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${publicAnonKey}` },
          body: formData
        }
      );

      if (response.ok) {
        toast.success('File uploaded successfully');
        loadMessages();
      } else {
        toast.error('Failed to upload file');
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
      toast.error('Failed to upload file');
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const getChatStageLabel = () => {
    switch (bookingStage) {
      case 'pre-consultation':
        return 'Pre-Consultation Chat';
      case 'during':
        return 'Live Consultation';
      case 'post':
        return 'Post-Consultation Follow-up';
      default:
        return 'Chat';
    }
  };

  const getStageColor = () => {
    switch (bookingStage) {
      case 'pre-consultation':
        return 'bg-blue-100 text-blue-700';
      case 'during':
        return 'bg-green-100 text-green-700';
      case 'post':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (!chatConfig?.chatEnabled) {
    return null; // Chat not available for this vendor
  }

  return (
    <>
      {/* Chat Toggle Button */}
      <motion.div
        className="fixed bottom-6 right-6 z-50"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-full w-16 h-16 shadow-lg hover:shadow-xl transition-all relative"
        >
          <MessageCircle className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Button>
      </motion.div>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-28 right-6 z-50 w-96 h-[600px] shadow-2xl rounded-2xl overflow-hidden"
          >
            <Card className="h-full flex flex-col">
              {/* Header */}
              <div className="bg-gradient-to-r from-orange-500 to-pink-500 text-white p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{vendorName}</h3>
                      <p className="text-xs text-white/80">Chat about {petName}</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setIsOpen(false)}
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
                <Badge className={`${getStageColor()} text-xs`}>
                  {getChatStageLabel()}
                </Badge>
              </div>

              {/* Action Bar */}
              {roleContext?.supportedFeatures && (
                <div className="bg-gray-50 p-2 flex items-center gap-2 border-b">
                  {roleContext.supportedFeatures.videoCall && onVideoCallRequest && (
                    <Button
                      onClick={onVideoCallRequest}
                      size="sm"
                      variant="outline"
                      className="text-xs"
                    >
                      <Video className="w-4 h-4 mr-1" />
                      Video Call
                    </Button>
                  )}
                  {roleContext.supportedFeatures.prescriptionSharing && onPrescriptionRequest && (
                    <Button
                      onClick={onPrescriptionRequest}
                      size="sm"
                      variant="outline"
                      className="text-xs"
                    >
                      <FileText className="w-4 h-4 mr-1" />
                      Prescription
                    </Button>
                  )}
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">No messages yet</p>
                    <p className="text-xs mt-1">Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.senderType === 'customer' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                          msg.senderType === 'customer'
                            ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white'
                            : 'bg-white border border-gray-200'
                        }`}
                      >
                        {msg.senderType !== 'customer' && (
                          <p className="text-xs font-medium text-gray-600 mb-1">
                            {msg.senderName}
                          </p>
                        )}
                        {msg.messageType === 'file' && (
                          <div className="flex items-center gap-2 mb-2">
                            <Paperclip className="w-4 h-4" />
                            <span className="text-sm">{msg.fileName}</span>
                          </div>
                        )}
                        <p className="text-sm">{msg.message}</p>
                        <p
                          className={`text-xs mt-1 ${
                            msg.senderType === 'customer'
                              ? 'text-white/70'
                              : 'text-gray-400'
                          }`}
                        >
                          {formatTimestamp(msg.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 bg-white border-t">
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept="image/*,application/pdf,.doc,.docx"
                  />
                  {chatConfig.features.fileSharing && (
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      size="sm"
                      variant="outline"
                      disabled={loading}
                    >
                      <Paperclip className="w-4 h-4" />
                    </Button>
                  )}
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    disabled={loading}
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={loading || !newMessage.trim()}
                    className="bg-gradient-to-r from-orange-500 to-pink-500 text-white"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}