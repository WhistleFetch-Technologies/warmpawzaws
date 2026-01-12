'use client';

import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { 
  X, 
  MessageCircle, 
  Calendar,
  Clock,
  FileText,
  Download,
  Send,
  CheckCircle,
  AlertCircle,
  Stethoscope,
  Home,
  Video,
  RefreshCw,
  Paperclip,
  Image as ImageIcon,
  File,
  Film
} from 'lucide-react';

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
  
  // Chat state
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Booking slot state
  const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [bookingSlot, setBookingSlot] = useState(false);
  
  // Unread message counts
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  // Helper function to get base URL (for file downloads)
  const getBaseUrl = (): string => {
    if (typeof window !== 'undefined') {
      const cfg = (window as any).__WARMPAWZ_RUNTIME_CONFIG__ as { apiBaseUrl?: string } | undefined;
      return cfg?.apiBaseUrl || process.env.NEXT_PUBLIC_API_BASE_URL || '';
    }
    return process.env.NEXT_PUBLIC_API_BASE_URL || '';
  };


  useEffect(() => {
    // Update bookings if they change externally
    setFollowUpBookings(bookings);
    
    // Load unread counts for all bookings
    loadUnreadCounts();
  }, [bookings]);

  const loadUnreadCounts = async () => {
    const counts: Record<string, number> = {};
    for (const booking of bookings) {
      try {
        const data = await apiClient.get<{ messages?: any[] }>(`/customer/bookings/${booking.bookingId}/messages/unread`);
        const unreadCount = (data.messages || []).filter(
          (m: any) => m.senderType === 'vendor' && !m.read
        ).length;
        counts[booking.bookingId] = unreadCount;
      } catch (error) {
        console.error(`Error loading unread count for ${booking.bookingId}:`, error);
      }
    }
    setUnreadCounts(counts);
  };

  useEffect(() => {
    if (view === 'chat' && selectedBooking) {
      loadMessages();
      const interval = setInterval(loadMessages, 3000); // Poll every 3 seconds
      return () => clearInterval(interval);
    }
  }, [view, selectedBooking]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    if (!selectedBooking) return;
    
    try {
      const data = await apiClient.get<{ messages?: any[] }>(`/customer/bookings/${selectedBooking.bookingId}/messages`);
      setMessages(data.messages || []);
    } catch (error) {
      console.error('❌ Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedBooking) return;

    try {
      setSendingMessage(true);
      // Use customerPhone from booking if available, otherwise use prop
      const phone = selectedBooking.customerPhone || customerPhone;
      if (!phone) {
        console.error('❌ No customer phone available');
        return;
      }
      const cleanPhone = phone.replace(/[^0-9]/g, '');

      // Get vendor phone with fallback
      const vendorPhone = selectedBooking.vendorPhone || '';
      if (!vendorPhone) {
        console.error('❌ No vendor phone available for booking:', selectedBooking);
        alert('Unable to send message: Vendor contact information not available');
        return;
      }
      const cleanVendorPhone = vendorPhone.replace(/[^0-9]/g, '');

      await apiClient.post('/chat/send', {
        bookingId: selectedBooking.bookingId,
        senderPhone: cleanPhone,
        senderName: selectedBooking.customerName || 'Customer',
        senderType: 'customer',
        receiverPhone: cleanVendorPhone,
        receiverName: selectedBooking.vendorName || 'Vendor',
        receiverType: 'vendor',
        message: newMessage,
        messageType: 'text'
      });
      setNewMessage('');
      await loadMessages();
    } catch (error) {
      console.error('❌ Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedBooking) return;

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('File size must be less than 10MB');
      return;
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/quicktime', 'video/webm',
      'application/pdf'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      alert('Only images (JPG, PNG, GIF, WEBP), videos (MP4, MOV, WEBM), and PDF files are allowed');
      return;
    }

    try {
      setSendingMessage(true);
      // Use customerPhone from booking if available, otherwise use prop
      const phone = selectedBooking.customerPhone || customerPhone;
      const cleanPhone = phone.replace(/[^0-9]/g, '');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('bookingId', selectedBooking.bookingId);
      formData.append('senderPhone', cleanPhone);
      formData.append('senderName', selectedBooking.customerName || 'Customer');
      formData.append('senderType', 'customer');
      formData.append('caption', `Sent a ${file.type.startsWith('image/') ? 'photo' : file.type.startsWith('video/') ? 'video' : 'document'}`);

      // Use fetch for FormData (apiClient handles JSON, but FormData needs special handling)
      const baseUrl = getBaseUrl();
      const response = await fetch(`${baseUrl}/chat/upload-file`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        console.log('✅ File uploaded successfully');
        await loadMessages();
        
        // Send notification about file to vendor (only if vendorPhone exists)
        const vendorPhone = selectedBooking.vendorPhone || '';
        if (vendorPhone) {
          const cleanVendorPhone = vendorPhone.replace(/[^0-9]/g, '');
          await apiClient.post('/chat/send', {
            bookingId: selectedBooking.bookingId,
            senderPhone: cleanPhone,
            senderName: selectedBooking.customerName || 'Customer',
            senderType: 'customer',
            receiverPhone: cleanVendorPhone,
            receiverName: selectedBooking.vendorName,
            receiverType: 'vendor',
            message: `Sent a ${file.type.startsWith('image/') ? 'photo' : file.type.startsWith('video/') ? 'video' : 'document'}`,
            messageType: 'file_notification'
          });
        }
      } else {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        alert(`Failed to upload file: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ Error uploading file:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setSendingMessage(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType?.startsWith('image/')) return ImageIcon;
    if (fileType?.startsWith('video/')) return Film;
    return File;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const loadAvailableSlots = async (date: string) => {
    if (!selectedBooking) return;

    try {
      const data = await apiClient.get<{ slots?: any[] }>(
        `/vendor/${selectedBooking.vendorId}/slots/${date}?serviceStyle=at_center`
      );
      setAvailableSlots(data.slots || []);
    } catch (error) {
      console.error('❌ Error loading slots:', error);
    }
  };

  const bookFollowUpAppointment = async () => {
    if (!selectedBooking || !selectedDate || !selectedSlot) return;

    try {
      setBookingSlot(true);
      // Use customerPhone from booking if available, otherwise use prop
      const phone = selectedBooking.customerPhone || customerPhone;
      const cleanPhone = phone.replace(/[^0-9]/g, '');

      const data = await apiClient.post<{ message?: string }>(
        `/followup/create`,
        {
          originalBookingId: selectedBooking.bookingId,
          customerPhone: cleanPhone,
          vendorId: selectedBooking.vendorId,
          vendorPhone: selectedBooking.vendorPhone,
          serviceId: selectedBooking.id,
          selectedDate: selectedDate,
          selectedTime: selectedSlot,
          petId: 'pet_' + selectedBooking.petName.toLowerCase().replace(/\s/g, '_'),
          address: '',
          serviceStyle: 'at_center'
        }
      );

      alert(`✅ Follow-up appointment booked!\n${data.message || 'Success'}\nDate: ${selectedDate} at ${selectedSlot}`);
      onClose();
    } catch (error) {
      console.error('❌ Error booking follow-up:', error);
      alert('Failed to book appointment. Please try again.');
    } finally {
      setBookingSlot(false);
    }
  };

  const getServiceTypeIcon = (serviceType: string) => {
    const type = serviceType?.toLowerCase();
    if (type?.includes('clinic') || type?.includes('center')) return Stethoscope;
    if (type?.includes('home')) return Home;
    if (type?.includes('tele') || type?.includes('video')) return Video;
    return Stethoscope;
  };

  const getServiceTypeColor = (serviceType: string) => {
    const type = serviceType?.toLowerCase();
    if (type?.includes('clinic') || type?.includes('center')) return 'from-blue-500 to-blue-600';
    if (type?.includes('home')) return 'from-green-500 to-green-600';
    if (type?.includes('tele') || type?.includes('video')) return 'from-purple-500 to-purple-600';
    return 'from-orange-500 to-orange-600';
  };

  // Generate next 7 days for date selection
  const getNext7Days = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      dates.push({
        value: date.toISOString().split('T')[0],
        label: date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
      });
    }
    return dates;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-[430px] p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-[#FF8C42] animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-[430px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-[#FF8C42]" />
            <h2 className="font-semibold text-gray-900">
              {view === 'list' ? 'Follow-up Care' : view === 'chat' ? 'Chat with Vet' : 'Book Follow-up'}
            </h2>
          </div>
          <button
            onClick={() => {
              if (view !== 'list') {
                setView('list');
                setSelectedBooking(null);
              } else {
                onClose();
              }
            }}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {view === 'list' && (
            <>
              {followUpBookings.length === 0 ? (
                <div className="text-center py-12">
                  <RefreshCw className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="font-semibold text-gray-900 mb-2">No Follow-ups Available</h3>
                  <p className="text-sm text-gray-600">
                    Complete a vet consultation to get 7 days of free follow-up care
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-900">
                      💙 <strong>Free Follow-up Care</strong> - Chat with your vet & book clinic visits at zero cost within 7 days!
                    </p>
                  </div>

                  <div className="space-y-3">
                    {followUpBookings.map((booking, index) => {
                      const ServiceIcon = getServiceTypeIcon(booking.serviceType);
                      const gradient = getServiceTypeColor(booking.serviceType);

                      return (
                        <div
                          key={booking.bookingId || booking.id || index}
                          className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-[#FF8C42] transition-colors"
                        >
                          <div className="flex items-start gap-3 mb-3">
                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
                              <ServiceIcon className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900">{booking.petName}</h3>
                              <p className="text-sm text-gray-600">{booking.serviceName}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                Completed: {new Date(booking.completedDate).toLocaleDateString('en-IN')}
                              </p>
                              <div className="flex items-center gap-1 mt-1">
                                <Clock className="w-3 h-3 text-orange-600" />
                                <span className="text-xs text-orange-600 font-medium">
                                  {booking.daysRemaining} days left
                                </span>
                              </div>
                            </div>
                          </div>

                          {booking.hasPrescription && (
                            <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-lg">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-600" />
                                <span className="text-sm text-green-900">Prescription available</span>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => {
                                setSelectedBooking(booking);
                                setView('chat');
                              }}
                              className="relative flex items-center justify-center gap-2 px-3 py-2 bg-[#FF8C42] hover:bg-[#FF7829] text-white rounded-lg text-sm transition-colors"
                            >
                              <MessageCircle className="w-4 h-4" />
                              Chat
                              {unreadCounts[booking.bookingId] > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 font-semibold shadow-lg">
                                  {unreadCounts[booking.bookingId]}
                                </span>
                              )}
                            </button>
                            
                            {(booking.serviceType?.toLowerCase().includes('clinic') || 
                              booking.serviceType?.toLowerCase().includes('center')) && (
                              <button
                                onClick={() => {
                                  setSelectedBooking(booking);
                                  setView('book-slot');
                                }}
                                className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors"
                              >
                                <Calendar className="w-4 h-4" />
                                Book Slot
                              </button>
                            )}

                            {booking.hasPrescription && booking.prescriptionUrl && (
                              <button
                                onClick={() => window.open(booking.prescriptionUrl, '_blank')}
                                className="flex items-center justify-center gap-2 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm transition-colors col-span-2"
                              >
                                <Download className="w-4 h-4" />
                                View Prescription
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {view === 'chat' && selectedBooking && (
            <div className="flex flex-col h-full">
              {/* Vet Info */}
              <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                    <Stethoscope className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{selectedBooking.vendorName}</h3>
                    <p className="text-sm text-gray-600">Veterinarian • {selectedBooking.petName}</p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto mb-4 space-y-3 min-h-[300px] max-h-[400px]">
                {messages.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg, msgIndex) => {
                    const isCustomer = msg.senderType === 'customer';
                    const FileIconComponent = msg.fileType ? getFileIcon(msg.fileType) : File;
                    
                    return (
                      <div key={msg.id || `msg-${msgIndex}`} className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                            isCustomer
                              ? 'bg-[#FF8C42] text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          {/* File attachment display */}
                          {msg.fileId && (
                            <div className="mb-2">
                              <a
                                href={`${getBaseUrl()}/chat/file/${msg.fileId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-2 p-2 rounded-lg ${
                                  isCustomer ? 'bg-white/20' : 'bg-gray-200'
                                }`}
                              >
                                <FileIconComponent className="w-5 h-5" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{msg.fileName || 'File'}</p>
                                  {msg.fileSize && (
                                    <p className={`text-xs ${isCustomer ? 'text-white/70' : 'text-gray-500'}`}>
                                      {formatFileSize(msg.fileSize)}
                                    </p>
                                  )}
                                </div>
                                <Download className="w-4 h-4" />
                              </a>
                            </div>
                          )}
                          
                          {/* Text message */}
                          <p className="text-sm">{msg.message}</p>
                          
                          {/* Timestamp */}
                          <p className={`text-xs mt-1 ${isCustomer ? 'text-white/70' : 'text-gray-500'}`}>
                            {new Date(msg.timestamp).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Ask about your pet's health..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sendingMessage}
                  className="px-4 py-2 bg-[#FF8C42] hover:bg-[#FF7829] text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
                <label
                  htmlFor="file-upload"
                  className="px-4 py-2 bg-[#FF8C42] hover:bg-[#FF7829] text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Paperclip className="w-5 h-5" />
                </label>
                <input
                  type="file"
                  id="file-upload"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {view === 'book-slot' && selectedBooking && (
            <div className="space-y-4">
              {/* Info Banner */}
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-green-900">100% FREE Follow-up Visit</p>
                    <p className="text-xs text-green-700 mt-1">
                      Book a clinic visit for {selectedBooking.petName} at zero cost
                    </p>
                  </div>
                </div>
              </div>

              {/* Date Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
                <div className="grid grid-cols-3 gap-2">
                  {getNext7Days().map((date) => (
                    <button
                      key={date.value}
                      onClick={() => {
                        setSelectedDate(date.value);
                        setSelectedSlot('');
                        loadAvailableSlots(date.value);
                      }}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedDate === date.value
                          ? 'bg-[#FF8C42] text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {date.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Slot Selection */}
              {selectedDate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Time</label>
                  {availableSlots.length === 0 ? (
                    <div className="text-center py-6 bg-gray-50 rounded-lg">
                      <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">No slots available for this date</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto">
                      {availableSlots
                        .filter((slot) => slot.available)
                        .map((slot) => (
                          <button
                            key={slot.time}
                            onClick={() => setSelectedSlot(slot.time)}
                            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                              selectedSlot === slot.time
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {slot.time}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* Booking Confirmation */}
              {selectedDate && selectedSlot && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2">Confirm Booking</h3>
                  <div className="space-y-1 text-sm text-gray-700">
                    <p><strong>Pet:</strong> {selectedBooking.petName}</p>
                    <p><strong>Clinic:</strong> {selectedBooking.vendorName}</p>
                    <p><strong>Date:</strong> {new Date(selectedDate).toLocaleDateString('en-IN')}</p>
                    <p><strong>Time:</strong> {selectedSlot}</p>
                    <p><strong>Cost:</strong> <span className="text-green-600 font-semibold">FREE</span></p>
                  </div>
                </div>
              )}

              {/* Book Button */}
              <Button
                onClick={bookFollowUpAppointment}
                disabled={!selectedDate || !selectedSlot || bookingSlot}
                className="w-full bg-[#FF8C42] hover:bg-[#FF7829] text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bookingSlot ? 'Booking...' : 'Confirm Free Follow-up'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}