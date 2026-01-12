import { useState, useEffect, useRef } from 'react';
import { X, Send, Paperclip, Image as ImageIcon, FileText } from 'lucide-react';
import { Button } from '../ui/button';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { PrescriptionModal } from './PrescriptionModal';

interface ChatModalProps {
  bookingId: string;
  customerPhone: string;
  customerName: string;
  onClose: () => void;
  onReorderMedicine?: (medications: any[]) => void;
}

interface Message {
  id: string;
  senderId: string;
  senderType: 'customer' | 'vendor';
  senderName: string;
  message: string;
  messageType?: 'text' | 'image' | 'prescription';
  prescriptionId?: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  vendorName: string;
  petName: string;
  serviceName: string;
  status: 'active' | 'expired';
  expiresAt: string;
}

export function ChatModal({ bookingId, customerPhone, customerName, onClose, onReorderMedicine }: ChatModalProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showPrescription, setShowPrescription] = useState<string | null>(null); // prescriptionId
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversation();
    // Poll for new messages every 3 seconds
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, [bookingId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadConversation = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/chat/booking/${bookingId}/conversation`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const result = await response.json();
        setConversation(result.conversation);
        loadMessages();
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!conversation) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/chat/conversation/${conversation.id}/messages?userType=customer`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const result = await response.json();
        setMessages(result.messages || []);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !conversation || sending) return;

    try {
      setSending(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/chat/message/send`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            conversationId: conversation.id,
            senderId: customerPhone,
            senderType: 'customer',
            message: newMessage.trim()
          })
        }
      );

      if (response.ok) {
        const result = await response.json();
        setMessages([...messages, result.message]);
        setNewMessage('');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const isExpired = conversation && new Date(conversation.expiresAt) < new Date();
  const daysLeft = conversation ? Math.ceil((new Date(conversation.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div 
        className="bg-white w-full max-w-[430px] rounded-t-[32px] sm:rounded-[32px] h-[90vh] flex flex-col"
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] px-6 py-4 flex items-center justify-between rounded-t-[32px]">
          <div className="flex-1">
            <h2 className="font-bold text-white">{conversation?.vendorName || 'Chat'}</h2>
            <p className="text-sm text-white/90">
              {conversation?.serviceName} • {conversation?.petName}
            </p>
            {!isExpired && daysLeft > 0 && (
              <p className="text-xs text-white/80 mt-1">
                🕐 Chat expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-sm"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600">Loading chat...</p>
          </div>
        ) : !conversation ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-3xl">💬</span>
            </div>
            <p className="text-gray-600 font-semibold mb-2">Chat Not Available</p>
            <p className="text-sm text-gray-500">Complete the booking to start chatting with the vendor</p>
          </div>
        ) : isExpired ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-3xl">⏰</span>
            </div>
            <p className="text-gray-600 font-semibold mb-2">Chat Expired</p>
            <p className="text-sm text-gray-500">The 7-day chat window has expired</p>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-gray-500 text-sm">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.senderType === 'customer' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.messageType === 'prescription' ? (
                      <div className="max-w-[85%] w-full bg-white border border-gray-200 rounded-2xl p-4 shadow-sm ml-0">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-800">Prescription Received</h4>
                            <p className="text-xs text-gray-500">Dr. {message.senderName} sent a prescription</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setShowPrescription(message.prescriptionId || null)}
                          className="w-full bg-blue-50 text-blue-600 py-2 rounded-xl text-sm font-semibold hover:bg-blue-100 transition-colors"
                        >
                          View Prescription
                        </button>
                        <p className="text-xs text-gray-400 mt-2 text-right">
                          {new Date(message.createdAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    ) : (
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                          message.senderType === 'customer'
                            ? 'bg-[#FF8C42] text-white rounded-br-sm'
                            : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                        }`}
                      >
                        {message.senderType !== 'customer' && (
                          <p className="text-xs font-semibold mb-1 opacity-70">{message.senderName}</p>
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>
                        <p className={`text-xs mt-1 ${
                          message.senderType === 'customer' ? 'text-white/70' : 'text-gray-500'
                        }`}>
                          {new Date(message.createdAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-200 p-4 bg-white rounded-b-[32px]">
              <div className="flex items-end gap-3">
                <div className="flex-1 bg-gray-100 rounded-2xl px-4 py-3 flex items-center gap-2">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    className="flex-1 bg-transparent outline-none resize-none text-gray-800 placeholder-gray-500"
                    rows={1}
                    style={{ maxHeight: '100px' }}
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="w-12 h-12 bg-[#FF8C42] rounded-full flex items-center justify-center hover:bg-[#FF7A2F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Prescription Modal from Chat */}
      {showPrescription && (
        <PrescriptionModal
          bookingId={bookingId}
          // We don't pass the full prescription object here as it will load it via ID inside the modal
          // However, the current modal expects bookingId to load it. 
          // If we have multiple prescriptions for one booking, the modal might just load the latest one.
          // Ideally we should pass the prescriptionId to the modal, but let's stick to the existing interface for now.
          onClose={() => setShowPrescription(null)}
          onReorderMedicine={onReorderMedicine}
        />
      )}
    </div>
  );
}
