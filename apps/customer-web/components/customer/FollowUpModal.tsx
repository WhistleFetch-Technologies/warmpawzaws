'use client';

import { useState, useEffect, useRef } from 'react';
import { X, MessageCircle, Calendar, Clock, FileText, Download, Send, CheckCircle, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface FollowUpModalProps {
  onClose: () => void;
  bookings: FollowUpBooking[];
  customerPhone: string;
  onNavigate: (screen: string, data?: any) => void;
}

interface FollowUpBooking {
  id: string;
  bookingId: string;
  vendorName: string;
  vendorId: string;
  vendorPhone: string;
  customerPhone: string;
  customerName: string;
  petName: string;
  serviceName: string;
  serviceType: string;
  completedDate: string;
  daysRemaining: number;
  prescriptionUrl?: string;
  prescriptionNotes?: string;
  hasPrescription?: boolean;
}

export function FollowUpModal({ onClose, bookings, customerPhone, onNavigate }: FollowUpModalProps) {
  const [followUpBookings, setFollowUpBookings] = useState<FollowUpBooking[]>(bookings);
  const [loading, setLoading] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<FollowUpBooking | null>(null);
  const [view, setView] = useState<'list' | 'chat' | 'book-slot'>('list');
  
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [bookingSlot, setBookingSlot] = useState(false);
  
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    setFollowUpBookings(bookings);
    loadUnreadCounts();
  }, [bookings]);

  const loadUnreadCounts = async () => {
    const counts: Record<string, number> = {};
    for (const booking of bookings) {
      try {
        const response = await apiClient.get<{ messages: any[] }>(`/chat/messages/${booking.bookingId}`);
        if (response.messages) {
          const unreadCount = response.messages.filter(
            (m: any) => m.senderType === 'vendor' && !m.read
          ).length;
          counts[booking.bookingId] = unreadCount;
        }
      } catch (error) {
        console.error(`Error loading unread count for ${booking.bookingId}:`, error);
      }
    }
    setUnreadCounts(counts);
  };

  useEffect(() => {
    if (view === 'chat' && selectedBooking) {
      loadMessages();
      const interval = setInterval(loadMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [view, selectedBooking]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    if (!selectedBooking) return;
    
    try {
      const response = await apiClient.get<{ messages: any[] }>(`/chat/messages/${selectedBooking.bookingId}`);
      if (response.messages) {
        setMessages(response.messages);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedBooking) return;

    try {
      setSendingMessage(true);
      const phone = selectedBooking.customerPhone || customerPhone;
      const cleanPhone = phone.replace(/[^0-9]/g, '');

      const response = await apiClient.post<any>('/chat/send', {
        bookingId: selectedBooking.bookingId,
        senderType: 'customer',
        senderPhone: cleanPhone,
        receiverPhone: selectedBooking.vendorPhone,
        message: newMessage,
        messageType: 'text'
      });

      if (response.success || response.messageId) {
        setNewMessage('');
        loadMessages();
      } else {
        alert('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-[430px] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-bold text-lg">Follow-Up</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {view === 'list' && (
            <div className="space-y-3">
              {followUpBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="bg-white border border-gray-200 rounded-xl p-4 hover:border-primary transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">{booking.vendorName}</h3>
                      <p className="text-sm text-gray-600">{booking.serviceName}</p>
                    </div>
                    {unreadCounts[booking.bookingId] > 0 && (
                      <span className="px-2 py-1 bg-primary text-white rounded-full text-xs">
                        {unreadCounts[booking.bookingId]}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => {
                        setSelectedBooking(booking);
                        setView('chat');
                      }}
                      className="flex-1 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium"
                    >
                      <MessageCircle className="w-4 h-4 inline mr-1" />
                      Chat
                    </button>
                    <button
                      onClick={() => {
                        setSelectedBooking(booking);
                        setView('book-slot');
                      }}
                      className="flex-1 px-3 py-2 bg-white border-2 border-primary text-primary rounded-lg text-sm font-medium"
                    >
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Book Slot
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === 'chat' && selectedBooking && (
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.senderType === 'customer' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[70%] p-3 rounded-lg ${
                      msg.senderType === 'customer' 
                        ? 'bg-primary text-white' 
                        : 'bg-gray-100 text-gray-900'
                    }`}>
                      <p className="text-sm">{msg.message}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  className="flex-1 p-3 border border-gray-300 rounded-lg"
                  placeholder="Type a message..."
                />
                <button
                  onClick={sendMessage}
                  disabled={sendingMessage || !newMessage.trim()}
                  className="px-4 py-3 bg-primary text-white rounded-lg disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {view === 'book-slot' && selectedBooking && (
            <div className="space-y-4">
              <p className="text-gray-600">Book a follow-up slot with {selectedBooking.vendorName}</p>
              <div>
                <label className="block text-sm font-medium mb-2">Select Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
              </div>
              {selectedDate && (
                <div>
                  <label className="block text-sm font-medium mb-2">Select Time</label>
                  <div className="grid grid-cols-3 gap-2">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => setSelectedSlot(slot)}
                        className={`p-3 rounded-lg border-2 ${
                          selectedSlot === slot
                            ? 'border-primary bg-orange-50'
                            : 'border-gray-200'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={() => {
                  onNavigate('booking', {
                    vendorId: selectedBooking.vendorId,
                    serviceType: selectedBooking.serviceType,
                    date: selectedDate,
                    time: selectedSlot
                  });
                  onClose();
                }}
                disabled={!selectedDate || !selectedSlot}
                className="w-full py-3 bg-primary text-white rounded-lg font-semibold disabled:opacity-50"
              >
                Book Follow-Up
              </button>
            </div>
          )}
        </div>

        {/* Back Button */}
        {view !== 'list' && (
          <div className="px-6 py-4 border-t border-gray-200">
            <button
              onClick={() => {
                setView('list');
                setSelectedBooking(null);
              }}
              className="w-full py-2 text-primary font-medium"
            >
              Back to List
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

