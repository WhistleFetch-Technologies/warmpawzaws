import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Paperclip, Image as ImageIcon, X, FileText, Download } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface FollowUpChatProps {
  bookingId: string;
  vendorId: string;
  vendorName: string;
  customerPhone: string;
  onBack: () => void;
}

export function FollowUpChat({ bookingId, vendorId, vendorName, customerPhone, onBack }: FollowUpChatProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadChatMessages();
    // Poll for new messages every 5 seconds
    const interval = setInterval(loadChatMessages, 5000);
    return () => clearInterval(interval);
  }, [bookingId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatMessages = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/followup/chat/${bookingId}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Error loading chat messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/followup/chat/${bookingId}/message`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: newMessage,
            senderType: 'customer',
            senderPhone: customerPhone,
            vendorId
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, data.message]);
        setNewMessage('');
        scrollToBottom();
        toast.success('Message sent');
      } else {
        toast.error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white max-w-[430px] mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-[430px] mx-auto flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 px-6 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={onBack}
          className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex-1">
          <h1 className="text-white font-semibold">{vendorName}</h1>
          <p className="text-white/90 text-sm">Follow-up Chat</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 px-4 py-6 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-cyan-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Send className="w-10 h-10 text-cyan-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Start a Conversation</h3>
            <p className="text-sm text-gray-600">
              Ask your vet any follow-up questions about your recent consultation.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.senderType === 'customer' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.senderType === 'customer'
                      ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white'
                      : 'bg-white text-gray-900 shadow-sm'
                  }`}
                >
                  {/* Prescription Message */}
                  {msg.messageType === 'prescription' && msg.prescriptionId ? (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <FileText className={`w-4 h-4 mt-0.5 ${msg.senderType === 'customer' ? 'text-white' : 'text-cyan-600'}`} />
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${msg.senderType === 'customer' ? 'text-white' : 'text-gray-900'}`}>
                            Prescription attached
                          </p>
                          <button
                            onClick={async () => {
                              try {
                                const response = await fetch(
                                  `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/prescription/${msg.prescriptionId}/download`,
                                  {
                                    headers: { Authorization: `Bearer ${publicAnonKey}` }
                                  }
                                );
                                if (response.ok) {
                                  const blob = await response.blob();
                                  const url = window.URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `prescription_${bookingId}.pdf`;
                                  a.click();
                                  toast.success('Prescription downloaded');
                                } else {
                                  toast.error('Failed to download prescription');
                                }
                              } catch (err) {
                                console.error('Download error:', err);
                                toast.error('Failed to download prescription');
                              }
                            }}
                            className={`text-xs underline mt-1 flex items-center gap-1 ${
                              msg.senderType === 'customer' ? 'text-white/90 hover:text-white' : 'text-cyan-600 hover:text-cyan-700'
                            }`}
                          >
                            <Download className="w-3 h-3" />
                            Download PDF
                          </button>
                        </div>
                      </div>
                      {msg.message && msg.message !== 'Prescription has been added to your consultation' && (
                        <p className={`text-sm mt-2 ${msg.senderType === 'customer' ? 'text-white/90' : 'text-gray-700'}`}>
                          {msg.message}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                  )}
                  <p
                    className={`text-xs mt-1 ${
                      msg.senderType === 'customer' ? 'text-white/70' : 'text-gray-500'
                    }`}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 sticky bottom-0">
        <div className="flex items-end gap-2">
          <button className="p-2 hover:bg-gray-100 rounded-full">
            <Paperclip className="w-5 h-5 text-gray-500" />
          </button>
          
          <div className="flex-1 relative">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="w-full px-4 py-3 bg-gray-100 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500 max-h-32"
              rows={1}
              style={{ minHeight: '48px' }}
            />
          </div>

          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || sending}
            className={`p-3 rounded-full ${
              newMessage.trim() && !sending
                ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 hover:shadow-lg'
                : 'bg-gray-200'
            } transition-all`}
          >
            <Send
              className={`w-5 h-5 ${
                newMessage.trim() && !sending ? 'text-white' : 'text-gray-400'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
